#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Advanced Logging Configuration
Recipe-DevAPI Agent

This module provides comprehensive logging setup with structured logging,
multiple output formats, and integration with error tracking systems.
"""

import logging
import logging.handlers
import json
import sys
import os
from pathlib import Path
from typing import Dict, Any, Optional, Union
from datetime import datetime
import structlog
import traceback


class JSONFormatter(logging.Formatter):
    """
    JSON formatter for structured logging
    """
    
    def __init__(self, include_extra: bool = True):
        """
        Initialize JSON formatter
        
        Args:
            include_extra: Whether to include extra fields from LogRecord
        """
        super().__init__()
        self.include_extra = include_extra
    
    def format(self, record: logging.LogRecord) -> str:
        """Format log record as JSON"""
        # Base log entry
        log_entry = {
            'timestamp': datetime.fromtimestamp(record.created).isoformat(),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno,
        }
        
        # Add process/thread info
        if record.process:
            log_entry['process_id'] = record.process
        if record.thread:
            log_entry['thread_id'] = record.thread
        
        # Add exception info if present
        if record.exc_info:
            log_entry['exception'] = {
                'type': record.exc_info[0].__name__ if record.exc_info[0] else None,
                'message': str(record.exc_info[1]) if record.exc_info[1] else None,
                'traceback': traceback.format_exception(*record.exc_info)
            }
        
        # Add extra fields if requested
        if self.include_extra:
            # Get all extra fields (excluding standard LogRecord attributes)
            standard_attrs = {
                'name', 'msg', 'args', 'levelname', 'levelno', 'pathname', 'filename',
                'module', 'lineno', 'funcName', 'created', 'msecs', 'relativeCreated',
                'thread', 'threadName', 'processName', 'process', 'message', 'exc_info',
                'exc_text', 'stack_info'
            }
            
            extra_fields = {}
            for key, value in record.__dict__.items():
                if key not in standard_attrs:
                    # Try to make the value JSON serializable
                    try:
                        json.dumps(value)
                        extra_fields[key] = value
                    except (TypeError, ValueError):
                        extra_fields[key] = str(value)
            
            if extra_fields:
                log_entry['extra'] = extra_fields
        
        try:
            return json.dumps(log_entry, default=str, ensure_ascii=False)
        except (TypeError, ValueError) as e:
            # Fallback to string representation if JSON serialization fails
            return f'{{"timestamp": "{datetime.now().isoformat()}", "level": "ERROR", "message": "JSON serialization failed: {e}", "original_message": "{record.getMessage()}"}}'


class ColoredConsoleFormatter(logging.Formatter):
    """
    Colored console formatter for better readability
    """
    
    # ANSI color codes
    COLORS = {
        'DEBUG': '\033[36m',      # Cyan
        'INFO': '\033[32m',       # Green
        'WARNING': '\033[33m',    # Yellow
        'ERROR': '\033[31m',      # Red
        'CRITICAL': '\033[35m',   # Magenta
        'RESET': '\033[0m'        # Reset
    }
    
    def __init__(self, use_colors: bool = True):
        """
        Initialize colored formatter
        
        Args:
            use_colors: Whether to use colors (set to False for non-terminal output)
        """
        super().__init__()
        self.use_colors = use_colors and sys.stderr.isatty()
        
        # Format template
        self.format_template = (
            "{timestamp} | {level} | {name} | {message}"
        )
    
    def format(self, record: logging.LogRecord) -> str:
        """Format log record with colors"""
        timestamp = datetime.fromtimestamp(record.created).strftime('%H:%M:%S')
        
        # Apply colors if enabled
        if self.use_colors:
            color = self.COLORS.get(record.levelname, self.COLORS['RESET'])
            reset = self.COLORS['RESET']
            level = f"{color}{record.levelname:8}{reset}"
        else:
            level = f"{record.levelname:8}"
        
        # Format message
        try:
            message = record.getMessage()
        except Exception:
            message = str(record.msg)
        
        # Format base log line
        log_line = self.format_template.format(
            timestamp=timestamp,
            level=level,
            name=record.name,
            message=message
        )
        
        # Add exception info if present
        if record.exc_info and record.exc_info[0] is not None:
            log_line += '\n' + ''.join(traceback.format_exception(*record.exc_info))
        
        return log_line


class APIContextFilter(logging.Filter):
    """
    Filter to add API context to log records
    """
    
    def __init__(self):
        super().__init__()
        self._context = {}
    
    def set_context(self, **kwargs):
        """Set logging context"""
        self._context.update(kwargs)
    
    def clear_context(self):
        """Clear logging context"""
        self._context.clear()
    
    def filter(self, record: logging.LogRecord) -> bool:
        """Add context to log record"""
        for key, value in self._context.items():
            setattr(record, key, value)
        return True


def setup_logging(
    log_level: Union[str, int] = logging.INFO,
    log_dir: Optional[Path] = None,
    app_name: str = "recipe-devapi",
    console_output: bool = True,
    json_output: bool = True,
    file_output: bool = True,
    max_file_size: int = 10 * 1024 * 1024,  # 10MB
    backup_count: int = 5,
    structured_logging: bool = True
) -> Dict[str, Any]:
    """
    Set up comprehensive logging configuration
    
    Args:
        log_level: Minimum log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_dir: Directory for log files (None to disable file logging)
        app_name: Application name for log files
        console_output: Enable console output
        json_output: Enable JSON formatting for file output
        file_output: Enable file output
        max_file_size: Maximum size for log files before rotation
        backup_count: Number of backup files to keep
        structured_logging: Enable structlog for structured logging
        
    Returns:
        Dictionary containing logging configuration info
    """
    
    # Convert string log level to int
    if isinstance(log_level, str):
        log_level = getattr(logging, log_level.upper())
    
    # Create log directory if specified
    if log_dir and file_output:
        log_dir = Path(log_dir)
        log_dir.mkdir(parents=True, exist_ok=True)
    
    # Remove existing handlers to start fresh
    root_logger = logging.getLogger()
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # Set root logger level
    root_logger.setLevel(log_level)
    
    handlers = []
    
    # Console handler
    if console_output:
        console_handler = logging.StreamHandler(sys.stderr)
        console_handler.setLevel(log_level)
        console_handler.setFormatter(ColoredConsoleFormatter())
        root_logger.addHandler(console_handler)
        handlers.append('console')
    
    # File handlers
    if file_output and log_dir:
        # General application log
        app_log_file = log_dir / f"{app_name}.log"
        app_handler = logging.handlers.RotatingFileHandler(
            app_log_file,
            maxBytes=max_file_size,
            backupCount=backup_count,
            encoding='utf-8'
        )
        app_handler.setLevel(log_level)
        
        if json_output:
            app_handler.setFormatter(JSONFormatter())
        else:
            app_handler.setFormatter(logging.Formatter(
                '%(asctime)s | %(levelname)-8s | %(name)s | %(message)s'
            ))
        
        root_logger.addHandler(app_handler)
        handlers.append('file')
        
        # Error-only log
        error_log_file = log_dir / f"{app_name}-errors.log"
        error_handler = logging.handlers.RotatingFileHandler(
            error_log_file,
            maxBytes=max_file_size,
            backupCount=backup_count,
            encoding='utf-8'
        )
        error_handler.setLevel(logging.ERROR)
        error_handler.setFormatter(JSONFormatter())
        root_logger.addHandler(error_handler)
        handlers.append('error_file')
        
        # API-specific logs
        for api_name in ['youtube', 'claude', 'notion', 'gmail']:
            api_log_file = log_dir / f"{app_name}-{api_name}.log"
            api_handler = logging.handlers.RotatingFileHandler(
                api_log_file,
                maxBytes=max_file_size // 2,  # Smaller files for API logs
                backupCount=3,
                encoding='utf-8'
            )
            api_handler.setLevel(log_level)
            api_handler.setFormatter(JSONFormatter())
            
            # Add filter to only log messages from this API
            api_filter = logging.Filter(name=f'services.{api_name}')
            api_handler.addFilter(api_filter)
            
            root_logger.addHandler(api_handler)
            handlers.append(f'{api_name}_api')
    
    # Set up structured logging with structlog
    if structured_logging:
        structlog.configure(
            processors=[
                structlog.contextvars.merge_contextvars,
                structlog.processors.TimeStamper(fmt="ISO"),
                structlog.processors.add_log_level,
                structlog.processors.StackInfoRenderer(),
                structlog.dev.ConsoleRenderer() if console_output else structlog.processors.JSONRenderer()
            ],
            wrapper_class=structlog.make_filtering_bound_logger(log_level),
            logger_factory=structlog.WriteLoggerFactory(),
            cache_logger_on_first_use=True,
        )
    
    # Configure specific loggers
    logger_configs = {
        'httpx': logging.WARNING,  # Reduce HTTP client noise
        'urllib3': logging.WARNING,
        'google.auth': logging.INFO,
        'googleapiclient': logging.INFO,
        'anthropic': logging.INFO,
        'notion_client': logging.INFO,
    }
    
    for logger_name, level in logger_configs.items():
        logging.getLogger(logger_name).setLevel(level)
    
    # Create API context filter
    context_filter = APIContextFilter()
    
    # Log configuration summary
    config_info = {
        'log_level': logging.getLevelName(log_level),
        'handlers': handlers,
        'log_dir': str(log_dir) if log_dir else None,
        'structured_logging': structured_logging,
        'context_filter': context_filter
    }
    
    logger = logging.getLogger(__name__)
    logger.info(f"Logging configured: {config_info}")
    
    return config_info


def get_api_logger(api_name: str) -> logging.Logger:
    """
    Get a logger specifically for an API service
    
    Args:
        api_name: Name of the API (youtube, claude, notion, gmail)
        
    Returns:
        Logger instance configured for the API
    """
    logger_name = f"services.{api_name}"
    logger = logging.getLogger(logger_name)
    
    # Add API name as default context
    if hasattr(logger, 'bind'):  # structlog logger
        logger = logger.bind(api=api_name)
    
    return logger


def get_structured_logger(name: str) -> Any:
    """
    Get a structured logger using structlog
    
    Args:
        name: Logger name
        
    Returns:
        Structured logger instance
    """
    return structlog.get_logger(name)


class LoggingContext:
    """
    Context manager for adding structured context to logs
    """
    
    def __init__(self, context_filter: APIContextFilter, **context):
        """
        Initialize logging context
        
        Args:
            context_filter: APIContextFilter instance
            **context: Context key-value pairs
        """
        self.context_filter = context_filter
        self.context = context
        self.previous_context = {}
    
    def __enter__(self):
        """Enter context - save current context and set new one"""
        # Save current context
        self.previous_context = self.context_filter._context.copy()
        
        # Set new context
        self.context_filter.set_context(**self.context)
        
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Exit context - restore previous context"""
        self.context_filter.clear_context()
        self.context_filter.set_context(**self.previous_context)


def log_api_call(logger: logging.Logger, api_name: str, operation: str, duration: float, success: bool, **kwargs):
    """
    Log an API call with structured information
    
    Args:
        logger: Logger instance
        api_name: Name of the API
        operation: Operation performed
        duration: Call duration in seconds
        success: Whether the call was successful
        **kwargs: Additional context
    """
    log_data = {
        'api_name': api_name,
        'operation': operation,
        'duration_ms': round(duration * 1000, 2),
        'success': success,
        **kwargs
    }
    
    if success:
        logger.info(f"API call succeeded: {api_name}.{operation}", extra=log_data)
    else:
        logger.error(f"API call failed: {api_name}.{operation}", extra=log_data)


# Example usage and testing
def example_usage():
    """Example usage of the logging system"""
    
    # Set up logging
    log_config = setup_logging(
        log_level='INFO',
        log_dir=Path('./logs'),
        console_output=True,
        json_output=True
    )
    
    print(f"Logging configured: {log_config}")
    
    # Get API-specific loggers
    youtube_logger = get_api_logger('youtube')
    claude_logger = get_api_logger('claude')
    
    # Test logging
    youtube_logger.info("Testing YouTube API logger")
    claude_logger.warning("Testing Claude API logger with warning")
    
    # Test structured logger
    struct_logger = get_structured_logger('test')
    struct_logger.info("Structured log message", user_id="123", action="test")
    
    # Test API call logging
    import time
    start_time = time.time()
    time.sleep(0.1)  # Simulate API call
    duration = time.time() - start_time
    
    log_api_call(
        youtube_logger,
        'youtube',
        'search_videos',
        duration,
        True,
        query='recipe',
        results_count=50
    )
    
    # Test error logging
    try:
        raise ValueError("Test error for logging")
    except Exception:
        claude_logger.exception("Error occurred during test")


if __name__ == "__main__":
    example_usage()