#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Notification Manager
Recipe-DevAPI Agent

This module provides centralized notification management across all services,
including batching, prioritization, and multi-channel delivery.
"""

import asyncio
import logging
from typing import Dict, List, Optional, Any, Callable, Union
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
import json
import time

from .gmail_service import GmailService, EmailRecipient, NotificationType, EmailMessage
from config.error_handler import APIErrorHandler
from config.logger_config import get_api_logger


class Priority(Enum):
    """Notification priority levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class NotificationChannel(Enum):
    """Available notification channels"""
    EMAIL = "email"
    WEBHOOK = "webhook"
    CONSOLE = "console"


@dataclass
class NotificationPayload:
    """Notification payload data"""
    notification_id: str
    type: str
    priority: Priority
    title: str
    message: str
    data: Dict[str, Any] = field(default_factory=dict)
    channels: List[NotificationChannel] = field(default_factory=lambda: [NotificationChannel.EMAIL])
    recipients: List[EmailRecipient] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    scheduled_for: Optional[datetime] = None
    retry_count: int = 0
    max_retries: int = 3
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            'notification_id': self.notification_id,
            'type': self.type,
            'priority': self.priority.value,
            'title': self.title,
            'message': self.message,
            'data': self.data,
            'channels': [c.value for c in self.channels],
            'recipients': [
                {'email': r.email, 'name': r.name, 'type': r.type} 
                for r in self.recipients
            ],
            'created_at': self.created_at.isoformat(),
            'scheduled_for': self.scheduled_for.isoformat() if self.scheduled_for else None,
            'retry_count': self.retry_count,
            'max_retries': self.max_retries
        }


@dataclass
class NotificationRule:
    """Notification routing and filtering rule"""
    rule_id: str
    name: str
    conditions: Dict[str, Any]
    actions: Dict[str, Any]
    enabled: bool = True
    priority_override: Optional[Priority] = None
    channel_override: Optional[List[NotificationChannel]] = None
    recipient_override: Optional[List[EmailRecipient]] = None


class NotificationManager:
    """
    Centralized notification management system
    
    Features:
    - Multi-channel delivery (email, webhook, console)
    - Priority-based routing and batching
    - Rule-based notification filtering and routing
    - Rate limiting and quiet hours
    - Retry logic with exponential backoff
    - Notification history and analytics
    - Template-based message generation
    """
    
    def __init__(
        self,
        gmail_service: GmailService,
        error_handler: APIErrorHandler,
        config_dir: Path
    ):
        """
        Initialize Notification Manager
        
        Args:
            gmail_service: Gmail service for email notifications
            error_handler: Error handling service
            config_dir: Configuration directory
        """
        self.gmail_service = gmail_service
        self.error_handler = error_handler
        self.config_dir = config_dir
        self.logger = get_api_logger('notification_manager')
        
        # Notification queues by priority
        self.queues: Dict[Priority, List[NotificationPayload]] = {
            Priority.CRITICAL: [],
            Priority.HIGH: [],
            Priority.MEDIUM: [],
            Priority.LOW: []
        }
        
        # Processing state
        self.processing_active = False
        self.processing_task: Optional[asyncio.Task] = None
        
        # Configuration
        self.rules: Dict[str, NotificationRule] = {}
        self.default_recipients: List[EmailRecipient] = []
        self.webhooks: Dict[str, str] = {}  # name -> URL
        
        # Statistics
        self.stats = {
            'total_sent': 0,
            'sent_by_priority': {p.value: 0 for p in Priority},
            'sent_by_channel': {c.value: 0 for c in NotificationChannel},
            'sent_by_type': {},
            'failed_notifications': 0,
            'retry_attempts': 0,
            'last_reset': datetime.now()
        }
        
        # Notification history
        self.history: List[Dict[str, Any]] = []
        self.max_history_size = 1000
        
        # Rate limiting
        self.rate_limits: Dict[Priority, Dict[str, Any]] = {
            Priority.CRITICAL: {'max_per_hour': 100, 'current': 0, 'reset_time': time.time()},
            Priority.HIGH: {'max_per_hour': 50, 'current': 0, 'reset_time': time.time()},
            Priority.MEDIUM: {'max_per_hour': 20, 'current': 0, 'reset_time': time.time()},
            Priority.LOW: {'max_per_hour': 10, 'current': 0, 'reset_time': time.time()}
        }
        
        # Load configuration
        self._load_configuration()
        
        self.logger.info("Notification Manager initialized")
    
    def _load_configuration(self) -> None:
        """Load notification configuration from files"""
        try:
            # Load rules
            rules_file = self.config_dir / "notification_rules.json"
            if rules_file.exists():
                with open(rules_file, 'r', encoding='utf-8') as f:
                    rules_data = json.load(f)
                
                for rule_data in rules_data:
                    rule = NotificationRule(
                        rule_id=rule_data['rule_id'],
                        name=rule_data['name'],
                        conditions=rule_data['conditions'],
                        actions=rule_data['actions'],
                        enabled=rule_data.get('enabled', True),
                        priority_override=Priority(rule_data['priority_override']) if rule_data.get('priority_override') else None,
                        channel_override=[NotificationChannel(c) for c in rule_data.get('channel_override', [])] if rule_data.get('channel_override') else None,
                        recipient_override=[
                            EmailRecipient(email=r['email'], name=r.get('name'), type=r.get('type', 'to'))
                            for r in rule_data.get('recipient_override', [])
                        ] if rule_data.get('recipient_override') else None
                    )
                    self.rules[rule.rule_id] = rule
            
            # Load default recipients
            recipients_file = self.config_dir / "notification_recipients.json"
            if recipients_file.exists():
                with open(recipients_file, 'r', encoding='utf-8') as f:
                    recipients_data = json.load(f)
                
                self.default_recipients = [
                    EmailRecipient(email=r['email'], name=r.get('name'), type=r.get('type', 'to'))
                    for r in recipients_data
                ]
            
            # Load webhooks
            webhooks_file = self.config_dir / "notification_webhooks.json"
            if webhooks_file.exists():
                with open(webhooks_file, 'r', encoding='utf-8') as f:
                    self.webhooks = json.load(f)
                    
            self.logger.info(
                f"Loaded notification config: {len(self.rules)} rules, "
                f"{len(self.default_recipients)} recipients, "
                f"{len(self.webhooks)} webhooks"
            )
            
        except Exception as e:
            self.logger.error(f"Error loading notification configuration: {e}")
    
    async def send_notification(
        self,
        notification_type: str,
        title: str,
        message: str,
        data: Optional[Dict[str, Any]] = None,
        priority: Priority = Priority.MEDIUM,
        channels: Optional[List[NotificationChannel]] = None,
        recipients: Optional[List[EmailRecipient]] = None,
        scheduled_for: Optional[datetime] = None
    ) -> str:
        """
        Send a notification
        
        Args:
            notification_type: Type of notification
            title: Notification title
            message: Notification message
            data: Additional data payload
            priority: Notification priority
            channels: Channels to use for delivery
            recipients: Recipients (uses default if None)
            scheduled_for: Schedule for future delivery
            
        Returns:
            Notification ID
        """
        try:
            # Generate notification ID
            notification_id = f"notif_{int(time.time())}_{hash(title) % 10000:04d}"
            
            # Create notification payload
            notification = NotificationPayload(
                notification_id=notification_id,
                type=notification_type,
                priority=priority,
                title=title,
                message=message,
                data=data or {},
                channels=channels or [NotificationChannel.EMAIL],
                recipients=recipients or self.default_recipients,
                scheduled_for=scheduled_for
            )
            
            # Apply rules
            notification = await self._apply_rules(notification)
            
            # Add to appropriate queue
            self.queues[notification.priority].append(notification)
            
            # Start processing if not active
            if not self.processing_active:
                await self.start_processing()
            
            self.logger.info(f"Queued notification: {title} (ID: {notification_id}, Priority: {priority.value})")
            return notification_id
            
        except Exception as e:
            self.logger.error(f"Error sending notification: {e}")
            await self.error_handler.handle_error(e, 'notification_manager', 'send_notification')
            raise
    
    async def _apply_rules(self, notification: NotificationPayload) -> NotificationPayload:
        """Apply notification rules to modify routing and delivery"""
        try:
            for rule in self.rules.values():
                if not rule.enabled:
                    continue
                
                # Check conditions
                if self._matches_conditions(notification, rule.conditions):
                    self.logger.debug(f"Applying rule: {rule.name} to notification {notification.notification_id}")
                    
                    # Apply actions
                    if 'drop' in rule.actions and rule.actions['drop']:
                        self.logger.info(f"Notification dropped by rule: {rule.name}")
                        return None
                    
                    if 'delay_minutes' in rule.actions:
                        delay = timedelta(minutes=rule.actions['delay_minutes'])
                        notification.scheduled_for = datetime.now() + delay
                    
                    # Apply overrides
                    if rule.priority_override:
                        notification.priority = rule.priority_override
                    
                    if rule.channel_override:
                        notification.channels = rule.channel_override
                    
                    if rule.recipient_override:
                        notification.recipients = rule.recipient_override
            
            return notification
            
        except Exception as e:
            self.logger.error(f"Error applying rules: {e}")
            return notification
    
    def _matches_conditions(self, notification: NotificationPayload, conditions: Dict[str, Any]) -> bool:
        """Check if notification matches rule conditions"""
        try:
            for condition_key, condition_value in conditions.items():
                if condition_key == 'type':
                    if notification.type != condition_value:
                        return False
                elif condition_key == 'priority':
                    if notification.priority.value != condition_value:
                        return False
                elif condition_key == 'title_contains':
                    if condition_value.lower() not in notification.title.lower():
                        return False
                elif condition_key == 'data_contains':
                    for key, value in condition_value.items():
                        if notification.data.get(key) != value:
                            return False
            
            return True
            
        except Exception as e:
            self.logger.error(f"Error checking conditions: {e}")
            return False
    
    async def start_processing(self) -> None:
        """Start notification processing"""
        if self.processing_active:
            return
        
        self.processing_active = True
        self.processing_task = asyncio.create_task(self._processing_loop())
        self.logger.info("Started notification processing")
    
    async def stop_processing(self) -> None:
        """Stop notification processing"""
        self.processing_active = False
        if self.processing_task:
            self.processing_task.cancel()
            try:
                await self.processing_task
            except asyncio.CancelledError:
                pass
        self.logger.info("Stopped notification processing")
    
    async def _processing_loop(self) -> None:
        """Main notification processing loop"""
        try:
            while self.processing_active:
                # Process queues in priority order
                processed_any = False
                
                for priority in [Priority.CRITICAL, Priority.HIGH, Priority.MEDIUM, Priority.LOW]:
                    if await self._process_queue(priority):
                        processed_any = True
                
                # Reset rate limits if needed
                self._reset_rate_limits()
                
                # Wait before next cycle
                if not processed_any:
                    await asyncio.sleep(10)  # Wait longer if no notifications processed
                else:
                    await asyncio.sleep(1)   # Quick cycle if processing notifications
                    
        except asyncio.CancelledError:
            self.logger.info("Notification processing loop cancelled")
        except Exception as e:
            self.logger.error(f"Error in notification processing loop: {e}")
            await self.error_handler.handle_error(e, 'notification_manager', 'processing_loop')
    
    async def _process_queue(self, priority: Priority) -> bool:
        """Process notifications from a specific priority queue"""
        queue = self.queues[priority]
        if not queue:
            return False
        
        # Check rate limits
        if not self._check_rate_limit(priority):
            return False
        
        # Get next notification
        notification = queue.pop(0)
        
        # Check if scheduled for future
        if notification.scheduled_for and datetime.now() < notification.scheduled_for:
            # Put back in queue for later
            queue.append(notification)
            return False
        
        # Process notification
        success = await self._deliver_notification(notification)
        
        if success:
            # Update statistics
            self.stats['total_sent'] += 1
            self.stats['sent_by_priority'][priority.value] += 1
            self.stats['sent_by_type'][notification.type] = self.stats['sent_by_type'].get(notification.type, 0) + 1
            
            # Add to history
            self._add_to_history(notification, success=True)
            
            # Update rate limit
            self.rate_limits[priority]['current'] += 1
            
        else:
            # Handle failure
            notification.retry_count += 1
            
            if notification.retry_count < notification.max_retries:
                # Schedule retry with exponential backoff
                delay_minutes = 2 ** notification.retry_count  # 2, 4, 8 minutes
                notification.scheduled_for = datetime.now() + timedelta(minutes=delay_minutes)
                queue.append(notification)
                
                self.stats['retry_attempts'] += 1
                self.logger.warning(
                    f"Notification delivery failed, scheduling retry {notification.retry_count}: "
                    f"{notification.title}"
                )
            else:
                # Max retries exceeded
                self.stats['failed_notifications'] += 1
                self._add_to_history(notification, success=False, error="Max retries exceeded")
                
                self.logger.error(
                    f"Notification delivery failed permanently: {notification.title}"
                )
        
        return True
    
    async def _deliver_notification(self, notification: NotificationPayload) -> bool:
        """Deliver notification through configured channels"""
        delivery_success = True
        
        for channel in notification.channels:
            try:
                if channel == NotificationChannel.EMAIL:
                    success = await self._deliver_email(notification)
                elif channel == NotificationChannel.WEBHOOK:
                    success = await self._deliver_webhook(notification)
                elif channel == NotificationChannel.CONSOLE:
                    success = await self._deliver_console(notification)
                else:
                    self.logger.warning(f"Unknown notification channel: {channel}")
                    success = False
                
                if success:
                    self.stats['sent_by_channel'][channel.value] += 1
                    self.logger.debug(f"Delivered via {channel.value}: {notification.title}")
                else:
                    delivery_success = False
                    self.logger.error(f"Failed to deliver via {channel.value}: {notification.title}")
                    
            except Exception as e:
                delivery_success = False
                self.logger.error(f"Error delivering notification via {channel.value}: {e}")
        
        return delivery_success
    
    async def _deliver_email(self, notification: NotificationPayload) -> bool:
        """Deliver notification via email"""
        try:
            # Map notification types to email templates
            template_mapping = {
                'new_recipe': NotificationType.NEW_RECIPE,
                'error_alert': NotificationType.ERROR_ALERT,
                'system_status': NotificationType.SYSTEM_STATUS,
                'batch_summary': NotificationType.BATCH_SUMMARY
            }
            
            template_id = template_mapping.get(notification.type)
            
            message = EmailMessage(
                recipients=notification.recipients,
                subject=notification.title,
                html_content=notification.message,
                text_content=notification.message
            )
            
            if template_id:
                # Use template
                result = await self.gmail_service.send_email(
                    message=message,
                    template_id=template_id,
                    template_variables=notification.data
                )
            else:
                # Send as plain email
                result = await self.gmail_service.send_email(message)
            
            return result.get('success', False)
            
        except Exception as e:
            self.logger.error(f"Error delivering email notification: {e}")
            return False
    
    async def _deliver_webhook(self, notification: NotificationPayload) -> bool:
        """Deliver notification via webhook"""
        try:
            import httpx
            
            webhook_payload = {
                'id': notification.notification_id,
                'type': notification.type,
                'priority': notification.priority.value,
                'title': notification.title,
                'message': notification.message,
                'data': notification.data,
                'timestamp': notification.created_at.isoformat()
            }
            
            # Send to all configured webhooks
            success = True
            for webhook_name, webhook_url in self.webhooks.items():
                try:
                    async with httpx.AsyncClient() as client:
                        response = await client.post(
                            webhook_url,
                            json=webhook_payload,
                            headers={'Content-Type': 'application/json'},
                            timeout=30
                        )
                        
                        if response.status_code not in [200, 201, 202]:
                            self.logger.error(
                                f"Webhook {webhook_name} returned {response.status_code}: "
                                f"{response.text}"
                            )
                            success = False
                        
                except Exception as e:
                    self.logger.error(f"Error sending webhook {webhook_name}: {e}")
                    success = False
            
            return success
            
        except Exception as e:
            self.logger.error(f"Error delivering webhook notification: {e}")
            return False
    
    async def _deliver_console(self, notification: NotificationPayload) -> bool:
        """Deliver notification via console output"""
        try:
            priority_emoji = {
                Priority.CRITICAL: "🔴",
                Priority.HIGH: "🟠", 
                Priority.MEDIUM: "🟡",
                Priority.LOW: "🟢"
            }
            
            emoji = priority_emoji.get(notification.priority, "ℹ️")
            timestamp = notification.created_at.strftime("%Y-%m-%d %H:%M:%S")
            
            console_message = (
                f"\n{'='*60}\n"
                f"{emoji} NOTIFICATION [{notification.priority.value.upper()}] - {timestamp}\n"
                f"Type: {notification.type}\n"
                f"Title: {notification.title}\n"
                f"Message: {notification.message}\n"
                f"{'='*60}\n"
            )
            
            print(console_message)
            return True
            
        except Exception as e:
            self.logger.error(f"Error delivering console notification: {e}")
            return False
    
    def _check_rate_limit(self, priority: Priority) -> bool:
        """Check if priority level is within rate limits"""
        limit_info = self.rate_limits[priority]
        current_time = time.time()
        
        # Reset if hour has passed
        if current_time - limit_info['reset_time'] >= 3600:
            limit_info['current'] = 0
            limit_info['reset_time'] = current_time
        
        return limit_info['current'] < limit_info['max_per_hour']
    
    def _reset_rate_limits(self) -> None:
        """Reset rate limits if time window has passed"""
        current_time = time.time()
        
        for priority, limit_info in self.rate_limits.items():
            if current_time - limit_info['reset_time'] >= 3600:
                limit_info['current'] = 0
                limit_info['reset_time'] = current_time
    
    def _add_to_history(self, notification: NotificationPayload, success: bool, error: Optional[str] = None) -> None:
        """Add notification to history"""
        history_entry = {
            'notification_id': notification.notification_id,
            'type': notification.type,
            'priority': notification.priority.value,
            'title': notification.title,
            'channels': [c.value for c in notification.channels],
            'success': success,
            'error': error,
            'retry_count': notification.retry_count,
            'processed_at': datetime.now().isoformat()
        }
        
        self.history.append(history_entry)
        
        # Trim history if too large
        if len(self.history) > self.max_history_size:
            self.history = self.history[-self.max_history_size:]
    
    # Convenience methods for common notification types
    async def send_new_recipe_notification(
        self,
        title: str,
        channel: str,
        url: str,
        description: str,
        thumbnail_url: Optional[str] = None
    ) -> str:
        """Send new recipe notification"""
        return await self.send_notification(
            notification_type='new_recipe',
            title=f"🍳 New Recipe: {title}",
            message=f"New recipe detected from {channel}",
            data={
                'title': title,
                'channel': channel,
                'url': url,
                'description': description,
                'thumbnail_url': thumbnail_url
            },
            priority=Priority.MEDIUM
        )
    
    async def send_error_alert(
        self,
        error_type: str,
        api_name: str,
        message: str,
        details: Optional[str] = None,
        severity: str = 'medium'
    ) -> str:
        """Send error alert notification"""
        priority_map = {
            'low': Priority.LOW,
            'medium': Priority.MEDIUM,
            'high': Priority.HIGH,
            'critical': Priority.CRITICAL
        }
        
        return await self.send_notification(
            notification_type='error_alert',
            title=f"🚨 {error_type} Error - {api_name}",
            message=message,
            data={
                'error_type': error_type,
                'api_name': api_name,
                'message': message,
                'details': details,
                'severity': severity
            },
            priority=priority_map.get(severity, Priority.MEDIUM)
        )
    
    async def send_batch_summary(
        self,
        total_count: int,
        success_count: int,
        error_count: int,
        duration: float,
        items: List[str]
    ) -> str:
        """Send batch processing summary"""
        return await self.send_notification(
            notification_type='batch_summary',
            title=f"📦 Batch Complete: {success_count}/{total_count} processed",
            message=f"Batch processing completed with {success_count} successes and {error_count} errors",
            data={
                'total_count': total_count,
                'success_count': success_count,
                'error_count': error_count,
                'duration': duration,
                'items': items[:10]  # Limit items shown
            },
            priority=Priority.LOW
        )
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get notification statistics"""
        uptime = datetime.now() - self.stats['last_reset']
        
        return {
            'uptime_hours': uptime.total_seconds() / 3600,
            'processing_active': self.processing_active,
            'queue_sizes': {p.value: len(q) for p, q in self.queues.items()},
            'total_queued': sum(len(q) for q in self.queues.values()),
            'statistics': self.stats.copy(),
            'rate_limits': {
                p.value: {
                    'max_per_hour': info['max_per_hour'],
                    'current_usage': info['current'],
                    'remaining': info['max_per_hour'] - info['current']
                }
                for p, info in self.rate_limits.items()
            },
            'history_size': len(self.history),
            'configuration': {
                'rules': len(self.rules),
                'default_recipients': len(self.default_recipients),
                'webhooks': len(self.webhooks)
            }
        }
    
    def get_recent_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent notification history"""
        return self.history[-limit:] if len(self.history) >= limit else self.history


# Example usage
async def example_usage():
    """Example usage of Notification Manager"""
    from pathlib import Path
    from config.rate_limiter import RateLimiter
    from config.error_handler import APIErrorHandler
    from .gmail_service import GmailService
    
    # Initialize dependencies
    config_dir = Path("./config")
    rate_limiter = RateLimiter()
    error_handler = APIErrorHandler(config_dir)
    
    gmail_service = GmailService(
        credentials=None,  # Load from OAuth
        rate_limiter=rate_limiter,
        error_handler=error_handler,
        config_dir=config_dir
    )
    
    # Initialize Notification Manager
    notification_manager = NotificationManager(
        gmail_service=gmail_service,
        error_handler=error_handler,
        config_dir=config_dir
    )
    
    # Start processing
    await notification_manager.start_processing()
    
    # Send various types of notifications
    await notification_manager.send_new_recipe_notification(
        title="Amazing Pasta Carbonara",
        channel="Italian Cooking",
        url="https://youtube.com/watch?v=example",
        description="Learn to make authentic carbonara"
    )
    
    await notification_manager.send_error_alert(
        error_type="API Error",
        api_name="YouTube",
        message="Rate limit exceeded",
        severity="high"
    )
    
    # Let it process for a bit
    await asyncio.sleep(5)
    
    # Get statistics
    stats = notification_manager.get_statistics()
    print(f"Notification statistics: {json.dumps(stats, indent=2)}")
    
    # Stop processing
    await notification_manager.stop_processing()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(example_usage())