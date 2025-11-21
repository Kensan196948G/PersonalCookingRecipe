// tests/full-user-journey.spec.js
import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

test.describe('Complete User Journey Tests @integration', () => {
  test.beforeAll(async () => {
    // Store test coordination
    try {
      execSync('npx claude-flow@alpha hooks pre-task --description "Complete user journey E2E test" --auto-spawn-agents false');
    } catch (error) {
      // Continue without coordination
    }
  });

  test.afterAll(async () => {
    // Store test results
    try {
      execSync('npx claude-flow@alpha hooks post-task --task-id "full_user_journey" --analyze-performance true');
    } catch (error) {
      // Continue without coordination
    }
  });

  test('Complete New User Journey: Registration → Recipe Creation → Search → Social Integration', async ({ page, context }) => {
    console.log('🚀 Starting complete user journey test');

    const testUser = {
      name: 'Journey Test User',
      email: `journey.test.${Date.now()}@example.com`,
      password: 'JourneyTest123!'
    };

    const testRecipe = {
      title: 'Journey Test Pasta Recipe',
      description: 'A delicious pasta recipe created during user journey testing',
      category: 'Main Course',
      cuisine: 'Italian',
      servings: 4,
      prepTime: 15,
      cookTime: 25,
      difficulty: 'Medium',
      ingredients: [
        '400g spaghetti pasta',
        '2 cloves garlic, minced',
        '3 tablespoons olive oil',
        '1/2 cup grated Parmesan cheese',
        '2 tablespoons fresh basil, chopped',
        '1 can (400g) crushed tomatoes',
        'Salt and pepper to taste'
      ],
      instructions: [
        'Bring a large pot of salted water to boil',
        'Add spaghetti and cook according to package directions',
        'Heat olive oil in a large pan over medium heat',
        'Add minced garlic and cook for 1 minute until fragrant',
        'Add crushed tomatoes and simmer for 10 minutes',
        'Drain pasta and add to the sauce',
        'Toss with Parmesan cheese and fresh basil',
        'Season with salt and pepper, serve immediately'
      ],
      tags: ['pasta', 'italian', 'dinner', 'easy'],
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    };

    // STEP 1: User Registration
    console.log('📝 Step 1: New user registration');
    
    await page.goto('/');
    await expect(page.locator('[data-testid="welcome-header"]')).toBeVisible();
    
    // Navigate to registration
    await page.click('[data-testid="register-button"]');
    await expect(page).toHaveURL('**/register');
    
    // Fill registration form
    await page.fill('[data-testid="name-input"]', testUser.name);
    await page.fill('[data-testid="email-input"]', testUser.email);
    await page.fill('[data-testid="password-input"]', testUser.password);
    await page.fill('[data-testid="confirm-password-input"]', testUser.password);
    await page.check('[data-testid="terms-checkbox"]');
    
    // Submit registration
    await page.click('[data-testid="register-submit-button"]');
    
    // Verify successful registration
    await expect(page).toHaveURL('**/dashboard');
    await expect(page.locator('[data-testid="welcome-message"]')).toContainText(testUser.name);
    await expect(page.locator('.success-message')).toContainText('Welcome! Your account has been created');

    try {
      execSync('npx claude-flow@alpha hooks notify --message "User registration completed successfully" --telemetry true');
    } catch (error) {
      // Continue without coordination
    }

    // STEP 2: Profile Setup and Onboarding
    console.log('👤 Step 2: Profile setup and onboarding');
    
    // Check if onboarding tour is present
    const onboardingModal = page.locator('[data-testid="onboarding-modal"]');
    if (await onboardingModal.isVisible()) {
      await page.click('[data-testid="start-tour-button"]');
      
      // Go through onboarding steps
      for (let step = 1; step <= 3; step++) {
        await expect(page.locator(`[data-testid="onboarding-step-${step}"]`)).toBeVisible();
        await page.click('[data-testid="next-step-button"]');
      }
      
      await page.click('[data-testid="finish-onboarding-button"]');
    }
    
    // Set dietary preferences
    await page.click('[data-testid="profile-menu"]');
    await page.click('[data-testid="profile-settings"]');
    
    await page.check('[data-testid="dietary-vegetarian"]');
    await page.check('[data-testid="dietary-gluten-free"]');
    await page.selectOption('[data-testid="cooking-skill-level"]', 'Intermediate');
    await page.fill('[data-testid="favorite-cuisines"]', 'Italian, Mediterranean, Asian');
    
    await page.click('[data-testid="save-profile-button"]');
    await expect(page.locator('.success-message')).toContainText('Profile updated successfully');

    // STEP 3: Recipe Creation
    console.log('🍝 Step 3: Creating first recipe');
    
    await page.goto('/recipes/create');
    
    // Fill basic recipe information
    await page.fill('[data-testid="recipe-title"]', testRecipe.title);
    await page.fill('[data-testid="recipe-description"]', testRecipe.description);
    await page.selectOption('[data-testid="recipe-category"]', testRecipe.category);
    await page.selectOption('[data-testid="recipe-cuisine"]', testRecipe.cuisine);
    await page.fill('[data-testid="recipe-servings"]', testRecipe.servings.toString());
    await page.fill('[data-testid="recipe-prep-time"]', testRecipe.prepTime.toString());
    await page.fill('[data-testid="recipe-cook-time"]', testRecipe.cookTime.toString());
    await page.selectOption('[data-testid="recipe-difficulty"]', testRecipe.difficulty);
    
    // Add ingredients
    for (let i = 0; i < testRecipe.ingredients.length; i++) {
      if (i > 0) {
        await page.click('[data-testid="add-ingredient-button"]');
      }
      await page.fill(`[data-testid="ingredient-${i}"]`, testRecipe.ingredients[i]);
    }
    
    // Add instructions
    for (let i = 0; i < testRecipe.instructions.length; i++) {
      if (i > 0) {
        await page.click('[data-testid="add-instruction-button"]');
      }
      await page.fill(`[data-testid="instruction-${i}"]`, testRecipe.instructions[i]);
    }
    
    // Add tags and YouTube URL
    await page.fill('[data-testid="recipe-tags"]', testRecipe.tags.join(', '));
    await page.fill('[data-testid="youtube-url"]', testRecipe.youtubeUrl);
    
    // Save recipe
    await page.click('[data-testid="save-recipe-button"]');
    
    // Verify recipe creation
    await expect(page.locator('.success-message')).toContainText('Recipe created successfully');
    await expect(page).toHaveURL(/.*\/recipes\/\d+/);
    await expect(page.locator('[data-testid="recipe-title"]')).toContainText(testRecipe.title);

    try {
      execSync('npx claude-flow@alpha hooks post-edit --file "user-journey-recipe.md" --memory-key "journey/recipe_created"');
    } catch (error) {
      // Continue without coordination
    }

    // STEP 4: Recipe Management and Interaction
    console.log('📚 Step 4: Recipe management and interaction');
    
    // Add to favorites
    await page.click('[data-testid="favorite-button"]');
    await expect(page.locator('.success-message')).toContainText('Recipe added to favorites');
    
    // Test recipe rating
    await page.click('[data-testid="rating-star-4"]'); // 4-star rating
    await expect(page.locator('[data-testid="recipe-rating"]')).toContainText('4');
    
    // Add a comment/review
    await page.fill('[data-testid="review-text"]', 'This is an amazing pasta recipe! Easy to follow and delicious results.');
    await page.click('[data-testid="submit-review-button"]');
    await expect(page.locator('[data-testid="user-review"]')).toContainText('This is an amazing pasta recipe');
    
    // Edit the recipe
    await page.click('[data-testid="edit-recipe-button"]');
    await page.fill('[data-testid="recipe-description"]', testRecipe.description + ' Updated with user feedback.');
    await page.click('[data-testid="save-recipe-button"]');
    await expect(page.locator('.success-message')).toContainText('Recipe updated successfully');

    // STEP 5: Search and Discovery
    console.log('🔍 Step 5: Search and discovery features');
    
    await page.goto('/recipes');
    
    // Test basic search
    await page.fill('[data-testid="recipe-search"]', 'pasta');
    await page.press('[data-testid="recipe-search"]', 'Enter');
    await page.waitForTimeout(1000);
    
    // Verify search results
    const searchResults = page.locator('[data-testid="recipe-card"]');
    await expect(searchResults.first()).toBeVisible();
    
    // Test advanced filters
    await page.selectOption('[data-testid="category-filter"]', 'Main Course');
    await page.selectOption('[data-testid="cuisine-filter"]', 'Italian');
    await page.selectOption('[data-testid="difficulty-filter"]', 'Medium');
    await page.waitForTimeout(1000);
    
    // Should still see our created recipe
    await expect(page.locator('[data-testid="recipe-card"]')).toHaveCountGreaterThan(0);
    
    // Test recipe discovery through categories
    await page.click('[data-testid="clear-filters-button"]');
    await page.click('[data-testid="category-main-course"]');
    await expect(page.locator('[data-testid="category-header"]')).toContainText('Main Course');

    // STEP 6: Social Features and Sharing
    console.log('🤝 Step 6: Social features and sharing');
    
    // Go back to our created recipe
    await page.fill('[data-testid="recipe-search"]', testRecipe.title);
    await page.press('[data-testid="recipe-search"]', 'Enter');
    await page.click('[data-testid="recipe-card"]:first-child');
    
    // Test sharing functionality
    await page.click('[data-testid="share-button"]');
    await expect(page.locator('[data-testid="share-menu"]')).toBeVisible();
    
    // Mock social sharing APIs
    await page.route('**/api/share/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, shareUrl: 'https://example.com/shared-recipe' })
      });
    });
    
    // Test Facebook sharing
    await page.click('[data-testid="share-facebook"]');
    await expect(page.locator('.success-message')).toContainText('Recipe shared successfully');
    
    // Test copying link
    await page.click('[data-testid="share-button"]');
    await page.click('[data-testid="copy-link"]');
    await expect(page.locator('.success-message')).toContainText('Recipe link copied');

    // STEP 7: External Service Integration
    console.log('🔗 Step 7: External service integration');
    
    // Test YouTube integration (verify video is embedded)
    await expect(page.locator('[data-testid="youtube-video"]')).toBeVisible();
    
    // Test grocery list generation
    await page.click('[data-testid="generate-grocery-list"]');
    await expect(page.locator('[data-testid="grocery-list-modal"]')).toBeVisible();
    
    // Select ingredients for grocery list
    await page.check('[data-testid="grocery-ingredient-0"]');
    await page.check('[data-testid="grocery-ingredient-1"]');
    await page.check('[data-testid="grocery-ingredient-2"]');
    
    await page.click('[data-testid="save-grocery-list"]');
    await expect(page.locator('.success-message')).toContainText('Grocery list saved');
    
    // Test recipe export
    await page.click('[data-testid="export-recipe"]');
    await page.selectOption('[data-testid="export-format"]', 'pdf');
    await page.click('[data-testid="download-export"]');
    // Note: In real scenario, this would trigger a download

    // STEP 8: Meal Planning
    console.log('📅 Step 8: Meal planning functionality');
    
    await page.goto('/meal-planner');
    
    // Add recipe to meal plan
    await page.click('[data-testid="add-to-meal-plan"]');
    await page.selectOption('[data-testid="meal-plan-date"]', new Date().toISOString().split('T')[0]);
    await page.selectOption('[data-testid="meal-plan-time"]', 'dinner');
    await page.click('[data-testid="confirm-meal-plan"]');
    
    await expect(page.locator('.success-message')).toContainText('Recipe added to meal plan');
    
    // View meal plan calendar
    await expect(page.locator('[data-testid="meal-plan-calendar"]')).toBeVisible();
    await expect(page.locator('[data-testid="planned-meal"]')).toContainText(testRecipe.title);

    // STEP 9: Mobile Responsiveness Test
    console.log('📱 Step 9: Mobile responsiveness');
    
    // Switch to mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    
    // Test mobile navigation
    await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
    await page.click('[data-testid="mobile-menu-button"]');
    await expect(page.locator('[data-testid="mobile-nav-menu"]')).toBeVisible();
    
    // Test recipe viewing on mobile
    await page.click('[data-testid="mobile-nav-recipes"]');
    await expect(page.locator('[data-testid="recipe-grid"]')).toBeVisible();
    
    // Recipe cards should stack vertically on mobile
    const mobileCards = page.locator('[data-testid="recipe-card"]');
    if (await mobileCards.count() > 1) {
      const firstCardBox = await mobileCards.first().boundingBox();
      const secondCardBox = await mobileCards.nth(1).boundingBox();
      expect(secondCardBox.y).toBeGreaterThan(firstCardBox.y + 50);
    }

    // STEP 10: User Data Management
    console.log('💾 Step 10: User data management');
    
    // Switch back to desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    await page.goto('/profile/data');
    
    // Test data export
    await page.click('[data-testid="export-user-data"]');
    await page.selectOption('[data-testid="export-data-format"]', 'json');
    await page.click('[data-testid="confirm-data-export"]');
    await expect(page.locator('.success-message')).toContainText('Data export initiated');
    
    // Test favorites management
    await page.goto('/favorites');
    await expect(page.locator('[data-testid="favorite-recipe"]')).toContainText(testRecipe.title);
    
    // Remove from favorites
    await page.click('[data-testid="remove-favorite-button"]');
    await expect(page.locator('.success-message')).toContainText('Recipe removed from favorites');

    // STEP 11: Settings and Preferences
    console.log('⚙️ Step 11: Settings and preferences');
    
    await page.goto('/settings');
    
    // Test notification settings
    await page.check('[data-testid="email-notifications"]');
    await page.check('[data-testid="weekly-digest"]');
    await page.uncheck('[data-testid="marketing-emails"]');
    
    // Test privacy settings
    await page.click('[data-testid="privacy-tab"]');
    await page.selectOption('[data-testid="profile-visibility"]', 'private');
    await page.check('[data-testid="recipe-sharing-enabled"]');
    
    await page.click('[data-testid="save-settings-button"]');
    await expect(page.locator('.success-message')).toContainText('Settings saved successfully');

    // STEP 12: Search and Filter Performance
    console.log('🚀 Step 12: Testing search performance');
    
    await page.goto('/recipes');
    
    // Perform multiple search operations
    const searchTerms = ['chicken', 'vegetarian', 'dessert', 'quick', 'pasta'];
    
    for (const term of searchTerms) {
      const searchStart = Date.now();
      
      await page.fill('[data-testid="recipe-search"]', term);
      await page.press('[data-testid="recipe-search"]', 'Enter');
      await page.waitForSelector('[data-testid="recipe-card"]', { timeout: 3000 });
      
      const searchTime = Date.now() - searchStart;
      console.log(`Search for "${term}": ${searchTime}ms`);
      
      // Each search should complete quickly
      expect(searchTime).toBeLessThan(2000);
      
      await page.waitForTimeout(500);
    }

    // STEP 13: Error Handling and Edge Cases
    console.log('⚠️ Step 13: Error handling and edge cases');
    
    // Test creating recipe with invalid data
    await page.goto('/recipes/create');
    
    // Try to submit empty form
    await page.click('[data-testid="save-recipe-button"]');
    await expect(page.locator('.error-message')).toContainText('Recipe title is required');
    
    // Test navigation to non-existent recipe
    await page.goto('/recipes/999999');
    await expect(page.locator('.error-message')).toContainText('Recipe not found');
    
    // Test handling of network errors (simulate offline)
    await page.context().setOffline(true);
    await page.goto('/recipes');
    await expect(page.locator('.offline-message')).toBeVisible();
    
    // Restore connection
    await page.context().setOffline(false);
    await page.reload();
    await expect(page.locator('[data-testid="recipe-grid"]')).toBeVisible();

    // STEP 14: User Logout and Session Management
    console.log('👋 Step 14: Logout and session management');
    
    // Test session persistence
    const newPage = await context.newPage();
    await newPage.goto('/dashboard');
    await expect(newPage.locator('[data-testid="welcome-message"]')).toContainText(testUser.name);
    await newPage.close();
    
    // Test logout
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-button"]');
    
    await expect(page).toHaveURL('**/');
    await expect(page.locator('[data-testid="login-button"]')).toBeVisible();
    
    // Try to access protected route after logout
    await page.goto('/dashboard');
    await expect(page).toHaveURL('**/login');

    // FINAL VERIFICATION: Test login with created user
    console.log('✅ Final verification: Login with created user');
    
    await page.fill('[data-testid="email-input"]', testUser.email);
    await page.fill('[data-testid="password-input"]', testUser.password);
    await page.click('[data-testid="login-button"]');
    
    await expect(page).toHaveURL('**/dashboard');
    await expect(page.locator('[data-testid="welcome-message"]')).toContainText(testUser.name);
    
    // Verify our created recipe still exists
    await page.goto('/recipes');
    await page.fill('[data-testid="recipe-search"]', testRecipe.title);
    await page.press('[data-testid="recipe-search"]', 'Enter');
    await expect(page.locator('[data-testid="recipe-card"]')).toContainText(testRecipe.title);

    console.log('🎉 Complete user journey test completed successfully!');
    
    // Store final test results
    try {
      execSync('npx claude-flow@alpha hooks notify --message "Complete user journey test finished successfully" --telemetry true');
    } catch (error) {
      // Continue without coordination
    }
  });

  test('Power User Journey: Advanced Features and Integrations', async ({ page, context }) => {
    console.log('🚀 Starting power user journey test');

    // Login as existing user
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test.chef@example.com');
    await page.fill('[data-testid="password-input"]', 'TestChef123!');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('**/dashboard');

    // POWER USER STEP 1: Bulk Recipe Management
    console.log('📦 Power User Step 1: Bulk recipe management');
    
    await page.goto('/recipes');
    
    // Enter bulk selection mode
    await page.click('[data-testid="bulk-select-mode"]');
    
    // Select multiple recipes
    const recipeCards = page.locator('[data-testid="recipe-card-checkbox"]');
    const cardCount = await recipeCards.count();
    
    for (let i = 0; i < Math.min(5, cardCount); i++) {
      await recipeCards.nth(i).check();
    }
    
    // Test bulk export
    await page.click('[data-testid="bulk-export"]');
    await page.selectOption('[data-testid="export-format"]', 'csv');
    await page.click('[data-testid="confirm-bulk-export"]');
    await expect(page.locator('.success-message')).toContainText('Bulk export completed');
    
    // Test bulk categorization
    await page.click('[data-testid="bulk-categorize"]');
    await page.selectOption('[data-testid="new-category"]', 'Holiday Recipes');
    await page.click('[data-testid="apply-bulk-category"]');
    await expect(page.locator('.success-message')).toContainText('Categories updated');

    // POWER USER STEP 2: Advanced Search and Analytics
    console.log('📊 Power User Step 2: Advanced search and analytics');
    
    await page.goto('/analytics');
    
    // View recipe analytics
    await expect(page.locator('[data-testid="total-recipes-stat"]')).toBeVisible();
    await expect(page.locator('[data-testid="avg-rating-stat"]')).toBeVisible();
    await expect(page.locator('[data-testid="most-viewed-recipes"]')).toBeVisible();
    
    // Test advanced search
    await page.click('[data-testid="advanced-search-button"]');
    
    // Complex search with multiple criteria
    await page.fill('[data-testid="ingredients-include"]', 'chicken, tomato');
    await page.fill('[data-testid="ingredients-exclude"]', 'mushroom');
    await page.fill('[data-testid="min-rating"]', '4');
    await page.fill('[data-testid="max-cook-time"]', '60');
    await page.check('[data-testid="has-video"]');
    
    await page.click('[data-testid="execute-advanced-search"]');
    await expect(page.locator('[data-testid="advanced-search-results"]')).toBeVisible();

    // POWER USER STEP 3: API Integration and Automation
    console.log('🔗 Power User Step 3: API integrations');
    
    await page.goto('/integrations');
    
    // Test Notion integration
    await page.click('[data-testid="connect-notion"]');
    // Mock successful connection
    await expect(page.locator('[data-testid="notion-status"]')).toContainText('Connected');
    
    // Set up automated sync
    await page.check('[data-testid="auto-sync-notion"]');
    await page.selectOption('[data-testid="sync-frequency"]', 'daily');
    await page.click('[data-testid="save-integration-settings"]');
    
    // Test recipe import from external source
    await page.click('[data-testid="import-external-recipe"]');
    await page.fill('[data-testid="recipe-url"]', 'https://example.com/recipe/pasta-carbonara');
    await page.click('[data-testid="import-from-url"]');
    await expect(page.locator('.success-message')).toContainText('Recipe imported successfully');

    // POWER USER STEP 4: Custom Recipe Collections and Lists
    console.log('📚 Power User Step 4: Custom collections');
    
    await page.goto('/collections');
    
    // Create new collection
    await page.click('[data-testid="create-collection"]');
    await page.fill('[data-testid="collection-name"]', 'Holiday Favorites');
    await page.fill('[data-testid="collection-description"]', 'Special recipes for holiday celebrations');
    await page.selectOption('[data-testid="collection-visibility"]', 'public');
    await page.click('[data-testid="save-collection"]');
    
    // Add recipes to collection
    await page.click('[data-testid="add-recipes-to-collection"]');
    await page.check('[data-testid="recipe-selector-1"]');
    await page.check('[data-testid="recipe-selector-3"]');
    await page.check('[data-testid="recipe-selector-5"]');
    await page.click('[data-testid="add-selected-recipes"]');
    
    await expect(page.locator('.success-message')).toContainText('Recipes added to collection');

    // POWER USER STEP 5: Recipe Collaboration and Sharing
    console.log('🤝 Power User Step 5: Recipe collaboration');
    
    // Share collection with other users
    await page.click('[data-testid="share-collection"]');
    await page.fill('[data-testid="collaborator-email"]', 'collaborator@example.com');
    await page.selectOption('[data-testid="permission-level"]', 'editor');
    await page.click('[data-testid="send-collaboration-invite"]');
    
    await expect(page.locator('.success-message')).toContainText('Collaboration invite sent');
    
    // Test recipe versioning
    await page.goto('/recipes');
    await page.click('[data-testid="recipe-card"]:first-child');
    await page.click('[data-testid="edit-recipe-button"]');
    
    // Make changes to create new version
    await page.fill('[data-testid="recipe-title"]', 'Updated Recipe Title v2');
    await page.fill('[data-testid="version-notes"]', 'Added new ingredients and improved instructions');
    await page.click('[data-testid="save-as-new-version"]');
    
    // View version history
    await page.click('[data-testid="version-history"]');
    await expect(page.locator('[data-testid="version-list"]')).toContainText('v2');
    await expect(page.locator('[data-testid="version-list"]')).toContainText('v1');

    console.log('🎯 Power user journey completed successfully!');
  });

  test('Mobile-First User Journey: Complete Mobile Experience', async ({ page }) => {
    console.log('📱 Starting mobile-first user journey');

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Mobile user journey
    await page.goto('/');
    
    // Mobile registration
    await page.click('[data-testid="mobile-register-button"]');
    
    const mobileUser = {
      name: 'Mobile Test User',
      email: `mobile.test.${Date.now()}@example.com`,
      password: 'MobileTest123!'
    };
    
    await page.fill('[data-testid="name-input"]', mobileUser.name);
    await page.fill('[data-testid="email-input"]', mobileUser.email);
    await page.fill('[data-testid="password-input"]', mobileUser.password);
    await page.fill('[data-testid="confirm-password-input"]', mobileUser.password);
    await page.check('[data-testid="terms-checkbox"]');
    
    await page.click('[data-testid="register-submit-button"]');
    await expect(page).toHaveURL('**/dashboard');

    // Mobile recipe creation
    await page.click('[data-testid="mobile-menu-button"]');
    await page.click('[data-testid="mobile-nav-create-recipe"]');
    
    await page.fill('[data-testid="recipe-title"]', 'Mobile Recipe');
    await page.fill('[data-testid="recipe-description"]', 'Created on mobile device');
    
    // Mobile-optimized ingredient entry
    await page.fill('[data-testid="ingredient-0"]', '1 cup flour');
    await page.tap('[data-testid="add-ingredient-button"]');
    await page.fill('[data-testid="ingredient-1"]', '2 eggs');
    
    await page.fill('[data-testid="instruction-0"]', 'Mix ingredients together');
    
    await page.click('[data-testid="save-recipe-button"]');
    await expect(page.locator('.success-message')).toContainText('Recipe created successfully');

    // Mobile search and discovery
    await page.click('[data-testid="mobile-menu-button"]');
    await page.click('[data-testid="mobile-nav-recipes"]');
    
    // Mobile search
    await page.fill('[data-testid="mobile-search-input"]', 'mobile');
    await page.tap('[data-testid="mobile-search-button"]');
    
    await expect(page.locator('[data-testid="recipe-card"]')).toContainText('Mobile Recipe');

    // Mobile recipe interaction
    await page.tap('[data-testid="recipe-card"]:first-child');
    
    // Test mobile swipe gestures (simulated)
    await page.touchscreen.tap(200, 400);
    
    // Mobile favorite action
    await page.tap('[data-testid="mobile-favorite-button"]');
    await expect(page.locator('.success-message')).toContainText('Recipe added to favorites');

    console.log('📱 Mobile-first user journey completed successfully!');
  });
});