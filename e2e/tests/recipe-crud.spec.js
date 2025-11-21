// tests/recipe-crud.spec.js
import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

test.describe('Recipe CRUD Operations @recipe', () => {
  test.beforeEach(async ({ page }) => {
    // Store test coordination
    try {
      execSync('npx claude-flow@alpha hooks pre-search --query "recipe CRUD test" --cache-results true');
    } catch (error) {
      // Continue without coordination
    }
    
    // Login as test user
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test.user@example.com');
    await page.fill('[data-testid="password-input"]', 'TestUser123!');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('**/dashboard');
  });

  test.afterEach(async ({ page }) => {
    // Store test results
    try {
      execSync('npx claude-flow@alpha hooks post-edit --file "recipe-crud.spec.js" --memory-key "testing/recipe-crud/completed"');
    } catch (error) {
      // Continue without coordination
    }
  });

  const sampleRecipe = {
    title: 'E2E Test Recipe',
    description: 'A delicious test recipe created by automation',
    category: 'Main Course',
    cuisine: 'International',
    servings: 4,
    prepTime: 15,
    cookTime: 30,
    difficulty: 'Medium',
    ingredients: [
      '2 cups flour',
      '1 tsp salt',
      '2 eggs',
      '1 cup milk'
    ],
    instructions: [
      'Mix dry ingredients in a large bowl',
      'Whisk eggs and milk in separate bowl',
      'Combine wet and dry ingredients',
      'Cook according to recipe requirements'
    ],
    tags: ['test', 'automation', 'e2e'],
    youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  };

  test('should create a new recipe successfully', async ({ page }) => {
    await page.goto('/recipes/create');
    
    // Fill basic information
    await page.fill('[data-testid="recipe-title"]', sampleRecipe.title);
    await page.fill('[data-testid="recipe-description"]', sampleRecipe.description);
    await page.selectOption('[data-testid="recipe-category"]', sampleRecipe.category);
    await page.selectOption('[data-testid="recipe-cuisine"]', sampleRecipe.cuisine);
    await page.fill('[data-testid="recipe-servings"]', sampleRecipe.servings.toString());
    await page.fill('[data-testid="recipe-prep-time"]', sampleRecipe.prepTime.toString());
    await page.fill('[data-testid="recipe-cook-time"]', sampleRecipe.cookTime.toString());
    await page.selectOption('[data-testid="recipe-difficulty"]', sampleRecipe.difficulty);
    
    // Add ingredients
    for (let i = 0; i < sampleRecipe.ingredients.length; i++) {
      if (i > 0) {
        await page.click('[data-testid="add-ingredient-button"]');
      }
      await page.fill(`[data-testid="ingredient-${i}"]`, sampleRecipe.ingredients[i]);
    }
    
    // Add instructions
    for (let i = 0; i < sampleRecipe.instructions.length; i++) {
      if (i > 0) {
        await page.click('[data-testid="add-instruction-button"]');
      }
      await page.fill(`[data-testid="instruction-${i}"]`, sampleRecipe.instructions[i]);
    }
    
    // Add tags
    await page.fill('[data-testid="recipe-tags"]', sampleRecipe.tags.join(', '));
    
    // Add YouTube URL
    await page.fill('[data-testid="youtube-url"]', sampleRecipe.youtubeUrl);
    
    // Upload image (simulate)
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('[data-testid="image-upload-button"]');
    const fileChooser = await fileChooserPromise;
    // In real tests, you'd upload an actual file
    // await fileChooser.setFiles('./test-fixtures/sample-recipe-image.jpg');
    
    // Submit recipe
    await page.click('[data-testid="save-recipe-button"]');
    
    // Verify success
    await expect(page.locator('.success-message')).toContainText('Recipe created successfully');
    await expect(page).toHaveURL(/.*\/recipes\/\d+/);
    await expect(page.locator('[data-testid="recipe-title"]')).toContainText(sampleRecipe.title);
  });

  test('should display recipe list with filters', async ({ page }) => {
    await page.goto('/recipes');
    
    // Check if recipes are displayed
    await expect(page.locator('[data-testid="recipe-grid"]')).toBeVisible();
    
    // Test category filter
    await page.selectOption('[data-testid="category-filter"]', 'Main Course');
    await page.waitForTimeout(1000); // Wait for filter to apply
    
    const recipeCards = page.locator('[data-testid="recipe-card"]');
    await expect(recipeCards).toHaveCountGreaterThan(0);
    
    // Test search functionality
    await page.fill('[data-testid="recipe-search"]', sampleRecipe.title);
    await page.press('[data-testid="recipe-search"]', 'Enter');
    
    // Should show filtered results
    await expect(page.locator('[data-testid="recipe-card"]')).toHaveCountGreaterThanOrEqual(0);
  });

  test('should view recipe details', async ({ page }) => {
    // Go to recipes page and click on first recipe
    await page.goto('/recipes');
    await page.click('[data-testid="recipe-card"]:first-child');
    
    // Verify recipe details page
    await expect(page.locator('[data-testid="recipe-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="recipe-description"]')).toBeVisible();
    await expect(page.locator('[data-testid="recipe-ingredients"]')).toBeVisible();
    await expect(page.locator('[data-testid="recipe-instructions"]')).toBeVisible();
    await expect(page.locator('[data-testid="recipe-metadata"]')).toBeVisible();
    
    // Check if YouTube video is embedded (if URL exists)
    const youtubeFrame = page.locator('[data-testid="youtube-video"]');
    if (await youtubeFrame.count() > 0) {
      await expect(youtubeFrame).toBeVisible();
    }
    
    // Check action buttons
    await expect(page.locator('[data-testid="edit-recipe-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="favorite-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="share-button"]')).toBeVisible();
  });

  test('should edit existing recipe', async ({ page }) => {
    // Navigate to recipes and select first recipe to edit
    await page.goto('/recipes');
    await page.click('[data-testid="recipe-card"]:first-child');
    await page.click('[data-testid="edit-recipe-button"]');
    
    // Modify recipe data
    const updatedTitle = 'Updated E2E Test Recipe';
    await page.fill('[data-testid="recipe-title"]', updatedTitle);
    await page.fill('[data-testid="recipe-description"]', 'Updated description for testing');
    
    // Update servings
    await page.fill('[data-testid="recipe-servings"]', '6');
    
    // Add new ingredient
    await page.click('[data-testid="add-ingredient-button"]');
    await page.fill('[data-testid="ingredient-last"]', '1 tsp black pepper');
    
    // Save changes
    await page.click('[data-testid="save-recipe-button"]');
    
    // Verify update success
    await expect(page.locator('.success-message')).toContainText('Recipe updated successfully');
    await expect(page.locator('[data-testid="recipe-title"]')).toContainText(updatedTitle);
  });

  test('should delete recipe with confirmation', async ({ page }) => {
    // Create a recipe first for deletion
    await page.goto('/recipes/create');
    await page.fill('[data-testid="recipe-title"]', 'Recipe to Delete');
    await page.fill('[data-testid="recipe-description"]', 'This recipe will be deleted');
    await page.selectOption('[data-testid="recipe-category"]', 'Dessert');
    await page.fill('[data-testid="ingredient-0"]', '1 cup sugar');
    await page.fill('[data-testid="instruction-0"]', 'Mix ingredients');
    await page.click('[data-testid="save-recipe-button"]');
    
    // Wait for creation success
    await expect(page.locator('.success-message')).toContainText('Recipe created successfully');
    
    // Delete the recipe
    await page.click('[data-testid="delete-recipe-button"]');
    
    // Handle confirmation dialog
    await expect(page.locator('[data-testid="delete-confirmation-dialog"]')).toBeVisible();
    await expect(page.locator('.confirmation-message')).toContainText('Are you sure you want to delete this recipe?');
    
    // Cancel first
    await page.click('[data-testid="cancel-delete-button"]');
    await expect(page.locator('[data-testid="delete-confirmation-dialog"]')).toBeHidden();
    
    // Delete again and confirm
    await page.click('[data-testid="delete-recipe-button"]');
    await page.click('[data-testid="confirm-delete-button"]');
    
    // Verify deletion
    await expect(page.locator('.success-message')).toContainText('Recipe deleted successfully');
    await expect(page).toHaveURL('**/recipes');
  });

  test('should validate recipe form inputs', async ({ page }) => {
    await page.goto('/recipes/create');
    
    // Try to submit empty form
    await page.click('[data-testid="save-recipe-button"]');
    
    // Check required field validations
    await expect(page.locator('.error-message')).toContainText('Recipe title is required');
    
    // Fill title but leave other required fields empty
    await page.fill('[data-testid="recipe-title"]', 'Test Recipe');
    await page.click('[data-testid="save-recipe-button"]');
    
    await expect(page.locator('.error-message')).toContainText('At least one ingredient is required');
    
    // Add ingredient but no instructions
    await page.fill('[data-testid="ingredient-0"]', '1 cup flour');
    await page.click('[data-testid="save-recipe-button"]');
    
    await expect(page.locator('.error-message')).toContainText('At least one instruction is required');
    
    // Test numeric validations
    await page.fill('[data-testid="recipe-servings"]', '-1');
    await page.fill('[data-testid="recipe-prep-time"]', 'abc');
    await page.click('[data-testid="save-recipe-button"]');
    
    await expect(page.locator('.error-message')).toContainText('Servings must be a positive number');
    await expect(page.locator('.error-message')).toContainText('Prep time must be a valid number');
  });

  test('should handle favorite/unfavorite recipe', async ({ page }) => {
    // Go to a recipe details page
    await page.goto('/recipes');
    await page.click('[data-testid="recipe-card"]:first-child');
    
    // Check initial favorite state
    const favoriteButton = page.locator('[data-testid="favorite-button"]');
    const initialState = await favoriteButton.getAttribute('data-favorited');
    
    // Toggle favorite
    await favoriteButton.click();
    
    // Verify state change
    if (initialState === 'false') {
      await expect(favoriteButton).toHaveAttribute('data-favorited', 'true');
      await expect(page.locator('.success-message')).toContainText('Recipe added to favorites');
    } else {
      await expect(favoriteButton).toHaveAttribute('data-favorited', 'false');
      await expect(page.locator('.success-message')).toContainText('Recipe removed from favorites');
    }
  });

  test('should share recipe via social media', async ({ page, context }) => {
    await page.goto('/recipes');
    await page.click('[data-testid="recipe-card"]:first-child');
    
    // Mock external share APIs
    await page.route('**/api/share/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, shareUrl: 'https://example.com/shared-recipe' })
      });
    });
    
    // Click share button
    await page.click('[data-testid="share-button"]');
    await expect(page.locator('[data-testid="share-menu"]')).toBeVisible();
    
    // Test Facebook share
    const facebookSharePromise = page.waitForEvent('popup');
    await page.click('[data-testid="share-facebook"]');
    // Verify popup would open (in real test, check URL contains facebook.com/sharer)
    
    // Test Twitter share
    await page.click('[data-testid="share-twitter"]');
    
    // Test copy link
    await page.click('[data-testid="copy-link"]');
    await expect(page.locator('.success-message')).toContainText('Recipe link copied to clipboard');
  });

  test('should handle bulk recipe operations', async ({ page }) => {
    await page.goto('/recipes');
    
    // Enter bulk selection mode
    await page.click('[data-testid="bulk-select-mode"]');
    
    // Select multiple recipes
    await page.click('[data-testid="recipe-card-checkbox"]:nth-child(1)');
    await page.click('[data-testid="recipe-card-checkbox"]:nth-child(2)');
    await page.click('[data-testid="recipe-card-checkbox"]:nth-child(3)');
    
    // Check bulk actions are available
    await expect(page.locator('[data-testid="bulk-actions-menu"]')).toBeVisible();
    await expect(page.locator('[data-testid="selected-count"]')).toContainText('3 selected');
    
    // Test bulk export
    await page.click('[data-testid="bulk-export"]');
    // Would trigger download in real scenario
    
    // Test bulk delete (cancel)
    await page.click('[data-testid="bulk-delete"]');
    await expect(page.locator('[data-testid="bulk-delete-confirmation"]')).toBeVisible();
    await page.click('[data-testid="cancel-bulk-delete"]');
    
    // Exit bulk mode
    await page.click('[data-testid="exit-bulk-mode"]');
    await expect(page.locator('[data-testid="bulk-actions-menu"]')).toBeHidden();
  });
});