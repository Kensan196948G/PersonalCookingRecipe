"""
Configuration package for Recipe-DevAPI Agent
Provides centralized configuration management for all API integrations
"""

from .api_manager import APIManager, APIConnectionTester
from .keychain_manager import MacOSKeychainManager
from .rate_limiter import RateLimiter
from .error_handler import APIErrorHandler
from .logger_config import setup_logging

__all__ = [
    'APIManager',
    'APIConnectionTester',
    'MacOSKeychainManager',
    'RateLimiter',
    'APIErrorHandler',
    'setup_logging'
]

__version__ = '1.0.0'