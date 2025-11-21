#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Notion API Service
Recipe-DevAPI Agent

This module provides comprehensive Notion API integration for database management,
page creation, property management, and media embedding.
"""

import asyncio
import logging
import time
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, field
from datetime import datetime, timedelta
import json
from pathlib import Path
from urllib.parse import urlparse
import uuid

import httpx
from notion_client import AsyncClient
from notion_client.errors import APIErrorResponse

from config.rate_limiter import RateLimiter, APIRateLimitDecorator
from config.error_handler import APIErrorHandler, handle_api_errors
from config.logger_config import get_api_logger


@dataclass
class NotionPage:
    """Notion page structure"""
    page_id: str
    title: str
    url: str
    created_time: datetime
    last_edited_time: datetime
    properties: Dict[str, Any]
    parent_database_id: Optional[str] = None
    cover_url: Optional[str] = None
    icon_emoji: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            'page_id': self.page_id,
            'title': self.title,
            'url': self.url,
            'created_time': self.created_time.isoformat(),
            'last_edited_time': self.last_edited_time.isoformat(),
            'properties': self.properties,
            'parent_database_id': self.parent_database_id,
            'cover_url': self.cover_url,
            'icon_emoji': self.icon_emoji
        }


@dataclass
class NotionDatabase:
    """Notion database structure"""
    database_id: str
    title: str
    url: str
    created_time: datetime
    last_edited_time: datetime
    properties: Dict[str, Any]
    description: List[Dict[str, Any]] = field(default_factory=list)
    cover_url: Optional[str] = None
    icon_emoji: Optional[str] = None


@dataclass
class RecipePageData:
    """Recipe-specific page data structure"""
    title_en: str
    title_ja: str
    description_en: str
    description_ja: str
    youtube_url: str
    channel_name: str
    published_date: datetime
    duration: int  # seconds
    recipe_type: str
    meat_ingredients: List[str]
    ingredients: List[Dict[str, Any]]
    instructions: List[str]
    tags: List[str]
    thumbnail_url: Optional[str] = None
    view_count: Optional[int] = None
    like_count: Optional[int] = None
    cooking_time: Optional[int] = None  # minutes
    servings: Optional[int] = None
    difficulty: Optional[str] = None
    confidence_score: Optional[float] = None


class NotionPropertyType:
    """Notion property type definitions"""
    TITLE = "title"
    RICH_TEXT = "rich_text"
    NUMBER = "number"
    SELECT = "select"
    MULTI_SELECT = "multi_select"
    DATE = "date"
    CHECKBOX = "checkbox"
    URL = "url"
    EMAIL = "email"
    PHONE_NUMBER = "phone_number"
    FILES = "files"
    RELATION = "relation"
    ROLLUP = "rollup"
    FORMULA = "formula"
    CREATED_TIME = "created_time"
    CREATED_BY = "created_by"
    LAST_EDITED_TIME = "last_edited_time"
    LAST_EDITED_BY = "last_edited_by"


class NotionService:
    """
    Comprehensive Notion API service
    
    Features:
    - Database connection and management
    - Page creation with rich content
    - Property management and updates
    - Media embedding (images, videos)
    - Query and filtering capabilities
    - Batch operations for efficiency
    - Error handling and retry logic
    """
    
    def __init__(
        self,
        token: str,
        database_id: str,
        rate_limiter: RateLimiter,
        error_handler: APIErrorHandler
    ):
        """
        Initialize Notion service
        
        Args:
            token: Notion integration token
            database_id: Main database ID for recipes
            rate_limiter: Rate limiting manager
            error_handler: Error handling manager
        """
        self.token = token
        self.database_id = database_id
        self.rate_limiter = rate_limiter
        self.error_handler = error_handler
        self.logger = get_api_logger('notion')
        
        # Initialize Notion client
        self.client = AsyncClient(auth=token)
        
        # Cache for database schemas and properties
        self._schema_cache: Dict[str, Tuple[Dict[str, Any], float]] = {}
        self.cache_ttl = 3600  # 1 hour
        
        # Request tracking
        self.requests_made = 0
        self.pages_created = 0
        self.pages_updated = 0
        
        # Database schema configuration for recipes
        self.recipe_schema = self._get_recipe_database_schema()
        
        self.logger.info(f"Notion service initialized for database: {database_id}")
    
    def _get_recipe_database_schema(self) -> Dict[str, Any]:
        """Define the expected recipe database schema"""
        return {
            "Title (EN)": {"type": NotionPropertyType.TITLE},
            "Title (JA)": {"type": NotionPropertyType.RICH_TEXT},
            "Description (EN)": {"type": NotionPropertyType.RICH_TEXT},
            "Description (JA)": {"type": NotionPropertyType.RICH_TEXT},
            "YouTube URL": {"type": NotionPropertyType.URL},
            "Channel": {"type": NotionPropertyType.RICH_TEXT},
            "Published Date": {"type": NotionPropertyType.DATE},
            "Duration (sec)": {"type": NotionPropertyType.NUMBER},
            "Recipe Type": {"type": NotionPropertyType.SELECT},
            "Meat Ingredients": {"type": NotionPropertyType.MULTI_SELECT},
            "Tags": {"type": NotionPropertyType.MULTI_SELECT},
            "Thumbnail": {"type": NotionPropertyType.FILES},
            "View Count": {"type": NotionPropertyType.NUMBER},
            "Like Count": {"type": NotionPropertyType.NUMBER},
            "Cooking Time (min)": {"type": NotionPropertyType.NUMBER},
            "Servings": {"type": NotionPropertyType.NUMBER},
            "Difficulty": {"type": NotionPropertyType.SELECT},
            "Confidence Score": {"type": NotionPropertyType.NUMBER},
            "Processed": {"type": NotionPropertyType.CHECKBOX},
            "Created": {"type": NotionPropertyType.CREATED_TIME}
        }
    
    @handle_api_errors(None, 'notion', 'get_database')
    async def get_database(self, database_id: Optional[str] = None) -> NotionDatabase:
        """
        Get database information and schema
        
        Args:
            database_id: Database ID (uses default if None)
            
        Returns:
            NotionDatabase object
        """
        db_id = database_id or self.database_id
        
        # Check cache
        cache_key = f"database_{db_id}"
        if cache_key in self._schema_cache:
            cached_data, timestamp = self._schema_cache[cache_key]
            if time.time() - timestamp < self.cache_ttl:
                return NotionDatabase(**cached_data)
        
        await self.rate_limiter.wait_if_needed('notion', 'retrieve_database')
        
        try:
            response = await self.client.databases.retrieve(database_id=db_id)
            self.requests_made += 1
            
            # Parse response
            database = NotionDatabase(
                database_id=db_id,
                title=self._extract_title_from_rich_text(response.get('title', [])),
                url=response.get('url', ''),
                created_time=datetime.fromisoformat(response['created_time'].replace('Z', '+00:00')),
                last_edited_time=datetime.fromisoformat(response['last_edited_time'].replace('Z', '+00:00')),
                properties=response.get('properties', {}),
                description=response.get('description', []),
                cover_url=response.get('cover', {}).get('external', {}).get('url') if response.get('cover') else None,
                icon_emoji=response.get('icon', {}).get('emoji') if response.get('icon') else None
            )
            
            # Cache result
            self._schema_cache[cache_key] = (database.__dict__.copy(), time.time())
            
            self.logger.info(f"Retrieved database: {database.title}")
            return database
            
        except APIErrorResponse as e:
            self.logger.error(f"Notion API error retrieving database {db_id}: {e}")
            raise
        except Exception as e:
            self.logger.error(f"Unexpected error retrieving database {db_id}: {e}")
            raise
    
    @handle_api_errors(None, 'notion', 'create_recipe_page')
    async def create_recipe_page(
        self,
        recipe_data: RecipePageData,
        database_id: Optional[str] = None
    ) -> NotionPage:
        """
        Create a new recipe page in the database
        
        Args:
            recipe_data: Recipe data to create page with
            database_id: Database ID (uses default if None)
            
        Returns:
            NotionPage object representing created page
        """
        db_id = database_id or self.database_id
        
        await self.rate_limiter.wait_if_needed('notion', 'create_page')
        
        try:
            # Build page properties
            properties = self._build_recipe_properties(recipe_data)
            
            # Build page content blocks
            content_blocks = await self._build_recipe_content_blocks(recipe_data)
            
            # Create page
            page_data = {
                "parent": {"database_id": db_id},
                "properties": properties,
                "children": content_blocks
            }
            
            # Set cover image if available
            if recipe_data.thumbnail_url:
                page_data["cover"] = {
                    "type": "external",
                    "external": {"url": recipe_data.thumbnail_url}
                }
            
            # Set icon
            page_data["icon"] = {"type": "emoji", "emoji": "🍳"}
            
            response = await self.client.pages.create(**page_data)
            self.requests_made += 1
            self.pages_created += 1
            
            # Parse response into NotionPage
            page = self._parse_page_response(response)
            
            self.logger.info(f"Created recipe page: {recipe_data.title_en}")
            return page
            
        except APIErrorResponse as e:
            self.logger.error(f"Notion API error creating recipe page: {e}")
            raise
        except Exception as e:
            self.logger.error(f"Unexpected error creating recipe page: {e}")
            raise
    
    def _build_recipe_properties(self, recipe_data: RecipePageData) -> Dict[str, Any]:
        """Build Notion properties from recipe data"""
        properties = {}
        
        # Title (EN) - Title property
        properties["Title (EN)"] = {
            "title": [{"text": {"content": recipe_data.title_en}}]
        }
        
        # Title (JA) - Rich text
        if recipe_data.title_ja:
            properties["Title (JA)"] = {
                "rich_text": [{"text": {"content": recipe_data.title_ja}}]
            }
        
        # Descriptions
        if recipe_data.description_en:
            properties["Description (EN)"] = {
                "rich_text": [{"text": {"content": recipe_data.description_en[:2000]}}]  # Limit length
            }
        
        if recipe_data.description_ja:
            properties["Description (JA)"] = {
                "rich_text": [{"text": {"content": recipe_data.description_ja[:2000]}}]
            }
        
        # YouTube URL
        if recipe_data.youtube_url:
            properties["YouTube URL"] = {"url": recipe_data.youtube_url}
        
        # Channel
        if recipe_data.channel_name:
            properties["Channel"] = {
                "rich_text": [{"text": {"content": recipe_data.channel_name}}]
            }
        
        # Published Date
        properties["Published Date"] = {
            "date": {"start": recipe_data.published_date.isoformat()}
        }
        
        # Duration
        properties["Duration (sec)"] = {"number": recipe_data.duration}
        
        # Recipe Type
        if recipe_data.recipe_type:
            properties["Recipe Type"] = {
                "select": {"name": recipe_data.recipe_type}
            }
        
        # Meat Ingredients (Multi-select)
        if recipe_data.meat_ingredients:
            properties["Meat Ingredients"] = {
                "multi_select": [{"name": ingredient} for ingredient in recipe_data.meat_ingredients[:10]]
            }
        
        # Tags (Multi-select)
        if recipe_data.tags:
            properties["Tags"] = {
                "multi_select": [{"name": tag} for tag in recipe_data.tags[:15]]
            }
        
        # Thumbnail (Files)
        if recipe_data.thumbnail_url:
            properties["Thumbnail"] = {
                "files": [{
                    "type": "external",
                    "name": "Thumbnail",
                    "external": {"url": recipe_data.thumbnail_url}
                }]
            }
        
        # Numeric properties
        if recipe_data.view_count is not None:
            properties["View Count"] = {"number": recipe_data.view_count}
        
        if recipe_data.like_count is not None:
            properties["Like Count"] = {"number": recipe_data.like_count}
        
        if recipe_data.cooking_time is not None:
            properties["Cooking Time (min)"] = {"number": recipe_data.cooking_time}
        
        if recipe_data.servings is not None:
            properties["Servings"] = {"number": recipe_data.servings}
        
        if recipe_data.difficulty:
            properties["Difficulty"] = {
                "select": {"name": recipe_data.difficulty}
            }
        
        if recipe_data.confidence_score is not None:
            properties["Confidence Score"] = {"number": round(recipe_data.confidence_score, 2)}
        
        # Mark as processed
        properties["Processed"] = {"checkbox": True}
        
        return properties
    
    async def _build_recipe_content_blocks(self, recipe_data: RecipePageData) -> List[Dict[str, Any]]:
        """Build content blocks for recipe page"""
        blocks = []
        
        # Add video embed if YouTube URL is available
        if recipe_data.youtube_url:
            blocks.append({
                "object": "block",
                "type": "embed",
                "embed": {"url": recipe_data.youtube_url}
            })
        
        # Add divider
        blocks.append({
            "object": "block",
            "type": "divider",
            "divider": {}
        })
        
        # Add ingredients section
        if recipe_data.ingredients:
            blocks.append({
                "object": "block",
                "type": "heading_2",
                "heading_2": {
                    "rich_text": [{"text": {"content": "🥘 Ingredients / 材料"}}]
                }
            })
            
            # Add ingredients list
            ingredient_items = []
            for ingredient in recipe_data.ingredients[:20]:  # Limit to 20 ingredients
                ingredient_text = f"{ingredient.get('amount', '')} {ingredient.get('unit', '')} {ingredient.get('name_en', '')}"
                if ingredient.get('name_ja'):
                    ingredient_text += f" / {ingredient['name_ja']}"
                
                ingredient_items.append({
                    "object": "block",
                    "type": "bulleted_list_item",
                    "bulleted_list_item": {
                        "rich_text": [{"text": {"content": ingredient_text.strip()}}]
                    }
                })
            
            blocks.extend(ingredient_items)
        
        # Add instructions section
        if recipe_data.instructions:
            blocks.append({
                "object": "block",
                "type": "heading_2", 
                "heading_2": {
                    "rich_text": [{"text": {"content": "👨‍🍳 Instructions / 作り方"}}]
                }
            })
            
            # Add numbered instructions
            for i, instruction in enumerate(recipe_data.instructions[:15], 1):  # Limit to 15 steps
                blocks.append({
                    "object": "block",
                    "type": "numbered_list_item",
                    "numbered_list_item": {
                        "rich_text": [{"text": {"content": instruction}}]
                    }
                })
        
        # Add metadata section
        metadata_items = []
        
        if recipe_data.cooking_time:
            metadata_items.append(f"⏱️ Cooking Time: {recipe_data.cooking_time} minutes")
        
        if recipe_data.servings:
            metadata_items.append(f"🍽️ Servings: {recipe_data.servings}")
        
        if recipe_data.difficulty:
            metadata_items.append(f"📊 Difficulty: {recipe_data.difficulty}")
        
        if metadata_items:
            blocks.append({
                "object": "block",
                "type": "heading_3",
                "heading_3": {
                    "rich_text": [{"text": {"content": "📋 Recipe Info"}}]
                }
            })
            
            for item in metadata_items:
                blocks.append({
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {
                        "rich_text": [{"text": {"content": item}}]
                    }
                })
        
        return blocks
    
    @handle_api_errors(None, 'notion', 'update_page')
    async def update_page(
        self,
        page_id: str,
        properties: Dict[str, Any],
        append_content: Optional[List[Dict[str, Any]]] = None
    ) -> NotionPage:
        """
        Update an existing page
        
        Args:
            page_id: Page ID to update
            properties: Properties to update
            append_content: Content blocks to append
            
        Returns:
            Updated NotionPage object
        """
        await self.rate_limiter.wait_if_needed('notion', 'update_page')
        
        try:
            # Update properties
            update_data = {"properties": properties}
            
            response = await self.client.pages.update(page_id=page_id, **update_data)
            self.requests_made += 1
            self.pages_updated += 1
            
            # Append content blocks if provided
            if append_content:
                await self.rate_limiter.wait_if_needed('notion', 'append_blocks')
                
                await self.client.blocks.children.append(
                    block_id=page_id,
                    children=append_content
                )
                self.requests_made += 1
            
            page = self._parse_page_response(response)
            
            self.logger.info(f"Updated page: {page_id}")
            return page
            
        except APIErrorResponse as e:
            self.logger.error(f"Notion API error updating page {page_id}: {e}")
            raise
        except Exception as e:
            self.logger.error(f"Unexpected error updating page {page_id}: {e}")
            raise
    
    @handle_api_errors(None, 'notion', 'query_database')
    async def query_database(
        self,
        database_id: Optional[str] = None,
        filter_conditions: Optional[Dict[str, Any]] = None,
        sorts: Optional[List[Dict[str, Any]]] = None,
        start_cursor: Optional[str] = None,
        page_size: int = 100
    ) -> Dict[str, Any]:
        """
        Query database with filtering and sorting
        
        Args:
            database_id: Database ID (uses default if None)
            filter_conditions: Filter conditions
            sorts: Sort conditions
            start_cursor: Pagination cursor
            page_size: Number of results per page
            
        Returns:
            Query results with pages and pagination info
        """
        db_id = database_id or self.database_id
        
        await self.rate_limiter.wait_if_needed('notion', 'query_database')
        
        try:
            query_params = {"database_id": db_id, "page_size": page_size}
            
            if filter_conditions:
                query_params["filter"] = filter_conditions
            
            if sorts:
                query_params["sorts"] = sorts
            
            if start_cursor:
                query_params["start_cursor"] = start_cursor
            
            response = await self.client.databases.query(**query_params)
            self.requests_made += 1
            
            # Parse pages
            pages = [self._parse_page_response(page_data) for page_data in response.get('results', [])]
            
            result = {
                'pages': pages,
                'has_more': response.get('has_more', False),
                'next_cursor': response.get('next_cursor'),
                'total_count': len(pages)
            }
            
            self.logger.info(f"Queried database {db_id}: {len(pages)} results")
            return result
            
        except APIErrorResponse as e:
            self.logger.error(f"Notion API error querying database {db_id}: {e}")
            raise
        except Exception as e:
            self.logger.error(f"Unexpected error querying database {db_id}: {e}")
            raise
    
    async def search_recipes(
        self,
        search_query: Optional[str] = None,
        recipe_type: Optional[str] = None,
        channel: Optional[str] = None,
        has_meat: Optional[bool] = None,
        limit: int = 50
    ) -> List[NotionPage]:
        """
        Search recipes with various filters
        
        Args:
            search_query: Text search query
            recipe_type: Filter by recipe type
            channel: Filter by channel name
            has_meat: Filter by meat content
            limit: Maximum results to return
            
        Returns:
            List of matching NotionPage objects
        """
        filter_conditions = {"and": []}
        
        # Recipe type filter
        if recipe_type:
            filter_conditions["and"].append({
                "property": "Recipe Type",
                "select": {"equals": recipe_type}
            })
        
        # Channel filter
        if channel:
            filter_conditions["and"].append({
                "property": "Channel",
                "rich_text": {"contains": channel}
            })
        
        # Meat content filter
        if has_meat is not None:
            if has_meat:
                filter_conditions["and"].append({
                    "property": "Meat Ingredients",
                    "multi_select": {"is_not_empty": True}
                })
            else:
                filter_conditions["and"].append({
                    "property": "Meat Ingredients",
                    "multi_select": {"is_empty": True}
                })
        
        # Text search (search in titles)
        if search_query:
            filter_conditions["and"].append({
                "or": [
                    {
                        "property": "Title (EN)",
                        "title": {"contains": search_query}
                    },
                    {
                        "property": "Title (JA)",
                        "rich_text": {"contains": search_query}
                    }
                ]
            })
        
        # Remove empty filter if no conditions
        if not filter_conditions["and"]:
            filter_conditions = None
        
        # Sort by creation date (newest first)
        sorts = [{"property": "Created", "direction": "descending"}]
        
        # Query database
        results = await self.query_database(
            filter_conditions=filter_conditions,
            sorts=sorts,
            page_size=min(limit, 100)
        )
        
        return results['pages']
    
    async def batch_create_recipe_pages(
        self,
        recipe_data_list: List[RecipePageData],
        batch_size: int = 5
    ) -> List[NotionPage]:
        """
        Create multiple recipe pages in batches
        
        Args:
            recipe_data_list: List of recipe data
            batch_size: Number of pages to create concurrently
            
        Returns:
            List of created NotionPage objects
        """
        created_pages = []
        
        # Process in batches
        for i in range(0, len(recipe_data_list), batch_size):
            batch = recipe_data_list[i:i + batch_size]
            
            # Create tasks for concurrent processing
            tasks = [
                self.create_recipe_page(recipe_data)
                for recipe_data in batch
            ]
            
            # Execute batch
            try:
                batch_results = await asyncio.gather(*tasks, return_exceptions=True)
                
                for j, result in enumerate(batch_results):
                    if isinstance(result, Exception):
                        self.logger.error(f"Error creating recipe page {i+j}: {result}")
                    else:
                        created_pages.append(result)
                        self.logger.info(f"Created page {len(created_pages)}/{len(recipe_data_list)}")
                
            except Exception as e:
                self.logger.error(f"Error in batch {i//batch_size + 1}: {e}")
            
            # Small delay between batches to respect rate limits
            if i + batch_size < len(recipe_data_list):
                await asyncio.sleep(1)
        
        self.logger.info(f"Batch creation completed: {len(created_pages)} pages created")
        return created_pages
    
    def _parse_page_response(self, page_data: Dict[str, Any]) -> NotionPage:
        """Parse Notion API page response into NotionPage object"""
        try:
            # Extract title from title property
            title = ""
            properties = page_data.get('properties', {})
            
            for prop_name, prop_data in properties.items():
                if prop_data.get('type') == 'title' and prop_data.get('title'):
                    title = self._extract_text_from_rich_text(prop_data['title'])
                    break
            
            return NotionPage(
                page_id=page_data['id'],
                title=title,
                url=page_data.get('url', ''),
                created_time=datetime.fromisoformat(page_data['created_time'].replace('Z', '+00:00')),
                last_edited_time=datetime.fromisoformat(page_data['last_edited_time'].replace('Z', '+00:00')),
                properties=properties,
                parent_database_id=page_data.get('parent', {}).get('database_id'),
                cover_url=page_data.get('cover', {}).get('external', {}).get('url') if page_data.get('cover') else None,
                icon_emoji=page_data.get('icon', {}).get('emoji') if page_data.get('icon') else None
            )
        except Exception as e:
            self.logger.error(f"Error parsing page response: {e}")
            raise
    
    def _extract_title_from_rich_text(self, rich_text_array: List[Dict[str, Any]]) -> str:
        """Extract plain text from rich text array"""
        if not rich_text_array:
            return ""
        return "".join([item.get('plain_text', '') for item in rich_text_array])
    
    def _extract_text_from_rich_text(self, rich_text_array: List[Dict[str, Any]]) -> str:
        """Extract text from rich text array"""
        return self._extract_title_from_rich_text(rich_text_array)
    
    async def verify_database_schema(self, database_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Verify that database has required properties for recipes
        
        Args:
            database_id: Database ID to verify
            
        Returns:
            Verification result with missing/incorrect properties
        """
        db_id = database_id or self.database_id
        
        try:
            database = await self.get_database(db_id)
            existing_properties = database.properties
            
            verification_result = {
                'valid': True,
                'missing_properties': [],
                'incorrect_types': [],
                'recommendations': []
            }
            
            # Check each required property
            for prop_name, expected_config in self.recipe_schema.items():
                if prop_name not in existing_properties:
                    verification_result['missing_properties'].append(prop_name)
                    verification_result['valid'] = False
                else:
                    existing_prop = existing_properties[prop_name]
                    expected_type = expected_config['type']
                    
                    if existing_prop.get('type') != expected_type:
                        verification_result['incorrect_types'].append({
                            'property': prop_name,
                            'expected': expected_type,
                            'actual': existing_prop.get('type')
                        })
                        verification_result['valid'] = False
            
            # Add recommendations
            if verification_result['missing_properties']:
                verification_result['recommendations'].append(
                    f"Add missing properties: {', '.join(verification_result['missing_properties'])}"
                )
            
            if verification_result['incorrect_types']:
                verification_result['recommendations'].append(
                    "Update property types to match expected schema"
                )
            
            self.logger.info(f"Database schema verification: {'✅ Valid' if verification_result['valid'] else '❌ Invalid'}")
            return verification_result
            
        except Exception as e:
            self.logger.error(f"Error verifying database schema: {e}")
            return {
                'valid': False,
                'error': str(e),
                'missing_properties': [],
                'incorrect_types': [],
                'recommendations': ['Fix database access issues first']
            }
    
    def get_usage_statistics(self) -> Dict[str, Any]:
        """Get API usage statistics"""
        return {
            'requests_made': self.requests_made,
            'pages_created': self.pages_created,
            'pages_updated': self.pages_updated,
            'cache_entries': len(self._schema_cache)
        }
    
    def clear_cache(self) -> int:
        """Clear schema cache"""
        cleared_count = len(self._schema_cache)
        self._schema_cache.clear()
        self.logger.info(f"Cleared {cleared_count} cached schema entries")
        return cleared_count


# Example usage
async def example_usage():
    """Example usage of Notion service"""
    from config.rate_limiter import RateLimiter
    from config.error_handler import APIErrorHandler
    from pathlib import Path
    from datetime import datetime
    
    # Initialize dependencies
    rate_limiter = RateLimiter()
    error_handler = APIErrorHandler(Path("./config"))
    
    # Initialize Notion service (replace with real token and database ID)
    notion_service = NotionService(
        token="YOUR_NOTION_TOKEN",
        database_id="YOUR_DATABASE_ID",
        rate_limiter=rate_limiter,
        error_handler=error_handler
    )
    
    # Verify database schema
    schema_check = await notion_service.verify_database_schema()
    print(f"Schema valid: {schema_check['valid']}")
    
    # Create sample recipe page
    recipe_data = RecipePageData(
        title_en="Perfect Pasta Carbonara",
        title_ja="完璧なパスタカルボナーラ",
        description_en="Classic Italian pasta dish with eggs, cheese, and pancetta",
        description_ja="卵、チーズ、パンチェッタを使った古典的なイタリアンパスタ",
        youtube_url="https://www.youtube.com/watch?v=example",
        channel_name="Italian Cooking Channel",
        published_date=datetime.now(),
        duration=900,  # 15 minutes
        recipe_type="meat_based",
        meat_ingredients=["pancetta", "egg"],
        ingredients=[
            {"name_en": "spaghetti", "name_ja": "スパゲッティ", "amount": "400", "unit": "g"},
            {"name_en": "pancetta", "name_ja": "パンチェッタ", "amount": "100", "unit": "g"},
            {"name_en": "eggs", "name_ja": "卵", "amount": "3", "unit": "pieces"}
        ],
        instructions=[
            "Cook pasta in salted water until al dente",
            "Fry pancetta until crispy",
            "Mix eggs and cheese in bowl",
            "Combine everything while hot"
        ],
        tags=["pasta", "italian", "quick", "classic"],
        cooking_time=20,
        servings=4,
        difficulty="medium",
        confidence_score=0.9
    )
    
    # Create the page
    created_page = await notion_service.create_recipe_page(recipe_data)
    print(f"Created page: {created_page.title} ({created_page.page_id})")
    
    # Search for recipes
    search_results = await notion_service.search_recipes(
        search_query="pasta",
        recipe_type="meat_based",
        limit=10
    )
    
    print(f"Found {len(search_results)} matching recipes")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(example_usage())