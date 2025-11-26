#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Claude API Service
Recipe-DevAPI Agent

This module provides comprehensive Claude API integration for recipe analysis,
translation, content generation, and meat dish detection.
"""

import asyncio
import logging
import time
from typing import Dict, List, Optional, Any, Union, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import json
import re

import httpx
from anthropic import AsyncAnthropic
from anthropic.types import Message, TextBlock

from config.rate_limiter import RateLimiter, APIRateLimitDecorator
from config.error_handler import APIErrorHandler, handle_api_errors
from config.logger_config import get_api_logger


class RecipeType(Enum):
    """Recipe type classification"""
    MEAT_BASED = "meat_based"
    VEGETARIAN = "vegetarian"
    VEGAN = "vegan"
    SEAFOOD = "seafood"
    DAIRY_BASED = "dairy_based"
    UNKNOWN = "unknown"


class AnalysisType(Enum):
    """Types of analysis available"""
    RECIPE_EXTRACTION = "recipe_extraction"
    MEAT_DETECTION = "meat_detection"
    TRANSLATION = "translation"
    CONTENT_SUMMARIZATION = "content_summarization"
    INGREDIENT_ANALYSIS = "ingredient_analysis"
    COOKING_TECHNIQUE = "cooking_technique"
    NUTRITIONAL_ASSESSMENT = "nutritional_assessment"


@dataclass
class RecipeAnalysis:
    """Complete recipe analysis result"""
    recipe_type: RecipeType
    confidence_score: float  # 0.0 to 1.0
    title_en: str
    title_ja: str
    description_en: str
    description_ja: str
    ingredients: List[Dict[str, Any]]
    instructions: List[str]
    cooking_time: Optional[int] = None  # minutes
    servings: Optional[int] = None
    difficulty: Optional[str] = None
    techniques: List[str] = field(default_factory=list)
    meat_ingredients: List[str] = field(default_factory=list)
    allergens: List[str] = field(default_factory=list)
    nutritional_info: Optional[Dict[str, Any]] = None
    tags: List[str] = field(default_factory=list)
    source_language: str = "en"
    analysis_timestamp: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return {
            'recipe_type': self.recipe_type.value,
            'confidence_score': self.confidence_score,
            'title_en': self.title_en,
            'title_ja': self.title_ja,
            'description_en': self.description_en,
            'description_ja': self.description_ja,
            'ingredients': self.ingredients,
            'instructions': self.instructions,
            'cooking_time': self.cooking_time,
            'servings': self.servings,
            'difficulty': self.difficulty,
            'techniques': self.techniques,
            'meat_ingredients': self.meat_ingredients,
            'allergens': self.allergens,
            'nutritional_info': self.nutritional_info,
            'tags': self.tags,
            'source_language': self.source_language,
            'analysis_timestamp': self.analysis_timestamp.isoformat()
        }


@dataclass
class TranslationResult:
    """Translation result structure"""
    original_text: str
    translated_text: str
    source_language: str
    target_language: str
    confidence: float
    detected_recipe_terms: List[str] = field(default_factory=list)
    cooking_context: bool = False


class ClaudeService:
    """
    Comprehensive Claude API service for recipe analysis and translation
    
    Features:
    - Recipe content analysis and extraction
    - Intelligent meat dish detection
    - High-quality English to Japanese translation
    - Cooking technique identification
    - Nutritional assessment
    - Structured data generation
    - Context-aware processing
    """
    
    def __init__(
        self,
        api_key: str,
        rate_limiter: RateLimiter,
        error_handler: APIErrorHandler,
        model: str = "claude-3-5-sonnet-20241022"
    ):
        """
        Initialize Claude service
        
        Args:
            api_key: Claude API key
            rate_limiter: Rate limiting manager
            error_handler: Error handling manager
            model: Claude model to use
        """
        self.api_key = api_key
        self.rate_limiter = rate_limiter
        self.error_handler = error_handler
        self.model = model
        self.logger = get_api_logger('claude')
        
        # Initialize Claude client
        self.client = AsyncAnthropic(api_key=api_key)
        
        # Analysis cache
        self._analysis_cache: Dict[str, Tuple[Any, float]] = {}
        self.cache_ttl = 3600  # 1 hour
        
        # Token usage tracking
        self.tokens_used = 0
        self.requests_made = 0
        
        # Load cooking terminology for better analysis
        self.cooking_terms = self._load_cooking_terminology()
        self.meat_keywords = self._load_meat_keywords()
        
        self.logger.info(f"Claude service initialized with model: {model}")
    
    def _load_cooking_terminology(self) -> Dict[str, List[str]]:
        """Load cooking terminology for analysis"""
        return {
            'cooking_methods': [
                'bake', 'roast', 'grill', 'fry', 'sauté', 'steam', 'boil', 'simmer',
                'braise', 'stew', 'poach', 'broil', 'barbecue', 'smoke', 'cure',
                'marinate', 'season', 'blanch', 'sear', 'caramelize'
            ],
            'cooking_terms_ja': [
                '焼く', '煮る', '炒める', '蒸す', '揚げる', '茹でる', '炊く',
                '煮込む', '和える', '漬ける', '燻す', '焦がす'
            ],
            'kitchen_tools': [
                'pan', 'pot', 'skillet', 'oven', 'grill', 'steamer', 'wok',
                'knife', 'cutting board', 'whisk', 'spatula', 'tongs'
            ],
            'measurements': [
                'cup', 'tablespoon', 'teaspoon', 'ounce', 'pound', 'gram',
                'kilogram', 'milliliter', 'liter', 'inch', 'centimeter'
            ]
        }
    
    def _load_meat_keywords(self) -> Dict[str, List[str]]:
        """Load meat-related keywords for detection"""
        return {
            'meat_types': [
                'beef', 'pork', 'chicken', 'turkey', 'duck', 'lamb', 'veal',
                'bacon', 'ham', 'sausage', 'ground beef', 'steak', 'ribs',
                'brisket', 'tenderloin', 'drumstick', 'thigh', 'breast'
            ],
            'meat_types_ja': [
                '牛肉', '豚肉', '鶏肉', '七面鳥', '鴨肉', '羊肉', '子牛肉',
                'ベーコン', 'ハム', 'ソーセージ', 'ひき肉', 'ステーキ'
            ],
            'seafood': [
                'fish', 'salmon', 'tuna', 'cod', 'shrimp', 'crab', 'lobster',
                'scallops', 'mussels', 'clams', 'oysters', 'sardines'
            ],
            'seafood_ja': [
                '魚', 'サーモン', 'マグロ', 'タラ', 'エビ', 'カニ', 'ロブスター',
                'ホタテ', 'ムール貝', 'アサリ', '牡蠣', 'イワシ'
            ],
            'meat_products': [
                'broth', 'stock', 'gelatin', 'lard', 'tallow', 'bone',
                'marrow', 'fat', 'drippings'
            ]
        }
    
    @handle_api_errors(None, 'claude', 'analyze_recipe_content')
    async def analyze_recipe_content(
        self,
        content: str,
        video_title: str = "",
        video_description: str = "",
        analysis_types: List[AnalysisType] = None
    ) -> RecipeAnalysis:
        """
        Comprehensive recipe content analysis
        
        Args:
            content: Raw content to analyze
            video_title: Video title for context
            video_description: Video description for context
            analysis_types: Specific analysis types to perform
            
        Returns:
            RecipeAnalysis object with complete analysis
        """
        if analysis_types is None:
            analysis_types = [
                AnalysisType.RECIPE_EXTRACTION,
                AnalysisType.MEAT_DETECTION,
                AnalysisType.TRANSLATION,
                AnalysisType.INGREDIENT_ANALYSIS
            ]
        
        # Check cache
        cache_key = self._generate_cache_key(content, video_title, analysis_types)
        cached_result = self._get_cached_analysis(cache_key)
        if cached_result:
            self.logger.debug("Using cached recipe analysis")
            return cached_result
        
        await self.rate_limiter.wait_if_needed('claude', 'recipe_analysis')
        
        try:
            # Build comprehensive analysis prompt
            analysis_prompt = self._build_recipe_analysis_prompt(
                content, video_title, video_description, analysis_types
            )
            
            # Make API call
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=4000,
                temperature=0.1,  # Low temperature for consistent analysis
                messages=[
                    {
                        "role": "user",
                        "content": analysis_prompt
                    }
                ]
            )
            
            # Track usage
            self.requests_made += 1
            self.tokens_used += response.usage.input_tokens + response.usage.output_tokens
            
            # Parse response
            analysis_result = self._parse_recipe_analysis(response)
            
            # Cache result
            self._cache_analysis(cache_key, analysis_result)
            
            self.logger.info(f"Recipe analysis completed: {analysis_result.recipe_type.value}")
            return analysis_result
            
        except Exception as e:
            self.logger.error(f"Error during recipe analysis: {e}")
            raise
    
    def _build_recipe_analysis_prompt(
        self,
        content: str,
        video_title: str,
        video_description: str,
        analysis_types: List[AnalysisType]
    ) -> str:
        """Build comprehensive recipe analysis prompt"""
        
        prompt_parts = [
            "You are an expert culinary analyst and translator specializing in recipe analysis.",
            "Please analyze the following content and provide a comprehensive recipe analysis.",
            "",
            f"Video Title: {video_title}",
            f"Video Description: {video_description}",
            f"Content: {content}",
            "",
            "Please provide your analysis in the following JSON format:",
            "{",
            '  "recipe_type": "meat_based|vegetarian|vegan|seafood|dairy_based|unknown",',
            '  "confidence_score": 0.0-1.0,',
            '  "title_en": "English title",',
            '  "title_ja": "Japanese title",',
            '  "description_en": "English description",',
            '  "description_ja": "Japanese description",',
            '  "ingredients": [',
            '    {',
            '      "name_en": "ingredient name in English",',
            '      "name_ja": "ingredient name in Japanese",',
            '      "amount": "quantity",',
            '      "unit": "measurement unit",',
            '      "optional": true/false',
            '    }',
            '  ],',
            '  "instructions": ["step 1", "step 2", "..."],',
            '  "cooking_time": minutes (number or null),',
            '  "servings": number of servings (number or null),',
            '  "difficulty": "easy|medium|hard|null",',
            '  "techniques": ["technique1", "technique2"],',
            '  "meat_ingredients": ["meat ingredient 1", "meat ingredient 2"],',
            '  "allergens": ["allergen1", "allergen2"],',
            '  "tags": ["tag1", "tag2", "tag3"],',
            '  "source_language": "detected language code"',
            "}",
            "",
            "Analysis Requirements:"
        ]
        
        if AnalysisType.RECIPE_EXTRACTION in analysis_types:
            prompt_parts.extend([
                "- Extract recipe information including ingredients, steps, timing, and servings",
                "- Identify cooking techniques and difficulty level"
            ])
        
        if AnalysisType.MEAT_DETECTION in analysis_types:
            prompt_parts.extend([
                "- Carefully detect ALL meat, poultry, seafood, and animal-derived ingredients",
                "- Include indirect meat products like broth, gelatin, lard, etc.",
                "- Classify as meat_based if ANY animal products are present",
                "- List specific meat ingredients found"
            ])
        
        if AnalysisType.TRANSLATION in analysis_types:
            prompt_parts.extend([
                "- Translate titles and descriptions to natural, fluent Japanese",
                "- Translate ingredient names to commonly used Japanese terms",
                "- Maintain cooking context and cultural appropriateness"
            ])
        
        if AnalysisType.INGREDIENT_ANALYSIS in analysis_types:
            prompt_parts.extend([
                "- Identify potential allergens (nuts, dairy, eggs, gluten, soy, etc.)",
                "- Extract precise measurements and units",
                "- Mark optional vs required ingredients"
            ])
        
        prompt_parts.extend([
            "",
            "Important Notes:",
            "- Be extremely thorough in detecting meat/animal products",
            "- Provide high-quality, natural Japanese translations",
            "- Use confidence scores honestly (1.0 only if completely certain)",
            "- Include relevant cooking tags for categorization",
            "- Respond ONLY with valid JSON, no additional text"
        ])
        
        return "\n".join(prompt_parts)
    
    def _parse_recipe_analysis(self, response: Message) -> RecipeAnalysis:
        """Parse Claude API response into RecipeAnalysis object"""
        try:
            # Extract content from response
            if not response.content or len(response.content) == 0:
                raise ValueError("Empty response from Claude API")
            
            content_block = response.content[0]
            if not isinstance(content_block, TextBlock):
                raise ValueError("Unexpected response format")
            
            response_text = content_block.text.strip()
            
            # Remove any markdown code blocks
            if response_text.startswith('```'):
                response_text = re.sub(r'^```[^\n]*\n', '', response_text)
                response_text = re.sub(r'\n```$', '', response_text)
            
            # Parse JSON
            try:
                data = json.loads(response_text)
            except json.JSONDecodeError as e:
                # Try to extract JSON from the response
                json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
                if json_match:
                    data = json.loads(json_match.group())
                else:
                    raise ValueError(f"Could not parse JSON: {e}")
            
            # Create RecipeAnalysis object
            analysis = RecipeAnalysis(
                recipe_type=RecipeType(data.get('recipe_type', 'unknown')),
                confidence_score=float(data.get('confidence_score', 0.0)),
                title_en=data.get('title_en', ''),
                title_ja=data.get('title_ja', ''),
                description_en=data.get('description_en', ''),
                description_ja=data.get('description_ja', ''),
                ingredients=data.get('ingredients', []),
                instructions=data.get('instructions', []),
                cooking_time=data.get('cooking_time'),
                servings=data.get('servings'),
                difficulty=data.get('difficulty'),
                techniques=data.get('techniques', []),
                meat_ingredients=data.get('meat_ingredients', []),
                allergens=data.get('allergens', []),
                tags=data.get('tags', []),
                source_language=data.get('source_language', 'en')
            )
            
            return analysis
            
        except Exception as e:
            self.logger.error(f"Error parsing recipe analysis response: {e}")
            self.logger.debug(f"Raw response: {response_text if 'response_text' in locals() else 'N/A'}")
            
            # Return minimal analysis object
            return RecipeAnalysis(
                recipe_type=RecipeType.UNKNOWN,
                confidence_score=0.0,
                title_en="Analysis Error",
                title_ja="解析エラー",
                description_en="Could not analyze content",
                description_ja="コンテンツを解析できませんでした",
                ingredients=[],
                instructions=[]
            )
    
    @handle_api_errors(None, 'claude', 'translate_text')
    async def translate_text(
        self,
        text: str,
        target_language: str = 'ja',
        source_language: str = 'auto',
        cooking_context: bool = True
    ) -> TranslationResult:
        """
        High-quality text translation with cooking context
        
        Args:
            text: Text to translate
            target_language: Target language code (ja for Japanese)
            source_language: Source language code (auto for detection)
            cooking_context: Whether to use cooking-specific translation
            
        Returns:
            TranslationResult object
        """
        await self.rate_limiter.wait_if_needed('claude', 'translation')
        
        try:
            # Build translation prompt
            translation_prompt = self._build_translation_prompt(
                text, target_language, cooking_context
            )
            
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=2000,
                temperature=0.1,
                messages=[
                    {
                        "role": "user", 
                        "content": translation_prompt
                    }
                ]
            )
            
            # Track usage
            self.requests_made += 1
            self.tokens_used += response.usage.input_tokens + response.usage.output_tokens
            
            # Parse translation result
            translation_result = self._parse_translation_response(
                response, text, target_language, cooking_context
            )
            
            self.logger.info(f"Translation completed: {source_language} -> {target_language}")
            return translation_result
            
        except Exception as e:
            self.logger.error(f"Error during translation: {e}")
            raise
    
    def _build_translation_prompt(
        self,
        text: str,
        target_language: str,
        cooking_context: bool
    ) -> str:
        """Build translation prompt"""
        
        lang_names = {
            'ja': 'Japanese',
            'en': 'English',
            'es': 'Spanish',
            'fr': 'French',
            'de': 'German'
        }
        
        target_lang_name = lang_names.get(target_language, target_language)
        
        prompt_parts = [
            f"Please translate the following text to {target_lang_name}.",
        ]
        
        if cooking_context:
            prompt_parts.extend([
                "This is cooking/culinary content, so please:",
                "- Use appropriate culinary terminology",
                "- Maintain cultural context for food names",
                "- Keep ingredient names accurate and recognizable",
                "- Use natural, fluent language that sounds native",
                ""
            ])
        
        prompt_parts.extend([
            "Please respond in JSON format:",
            "{",
            '  "translated_text": "your translation here",',
            '  "detected_source_language": "language code",',
            '  "confidence": 0.0-1.0,',
            '  "detected_recipe_terms": ["term1", "term2"],',
            '  "cooking_context_detected": true/false',
            "}",
            "",
            f"Text to translate: {text}"
        ])
        
        return "\n".join(prompt_parts)
    
    def _parse_translation_response(
        self,
        response: Message,
        original_text: str,
        target_language: str,
        cooking_context: bool
    ) -> TranslationResult:
        """Parse translation response"""
        try:
            content_block = response.content[0]
            response_text = content_block.text.strip()
            
            # Clean response
            if response_text.startswith('```'):
                response_text = re.sub(r'^```[^\n]*\n', '', response_text)
                response_text = re.sub(r'\n```$', '', response_text)
            
            data = json.loads(response_text)
            
            return TranslationResult(
                original_text=original_text,
                translated_text=data.get('translated_text', ''),
                source_language=data.get('detected_source_language', 'unknown'),
                target_language=target_language,
                confidence=float(data.get('confidence', 0.0)),
                detected_recipe_terms=data.get('detected_recipe_terms', []),
                cooking_context=data.get('cooking_context_detected', cooking_context)
            )
            
        except Exception as e:
            self.logger.error(f"Error parsing translation response: {e}")
            
            # Return minimal result
            return TranslationResult(
                original_text=original_text,
                translated_text=original_text,  # Fallback to original
                source_language='unknown',
                target_language=target_language,
                confidence=0.0
            )
    
    async def detect_meat_content(self, content: str) -> Tuple[bool, float, List[str]]:
        """
        Specialized meat detection analysis
        
        Args:
            content: Content to analyze
            
        Returns:
            Tuple of (contains_meat, confidence, meat_ingredients_found)
        """
        # Quick keyword-based check first
        quick_check = self._quick_meat_detection(content)
        
        if not quick_check:
            return False, 0.9, []
        
        # Use Claude for detailed analysis
        analysis = await self.analyze_recipe_content(
            content,
            analysis_types=[AnalysisType.MEAT_DETECTION]
        )
        
        contains_meat = analysis.recipe_type in [
            RecipeType.MEAT_BASED,
            RecipeType.SEAFOOD
        ]
        
        return contains_meat, analysis.confidence_score, analysis.meat_ingredients
    
    def _quick_meat_detection(self, content: str) -> bool:
        """Quick keyword-based meat detection"""
        content_lower = content.lower()
        
        # Check all meat keywords
        for category, keywords in self.meat_keywords.items():
            for keyword in keywords:
                if keyword.lower() in content_lower:
                    return True
        
        return False
    
    async def batch_analyze_videos(
        self,
        videos_data: List[Dict[str, Any]]
    ) -> List[RecipeAnalysis]:
        """
        Analyze multiple videos in batch
        
        Args:
            videos_data: List of video data dictionaries
            
        Returns:
            List of RecipeAnalysis objects
        """
        results = []
        
        # Process in parallel with rate limiting
        semaphore = asyncio.Semaphore(3)  # Limit concurrent requests
        
        async def analyze_single_video(video_data: Dict[str, Any]) -> RecipeAnalysis:
            async with semaphore:
                return await self.analyze_recipe_content(
                    content=video_data.get('description', ''),
                    video_title=video_data.get('title', ''),
                    video_description=video_data.get('description', '')
                )
        
        # Create tasks
        tasks = [
            analyze_single_video(video_data)
            for video_data in videos_data
        ]
        
        # Execute with progress tracking
        for i, task in enumerate(asyncio.as_completed(tasks)):
            try:
                result = await task
                results.append(result)
                self.logger.info(f"Analyzed video {i+1}/{len(videos_data)}")
            except Exception as e:
                self.logger.error(f"Error analyzing video {i+1}: {e}")
                # Add empty result to maintain order
                results.append(RecipeAnalysis(
                    recipe_type=RecipeType.UNKNOWN,
                    confidence_score=0.0,
                    title_en="Error",
                    title_ja="エラー", 
                    description_en="Analysis failed",
                    description_ja="解析に失敗しました",
                    ingredients=[],
                    instructions=[]
                ))
        
        return results
    
    # Cache management
    def _generate_cache_key(
        self,
        content: str,
        video_title: str,
        analysis_types: List[AnalysisType]
    ) -> str:
        """Generate cache key for analysis"""
        import hashlib
        
        key_data = f"{content[:500]}_{video_title}_{[t.value for t in analysis_types]}"
        return hashlib.sha256(key_data.encode()).hexdigest()[:16]
    
    def _get_cached_analysis(self, key: str) -> Optional[RecipeAnalysis]:
        """Get cached analysis if valid"""
        if key in self._analysis_cache:
            analysis, timestamp = self._analysis_cache[key]
            if time.time() - timestamp < self.cache_ttl:
                return analysis
        return None
    
    def _cache_analysis(self, key: str, analysis: RecipeAnalysis) -> None:
        """Cache analysis result"""
        self._analysis_cache[key] = (analysis, time.time())
    
    def get_usage_statistics(self) -> Dict[str, Any]:
        """Get API usage statistics"""
        return {
            'requests_made': self.requests_made,
            'tokens_used': self.tokens_used,
            'cache_entries': len(self._analysis_cache),
            'model': self.model
        }
    
    def clear_cache(self) -> int:
        """Clear analysis cache"""
        cleared_count = len(self._analysis_cache)
        self._analysis_cache.clear()
        self.logger.info(f"Cleared {cleared_count} cached analyses")
        return cleared_count


# Example usage
async def example_usage():
    """Example usage of Claude service"""
    from config.rate_limiter import RateLimiter
    from config.error_handler import APIErrorHandler
    from pathlib import Path
    
    # Initialize dependencies
    rate_limiter = RateLimiter()
    error_handler = APIErrorHandler(Path("./config"))
    
    # Initialize Claude service (replace with real API key)
    claude_service = ClaudeService(
        api_key="YOUR_CLAUDE_API_KEY",
        rate_limiter=rate_limiter,
        error_handler=error_handler
    )
    
    # Example recipe analysis
    sample_content = """
    Today I'm making beef steak with garlic butter. 
    Ingredients: 2 ribeye steaks, 4 cloves garlic, butter, salt, pepper.
    Cook steaks in hot pan for 4 minutes each side, then add garlic and butter.
    """
    
    # Analyze recipe
    analysis = await claude_service.analyze_recipe_content(
        content=sample_content,
        video_title="Perfect Ribeye Steak Recipe"
    )
    
    print(f"Recipe Type: {analysis.recipe_type.value}")
    print(f"Confidence: {analysis.confidence_score}")
    print(f"Title (EN): {analysis.title_en}")
    print(f"Title (JA): {analysis.title_ja}")
    print(f"Meat Ingredients: {analysis.meat_ingredients}")
    
    # Test translation
    translation = await claude_service.translate_text(
        "Sear the steak in a hot skillet with oil",
        target_language='ja',
        cooking_context=True
    )
    
    print(f"Translation: {translation.translated_text}")
    
    # Test meat detection
    contains_meat, confidence, meat_list = await claude_service.detect_meat_content(sample_content)
    print(f"Contains meat: {contains_meat} (confidence: {confidence})")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(example_usage())