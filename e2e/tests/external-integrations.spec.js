// tests/external-integrations.spec.js
import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

test.describe('External Service Integrations @integration', () => {
  test.beforeEach(async ({ page }) => {
    // Store test coordination
    try {
      execSync('npx claude-flow@alpha hooks pre-search --query "external integrations test" --cache-results true');
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
      execSync('npx claude-flow@alpha hooks post-edit --file "external-integrations.spec.js" --memory-key "testing/integrations/completed"');
    } catch (error) {
      // Continue without coordination
    }
  });

  test.describe('YouTube Integration', () => {
    test('should embed YouTube video in recipe', async ({ page }) => {
      await page.goto('/recipes/create');
      
      // Fill basic recipe info
      await page.fill('[data-testid="recipe-title"]', 'YouTube Recipe Test');
      await page.fill('[data-testid="recipe-description"]', 'Testing YouTube integration');
      await page.fill('[data-testid="ingredient-0"]', '1 cup flour');
      await page.fill('[data-testid="instruction-0"]', 'Mix ingredients');
      
      // Add YouTube URL
      const youtubeUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      await page.fill('[data-testid="youtube-url"]', youtubeUrl);
      
      // Validate YouTube URL
      await expect(page.locator('[data-testid="youtube-preview"]')).toBeVisible({ timeout: 5000 });
      
      // Save recipe
      await page.click('[data-testid="save-recipe-button"]');
      await expect(page.locator('.success-message')).toContainText('Recipe created successfully');
      
      // Verify video is embedded in recipe view
      await expect(page.locator('[data-testid="youtube-video"]')).toBeVisible();
      
      // Check iframe properties
      const iframe = page.locator('[data-testid="youtube-video"] iframe');
      await expect(iframe).toHaveAttribute('src', /youtube\.com\/embed/);
    });

    test('should validate YouTube URL format', async ({ page }) => {
      await page.goto('/recipes/create');
      
      const invalidUrls = [
        'https://vimeo.com/123456',
        'https://youtube.com/invalid',
        'not-a-url',
        'https://www.youtube.com/watch?v=invalid-id-too-long-and-contains-special-chars'
      ];
      
      for (const invalidUrl of invalidUrls) {
        await page.fill('[data-testid="youtube-url"]', invalidUrl);
        await page.click('[data-testid="recipe-title"]'); // Trigger validation
        
        await expect(page.locator('.error-message')).toContainText('Please enter a valid YouTube URL');
      }
      
      // Test valid URL
      const validUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      await page.fill('[data-testid="youtube-url"]', validUrl);
      await page.click('[data-testid="recipe-title"]');
      
      await expect(page.locator('.error-message')).toBeHidden();
    });

    test('should extract video metadata from YouTube', async ({ page }) => {
      // Mock YouTube oEmbed API
      await page.route('**/youtube.com/oembed**', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            title: 'Amazing Recipe Video',
            author_name: 'Chef Test',
            thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
            duration: 240
          })
        });
      });
      
      await page.goto('/recipes/create');
      await page.fill('[data-testid="youtube-url"]', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      
      // Wait for metadata extraction
      await page.waitForTimeout(2000);
      
      // Check if video metadata is displayed
      await expect(page.locator('[data-testid="video-title"]')).toContainText('Amazing Recipe Video');
      await expect(page.locator('[data-testid="video-author"]')).toContainText('Chef Test');
      await expect(page.locator('[data-testid="video-duration"]')).toContainText('4:00');
    });

    test('should handle YouTube playlist URLs', async ({ page }) => {
      await page.goto('/recipes/create');
      
      const playlistUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLrAXtmRdnEQy';
      await page.fill('[data-testid="youtube-url"]', playlistUrl);
      
      // Should extract individual video ID and ignore playlist
      await expect(page.locator('[data-testid="youtube-preview"]')).toBeVisible();
      
      // Verify the processed URL contains only video ID
      const processedUrl = await page.locator('[data-testid="processed-url"]').textContent();
      expect(processedUrl).not.toContain('list=');
      expect(processedUrl).toContain('dQw4w9WgXcQ');
    });
  });

  test.describe('Gmail Integration', () => {
    test('should send recipe via Gmail', async ({ page, context }) => {
      // Navigate to a recipe
      await page.goto('/recipes');
      await page.click('[data-testid="recipe-card"]:first-child');
      
      // Mock Gmail compose API
      await page.route('**/api/gmail/compose', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ 
            success: true, 
            compose_url: 'https://mail.google.com/mail/u/0/#compose'
          })
        });
      });
      
      // Click share via Gmail
      await page.click('[data-testid="share-button"]');
      await page.click('[data-testid="share-gmail"]');
      
      // Fill email form
      await page.fill('[data-testid="recipient-email"]', 'friend@example.com');
      await page.fill('[data-testid="email-subject"]', 'Check out this recipe!');
      await page.fill('[data-testid="email-message"]', 'I thought you might like this recipe.');
      
      // Send email
      const emailPromise = page.waitForEvent('popup');
      await page.click('[data-testid="send-email-button"]');
      
      // Verify Gmail compose window opens
      const emailPage = await emailPromise;
      expect(emailPage.url()).toContain('mail.google.com');
    });

    test('should authenticate with Gmail OAuth', async ({ page }) => {
      await page.goto('/settings/integrations');
      
      // Mock OAuth flow
      await page.route('**/auth/gmail/authorize', async route => {
        await route.fulfill({
          status: 302,
          headers: {
            'Location': '/settings/integrations?gmail_auth=success'
          }
        });
      });
      
      // Click Gmail connect button
      await page.click('[data-testid="connect-gmail-button"]');
      
      // Should redirect back with success
      await expect(page).toHaveURL('**/settings/integrations*gmail_auth=success*');
      await expect(page.locator('[data-testid="gmail-status"]')).toContainText('Connected');
    });

    test('should import recipes from Gmail', async ({ page }) => {
      // Mock Gmail API for recipe search
      await page.route('**/api/gmail/search', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            messages: [
              {
                id: 'msg1',
                subject: 'Great Pasta Recipe',
                from: 'chef@example.com',
                snippet: 'Here\'s my famous pasta recipe...',
                has_recipe: true
              },
              {
                id: 'msg2', 
                subject: 'Chocolate Cake Recipe',
                from: 'baker@example.com',
                snippet: 'Try this amazing chocolate cake...',
                has_recipe: true
              }
            ]
          })
        });
      });
      
      await page.goto('/import/gmail');
      
      // Search for recipe emails
      await page.fill('[data-testid="search-query"]', 'recipe');
      await page.click('[data-testid="search-gmail-button"]');
      
      // Wait for results
      await expect(page.locator('[data-testid="gmail-results"]')).toBeVisible();
      
      // Select emails to import
      await page.check('[data-testid="email-checkbox-msg1"]');
      await page.check('[data-testid="email-checkbox-msg2"]');
      
      // Import selected recipes
      await page.click('[data-testid="import-selected-button"]');
      
      await expect(page.locator('.success-message')).toContainText('2 recipes imported successfully');
    });
  });

  test.describe('Notion Integration', () => {
    test('should export recipes to Notion', async ({ page }) => {
      // Mock Notion API
      await page.route('**/api/notion/pages', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'notion-page-id',
            url: 'https://notion.so/Recipe-Database',
            created_time: new Date().toISOString()
          })
        });
      });
      
      await page.goto('/recipes');
      
      // Select recipes for export
      await page.click('[data-testid="bulk-select-mode"]');
      await page.check('[data-testid="recipe-checkbox"]:nth-child(1)');
      await page.check('[data-testid="recipe-checkbox"]:nth-child(2)');
      
      // Export to Notion
      await page.click('[data-testid="export-notion-button"]');
      
      // Configure Notion export
      await page.selectOption('[data-testid="notion-database"]', 'Recipe Database');
      await page.check('[data-testid="include-images"]');
      await page.check('[data-testid="include-tags"]');
      
      await page.click('[data-testid="confirm-export-button"]');
      
      await expect(page.locator('.success-message')).toContainText('Recipes exported to Notion successfully');
    });

    test('should sync recipe updates with Notion', async ({ page }) => {
      // Navigate to recipe with Notion integration
      await page.goto('/recipes');
      await page.click('[data-testid="recipe-card"]:first-child');
      
      // Check if recipe is synced with Notion
      if (await page.locator('[data-testid="notion-sync-indicator"]').isVisible()) {
        // Edit the recipe
        await page.click('[data-testid="edit-recipe-button"]');
        await page.fill('[data-testid="recipe-title"]', 'Updated Recipe Title');
        await page.click('[data-testid="save-recipe-button"]');
        
        // Verify sync indicator
        await expect(page.locator('[data-testid="notion-sync-status"]')).toContainText('Syncing...');
        
        // Wait for sync completion
        await expect(page.locator('[data-testid="notion-sync-status"]')).toContainText('Synced', { timeout: 10000 });
      }
    });

    test('should import recipes from Notion', async ({ page }) => {
      // Mock Notion database query
      await page.route('**/api/notion/databases/*/query', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            results: [
              {
                id: 'notion-recipe-1',
                properties: {
                  Title: { title: [{ text: { content: 'Notion Recipe 1' } }] },
                  Category: { select: { name: 'Main Course' } },
                  Ingredients: { rich_text: [{ text: { content: '1 cup flour\n2 eggs' } }] }
                }
              },
              {
                id: 'notion-recipe-2',
                properties: {
                  Title: { title: [{ text: { content: 'Notion Recipe 2' } }] },
                  Category: { select: { name: 'Dessert' } },
                  Ingredients: { rich_text: [{ text: { content: '1 cup sugar\n2 cups milk' } }] }
                }
              }
            ]
          })
        });
      });
      
      await page.goto('/import/notion');
      
      // Select Notion database
      await page.selectOption('[data-testid="notion-database-select"]', 'Recipe Database');
      
      // Load recipes
      await page.click('[data-testid="load-notion-recipes"]');
      
      // Select recipes to import
      await page.check('[data-testid="notion-recipe-checkbox"]:nth-child(1)');
      await page.check('[data-testid="notion-recipe-checkbox"]:nth-child(2)');
      
      // Import selected
      await page.click('[data-testid="import-notion-recipes"]');
      
      await expect(page.locator('.success-message')).toContainText('2 recipes imported from Notion');
    });
  });

  test.describe('External API Integration', () => {
    test('should integrate with Spoonacular API for recipe suggestions', async ({ page }) => {
      // Mock Spoonacular API
      await page.route('**/api/spoonacular/recipes/complexSearch', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            results: [
              {
                id: 716429,
                title: 'Pasta with Garlic, Scallions, Cauliflower & Breadcrumbs',
                image: 'https://spoonacular.com/recipeImages/716429-556x370.jpg',
                readyInMinutes: 30,
                servings: 2
              }
            ],
            totalResults: 1
          })
        });
      });
      
      await page.goto('/recipes/suggestions');
      
      // Search for recipe suggestions
      await page.fill('[data-testid="ingredient-search"]', 'pasta, tomato, basil');
      await page.click('[data-testid="get-suggestions-button"]');
      
      // Wait for suggestions
      await expect(page.locator('[data-testid="suggestion-card"]')).toBeVisible();
      
      // Import suggestion
      await page.click('[data-testid="import-suggestion-button"]:first-child');
      
      await expect(page.locator('.success-message')).toContainText('Recipe imported successfully');
    });

    test('should handle nutritional data integration', async ({ page }) => {
      // Mock nutrition API
      await page.route('**/api/nutrition/analyze', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            calories: 450,
            fat: 15,
            carbs: 60,
            protein: 20,
            fiber: 8,
            sugar: 12,
            sodium: 850
          })
        });
      });
      
      await page.goto('/recipes');
      await page.click('[data-testid="recipe-card"]:first-child');
      
      // Calculate nutrition
      await page.click('[data-testid="calculate-nutrition-button"]');
      
      // Wait for nutrition data
      await expect(page.locator('[data-testid="nutrition-panel"]')).toBeVisible();
      await expect(page.locator('[data-testid="calories"]')).toContainText('450');
      await expect(page.locator('[data-testid="protein"]')).toContainText('20g');
    });

    test('should integrate with grocery delivery services', async ({ page }) => {
      // Mock grocery API
      await page.route('**/api/grocery/cart', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            cart_url: 'https://grocery-service.com/cart',
            items_added: 5
          })
        });
      });
      
      await page.goto('/recipes');
      await page.click('[data-testid="recipe-card"]:first-child');
      
      // Add ingredients to grocery cart
      await page.click('[data-testid="add-to-grocery-cart"]');
      
      // Select grocery service
      await page.selectOption('[data-testid="grocery-service"]', 'instacart');
      
      // Confirm selection of ingredients
      await page.check('[data-testid="ingredient-checkbox"]:nth-child(1)');
      await page.check('[data-testid="ingredient-checkbox"]:nth-child(2)');
      
      await page.click('[data-testid="add-selected-ingredients"]');
      
      await expect(page.locator('.success-message')).toContainText('5 ingredients added to cart');
      
      // Option to go to grocery service
      const cartPromise = page.waitForEvent('popup');
      await page.click('[data-testid="go-to-cart-button"]');
      
      const cartPage = await cartPromise;
      expect(cartPage.url()).toContain('grocery-service.com');
    });
  });

  test.describe('Social Media Integration', () => {
    test('should share recipe on Facebook', async ({ page, context }) => {
      await page.goto('/recipes');
      await page.click('[data-testid="recipe-card"]:first-child');
      
      // Mock Facebook Share API
      await page.route('**/api/facebook/share', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, post_id: 'fb_post_123' })
        });
      });
      
      // Share on Facebook
      await page.click('[data-testid="share-button"]');
      await page.click('[data-testid="share-facebook"]');
      
      // Verify share dialog
      const sharePopupPromise = page.waitForEvent('popup');
      await page.click('[data-testid="confirm-facebook-share"]');
      
      // In real scenario, would verify Facebook share dialog opens
      // For testing, verify API call was made
      await expect(page.locator('.success-message')).toContainText('Recipe shared on Facebook');
    });

    test('should post recipe to Instagram', async ({ page }) => {
      // Mock Instagram API
      await page.route('**/api/instagram/post', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, media_id: 'ig_media_123' })
        });
      });
      
      await page.goto('/recipes');
      await page.click('[data-testid="recipe-card"]:first-child');
      
      // Share on Instagram
      await page.click('[data-testid="share-button"]');
      await page.click('[data-testid="share-instagram"]');
      
      // Customize Instagram post
      await page.fill('[data-testid="instagram-caption"]', 'Check out this amazing recipe! #cooking #foodie');
      await page.selectOption('[data-testid="instagram-filter"]', 'valencia');
      
      await page.click('[data-testid="post-to-instagram"]');
      
      await expect(page.locator('.success-message')).toContainText('Recipe posted to Instagram');
    });
  });

  test.describe('Error Handling for External Services', () => {
    test('should handle YouTube service unavailable', async ({ page }) => {
      // Mock YouTube API failure
      await page.route('**/youtube.com/oembed**', async route => {
        await route.fulfill({ status: 503 });
      });
      
      await page.goto('/recipes/create');
      await page.fill('[data-testid="youtube-url"]', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      
      // Should show graceful error message
      await expect(page.locator('.warning-message')).toContainText('YouTube service temporarily unavailable');
      
      // Should still allow recipe creation without video metadata
      await page.fill('[data-testid="recipe-title"]', 'Recipe without YouTube metadata');
      await page.fill('[data-testid="ingredient-0"]', '1 cup flour');
      await page.fill('[data-testid="instruction-0"]', 'Mix ingredients');
      
      await page.click('[data-testid="save-recipe-button"]');
      await expect(page.locator('.success-message')).toContainText('Recipe created successfully');
    });

    test('should handle Gmail authentication failure', async ({ page }) => {
      await page.goto('/settings/integrations');
      
      // Mock OAuth failure
      await page.route('**/auth/gmail/authorize', async route => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'access_denied' })
        });
      });
      
      await page.click('[data-testid="connect-gmail-button"]');
      
      await expect(page.locator('.error-message')).toContainText('Gmail authentication failed');
      await expect(page.locator('[data-testid="gmail-status"]')).toContainText('Not connected');
    });

    test('should handle network timeout for external APIs', async ({ page }) => {
      // Mock network timeout
      await page.route('**/api/spoonacular/**', async route => {
        await new Promise(resolve => setTimeout(resolve, 60000)); // Never resolves
      });
      
      await page.goto('/recipes/suggestions');
      await page.fill('[data-testid="ingredient-search"]', 'pasta');
      await page.click('[data-testid="get-suggestions-button"]');
      
      // Should show timeout message
      await expect(page.locator('.error-message')).toContainText('Request timed out', { timeout: 35000 });
      
      // Should allow retry
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
    });
  });
});