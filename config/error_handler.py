#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Comprehensive Error Handler
Recipe-DevAPI Agent

This module provides centralized error handling, retry logic, and 
error reporting for all API integrations.
"""

import asyncio
import logging
import traceback
import time
from typing import Dict, List, Optional, Any, Callable, Type, Union, Awaitable
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict
import json
from pathlib import Path
import smtplib
from email.mime.text import MimeText
from email.mime.multipart import MimeMultipart


class ErrorSeverity(Enum):
    """Error severity levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ErrorCategory(Enum):
    """Error categories"""
    AUTHENTICATION = "authentication"
    RATE_LIMIT = "rate_limit"
    NETWORK = "network"
    QUOTA_EXCEEDED = "quota_exceeded"
    INVALID_REQUEST = "invalid_request"
    SERVER_ERROR = "server_error"
    TIMEOUT = "timeout"
    CONFIGURATION = "configuration"
    DATA_VALIDATION = "data_validation"
    UNKNOWN = "unknown"


@dataclass
class ErrorContext:
    """Error context information"""
    api_name: str
    operation: str
    timestamp: float
    request_id: Optional[str] = None
    user_id: Optional[str] = None
    additional_data: Dict[str, Any] = field(default_factory=dict)


@dataclass  
class ErrorRecord:
    """Complete error record"""
    error_id: str
    api_name: str
    operation: str
    category: ErrorCategory
    severity: ErrorSeverity
    message: str
    exception_type: str
    traceback_str: str
    timestamp: float
    context: ErrorContext
    retry_count: int = 0
    resolved: bool = False
    resolution_notes: Optional[str] = None


class RetryStrategy:
    """Retry strategy configuration"""
    
    def __init__(
        self,
        max_attempts: int = 3,
        base_delay: float = 1.0,
        max_delay: float = 60.0,
        exponential_base: float = 2.0,
        jitter: bool = True
    ):
        self.max_attempts = max_attempts
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.exponential_base = exponential_base
        self.jitter = jitter
    
    def calculate_delay(self, attempt: int) -> float:
        """Calculate delay for retry attempt"""
        if attempt <= 0:
            return 0.0
        
        # Exponential backoff
        delay = self.base_delay * (self.exponential_base ** (attempt - 1))
        delay = min(delay, self.max_delay)
        
        # Add jitter to prevent thundering herd
        if self.jitter:
            import random
            delay *= (0.5 + random.random() * 0.5)
        
        return delay


class APIErrorHandler:
    """
    Comprehensive error handler for all API integrations
    
    Features:
    - Intelligent error categorization
    - Configurable retry strategies
    - Error tracking and reporting
    - Automatic escalation
    - Integration with notification systems
    """
    
    def __init__(self, config_dir: Path, enable_notifications: bool = True):
        """
        Initialize error handler
        
        Args:
            config_dir: Configuration directory path
            enable_notifications: Whether to enable error notifications
        """
        self.config_dir = config_dir
        self.enable_notifications = enable_notifications
        self.logger = logging.getLogger(__name__)
        
        # Error tracking
        self.error_records: List[ErrorRecord] = []
        self.error_counts: Dict[str, Dict[ErrorCategory, int]] = defaultdict(lambda: defaultdict(int))
        self.last_errors: Dict[str, float] = {}  # API -> last error timestamp
        
        # Retry strategies by API
        self.retry_strategies: Dict[str, RetryStrategy] = {
            'youtube': RetryStrategy(max_attempts=3, base_delay=1.0, max_delay=30.0),
            'claude': RetryStrategy(max_attempts=5, base_delay=2.0, max_delay=60.0),
            'notion': RetryStrategy(max_attempts=4, base_delay=1.5, max_delay=45.0),
            'gmail': RetryStrategy(max_attempts=2, base_delay=3.0, max_delay=30.0)
        }
        
        # Error thresholds for escalation
        self.escalation_thresholds = {
            ErrorSeverity.CRITICAL: 1,    # Immediate escalation
            ErrorSeverity.HIGH: 3,        # 3 errors within 1 hour
            ErrorSeverity.MEDIUM: 10,     # 10 errors within 1 hour
            ErrorSeverity.LOW: 50         # 50 errors within 1 hour
        }
        
        # Error log file
        self.error_log_file = config_dir / "error_log.jsonl"
        self.config_dir.mkdir(parents=True, exist_ok=True)
        
        self.logger.info("APIErrorHandler initialized")
    
    def categorize_error(self, exception: Exception, api_name: str) -> ErrorCategory:
        """
        Categorize an error based on exception type and context
        
        Args:
            exception: The exception that occurred
            api_name: Name of the API where error occurred
            
        Returns:
            ErrorCategory: Categorized error type
        """
        exception_type = type(exception).__name__
        error_message = str(exception).lower()
        
        # Check for authentication errors
        if any(keyword in error_message for keyword in [
            'unauthorized', 'authentication', 'invalid token', 'access denied',
            'forbidden', '401', '403'
        ]):
            return ErrorCategory.AUTHENTICATION
        
        # Check for rate limiting
        if any(keyword in error_message for keyword in [
            'rate limit', 'too many requests', '429', 'quota exceeded',
            'throttled', 'rate exceeded'
        ]):
            return ErrorCategory.RATE_LIMIT if 'rate' in error_message else ErrorCategory.QUOTA_EXCEEDED
        
        # Check for network errors
        if any(keyword in error_message for keyword in [
            'connection', 'network', 'timeout', 'dns', 'unreachable',
            'connection reset', 'connection refused'
        ]) or exception_type in ['ConnectionError', 'TimeoutError', 'DNSError']:
            return ErrorCategory.NETWORK if 'timeout' not in error_message else ErrorCategory.TIMEOUT
        
        # Check for server errors
        if any(keyword in error_message for keyword in [
            '500', '502', '503', '504', 'internal server error',
            'bad gateway', 'service unavailable', 'gateway timeout'
        ]):
            return ErrorCategory.SERVER_ERROR
        
        # Check for validation errors
        if any(keyword in error_message for keyword in [
            'validation', 'invalid', 'bad request', '400',
            'malformed', 'schema'
        ]):
            return ErrorCategory.DATA_VALIDATION if 'validation' in error_message else ErrorCategory.INVALID_REQUEST
        
        # Check for configuration errors
        if any(keyword in error_message for keyword in [
            'configuration', 'config', 'missing', 'not found',
            'environment', 'setup'
        ]):
            return ErrorCategory.CONFIGURATION
        
        return ErrorCategory.UNKNOWN
    
    def determine_severity(
        self, 
        category: ErrorCategory, 
        api_name: str,
        context: ErrorContext
    ) -> ErrorSeverity:
        """
        Determine error severity based on category and context
        
        Args:
            category: Error category
            api_name: Name of the API
            context: Error context
            
        Returns:
            ErrorSeverity: Determined severity level
        """
        # Critical errors that require immediate attention
        if category in [ErrorCategory.AUTHENTICATION, ErrorCategory.CONFIGURATION]:
            return ErrorSeverity.CRITICAL
        
        # High severity errors
        if category in [ErrorCategory.QUOTA_EXCEEDED, ErrorCategory.SERVER_ERROR]:
            return ErrorSeverity.HIGH
        
        # Medium severity errors
        if category in [ErrorCategory.RATE_LIMIT, ErrorCategory.TIMEOUT]:
            return ErrorSeverity.MEDIUM
        
        # Check recent error frequency for escalation
        recent_errors = self._get_recent_error_count(api_name, time_window=3600)  # 1 hour
        
        if recent_errors > 20:
            return ErrorSeverity.HIGH
        elif recent_errors > 10:
            return ErrorSeverity.MEDIUM
        
        return ErrorSeverity.LOW
    
    def should_retry(
        self, 
        category: ErrorCategory, 
        severity: ErrorSeverity,
        attempt_count: int,
        api_name: str
    ) -> bool:
        """
        Determine if an error should trigger a retry
        
        Args:
            category: Error category
            severity: Error severity
            attempt_count: Current attempt count
            api_name: Name of the API
            
        Returns:
            bool: True if should retry
        """
        strategy = self.retry_strategies.get(api_name)
        if not strategy or attempt_count >= strategy.max_attempts:
            return False
        
        # Don't retry certain error categories
        if category in [
            ErrorCategory.AUTHENTICATION,
            ErrorCategory.CONFIGURATION,
            ErrorCategory.DATA_VALIDATION,
            ErrorCategory.INVALID_REQUEST
        ]:
            return False
        
        # Don't retry critical errors unless it's the first attempt
        if severity == ErrorSeverity.CRITICAL and attempt_count > 1:
            return False
        
        return True
    
    async def handle_error(
        self,
        exception: Exception,
        api_name: str,
        operation: str,
        context: Optional[ErrorContext] = None,
        attempt_count: int = 0
    ) -> ErrorRecord:
        """
        Handle an error with full processing pipeline
        
        Args:
            exception: The exception that occurred
            api_name: Name of the API
            operation: Operation that failed
            context: Additional error context
            attempt_count: Current retry attempt count
            
        Returns:
            ErrorRecord: Complete error record
        """
        # Create error context if not provided
        if context is None:
            context = ErrorContext(
                api_name=api_name,
                operation=operation,
                timestamp=time.time()
            )
        
        # Categorize and analyze error
        category = self.categorize_error(exception, api_name)
        severity = self.determine_severity(category, api_name, context)
        
        # Create error record
        error_record = ErrorRecord(
            error_id=self._generate_error_id(),
            api_name=api_name,
            operation=operation,
            category=category,
            severity=severity,
            message=str(exception),
            exception_type=type(exception).__name__,
            traceback_str=traceback.format_exc(),
            timestamp=context.timestamp,
            context=context,
            retry_count=attempt_count
        )
        
        # Store error record
        self.error_records.append(error_record)
        self.error_counts[api_name][category] += 1
        self.last_errors[api_name] = context.timestamp
        
        # Log error
        self._log_error(error_record)
        
        # Save to persistent storage
        await self._save_error_record(error_record)
        
        # Check for escalation
        if await self._should_escalate(error_record):
            await self._escalate_error(error_record)
        
        # Send notification if enabled
        if self.enable_notifications and severity in [ErrorSeverity.CRITICAL, ErrorSeverity.HIGH]:
            asyncio.create_task(self._send_error_notification(error_record))
        
        return error_record
    
    async def retry_with_backoff(
        self,
        func: Callable[..., Awaitable[Any]],
        api_name: str,
        operation: str,
        *args,
        context: Optional[ErrorContext] = None,
        **kwargs
    ) -> Any:
        """
        Execute function with automatic retry and backoff
        
        Args:
            func: Async function to execute
            api_name: Name of the API
            operation: Operation name
            *args: Function arguments
            context: Error context
            **kwargs: Function keyword arguments
            
        Returns:
            Function result
            
        Raises:
            Last exception if all retries failed
        """
        strategy = self.retry_strategies.get(api_name, RetryStrategy())
        last_exception = None
        
        for attempt in range(strategy.max_attempts):
            try:
                result = await func(*args, **kwargs)
                
                # Log successful retry
                if attempt > 0:
                    self.logger.info(
                        f"Operation succeeded after {attempt} retries: "
                        f"{api_name}.{operation}"
                    )
                
                return result
                
            except Exception as e:
                last_exception = e
                
                # Handle the error
                error_record = await self.handle_error(
                    e, api_name, operation, context, attempt
                )
                
                # Check if we should retry
                if not self.should_retry(
                    error_record.category,
                    error_record.severity,
                    attempt + 1,
                    api_name
                ):
                    self.logger.error(
                        f"Not retrying {api_name}.{operation} after {attempt + 1} attempts: "
                        f"{error_record.category.value}"
                    )
                    break
                
                # Calculate delay and wait
                if attempt < strategy.max_attempts - 1:
                    delay = strategy.calculate_delay(attempt + 1)
                    self.logger.info(
                        f"Retrying {api_name}.{operation} in {delay:.1f}s "
                        f"(attempt {attempt + 2}/{strategy.max_attempts})"
                    )
                    await asyncio.sleep(delay)
        
        # All retries failed
        if last_exception:
            raise last_exception
    
    def _generate_error_id(self) -> str:
        """Generate unique error ID"""
        import uuid
        return f"err_{int(time.time())}_{str(uuid.uuid4())[:8]}"
    
    def _get_recent_error_count(self, api_name: str, time_window: float = 3600) -> int:
        """Get count of recent errors for an API"""
        cutoff_time = time.time() - time_window
        return sum(
            1 for record in self.error_records
            if record.api_name == api_name and record.timestamp > cutoff_time
        )
    
    def _log_error(self, error_record: ErrorRecord) -> None:
        """Log error record"""
        severity_emoji = {
            ErrorSeverity.LOW: "💙",
            ErrorSeverity.MEDIUM: "💛",
            ErrorSeverity.HIGH: "🧡",
            ErrorSeverity.CRITICAL: "❤️"
        }
        
        emoji = severity_emoji.get(error_record.severity, "⚠️")
        
        log_message = (
            f"{emoji} {error_record.severity.value.upper()} ERROR "
            f"[{error_record.api_name}.{error_record.operation}] "
            f"{error_record.category.value}: {error_record.message}"
        )
        
        if error_record.severity in [ErrorSeverity.CRITICAL, ErrorSeverity.HIGH]:
            self.logger.error(log_message)
        elif error_record.severity == ErrorSeverity.MEDIUM:
            self.logger.warning(log_message)
        else:
            self.logger.info(log_message)
    
    async def _save_error_record(self, error_record: ErrorRecord) -> None:
        """Save error record to persistent storage"""
        try:
            record_data = {
                'error_id': error_record.error_id,
                'api_name': error_record.api_name,
                'operation': error_record.operation,
                'category': error_record.category.value,
                'severity': error_record.severity.value,
                'message': error_record.message,
                'exception_type': error_record.exception_type,
                'timestamp': error_record.timestamp,
                'retry_count': error_record.retry_count,
                'context': {
                    'request_id': error_record.context.request_id,
                    'user_id': error_record.context.user_id,
                    'additional_data': error_record.context.additional_data
                }
            }
            
            # Append to JSONL file
            with open(self.error_log_file, 'a', encoding='utf-8') as f:
                f.write(json.dumps(record_data) + '\n')
                
        except Exception as e:
            self.logger.error(f"Failed to save error record: {e}")
    
    async def _should_escalate(self, error_record: ErrorRecord) -> bool:
        """Check if error should be escalated"""
        threshold = self.escalation_thresholds.get(error_record.severity, 999)
        
        # Count recent errors of same severity for the API
        recent_count = sum(
            1 for record in self.error_records
            if (record.api_name == error_record.api_name and
                record.severity == error_record.severity and
                record.timestamp > time.time() - 3600)  # Last hour
        )
        
        return recent_count >= threshold
    
    async def _escalate_error(self, error_record: ErrorRecord) -> None:
        """Escalate error to administrators"""
        self.logger.critical(
            f"ESCALATING ERROR {error_record.error_id}: "
            f"{error_record.api_name}.{error_record.operation} "
            f"({error_record.severity.value})"
        )
        
        # Here you could integrate with external systems:
        # - Slack/Discord webhooks
        # - PagerDuty
        # - Email alerts
        # - SMS notifications
    
    async def _send_error_notification(self, error_record: ErrorRecord) -> None:
        """Send error notification"""
        if not self.enable_notifications:
            return
        
        try:
            # This is a placeholder for notification logic
            # You could integrate with various notification services
            notification_message = (
                f"🚨 API Error Alert 🚨\n"
                f"API: {error_record.api_name}\n"
                f"Operation: {error_record.operation}\n"
                f"Severity: {error_record.severity.value}\n"
                f"Category: {error_record.category.value}\n"
                f"Message: {error_record.message}\n"
                f"Time: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(error_record.timestamp))}"
            )
            
            # Log notification (replace with actual notification service)
            self.logger.info(f"Notification sent: {notification_message}")
            
        except Exception as e:
            self.logger.error(f"Failed to send error notification: {e}")
    
    def get_error_statistics(self, time_window: Optional[float] = None) -> Dict[str, Any]:
        """
        Get error statistics
        
        Args:
            time_window: Time window in seconds (None for all time)
            
        Returns:
            Dictionary containing error statistics
        """
        if time_window:
            cutoff_time = time.time() - time_window
            records = [r for r in self.error_records if r.timestamp > cutoff_time]
        else:
            records = self.error_records
        
        if not records:
            return {'total_errors': 0}
        
        # Calculate statistics
        stats = {
            'total_errors': len(records),
            'by_api': defaultdict(int),
            'by_category': defaultdict(int),
            'by_severity': defaultdict(int),
            'error_rate_by_hour': defaultdict(int),
            'most_common_operations': defaultdict(int),
            'average_retry_count': 0,
            'resolution_rate': 0
        }
        
        total_retries = 0
        resolved_count = 0
        
        for record in records:
            stats['by_api'][record.api_name] += 1
            stats['by_category'][record.category.value] += 1
            stats['by_severity'][record.severity.value] += 1
            stats['most_common_operations'][f"{record.api_name}.{record.operation}"] += 1
            
            # Hour bucket for error rate
            hour_bucket = int(record.timestamp // 3600)
            stats['error_rate_by_hour'][hour_bucket] += 1
            
            total_retries += record.retry_count
            if record.resolved:
                resolved_count += 1
        
        stats['average_retry_count'] = total_retries / len(records) if records else 0
        stats['resolution_rate'] = resolved_count / len(records) if records else 0
        
        # Convert defaultdicts to regular dicts
        for key in ['by_api', 'by_category', 'by_severity', 'error_rate_by_hour', 'most_common_operations']:
            stats[key] = dict(stats[key])
        
        return stats
    
    def clear_old_errors(self, max_age_seconds: float = 86400 * 7) -> int:
        """
        Clear old error records
        
        Args:
            max_age_seconds: Maximum age in seconds (default: 7 days)
            
        Returns:
            Number of records cleared
        """
        cutoff_time = time.time() - max_age_seconds
        initial_count = len(self.error_records)
        
        self.error_records = [
            record for record in self.error_records 
            if record.timestamp > cutoff_time
        ]
        
        cleared_count = initial_count - len(self.error_records)
        
        if cleared_count > 0:
            self.logger.info(f"Cleared {cleared_count} old error records")
        
        return cleared_count


# Decorator for automatic error handling
def handle_api_errors(
    error_handler: APIErrorHandler,
    api_name: str,
    operation: str,
    with_retry: bool = True
):
    """
    Decorator for automatic error handling and retry
    
    Args:
        error_handler: APIErrorHandler instance
        api_name: Name of the API
        operation: Operation name  
        with_retry: Whether to enable automatic retry
    """
    def decorator(func: Callable[..., Awaitable[Any]]) -> Callable[..., Awaitable[Any]]:
        async def wrapper(*args, **kwargs) -> Any:
            context = ErrorContext(
                api_name=api_name,
                operation=operation,
                timestamp=time.time(),
                additional_data=kwargs.get('_error_context', {})
            )
            
            if with_retry:
                return await error_handler.retry_with_backoff(
                    func, api_name, operation, *args, context=context, **kwargs
                )
            else:
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    await error_handler.handle_error(e, api_name, operation, context)
                    raise
        
        return wrapper
    return decorator


# Example usage
async def example_usage():
    """Example usage of the error handler"""
    from pathlib import Path
    
    error_handler = APIErrorHandler(Path("./config"))
    
    # Simulate an API error
    try:
        raise ValueError("Test error for demonstration")
    except Exception as e:
        record = await error_handler.handle_error(
            e, "youtube", "search_videos"
        )
        print(f"Handled error: {record.error_id}")
    
    # Get statistics
    stats = error_handler.get_error_statistics()
    print(f"Error statistics: {stats}")
    
    # Example with retry decorator
    @handle_api_errors(error_handler, "test_api", "test_operation")
    async def test_function():
        # This would normally be your API call
        print("Test function executed successfully")
        return "success"
    
    result = await test_function()
    print(f"Function result: {result}")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(example_usage())