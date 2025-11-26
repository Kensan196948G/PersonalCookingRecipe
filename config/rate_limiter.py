#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Rate Limiting Manager
Recipe-DevAPI Agent

This module provides comprehensive rate limiting for all API integrations
with different strategies for each service.
"""

import asyncio
import time
import logging
from typing import Dict, Optional, Any, Callable, Awaitable
from dataclasses import dataclass, field
from collections import defaultdict, deque
from enum import Enum


class RateLimitStrategy(Enum):
    """Rate limiting strategies"""
    FIXED_WINDOW = "fixed_window"
    SLIDING_WINDOW = "sliding_window"
    TOKEN_BUCKET = "token_bucket"
    EXPONENTIAL_BACKOFF = "exponential_backoff"


@dataclass
class RateLimit:
    """Rate limit configuration"""
    requests_per_second: float
    burst_capacity: int = field(default=0)
    strategy: RateLimitStrategy = field(default=RateLimitStrategy.SLIDING_WINDOW)
    backoff_base: float = field(default=2.0)
    backoff_max: float = field(default=300.0)


class RateLimiter:
    """
    Advanced rate limiter with multiple strategies
    
    Supports different rate limiting strategies for different APIs:
    - YouTube: Quota-based with sliding window
    - Claude: Token bucket with burst capacity
    - Notion: Fixed window with exponential backoff
    - Gmail: Conservative sliding window
    """
    
    def __init__(self):
        """Initialize rate limiter with API-specific configurations"""
        self.logger = logging.getLogger(__name__)
        
        # API-specific rate limit configurations
        self.limits: Dict[str, RateLimit] = {
            'youtube': RateLimit(
                requests_per_second=100.0,  # YouTube quota: 10,000 units/day
                burst_capacity=10,
                strategy=RateLimitStrategy.SLIDING_WINDOW
            ),
            'claude': RateLimit(
                requests_per_second=5.0,  # Conservative rate for Claude API
                burst_capacity=3,
                strategy=RateLimitStrategy.TOKEN_BUCKET
            ),
            'notion': RateLimit(
                requests_per_second=3.0,  # Notion: 3 requests/second
                burst_capacity=5,
                strategy=RateLimitStrategy.FIXED_WINDOW
            ),
            'gmail': RateLimit(
                requests_per_second=2.0,  # Conservative for Gmail API
                burst_capacity=1,
                strategy=RateLimitStrategy.SLIDING_WINDOW
            )
        }
        
        # Internal state tracking
        self._request_history: Dict[str, deque] = defaultdict(deque)
        self._token_buckets: Dict[str, Dict[str, Any]] = {}
        self._backoff_delays: Dict[str, float] = defaultdict(float)
        self._last_reset: Dict[str, float] = defaultdict(time.time)
        self._locks: Dict[str, asyncio.Lock] = {
            api: asyncio.Lock() for api in self.limits.keys()
        }
        
        # Initialize token buckets
        for api_name, limit in self.limits.items():
            self._token_buckets[api_name] = {
                'tokens': limit.burst_capacity,
                'capacity': limit.burst_capacity,
                'refill_rate': limit.requests_per_second,
                'last_refill': time.time()
            }
        
        self.logger.info("Rate limiter initialized with API-specific configurations")
    
    async def acquire(self, api_name: str, operation: str = "default") -> bool:
        """
        Acquire permission to make an API request
        
        Args:
            api_name: Name of the API (youtube, claude, notion, gmail)
            operation: Specific operation name for detailed tracking
            
        Returns:
            bool: True if request is allowed, False if rate limited
        """
        if api_name not in self.limits:
            self.logger.warning(f"Unknown API name: {api_name}, allowing request")
            return True
        
        async with self._locks[api_name]:
            limit = self.limits[api_name]
            current_time = time.time()
            
            # Check for active backoff
            if self._backoff_delays[api_name] > current_time:
                remaining = self._backoff_delays[api_name] - current_time
                self.logger.warning(
                    f"API {api_name} in backoff, waiting {remaining:.1f}s"
                )
                return False
            
            # Apply strategy-specific rate limiting
            if limit.strategy == RateLimitStrategy.SLIDING_WINDOW:
                return await self._sliding_window_check(api_name, current_time)
            elif limit.strategy == RateLimitStrategy.TOKEN_BUCKET:
                return await self._token_bucket_check(api_name, current_time)
            elif limit.strategy == RateLimitStrategy.FIXED_WINDOW:
                return await self._fixed_window_check(api_name, current_time)
            else:
                self.logger.warning(f"Unknown strategy for {api_name}, allowing request")
                return True
    
    async def _sliding_window_check(self, api_name: str, current_time: float) -> bool:
        """Sliding window rate limit check"""
        limit = self.limits[api_name]
        history = self._request_history[api_name]
        window_size = 1.0  # 1 second window
        
        # Remove old entries outside the window
        cutoff_time = current_time - window_size
        while history and history[0] <= cutoff_time:
            history.popleft()
        
        # Check if we can make another request
        if len(history) < limit.requests_per_second:
            history.append(current_time)
            self.logger.debug(
                f"API {api_name}: Request allowed ({len(history)}/{limit.requests_per_second})"
            )
            return True
        
        # Calculate time until next request is allowed
        next_available = history[0] + window_size
        wait_time = next_available - current_time
        
        self.logger.warning(
            f"API {api_name}: Rate limited, next request in {wait_time:.1f}s"
        )
        return False
    
    async def _token_bucket_check(self, api_name: str, current_time: float) -> bool:
        """Token bucket rate limit check"""
        bucket = self._token_buckets[api_name]
        limit = self.limits[api_name]
        
        # Refill tokens based on elapsed time
        elapsed = current_time - bucket['last_refill']
        tokens_to_add = elapsed * bucket['refill_rate']
        bucket['tokens'] = min(bucket['capacity'], bucket['tokens'] + tokens_to_add)
        bucket['last_refill'] = current_time
        
        # Check if we have tokens available
        if bucket['tokens'] >= 1.0:
            bucket['tokens'] -= 1.0
            self.logger.debug(
                f"API {api_name}: Token consumed ({bucket['tokens']:.1f}/{bucket['capacity']} remaining)"
            )
            return True
        
        # Calculate time until next token is available
        wait_time = (1.0 - bucket['tokens']) / bucket['refill_rate']
        
        self.logger.warning(
            f"API {api_name}: No tokens available, next in {wait_time:.1f}s"
        )
        return False
    
    async def _fixed_window_check(self, api_name: str, current_time: float) -> bool:
        """Fixed window rate limit check"""
        limit = self.limits[api_name]
        history = self._request_history[api_name]
        window_start = int(current_time)  # 1-second windows
        
        # Reset counter if we're in a new window
        if not history or int(history[-1]) < window_start:
            history.clear()
        
        # Check if we're within the limit for this window
        requests_in_window = sum(1 for t in history if int(t) == window_start)
        
        if requests_in_window < limit.requests_per_second:
            history.append(current_time)
            self.logger.debug(
                f"API {api_name}: Fixed window request allowed ({requests_in_window + 1}/{limit.requests_per_second})"
            )
            return True
        
        self.logger.warning(
            f"API {api_name}: Fixed window limit exceeded ({requests_in_window}/{limit.requests_per_second})"
        )
        return False
    
    async def wait_if_needed(self, api_name: str, operation: str = "default") -> float:
        """
        Wait if necessary and acquire permission
        
        Args:
            api_name: Name of the API
            operation: Specific operation name
            
        Returns:
            float: Time waited in seconds
        """
        start_time = time.time()
        
        while not await self.acquire(api_name, operation):
            # Calculate optimal wait time based on strategy
            wait_time = await self._calculate_wait_time(api_name)
            
            self.logger.info(f"Rate limited for {api_name}, waiting {wait_time:.1f}s")
            await asyncio.sleep(wait_time)
        
        total_wait = time.time() - start_time
        if total_wait > 0:
            self.logger.info(f"Resumed after waiting {total_wait:.1f}s for {api_name}")
        
        return total_wait
    
    async def _calculate_wait_time(self, api_name: str) -> float:
        """Calculate optimal wait time for the API"""
        limit = self.limits[api_name]
        current_time = time.time()
        
        if limit.strategy == RateLimitStrategy.SLIDING_WINDOW:
            history = self._request_history[api_name]
            if history:
                next_available = history[0] + 1.0  # 1-second window
                return max(0.1, next_available - current_time)
        
        elif limit.strategy == RateLimitStrategy.TOKEN_BUCKET:
            bucket = self._token_buckets[api_name]
            tokens_needed = 1.0 - bucket['tokens']
            return max(0.1, tokens_needed / bucket['refill_rate'])
        
        elif limit.strategy == RateLimitStrategy.FIXED_WINDOW:
            # Wait until next window
            return max(0.1, 1.0 - (current_time % 1.0))
        
        return 1.0  # Default wait time
    
    def trigger_backoff(self, api_name: str, error_code: Optional[int] = None) -> None:
        """
        Trigger exponential backoff for an API
        
        Args:
            api_name: Name of the API
            error_code: HTTP error code that triggered backoff
        """
        if api_name not in self.limits:
            return
        
        limit = self.limits[api_name]
        current_delay = self._backoff_delays.get(f"{api_name}_base", 1.0)
        
        # Calculate new backoff delay
        new_delay = min(
            current_delay * limit.backoff_base,
            limit.backoff_max
        )
        
        # Set backoff expiry time
        self._backoff_delays[api_name] = time.time() + new_delay
        self._backoff_delays[f"{api_name}_base"] = new_delay
        
        self.logger.warning(
            f"Triggered backoff for {api_name}: {new_delay:.1f}s "
            f"(error_code: {error_code})"
        )
    
    def reset_backoff(self, api_name: str) -> None:
        """Reset backoff state for an API"""
        self._backoff_delays.pop(api_name, None)
        self._backoff_delays.pop(f"{api_name}_base", None)
        self.logger.info(f"Reset backoff for {api_name}")
    
    def get_status(self, api_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Get current rate limiting status
        
        Args:
            api_name: Specific API to check, or None for all APIs
            
        Returns:
            Dict containing rate limiting status information
        """
        current_time = time.time()
        
        if api_name:
            apis_to_check = [api_name] if api_name in self.limits else []
        else:
            apis_to_check = list(self.limits.keys())
        
        status = {}
        
        for api in apis_to_check:
            limit = self.limits[api]
            history = self._request_history[api]
            
            # Calculate current usage
            window_requests = 0
            if limit.strategy == RateLimitStrategy.SLIDING_WINDOW:
                cutoff = current_time - 1.0
                window_requests = sum(1 for t in history if t > cutoff)
            
            # Get token bucket status
            bucket_status = None
            if api in self._token_buckets:
                bucket = self._token_buckets[api]
                elapsed = current_time - bucket['last_refill']
                current_tokens = min(
                    bucket['capacity'],
                    bucket['tokens'] + elapsed * bucket['refill_rate']
                )
                bucket_status = {
                    'tokens': current_tokens,
                    'capacity': bucket['capacity'],
                    'refill_rate': bucket['refill_rate']
                }
            
            # Check backoff status
            backoff_remaining = max(0, self._backoff_delays.get(api, 0) - current_time)
            
            status[api] = {
                'strategy': limit.strategy.value,
                'requests_per_second': limit.requests_per_second,
                'current_window_requests': window_requests,
                'bucket_status': bucket_status,
                'backoff_remaining': backoff_remaining,
                'is_rate_limited': backoff_remaining > 0 or window_requests >= limit.requests_per_second
            }
        
        return status
    
    async def bulk_acquire(
        self,
        requests: Dict[str, int]
    ) -> Dict[str, bool]:
        """
        Acquire permission for multiple requests across different APIs
        
        Args:
            requests: Dictionary mapping API names to number of requests needed
            
        Returns:
            Dictionary mapping API names to whether all requests were granted
        """
        results = {}
        
        for api_name, count in requests.items():
            api_results = []
            for i in range(count):
                result = await self.acquire(api_name, f"bulk_{i}")
                api_results.append(result)
                
                # If rate limited, don't continue acquiring
                if not result:
                    break
            
            results[api_name] = all(api_results)
        
        return results
    
    def update_limits(self, api_name: str, new_limit: RateLimit) -> bool:
        """
        Update rate limits for a specific API
        
        Args:
            api_name: Name of the API
            new_limit: New rate limit configuration
            
        Returns:
            bool: True if successfully updated
        """
        if api_name in self.limits:
            old_limit = self.limits[api_name]
            self.limits[api_name] = new_limit
            
            # Update token bucket if strategy changed
            if new_limit.strategy == RateLimitStrategy.TOKEN_BUCKET:
                self._token_buckets[api_name] = {
                    'tokens': new_limit.burst_capacity,
                    'capacity': new_limit.burst_capacity,
                    'refill_rate': new_limit.requests_per_second,
                    'last_refill': time.time()
                }
            
            self.logger.info(
                f"Updated rate limit for {api_name}: "
                f"{old_limit.requests_per_second} -> {new_limit.requests_per_second} req/s"
            )
            return True
        
        return False


class APIRateLimitDecorator:
    """
    Decorator for automatically applying rate limiting to API methods
    """
    
    def __init__(self, rate_limiter: RateLimiter, api_name: str):
        """
        Initialize decorator
        
        Args:
            rate_limiter: RateLimiter instance
            api_name: Name of the API
        """
        self.rate_limiter = rate_limiter
        self.api_name = api_name
    
    def __call__(self, func: Callable[..., Awaitable[Any]]) -> Callable[..., Awaitable[Any]]:
        """Apply rate limiting to the decorated function"""
        
        async def wrapper(*args, **kwargs) -> Any:
            operation_name = kwargs.pop('_rate_limit_operation', func.__name__)
            
            # Wait for rate limit permission
            wait_time = await self.rate_limiter.wait_if_needed(
                self.api_name, 
                operation_name
            )
            
            try:
                # Execute the function
                result = await func(*args, **kwargs)
                
                # Reset backoff on successful request
                if wait_time > 0:
                    self.rate_limiter.reset_backoff(self.api_name)
                
                return result
                
            except Exception as e:
                # Trigger backoff on certain errors
                if hasattr(e, 'status_code') and e.status_code in [429, 503, 504]:
                    self.rate_limiter.trigger_backoff(self.api_name, e.status_code)
                raise
        
        return wrapper


# Usage examples and testing
async def example_usage():
    """Example usage of the RateLimiter"""
    
    limiter = RateLimiter()
    
    # Test individual API rate limiting
    print("Testing YouTube API rate limiting...")
    for i in range(5):
        allowed = await limiter.acquire('youtube', f'search_{i}')
        print(f"Request {i+1}: {'✅ Allowed' if allowed else '❌ Rate limited'}")
        
        if not allowed:
            # Wait and retry
            wait_time = await limiter.wait_if_needed('youtube', f'search_{i}_retry')
            print(f"Waited {wait_time:.1f}s and retried")
    
    # Test bulk acquisition
    print("\nTesting bulk acquisition...")
    bulk_requests = {
        'claude': 2,
        'notion': 3,
        'gmail': 1
    }
    
    results = await limiter.bulk_acquire(bulk_requests)
    for api, granted in results.items():
        print(f"{api}: {'✅ All granted' if granted else '❌ Some denied'}")
    
    # Get status
    print("\nRate limiting status:")
    status = limiter.get_status()
    for api, info in status.items():
        print(f"{api}: {info['current_window_requests']}/{info['requests_per_second']} req/s")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(example_usage())