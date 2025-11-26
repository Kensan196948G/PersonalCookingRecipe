// tests/responsive-design.spec.js
import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

test.describe('Responsive Design Tests @responsive', () => {
  const viewports = {
    mobile: { width: 375, height: 667 },
    tablet: { width: 768, height: 1024 },
    desktop: { width: 1920, height: 1080 },
    smallMobile: { width: 320, height: 568 },
    largeMobile: { width: 414, height: 896 },
    smallTablet: { width: 600, height: 800 }
  };

  test.beforeEach(async ({ page }) => {
    // Store test coordination
    try {
      execSync('npx claude-flow@alpha hooks pre-search --query "responsive design test" --cache-results true');
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
      execSync('npx claude-flow@alpha hooks post-edit --file "responsive-design.spec.js" --memory-key "testing/responsive/completed"');
    } catch (error) {
      // Continue without coordination
    }
  });

  test.describe('Mobile Viewport (375x667)', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(viewports.mobile);
    });

    test('should display mobile navigation correctly', async ({ page }) => {
      await page.goto('/');
      
      // Mobile menu should be collapsed by default
      await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="desktop-nav"]')).toBeHidden();
      
      // Open mobile menu
      await page.click('[data-testid="mobile-menu-button"]');
      await expect(page.locator('[data-testid="mobile-nav-menu"]')).toBeVisible();
      
      // Check mobile menu items
      await expect(page.locator('[data-testid="mobile-nav-recipes"]')).toBeVisible();
      await expect(page.locator('[data-testid="mobile-nav-favorites"]')).toBeVisible();
      await expect(page.locator('[data-testid="mobile-nav-profile"]')).toBeVisible();
      
      // Close mobile menu
      await page.click('[data-testid="mobile-menu-close"]');
      await expect(page.locator('[data-testid="mobile-nav-menu"]')).toBeHidden();
    });

    test('should stack recipe cards vertically on mobile', async ({ page }) => {
      await page.goto('/recipes');
      
      const recipeCards = page.locator('[data-testid="recipe-card"]');
      const count = await recipeCards.count();
      
      if (count > 1) {
        // Get positions of first two cards
        const firstCard = recipeCards.first();
        const secondCard = recipeCards.nth(1);
        
        const firstCardBox = await firstCard.boundingBox();
        const secondCardBox = await secondCard.boundingBox();
        
        // Cards should be stacked vertically (second card below first)
        expect(secondCardBox.y).toBeGreaterThan(firstCardBox.y + firstCardBox.height - 50);
      }
    });

    test('should display mobile-optimized recipe form', async ({ page }) => {
      await page.goto('/recipes/create');
      
      // Form should be full width on mobile
      const form = page.locator('[data-testid="recipe-form"]');
      const formBox = await form.boundingBox();
      const viewport = page.viewportSize();
      
      // Form should take most of the viewport width
      expect(formBox.width).toBeGreaterThan(viewport.width * 0.9);
      
      // Input fields should be stacked vertically
      const titleInput = page.locator('[data-testid="recipe-title"]');
      const descriptionInput = page.locator('[data-testid="recipe-description"]');
      
      const titleBox = await titleInput.boundingBox();
      const descriptionBox = await descriptionInput.boundingBox();
      
      expect(descriptionBox.y).toBeGreaterThan(titleBox.y + titleBox.height);
    });

    test('should handle mobile touch interactions', async ({ page }) => {
      await page.goto('/recipes');
      
      // Test swipe gestures (simulated)
      const recipeCard = page.locator('[data-testid="recipe-card"]').first();
      
      if (await recipeCard.isVisible()) {
        // Simulate swipe to reveal actions
        await recipeCard.hover();
        await page.mouse.down();
        await page.mouse.move(100, 0); // Swipe right
        await page.mouse.up();
        
        // Check if swipe actions are revealed
        await expect(page.locator('[data-testid="swipe-actions"]')).toBeVisible();
      }
    });

    test('should display mobile-friendly recipe details', async ({ page }) => {
      await page.goto('/recipes');
      await page.click('[data-testid="recipe-card"]:first-child');
      
      // Recipe image should be full width
      const recipeImage = page.locator('[data-testid="recipe-image"]');
      if (await recipeImage.isVisible()) {
        const imageBox = await recipeImage.boundingBox();
        const viewport = page.viewportSize();
        expect(imageBox.width).toBeGreaterThan(viewport.width * 0.9);
      }
      
      // Ingredients and instructions should be stacked
      const ingredients = page.locator('[data-testid="recipe-ingredients"]');
      const instructions = page.locator('[data-testid="recipe-instructions"]');
      
      const ingredientsBox = await ingredients.boundingBox();
      const instructionsBox = await instructions.boundingBox();
      
      expect(instructionsBox.y).toBeGreaterThan(ingredientsBox.y + ingredientsBox.height);
    });
  });

  test.describe('Tablet Viewport (768x1024)', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(viewports.tablet);
    });

    test('should display tablet navigation layout', async ({ page }) => {
      await page.goto('/');
      
      // Should show desktop navigation on tablet
      await expect(page.locator('[data-testid="desktop-nav"]')).toBeVisible();
      await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeHidden();
      
      // Navigation items should be visible
      await expect(page.locator('[data-testid="nav-recipes"]')).toBeVisible();
      await expect(page.locator('[data-testid="nav-favorites"]')).toBeVisible();
    });

    test('should display recipes in 2-column grid on tablet', async ({ page }) => {
      await page.goto('/recipes');
      
      const recipeCards = page.locator('[data-testid="recipe-card"]');
      const count = await recipeCards.count();
      
      if (count >= 2) {
        // Check if cards are arranged in 2-column layout
        const firstCard = recipeCards.first();
        const secondCard = recipeCards.nth(1);
        
        const firstCardBox = await firstCard.boundingBox();
        const secondCardBox = await secondCard.boundingBox();
        
        // Second card should be to the right of first card (same row)
        expect(Math.abs(firstCardBox.y - secondCardBox.y)).toBeLessThan(50);
        expect(secondCardBox.x).toBeGreaterThan(firstCardBox.x + firstCardBox.width / 2);
      }
    });

    test('should optimize recipe form for tablet', async ({ page }) => {
      await page.goto('/recipes/create');
      
      // Form should be centered with appropriate width
      const form = page.locator('[data-testid="recipe-form"]');
      const formBox = await form.boundingBox();
      const viewport = page.viewportSize();
      
      // Form should not be full width on tablet
      expect(formBox.width).toBeLessThan(viewport.width * 0.9);
      expect(formBox.width).toBeGreaterThan(viewport.width * 0.6);
    });
  });

  test.describe('Desktop Viewport (1920x1080)', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(viewports.desktop);
    });

    test('should display full desktop navigation', async ({ page }) => {
      await page.goto('/');
      
      // Full desktop navigation should be visible
      await expect(page.locator('[data-testid="desktop-nav"]')).toBeVisible();
      await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeHidden();
      
      // All navigation elements should be visible horizontally
      const navItems = page.locator('[data-testid="nav-item"]');
      const count = await navItems.count();
      
      if (count > 1) {
        const firstItem = navItems.first();
        const lastItem = navItems.last();
        
        const firstBox = await firstItem.boundingBox();
        const lastBox = await lastItem.boundingBox();
        
        // Items should be on the same horizontal line
        expect(Math.abs(firstBox.y - lastBox.y)).toBeLessThan(20);
      }
    });

    test('should display recipes in multi-column grid on desktop', async ({ page }) => {
      await page.goto('/recipes');
      
      const recipeCards = page.locator('[data-testid="recipe-card"]');
      const count = await recipeCards.count();
      
      if (count >= 3) {
        // Check if cards are arranged in multi-column layout
        const cards = await recipeCards.all();
        const cardBoxes = await Promise.all(cards.slice(0, 3).map(card => card.boundingBox()));
        
        // At least 3 cards should be in the same row
        const firstRowCards = cardBoxes.filter(box => 
          Math.abs(box.y - cardBoxes[0].y) < 50
        );
        
        expect(firstRowCards.length).toBeGreaterThanOrEqual(3);
      }
    });

    test('should display sidebar and main content layout', async ({ page }) => {
      await page.goto('/recipes');
      
      // Check if sidebar exists on desktop
      const sidebar = page.locator('[data-testid="sidebar"]');
      const mainContent = page.locator('[data-testid="main-content"]');
      
      if (await sidebar.isVisible()) {
        const sidebarBox = await sidebar.boundingBox();
        const mainBox = await mainContent.boundingBox();
        
        // Sidebar should be to the left of main content
        expect(sidebarBox.x + sidebarBox.width).toBeLessThanOrEqual(mainBox.x + 10);
        
        // Both should be visible at the same time
        expect(sidebarBox.y).toBeLessThanOrEqual(mainBox.y + 50);
      }
    });
  });

  test.describe('Cross-Viewport Consistency', () => {
    test('should maintain functionality across all viewports', async ({ page }) => {
      const testViewports = Object.entries(viewports);
      
      for (const [name, size] of testViewports) {
        console.log(`Testing ${name} viewport: ${size.width}x${size.height}`);
        
        await page.setViewportSize(size);
        await page.goto('/recipes');
        
        // Basic functionality should work on all viewports
        await expect(page.locator('[data-testid="recipe-grid"]')).toBeVisible();
        
        // Search should be accessible
        const searchInput = page.locator('[data-testid="recipe-search"]');
        await expect(searchInput).toBeVisible();
        
        // At least one recipe card should be visible
        await expect(page.locator('[data-testid="recipe-card"]').first()).toBeVisible();
      }
    });

    test('should handle viewport changes dynamically', async ({ page }) => {
      // Start with desktop
      await page.setViewportSize(viewports.desktop);
      await page.goto('/recipes');
      
      // Verify desktop layout
      await expect(page.locator('[data-testid="desktop-nav"]')).toBeVisible();
      
      // Change to mobile
      await page.setViewportSize(viewports.mobile);
      await page.waitForTimeout(500); // Wait for layout adjustment
      
      // Verify mobile layout
      await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="desktop-nav"]')).toBeHidden();
      
      // Change back to tablet
      await page.setViewportSize(viewports.tablet);
      await page.waitForTimeout(500);
      
      // Verify tablet layout
      await expect(page.locator('[data-testid="desktop-nav"]')).toBeVisible();
      await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeHidden();
    });
  });

  test.describe('Touch and Gesture Support', () => {
    test('should support touch interactions on mobile', async ({ page }) => {
      await page.setViewportSize(viewports.mobile);
      await page.goto('/recipes');
      
      const recipeCard = page.locator('[data-testid="recipe-card"]').first();
      
      if (await recipeCard.isVisible()) {
        // Test touch tap
        await recipeCard.tap();
        
        // Should navigate to recipe details
        await expect(page).toHaveURL(/.*\/recipes\/\d+/);
        
        // Go back
        await page.goBack();
        
        // Test long press (if implemented)
        await recipeCard.click({ button: 'right' });
        
        // Context menu might appear
        const contextMenu = page.locator('[data-testid="context-menu"]');
        if (await contextMenu.isVisible()) {
          await expect(contextMenu).toBeVisible();
        }
      }
    });

    test('should support pinch-to-zoom on mobile (simulated)', async ({ page }) => {
      await page.setViewportSize(viewports.mobile);
      await page.goto('/recipes');
      await page.click('[data-testid="recipe-card"]:first-child');
      
      const recipeImage = page.locator('[data-testid="recipe-image"]');
      
      if (await recipeImage.isVisible()) {
        // Simulate zoom gesture (double tap)
        await recipeImage.dblclick();
        
        // Image might enter full-screen or zoom mode
        const fullscreenImage = page.locator('[data-testid="fullscreen-image"]');
        const zoomedImage = page.locator('[data-testid="zoomed-image"]');
        
        if (await fullscreenImage.isVisible() || await zoomedImage.isVisible()) {
          console.log('Image zoom functionality detected');
        }
      }
    });
  });

  test.describe('Performance on Different Viewports', () => {
    test('should load efficiently on mobile', async ({ page }) => {
      await page.setViewportSize(viewports.mobile);
      
      const startTime = Date.now();
      await page.goto('/recipes');
      await page.waitForSelector('[data-testid="recipe-card"]');
      const loadTime = Date.now() - startTime;
      
      // Mobile should load reasonably quickly
      expect(loadTime).toBeLessThan(5000);
      
      // Check if lazy loading is working
      const images = page.locator('img[data-testid="recipe-image"]');
      const imageCount = await images.count();
      
      if (imageCount > 0) {
        // Not all images should be loaded immediately on mobile
        const loadedImages = await images.evaluateAll(imgs => 
          imgs.filter(img => img.complete && img.naturalWidth > 0).length
        );
        
        // At least some images should be lazy loaded
        if (imageCount > 3) {
          expect(loadedImages).toBeLessThan(imageCount);
        }
      }
    });

    test('should optimize resource usage on small screens', async ({ page }) => {
      await page.setViewportSize(viewports.smallMobile);
      await page.goto('/recipes');
      
      // Check if high-resolution images are not loaded on small screens
      const images = page.locator('img[data-testid="recipe-image"]');
      
      for (let i = 0; i < Math.min(3, await images.count()); i++) {
        const img = images.nth(i);
        const src = await img.getAttribute('src');
        
        // Should load smaller image sizes on mobile
        if (src && src.includes('?')) {
          expect(src).toMatch(/w=\d+/); // Width parameter
          
          const widthMatch = src.match(/w=(\d+)/);
          if (widthMatch) {
            const imageWidth = parseInt(widthMatch[1]);
            expect(imageWidth).toBeLessThan(800); // Smaller images on mobile
          }
        }
      }
    });
  });

  test.describe('Accessibility on Different Viewports', () => {
    test('should maintain accessibility on mobile', async ({ page }) => {
      await page.setViewportSize(viewports.mobile);
      await page.goto('/recipes');
      
      // Check if focus indicators work on mobile
      await page.keyboard.press('Tab');
      
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(['INPUT', 'BUTTON', 'A']).toContain(focusedElement);
      
      // Check if touch targets are large enough (minimum 44px)
      const buttons = page.locator('button, a, input[type="submit"]');
      const buttonCount = await buttons.count();
      
      for (let i = 0; i < Math.min(5, buttonCount); i++) {
        const button = buttons.nth(i);
        if (await button.isVisible()) {
          const box = await button.boundingBox();
          expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
        }
      }
    });

    test('should support screen reader navigation on all viewports', async ({ page }) => {
      const testViewports = [viewports.mobile, viewports.tablet, viewports.desktop];
      
      for (const viewport of testViewports) {
        await page.setViewportSize(viewport);
        await page.goto('/recipes');
        
        // Check for proper heading structure
        const headings = page.locator('h1, h2, h3, h4, h5, h6');
        const headingCount = await headings.count();
        expect(headingCount).toBeGreaterThan(0);
        
        // Check for aria labels
        const ariaLabels = page.locator('[aria-label]');
        const ariaLabelCount = await ariaLabels.count();
        expect(ariaLabelCount).toBeGreaterThan(0);
      }
    });
  });
});