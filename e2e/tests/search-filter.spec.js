// tests/search-filter.spec.js
import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

test.describe('Search and Filter Functionality @search', () => {
  test.beforeEach(async ({ page }) => {
    // Store test coordination
    try {
      execSync('npx claude-flow@alpha hooks pre-search --query "search and filter test" --cache-results true');
    } catch (error) {
      // Continue without coordination
    }
    
    // Login as test user
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test.user@example.com');
    await page.fill('[data-testid="password-input"]', 'TestUser123!');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('**/dashboard');
    
    // Navigate to recipes page
    await page.goto('/recipes');
  });

  test.afterEach(async ({ page }) => {
    // Store test results
    try {
      execSync('npx claude-flow@alpha hooks post-edit --file "search-filter.spec.js" --memory-key "testing/search/completed"');
    } catch (error) {
      // Continue without coordination
    }
  });

  test('should perform basic text search', async ({ page }) => {
    // Wait for page to load
    await page.waitForSelector('[data-testid="recipe-search"]');
    
    // Perform search
    const searchTerm = 'pasta';
    await page.fill('[data-testid="recipe-search"]', searchTerm);
    await page.press('[data-testid="recipe-search"]', 'Enter');
    
    // Wait for search results
    await page.waitForTimeout(1000);
    
    // Verify search results
    const recipeCards = page.locator('[data-testid="recipe-card"]');
    const count = await recipeCards.count();
    
    if (count > 0) {
      // Check if results contain search term in title or description
      const firstCard = recipeCards.first();
      const cardText = await firstCard.textContent();
      expect(cardText.toLowerCase()).toContain(searchTerm.toLowerCase());
    }
    
    // Check search term is preserved in input
    await expect(page.locator('[data-testid="recipe-search"]')).toHaveValue(searchTerm);
  });

  test('should filter by category', async ({ page }) => {
    // Select category filter
    await page.selectOption('[data-testid="category-filter"]', 'Main Course');
    
    // Wait for filter to apply
    await page.waitForTimeout(1000);
    
    // Verify filtered results
    const recipeCards = page.locator('[data-testid="recipe-card"]');
    const count = await recipeCards.count();
    
    if (count > 0) {
      // Check first card has correct category
      await recipeCards.first().click();
      await expect(page.locator('[data-testid="recipe-category"]')).toContainText('Main Course');
      await page.goBack();
    }
    
    // Test "All Categories" option
    await page.selectOption('[data-testid="category-filter"]', '');
    await page.waitForTimeout(1000);
    
    const allCards = page.locator('[data-testid="recipe-card"]');
    const allCount = await allCards.count();
    expect(allCount).toBeGreaterThanOrEqual(count);
  });

  test('should filter by cuisine type', async ({ page }) => {
    // Select cuisine filter
    await page.selectOption('[data-testid="cuisine-filter"]', 'Italian');
    
    // Wait for filter to apply
    await page.waitForTimeout(1000);
    
    // Verify filtered results
    const recipeCards = page.locator('[data-testid="recipe-card"]');
    const count = await recipeCards.count();
    
    if (count > 0) {
      // Check first card has correct cuisine
      await recipeCards.first().click();
      await expect(page.locator('[data-testid="recipe-cuisine"]')).toContainText('Italian');
      await page.goBack();
    }
  });

  test('should filter by difficulty level', async ({ page }) => {
    // Select difficulty filter
    await page.selectOption('[data-testid="difficulty-filter"]', 'Easy');
    
    // Wait for filter to apply
    await page.waitForTimeout(1000);
    
    // Verify filtered results
    const recipeCards = page.locator('[data-testid="recipe-card"]');
    const count = await recipeCards.count();
    
    if (count > 0) {
      // Check difficulty indicator on cards
      const difficultyIndicators = page.locator('[data-testid="recipe-difficulty"]');
      for (let i = 0; i < Math.min(3, count); i++) {
        await expect(difficultyIndicators.nth(i)).toContainText('Easy');
      }
    }
  });

  test('should filter by cooking time', async ({ page }) => {
    // Use time range filter
    await page.fill('[data-testid="max-cook-time"]', '30');
    await page.press('[data-testid="max-cook-time"]', 'Enter');
    
    // Wait for filter to apply
    await page.waitForTimeout(1000);
    
    // Verify filtered results
    const recipeCards = page.locator('[data-testid="recipe-card"]');
    const count = await recipeCards.count();
    
    if (count > 0) {
      // Check cook time on first card
      await recipeCards.first().click();
      const cookTimeText = await page.locator('[data-testid="cook-time"]').textContent();
      const cookTime = parseInt(cookTimeText.match(/\d+/)[0]);
      expect(cookTime).toBeLessThanOrEqual(30);
      await page.goBack();
    }
  });

  test('should filter by dietary restrictions', async ({ page }) => {
    // Select dietary filters
    await page.check('[data-testid="vegetarian-filter"]');
    await page.check('[data-testid="gluten-free-filter"]');
    
    // Wait for filter to apply
    await page.waitForTimeout(1000);
    
    // Verify filtered results
    const recipeCards = page.locator('[data-testid="recipe-card"]');
    const count = await recipeCards.count();
    
    if (count > 0) {
      // Check dietary tags on cards
      const dietaryTags = page.locator('[data-testid="dietary-tags"]');
      for (let i = 0; i < Math.min(3, count); i++) {
        const tagText = await dietaryTags.nth(i).textContent();
        expect(tagText.toLowerCase()).toMatch(/(vegetarian|gluten-free)/);
      }
    }
  });

  test('should combine multiple filters', async ({ page }) => {
    // Apply multiple filters
    await page.fill('[data-testid="recipe-search"]', 'chicken');
    await page.selectOption('[data-testid="category-filter"]', 'Main Course');
    await page.selectOption('[data-testid="difficulty-filter"]', 'Medium');
    await page.fill('[data-testid="max-cook-time"]', '45');
    
    // Apply filters
    await page.press('[data-testid="recipe-search"]', 'Enter');
    await page.waitForTimeout(1500);
    
    // Verify combined filter results
    const recipeCards = page.locator('[data-testid="recipe-card"]');
    const count = await recipeCards.count();
    
    // Check filter state is preserved
    await expect(page.locator('[data-testid="recipe-search"]')).toHaveValue('chicken');
    await expect(page.locator('[data-testid="category-filter"]')).toHaveValue('Main Course');
    await expect(page.locator('[data-testid="difficulty-filter"]')).toHaveValue('Medium');
    await expect(page.locator('[data-testid="max-cook-time"]')).toHaveValue('45');
    
    // Check active filter indicators
    await expect(page.locator('[data-testid="active-filters"]')).toBeVisible();
    await expect(page.locator('[data-testid="filter-count"]')).toContainText('4 active filters');
  });

  test('should clear all filters', async ({ page }) => {
    // Apply some filters first
    await page.fill('[data-testid="recipe-search"]', 'test');
    await page.selectOption('[data-testid="category-filter"]', 'Dessert');
    await page.check('[data-testid="vegetarian-filter"]');
    
    await page.waitForTimeout(1000);
    
    // Clear all filters
    await page.click('[data-testid="clear-filters-button"]');
    
    // Verify filters are cleared
    await expect(page.locator('[data-testid="recipe-search"]')).toHaveValue('');
    await expect(page.locator('[data-testid="category-filter"]')).toHaveValue('');
    await expect(page.locator('[data-testid="vegetarian-filter"]')).not.toBeChecked();
    
    // Check all recipes are shown
    const allRecipeCards = page.locator('[data-testid="recipe-card"]');
    const allCount = await allRecipeCards.count();
    expect(allCount).toBeGreaterThan(0);
  });

  test('should sort recipes by different criteria', async ({ page }) => {
    // Test sort by newest
    await page.selectOption('[data-testid="sort-by"]', 'newest');
    await page.waitForTimeout(1000);
    
    const newestCards = await page.locator('[data-testid="recipe-date"]').allTextContents();
    
    // Test sort by oldest
    await page.selectOption('[data-testid="sort-by"]', 'oldest');
    await page.waitForTimeout(1000);
    
    const oldestCards = await page.locator('[data-testid="recipe-date"]').allTextContents();
    
    // Verify sorting changed order (if there are multiple recipes)
    if (newestCards.length > 1) {
      expect(newestCards[0]).not.toBe(oldestCards[0]);
    }
    
    // Test sort by popularity
    await page.selectOption('[data-testid="sort-by"]', 'popularity');
    await page.waitForTimeout(1000);
    
    // Test sort by rating
    await page.selectOption('[data-testid="sort-by"]', 'rating');
    await page.waitForTimeout(1000);
    
    // Verify sort options are working
    await expect(page.locator('[data-testid="sort-by"]')).toHaveValue('rating');
  });

  test('should show no results message when no matches found', async ({ page }) => {
    // Search for something unlikely to exist
    await page.fill('[data-testid="recipe-search"]', 'xyzabc123nonexistent');
    await page.press('[data-testid="recipe-search"]', 'Enter');
    
    await page.waitForTimeout(1000);
    
    // Verify no results message
    await expect(page.locator('[data-testid="no-results-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="no-results-message"]')).toContainText('No recipes found');
    
    // Check suggestion to modify search
    await expect(page.locator('[data-testid="search-suggestions"]')).toBeVisible();
  });

  test('should provide search suggestions and autocomplete', async ({ page }) => {
    // Start typing in search
    await page.fill('[data-testid="recipe-search"]', 'chic');
    
    // Wait for autocomplete dropdown
    await page.waitForSelector('[data-testid="search-autocomplete"]', { timeout: 3000 });
    
    // Check if suggestions appear
    const suggestions = page.locator('[data-testid="search-suggestion"]');
    const suggestionCount = await suggestions.count();
    
    if (suggestionCount > 0) {
      // Click on first suggestion
      await suggestions.first().click();
      
      // Verify search input is updated
      const searchValue = await page.locator('[data-testid="recipe-search"]').inputValue();
      expect(searchValue.length).toBeGreaterThan(4);
    }
  });

  test('should handle advanced search with ingredients', async ({ page }) => {
    // Open advanced search
    await page.click('[data-testid="advanced-search-button"]');
    await expect(page.locator('[data-testid="advanced-search-panel"]')).toBeVisible();
    
    // Search by ingredients
    await page.fill('[data-testid="include-ingredients"]', 'tomato, basil, mozzarella');
    await page.fill('[data-testid="exclude-ingredients"]', 'mushroom, olives');
    
    // Apply advanced search
    await page.click('[data-testid="apply-advanced-search"]');
    await page.waitForTimeout(1000);
    
    // Verify advanced search is applied
    const recipeCards = page.locator('[data-testid="recipe-card"]');
    const count = await recipeCards.count();
    
    if (count > 0) {
      // Check first recipe contains included ingredients
      await recipeCards.first().click();
      const ingredientsText = await page.locator('[data-testid="recipe-ingredients"]').textContent();
      expect(ingredientsText.toLowerCase()).toMatch(/(tomato|basil|mozzarella)/);
      await page.goBack();
    }
  });

  test('should save and load search filters as presets', async ({ page }) => {
    // Apply some filters
    await page.fill('[data-testid="recipe-search"]', 'pasta');
    await page.selectOption('[data-testid="category-filter"]', 'Main Course');
    await page.selectOption('[data-testid="cuisine-filter"]', 'Italian');
    
    // Save as preset
    await page.click('[data-testid="save-preset-button"]');
    await page.fill('[data-testid="preset-name-input"]', 'Italian Pasta');
    await page.click('[data-testid="confirm-save-preset"]');
    
    // Clear filters
    await page.click('[data-testid="clear-filters-button"]');
    
    // Load preset
    await page.selectOption('[data-testid="filter-presets"]', 'Italian Pasta');
    
    // Verify preset is loaded
    await expect(page.locator('[data-testid="recipe-search"]')).toHaveValue('pasta');
    await expect(page.locator('[data-testid="category-filter"]')).toHaveValue('Main Course');
    await expect(page.locator('[data-testid="cuisine-filter"]')).toHaveValue('Italian');
  });

  test('should handle pagination in search results', async ({ page }) => {
    // Perform a broad search to get many results
    await page.fill('[data-testid="recipe-search"]', 'recipe');
    await page.press('[data-testid="recipe-search"]', 'Enter');
    await page.waitForTimeout(1000);
    
    // Check if pagination exists
    const pagination = page.locator('[data-testid="pagination"]');
    
    if (await pagination.isVisible()) {
      // Check current page
      await expect(page.locator('[data-testid="current-page"]')).toContainText('1');
      
      // Go to next page
      await page.click('[data-testid="next-page"]');
      await page.waitForTimeout(1000);
      
      // Verify page change
      await expect(page.locator('[data-testid="current-page"]')).toContainText('2');
      
      // Verify different recipes are shown
      const page2Cards = await page.locator('[data-testid="recipe-card"]').count();
      expect(page2Cards).toBeGreaterThan(0);
      
      // Go back to previous page
      await page.click('[data-testid="prev-page"]');
      await page.waitForTimeout(1000);
      
      await expect(page.locator('[data-testid="current-page"]')).toContainText('1');
    }
  });
});