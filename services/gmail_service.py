#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gmail API Service
Recipe-DevAPI Agent

This module provides comprehensive Gmail API integration with OAuth authentication,
HTML email notifications, and error reporting capabilities.
"""

import asyncio
import logging
import time
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, field
from datetime import datetime
import json
import base64
from pathlib import Path
from email.mime.text import MimeText
from email.mime.multipart import MimeMultipart
from email.mime.image import MimeImage
import smtplib

import httpx
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from config.rate_limiter import RateLimiter, APIRateLimitDecorator
from config.error_handler import APIErrorHandler, handle_api_errors
from config.logger_config import get_api_logger


@dataclass
class EmailRecipient:
    """Email recipient information"""
    email: str
    name: Optional[str] = None
    type: str = "to"  # "to", "cc", "bcc"


@dataclass
class EmailTemplate:
    """Email template structure"""
    template_id: str
    name: str
    subject: str
    html_content: str
    text_content: Optional[str] = None
    variables: List[str] = field(default_factory=list)


@dataclass
class EmailMessage:
    """Email message data"""
    recipients: List[EmailRecipient]
    subject: str
    html_content: str
    text_content: Optional[str] = None
    attachments: List[Dict[str, Any]] = field(default_factory=list)
    reply_to: Optional[str] = None
    sender_name: Optional[str] = None


@dataclass
class NotificationConfig:
    """Notification configuration"""
    enabled: bool = True
    recipients: List[EmailRecipient] = field(default_factory=list)
    notification_types: List[str] = field(default_factory=list)
    quiet_hours_start: Optional[str] = None  # "22:00"
    quiet_hours_end: Optional[str] = None    # "08:00"
    rate_limit: int = 10  # max notifications per hour
    batch_notifications: bool = True
    batch_interval: int = 300  # 5 minutes


class NotificationType:
    """Notification type constants"""
    NEW_RECIPE = "new_recipe"
    ERROR_ALERT = "error_alert"
    SYSTEM_STATUS = "system_status"
    BATCH_SUMMARY = "batch_summary"
    WEEKLY_REPORT = "weekly_report"


class GmailService:
    """
    Comprehensive Gmail API service
    
    Features:
    - OAuth 2.0 authentication flow
    - HTML email composition and sending
    - Template-based notifications
    - Batch notification processing  
    - Error reporting and alerts
    - Rate limiting and quiet hours
    - Attachment support
    """
    
    def __init__(
        self,
        credentials: Optional[Credentials],
        rate_limiter: RateLimiter,
        error_handler: APIErrorHandler,
        config_dir: Path,
        sender_email: Optional[str] = None
    ):
        """
        Initialize Gmail service
        
        Args:
            credentials: Gmail API credentials
            rate_limiter: Rate limiting manager
            error_handler: Error handling manager
            config_dir: Configuration directory
            sender_email: Sender email address
        """
        self.credentials = credentials
        self.rate_limiter = rate_limiter
        self.error_handler = error_handler
        self.config_dir = config_dir
        self.sender_email = sender_email
        self.logger = get_api_logger('gmail')
        
        # Gmail service
        self.service = None
        if credentials:
            self.service = build('gmail', 'v1', credentials=credentials)
        
        # Email templates
        self.templates: Dict[str, EmailTemplate] = {}
        self._load_email_templates()
        
        # Notification configuration
        self.notification_config = NotificationConfig()
        
        # Tracking
        self.emails_sent = 0
        self.requests_made = 0
        self.notification_queue: List[Dict[str, Any]] = []
        self.last_batch_send = time.time()
        
        # Rate limiting for notifications
        self.notification_history: List[float] = []
        
        self.logger.info(f"Gmail service initialized {'with' if credentials else 'without'} credentials")
    
    def _load_email_templates(self) -> None:
        """Load email templates from configuration"""
        templates_dir = self.config_dir / "email_templates"
        
        # Default templates
        self.templates = {
            NotificationType.NEW_RECIPE: EmailTemplate(
                template_id=NotificationType.NEW_RECIPE,
                name="New Recipe Notification",
                subject="🍳 New Recipe: {{title}}",
                html_content=self._get_new_recipe_template(),
                variables=["title", "channel", "url", "description", "thumbnail_url"]
            ),
            NotificationType.ERROR_ALERT: EmailTemplate(
                template_id=NotificationType.ERROR_ALERT,
                name="Error Alert",
                subject="🚨 System Alert: {{error_type}}",
                html_content=self._get_error_alert_template(),
                variables=["error_type", "api_name", "message", "timestamp", "details"]
            ),
            NotificationType.SYSTEM_STATUS: EmailTemplate(
                template_id=NotificationType.SYSTEM_STATUS,
                name="System Status Report",
                subject="📊 System Status Report - {{date}}",
                html_content=self._get_status_report_template(),
                variables=["date", "uptime", "processed_videos", "errors", "statistics"]
            ),
            NotificationType.BATCH_SUMMARY: EmailTemplate(
                template_id=NotificationType.BATCH_SUMMARY,
                name="Batch Processing Summary",
                subject="📦 Batch Summary: {{count}} items processed",
                html_content=self._get_batch_summary_template(),
                variables=["count", "success_count", "error_count", "items", "duration"]
            )
        }
        
        # Load custom templates if they exist
        if templates_dir.exists():
            self._load_custom_templates(templates_dir)
    
    def _get_new_recipe_template(self) -> str:
        """Get new recipe notification template"""
        return """
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; }
                .header { background-color: #ff6b6b; color: white; padding: 20px; text-align: center; }
                .content { padding: 20px; }
                .recipe-card { border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin: 15px 0; }
                .thumbnail { max-width: 100%; height: auto; border-radius: 4px; }
                .button { display: inline-block; padding: 10px 20px; background-color: #ff6b6b; 
                         color: white; text-decoration: none; border-radius: 4px; margin: 10px 0; }
                .footer { background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🍳 New Recipe Detected!</h1>
            </div>
            <div class="content">
                <div class="recipe-card">
                    {{#thumbnail_url}}
                    <img src="{{thumbnail_url}}" alt="Recipe Thumbnail" class="thumbnail">
                    {{/thumbnail_url}}
                    <h2>{{title}}</h2>
                    <p><strong>Channel:</strong> {{channel}}</p>
                    <p>{{description}}</p>
                    <a href="{{url}}" class="button">Watch Recipe Video 🎥</a>
                </div>
            </div>
            <div class="footer">
                <p>Recipe monitoring system - Tasty Recipe Monitor</p>
                <p>Generated at {{timestamp}}</p>
            </div>
        </body>
        </html>
        """
    
    def _get_error_alert_template(self) -> str:
        """Get error alert template"""
        return """
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; }
                .header { background-color: #e74c3c; color: white; padding: 20px; text-align: center; }
                .content { padding: 20px; }
                .error-details { background-color: #f8f9fa; border-left: 4px solid #e74c3c; padding: 15px; margin: 15px 0; }
                .severity-high { border-left-color: #e74c3c; }
                .severity-medium { border-left-color: #f39c12; }
                .severity-low { border-left-color: #3498db; }
                .footer { background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🚨 System Error Alert</h1>
            </div>
            <div class="content">
                <div class="error-details">
                    <h3>{{error_type}} - {{api_name}}</h3>
                    <p><strong>Message:</strong> {{message}}</p>
                    <p><strong>Timestamp:</strong> {{timestamp}}</p>
                    {{#details}}
                    <p><strong>Details:</strong></p>
                    <pre>{{details}}</pre>
                    {{/details}}
                </div>
            </div>
            <div class="footer">
                <p>Recipe monitoring system - Error reporting</p>
            </div>
        </body>
        </html>
        """
    
    def _get_status_report_template(self) -> str:
        """Get system status report template"""
        return """
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; }
                .header { background-color: #27ae60; color: white; padding: 20px; text-align: center; }
                .content { padding: 20px; }
                .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 15px 0; }
                .stat-card { background-color: #f8f9fa; padding: 15px; border-radius: 4px; text-align: center; }
                .stat-number { font-size: 24px; font-weight: bold; color: #27ae60; }
                .footer { background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>📊 System Status Report</h1>
                <p>{{date}}</p>
            </div>
            <div class="content">
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-number">{{uptime}}</div>
                        <div>Uptime (hours)</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">{{processed_videos}}</div>
                        <div>Videos Processed</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">{{errors}}</div>
                        <div>Errors Logged</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">{{success_rate}}%</div>
                        <div>Success Rate</div>
                    </div>
                </div>
                {{#statistics}}
                <h3>Detailed Statistics</h3>
                <pre>{{statistics}}</pre>
                {{/statistics}}
            </div>
            <div class="footer">
                <p>Recipe monitoring system - Status reporting</p>
            </div>
        </body>
        </html>
        """
    
    def _get_batch_summary_template(self) -> str:
        """Get batch processing summary template"""
        return """
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; }
                .header { background-color: #3498db; color: white; padding: 20px; text-align: center; }
                .content { padding: 20px; }
                .summary-stats { background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0; }
                .item-list { max-height: 300px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; }
                .footer { background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>📦 Batch Processing Summary</h1>
            </div>
            <div class="content">
                <div class="summary-stats">
                    <p><strong>Total Items:</strong> {{count}}</p>
                    <p><strong>Successful:</strong> {{success_count}}</p>
                    <p><strong>Errors:</strong> {{error_count}}</p>
                    <p><strong>Duration:</strong> {{duration}} seconds</p>
                </div>
                {{#items}}
                <div class="item-list">
                    <h3>Processed Items</h3>
                    {{#items}}
                    <p>• {{.}}</p>
                    {{/items}}
                </div>
                {{/items}}
            </div>
            <div class="footer">
                <p>Recipe monitoring system - Batch processing</p>
            </div>
        </body>
        </html>
        """
    
    def _load_custom_templates(self, templates_dir: Path) -> None:
        """Load custom email templates from directory"""
        try:
            for template_file in templates_dir.glob("*.json"):
                with open(template_file, 'r', encoding='utf-8') as f:
                    template_data = json.load(f)
                
                template = EmailTemplate(
                    template_id=template_data['id'],
                    name=template_data['name'],
                    subject=template_data['subject'],
                    html_content=template_data['html_content'],
                    text_content=template_data.get('text_content'),
                    variables=template_data.get('variables', [])
                )
                
                self.templates[template.template_id] = template
                
        except Exception as e:
            self.logger.error(f"Error loading custom templates: {e}")
    
    @handle_api_errors(None, 'gmail', 'send_email')
    async def send_email(
        self,
        message: EmailMessage,
        template_id: Optional[str] = None,
        template_variables: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Send email message
        
        Args:
            message: Email message data
            template_id: Optional template to use
            template_variables: Variables for template rendering
            
        Returns:
            Send result with message ID and status
        """
        if not self.service:
            raise ValueError("Gmail service not initialized - missing credentials")
        
        await self.rate_limiter.wait_if_needed('gmail', 'send_message')
        
        try:
            # Build email message
            if template_id and template_id in self.templates:
                email_content = await self._render_template(
                    template_id, template_variables or {}
                )
                subject = await self._render_string(
                    self.templates[template_id].subject, 
                    template_variables or {}
                )
            else:
                email_content = message.html_content
                subject = message.subject
            
            # Create MIME message
            msg = MimeMultipart('alternative')
            
            # Set headers
            msg['Subject'] = subject
            msg['From'] = self.sender_email or 'noreply@recipemonitor.com'
            msg['To'] = ', '.join([r.email for r in message.recipients if r.type == 'to'])
            
            if any(r.type == 'cc' for r in message.recipients):
                msg['Cc'] = ', '.join([r.email for r in message.recipients if r.type == 'cc'])
            
            if message.reply_to:
                msg['Reply-To'] = message.reply_to
            
            # Add text content if available
            if message.text_content:
                text_part = MimeText(message.text_content, 'plain', 'utf-8')
                msg.attach(text_part)
            
            # Add HTML content
            html_part = MimeText(email_content, 'html', 'utf-8')
            msg.attach(html_part)
            
            # Add attachments
            for attachment in message.attachments:
                await self._add_attachment(msg, attachment)
            
            # Encode message for Gmail API
            raw_message = base64.urlsafe_b64encode(msg.as_bytes()).decode('utf-8')
            
            # Send via Gmail API
            api_message = {
                'raw': raw_message,
                'threadId': None
            }
            
            result = self.service.users().messages().send(
                userId='me',
                body=api_message
            ).execute()
            
            self.requests_made += 1
            self.emails_sent += 1
            
            self.logger.info(f"Email sent successfully: {subject} (ID: {result.get('id')})")
            
            return {
                'success': True,
                'message_id': result.get('id'),
                'thread_id': result.get('threadId'),
                'label_ids': result.get('labelIds', [])
            }
            
        except HttpError as e:
            self.logger.error(f"Gmail API error sending email: {e}")
            raise
        except Exception as e:
            self.logger.error(f"Unexpected error sending email: {e}")
            raise
    
    async def _render_template(
        self, 
        template_id: str, 
        variables: Dict[str, Any]
    ) -> str:
        """Render email template with variables"""
        if template_id not in self.templates:
            raise ValueError(f"Template not found: {template_id}")
        
        template = self.templates[template_id]
        return await self._render_string(template.html_content, variables)
    
    async def _render_string(
        self, 
        template_string: str, 
        variables: Dict[str, Any]
    ) -> str:
        """Render template string with variables (simple Mustache-like syntax)"""
        import re
        
        # Add default variables
        variables.setdefault('timestamp', datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
        
        rendered = template_string
        
        # Simple variable substitution {{variable}}
        for key, value in variables.items():
            pattern = r'\{\{\s*' + re.escape(key) + r'\s*\}\}'
            rendered = re.sub(pattern, str(value), rendered)
        
        # Simple conditional blocks {{#variable}} ... {{/variable}}
        for key, value in variables.items():
            if value:  # Show block if value is truthy
                pattern = r'\{\{\#\s*' + re.escape(key) + r'\s*\}\}(.*?)\{\{\/\s*' + re.escape(key) + r'\s*\}\}'
                rendered = re.sub(pattern, r'\1', rendered, flags=re.DOTALL)
            else:  # Remove block if value is falsy
                pattern = r'\{\{\#\s*' + re.escape(key) + r'\s*\}\}.*?\{\{\/\s*' + re.escape(key) + r'\s*\}\}'
                rendered = re.sub(pattern, '', rendered, flags=re.DOTALL)
        
        return rendered
    
    async def _add_attachment(
        self, 
        msg: MimeMultipart, 
        attachment: Dict[str, Any]
    ) -> None:
        """Add attachment to email message"""
        try:
            attachment_type = attachment.get('type', 'file')
            
            if attachment_type == 'file':
                # File attachment
                file_path = Path(attachment['path'])
                if file_path.exists():
                    with open(file_path, 'rb') as f:
                        attachment_data = f.read()
                    
                    # Determine MIME type
                    import mimetypes
                    content_type, _ = mimetypes.guess_type(str(file_path))
                    
                    if content_type and content_type.startswith('image/'):
                        mime_attachment = MimeImage(attachment_data)
                    else:
                        from email.mime.application import MimeApplication
                        mime_attachment = MimeApplication(attachment_data)
                    
                    mime_attachment.add_header(
                        'Content-Disposition',
                        'attachment',
                        filename=file_path.name
                    )
                    
                    msg.attach(mime_attachment)
            
            elif attachment_type == 'url':
                # URL-based attachment (download first)
                async with httpx.AsyncClient() as client:
                    response = await client.get(attachment['url'])
                    if response.status_code == 200:
                        content_type = response.headers.get('content-type', 'application/octet-stream')
                        
                        if content_type.startswith('image/'):
                            mime_attachment = MimeImage(response.content)
                        else:
                            from email.mime.application import MimeApplication
                            mime_attachment = MimeApplication(response.content)
                        
                        filename = attachment.get('filename', 'attachment')
                        mime_attachment.add_header(
                            'Content-Disposition',
                            'attachment',
                            filename=filename
                        )
                        
                        msg.attach(mime_attachment)
            
        except Exception as e:
            self.logger.error(f"Error adding attachment: {e}")
    
    async def send_new_recipe_notification(
        self,
        recipe_data: Dict[str, Any],
        recipients: Optional[List[EmailRecipient]] = None
    ) -> Dict[str, Any]:
        """
        Send new recipe notification
        
        Args:
            recipe_data: Recipe data for notification
            recipients: Email recipients (uses default if None)
            
        Returns:
            Send result
        """
        notification_recipients = recipients or self.notification_config.recipients
        
        if not notification_recipients:
            self.logger.warning("No recipients configured for new recipe notifications")
            return {'success': False, 'error': 'No recipients'}
        
        # Check if notifications are enabled and within allowed time
        if not self._should_send_notification(NotificationType.NEW_RECIPE):
            self.logger.info("New recipe notification skipped (rate limited or quiet hours)")
            return {'success': False, 'error': 'Rate limited or quiet hours'}
        
        message = EmailMessage(recipients=notification_recipients, subject="", html_content="")
        
        template_variables = {
            'title': recipe_data.get('title', 'Unknown Recipe'),
            'channel': recipe_data.get('channel', 'Unknown Channel'),
            'url': recipe_data.get('url', '#'),
            'description': recipe_data.get('description', 'No description available')[:200],
            'thumbnail_url': recipe_data.get('thumbnail_url', '')
        }
        
        result = await self.send_email(
            message,
            template_id=NotificationType.NEW_RECIPE,
            template_variables=template_variables
        )
        
        # Track notification
        self.notification_history.append(time.time())
        
        return result
    
    async def send_error_alert(
        self,
        error_data: Dict[str, Any],
        recipients: Optional[List[EmailRecipient]] = None
    ) -> Dict[str, Any]:
        """
        Send error alert notification
        
        Args:
            error_data: Error data for alert
            recipients: Email recipients (uses default if None)
            
        Returns:
            Send result
        """
        notification_recipients = recipients or self.notification_config.recipients
        
        if not notification_recipients:
            self.logger.warning("No recipients configured for error alerts")
            return {'success': False, 'error': 'No recipients'}
        
        # Error alerts bypass quiet hours and rate limits for critical errors
        severity = error_data.get('severity', 'medium')
        if severity == 'critical' or self._should_send_notification(NotificationType.ERROR_ALERT):
            
            message = EmailMessage(recipients=notification_recipients, subject="", html_content="")
            
            template_variables = {
                'error_type': error_data.get('category', 'Unknown Error'),
                'api_name': error_data.get('api_name', 'Unknown API'),
                'message': error_data.get('message', 'No message available'),
                'timestamp': error_data.get('timestamp', datetime.now().isoformat()),
                'details': error_data.get('details', '')
            }
            
            result = await self.send_email(
                message,
                template_id=NotificationType.ERROR_ALERT,
                template_variables=template_variables
            )
            
            self.notification_history.append(time.time())
            return result
        
        return {'success': False, 'error': 'Rate limited or quiet hours'}
    
    async def send_batch_summary(
        self,
        batch_data: Dict[str, Any],
        recipients: Optional[List[EmailRecipient]] = None
    ) -> Dict[str, Any]:
        """
        Send batch processing summary
        
        Args:
            batch_data: Batch processing data
            recipients: Email recipients (uses default if None)
            
        Returns:
            Send result
        """
        notification_recipients = recipients or self.notification_config.recipients
        
        if not notification_recipients:
            return {'success': False, 'error': 'No recipients'}
        
        if not self._should_send_notification(NotificationType.BATCH_SUMMARY):
            return {'success': False, 'error': 'Rate limited or quiet hours'}
        
        message = EmailMessage(recipients=notification_recipients, subject="", html_content="")
        
        template_variables = {
            'count': batch_data.get('total_count', 0),
            'success_count': batch_data.get('success_count', 0),
            'error_count': batch_data.get('error_count', 0),
            'duration': batch_data.get('duration', 0),
            'items': batch_data.get('items', [])
        }
        
        result = await self.send_email(
            message,
            template_id=NotificationType.BATCH_SUMMARY,
            template_variables=template_variables
        )
        
        self.notification_history.append(time.time())
        return result
    
    def _should_send_notification(self, notification_type: str) -> bool:
        """
        Check if notification should be sent based on config
        
        Args:
            notification_type: Type of notification
            
        Returns:
            True if notification should be sent
        """
        config = self.notification_config
        
        # Check if notifications are enabled
        if not config.enabled:
            return False
        
        # Check if this notification type is enabled
        if config.notification_types and notification_type not in config.notification_types:
            return False
        
        # Check quiet hours
        if config.quiet_hours_start and config.quiet_hours_end:
            current_time = datetime.now().strftime('%H:%M')
            if config.quiet_hours_start <= current_time <= config.quiet_hours_end:
                return False
        
        # Check rate limit
        current_time = time.time()
        recent_notifications = [
            t for t in self.notification_history 
            if current_time - t < 3600  # Last hour
        ]
        
        if len(recent_notifications) >= config.rate_limit:
            return False
        
        return True
    
    async def configure_notifications(
        self,
        config: NotificationConfig
    ) -> bool:
        """
        Configure notification settings
        
        Args:
            config: New notification configuration
            
        Returns:
            True if configuration was updated successfully
        """
        try:
            self.notification_config = config
            
            # Save configuration to file
            config_file = self.config_dir / "notification_config.json"
            config_data = {
                'enabled': config.enabled,
                'recipients': [
                    {'email': r.email, 'name': r.name, 'type': r.type} 
                    for r in config.recipients
                ],
                'notification_types': config.notification_types,
                'quiet_hours_start': config.quiet_hours_start,
                'quiet_hours_end': config.quiet_hours_end,
                'rate_limit': config.rate_limit,
                'batch_notifications': config.batch_notifications,
                'batch_interval': config.batch_interval
            }
            
            with open(config_file, 'w', encoding='utf-8') as f:
                json.dump(config_data, f, indent=2)
            
            self.logger.info("Notification configuration updated")
            return True
            
        except Exception as e:
            self.logger.error(f"Error updating notification configuration: {e}")
            return False
    
    def get_usage_statistics(self) -> Dict[str, Any]:
        """Get Gmail service usage statistics"""
        return {
            'emails_sent': self.emails_sent,
            'requests_made': self.requests_made,
            'notification_queue_size': len(self.notification_queue),
            'recent_notifications': len([
                t for t in self.notification_history 
                if time.time() - t < 3600
            ]),
            'templates_loaded': len(self.templates),
            'notification_config': {
                'enabled': self.notification_config.enabled,
                'recipients_count': len(self.notification_config.recipients),
                'rate_limit': self.notification_config.rate_limit
            }
        }


# OAuth helper functions
async def initialize_gmail_oauth(
    client_id: str,
    client_secret: str,
    scopes: List[str],
    config_dir: Path
) -> Optional[Credentials]:
    """
    Initialize Gmail OAuth authentication
    
    Args:
        client_id: OAuth client ID
        client_secret: OAuth client secret
        scopes: OAuth scopes
        config_dir: Configuration directory
        
    Returns:
        Credentials object if successful
    """
    try:
        # OAuth flow configuration
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": ["http://localhost:8080"]
                }
            },
            scopes=scopes
        )
        
        flow.redirect_uri = "http://localhost:8080"
        
        # Get authorization URL
        auth_url, _ = flow.authorization_url(prompt='consent')
        
        print(f"Please visit this URL for authorization: {auth_url}")
        
        # Get authorization code from user
        auth_code = input("Enter the authorization code: ")
        
        # Exchange code for credentials
        flow.fetch_token(code=auth_code)
        
        credentials = flow.credentials
        
        # Save credentials
        token_file = config_dir / "gmail_token.json"
        with open(token_file, 'w') as f:
            f.write(credentials.to_json())
        
        return credentials
        
    except Exception as e:
        logging.error(f"Error initializing Gmail OAuth: {e}")
        return None


# Example usage
async def example_usage():
    """Example usage of Gmail service"""
    from config.rate_limiter import RateLimiter
    from config.error_handler import APIErrorHandler
    from pathlib import Path
    
    # Initialize dependencies
    rate_limiter = RateLimiter()
    error_handler = APIErrorHandler(Path("./config"))
    config_dir = Path("./config")
    
    # Initialize OAuth (you would do this once)
    # credentials = await initialize_gmail_oauth(
    #     client_id="YOUR_CLIENT_ID",
    #     client_secret="YOUR_CLIENT_SECRET", 
    #     scopes=['https://www.googleapis.com/auth/gmail.send'],
    #     config_dir=config_dir
    # )
    
    # For demo, use None (would load from saved credentials in real usage)
    credentials = None
    
    # Initialize Gmail service
    gmail_service = GmailService(
        credentials=credentials,
        rate_limiter=rate_limiter,
        error_handler=error_handler,
        config_dir=config_dir,
        sender_email="your-email@gmail.com"
    )
    
    # Configure notifications
    config = NotificationConfig(
        enabled=True,
        recipients=[
            EmailRecipient(email="admin@example.com", name="Admin"),
            EmailRecipient(email="notifications@example.com", name="Notifications")
        ],
        notification_types=[
            NotificationType.NEW_RECIPE,
            NotificationType.ERROR_ALERT
        ],
        rate_limit=5
    )
    
    await gmail_service.configure_notifications(config)
    
    # Send test notification (would work with real credentials)
    if credentials:
        recipe_data = {
            'title': 'Amazing Pasta Recipe',
            'channel': 'Cooking Channel',
            'url': 'https://youtube.com/watch?v=example',
            'description': 'Learn to make delicious pasta in 20 minutes'
        }
        
        result = await gmail_service.send_new_recipe_notification(recipe_data)
        print(f"Notification sent: {result}")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(example_usage())