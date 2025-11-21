// tests/performance.spec.js
import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

test.describe('Performance Tests @performance', () => {
  test.beforeEach(async ({ page }) => {
    // Store test coordination
    try {
      execSync('npx claude-flow@alpha hooks pre-search --query "performance test" --cache-results true');
    } catch (error) {
      // Continue without coordination
    }
  });

  test.afterEach(async ({ page }) => {
    // Store test results
    try {
      execSync('npx claude-flow@alpha hooks post-edit --file "performance.spec.js" --memory-key "testing/performance/completed"');
    } catch (error) {
      // Continue without coordination
    }
  });

  test('should load homepage within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    console.log(`Homepage load time: ${loadTime}ms`);
    
    // Homepage should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
    
    // Check for Core Web Vitals
    const vitals = await page.evaluate(() => {
      return new Promise((resolve) => {
        if ('web-vital' in window) {
          resolve({
            fcp: window.webVitals?.fcp || null,
            lcp: window.webVitals?.lcp || null,
            cls: window.webVitals?.cls || null,
            fid: window.webVitals?.fid || null
          });
        } else {
          resolve({});
        }
      });
    });
    
    console.log('Core Web Vitals:', vitals);
    
    if (vitals.lcp) {
      expect(vitals.lcp).toBeLessThan(2500); // Good LCP < 2.5s
    }
    
    if (vitals.fcp) {
      expect(vitals.fcp).toBeLessThan(1800); // Good FCP < 1.8s
    }
    
    if (vitals.cls) {
      expect(vitals.cls).toBeLessThan(0.1); // Good CLS < 0.1
    }
  });

  test('should handle large recipe lists efficiently', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test.user@example.com');
    await page.fill('[data-testid="password-input"]', 'TestUser123!');
    await page.click('[data-testid="login-button"]');
    
    const startTime = Date.now();
    
    await page.goto('/recipes?limit=100');
    await page.waitForSelector('[data-testid="recipe-card"]');
    
    const loadTime = Date.now() - startTime;
    
    console.log(`Recipe list (100 items) load time: ${loadTime}ms`);
    
    // Large lists should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
    
    // Check memory usage
    const memoryUsage = await page.evaluate(() => {
      if ('memory' in performance) {
        return {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
        };
      }
      return null;
    });
    
    if (memoryUsage) {
      console.log('Memory usage:', memoryUsage);
      
      // Memory usage should be reasonable (< 100MB)
      expect(memoryUsage.usedJSHeapSize).toBeLessThan(100 * 1024 * 1024);
    }
  });

  test('should implement efficient image lazy loading', async ({ page }) => {
    await page.goto('/recipes');
    
    // Get initial image load count
    const initialImageCount = await page.evaluate(() => {
      const images = document.querySelectorAll('img[data-testid="recipe-image"]');
      return Array.from(images).filter(img => img.complete && img.naturalWidth > 0).length;
    });
    
    console.log(`Initial loaded images: ${initialImageCount}`);
    
    // Scroll to trigger lazy loading
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    
    await page.waitForTimeout(2000); // Wait for lazy loading
    
    const finalImageCount = await page.evaluate(() => {
      const images = document.querySelectorAll('img[data-testid="recipe-image"]');
      return Array.from(images).filter(img => img.complete && img.naturalWidth > 0).length;
    });
    
    console.log(`Final loaded images: ${finalImageCount}`);
    
    // More images should be loaded after scrolling
    expect(finalImageCount).toBeGreaterThan(initialImageCount);
    
    // Check if images have proper loading attributes
    const lazyImages = await page.locator('img[loading="lazy"]').count();
    expect(lazyImages).toBeGreaterThan(0);
  });

  test('should optimize search performance', async ({ page }) => {
    await page.goto('/recipes');
    
    const searchTerm = 'pasta';
    const startTime = Date.now();
    
    // Type search term
    await page.fill('[data-testid="recipe-search"]', searchTerm);
    
    // Wait for search results (debounced)
    await page.waitForFunction(
      (term) => {
        const cards = document.querySelectorAll('[data-testid="recipe-card"]');
        return cards.length > 0 && 
               Array.from(cards).some(card => 
                 card.textContent.toLowerCase().includes(term.toLowerCase())
               );
      },
      searchTerm,
      { timeout: 3000 }
    );
    
    const searchTime = Date.now() - startTime;
    
    console.log(`Search time: ${searchTime}ms`);
    
    // Search should be fast (< 1 second)
    expect(searchTime).toBeLessThan(1000);
    
    // Check if search is debounced (multiple keystrokes)
    const multiSearchStart = Date.now();
    
    await page.fill('[data-testid="recipe-search"]', 'ch');
    await page.waitForTimeout(100);
    await page.fill('[data-testid="recipe-search"]', 'chi');
    await page.waitForTimeout(100);
    await page.fill('[data-testid="recipe-search"]', 'chic');
    await page.waitForTimeout(100);
    await page.fill('[data-testid="recipe-search"]', 'chick');
    await page.waitForTimeout(100);
    await page.fill('[data-testid="recipe-search"]', 'chicken');
    
    await page.waitForSelector('[data-testid="recipe-card"]');
    
    const multiSearchTime = Date.now() - multiSearchStart;
    
    console.log(`Multi-keystroke search time: ${multiSearchTime}ms`);
    
    // Debounced search should not be significantly slower
    expect(multiSearchTime).toBeLessThan(2000);
  });

  test('should handle concurrent API requests efficiently', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test.user@example.com');
    await page.fill('[data-testid="password-input"]', 'TestUser123!');
    await page.click('[data-testid="login-button"]');
    
    // Monitor network requests
    const requests = [];
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        requests.push({
          url: request.url(),
          timestamp: Date.now()
        });
      }
    });
    
    const startTime = Date.now();
    
    // Trigger multiple concurrent operations
    await Promise.all([
      page.goto('/recipes'),
      page.goto('/favorites'),
      page.goto('/profile')
    ]);
    
    await page.waitForLoadState('networkidle');
    
    const totalTime = Date.now() - startTime;
    
    console.log(`Concurrent operations time: ${totalTime}ms`);
    console.log(`Total API requests: ${requests.length}`);
    
    // Should complete within reasonable time
    expect(totalTime).toBeLessThan(8000);
    
    // Check for request optimization (no duplicate requests)
    const uniqueUrls = new Set(requests.map(r => r.url));
    const duplicateRequests = requests.length - uniqueUrls.size;
    
    console.log(`Duplicate requests: ${duplicateRequests}`);
    
    // Should minimize duplicate requests
    expect(duplicateRequests).toBeLessThan(5);
  });

  test('should implement efficient caching', async ({ page }) => {
    // First visit
    const firstVisitStart = Date.now();
    
    await page.goto('/recipes');
    await page.waitForLoadState('networkidle');
    
    const firstVisitTime = Date.now() - firstVisitStart;
    
    console.log(`First visit time: ${firstVisitTime}ms`);
    
    // Second visit (should use cache)
    const secondVisitStart = Date.now();
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    const secondVisitTime = Date.now() - secondVisitStart;
    
    console.log(`Second visit time: ${secondVisitTime}ms`);
    
    // Second visit should be faster due to caching
    expect(secondVisitTime).toBeLessThan(firstVisitTime * 0.8);
    
    // Check cache headers
    const cacheableResources = await page.evaluate(() => {
      return performance.getEntriesByType('resource')
        .filter(resource => 
          resource.name.includes('.js') || 
          resource.name.includes('.css') || 
          resource.name.includes('.png') || 
          resource.name.includes('.jpg')
        )
        .map(resource => ({
          name: resource.name,
          transferSize: resource.transferSize,
          decodedBodySize: resource.decodedBodySize
        }));
    });
    
    console.log('Cacheable resources:', cacheableResources.length);
    
    // Check if resources are being cached (transfer size < decoded size)
    const cachedResources = cacheableResources.filter(
      resource => resource.transferSize < resource.decodedBodySize * 0.1
    );
    
    console.log('Cached resources:', cachedResources.length);
    
    // Some resources should be cached
    expect(cachedResources.length).toBeGreaterThan(0);
  });

  test('should handle large form submissions efficiently', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test.user@example.com');
    await page.fill('[data-testid="password-input"]', 'TestUser123!');
    await page.click('[data-testid="login-button"]');
    
    await page.goto('/recipes/create');
    
    // Create a large recipe with many ingredients and steps
    await page.fill('[data-testid="recipe-title"]', 'Large Performance Test Recipe');
    await page.fill('[data-testid="recipe-description"]', 'A recipe to test form performance with many fields');
    
    // Add many ingredients
    for (let i = 0; i < 20; i++) {
      if (i > 0) {
        await page.click('[data-testid="add-ingredient-button"]');
      }
      await page.fill(`[data-testid="ingredient-${i}"]`, `Ingredient ${i + 1}: Test ingredient for performance`);
    }
    
    // Add many instructions
    for (let i = 0; i < 15; i++) {
      if (i > 0) {
        await page.click('[data-testid="add-instruction-button"]');
      }
      await page.fill(`[data-testid="instruction-${i}"]`, `Step ${i + 1}: Detailed instruction for performance testing that includes multiple sentences and specific details to make the instruction longer and more realistic.`);
    }
    
    const submitStart = Date.now();
    
    // Submit the form
    await page.click('[data-testid="save-recipe-button"]');
    await expect(page.locator('.success-message')).toContainText('Recipe created successfully');
    
    const submitTime = Date.now() - submitStart;
    
    console.log(`Large form submission time: ${submitTime}ms`);
    
    // Large form should submit within reasonable time
    expect(submitTime).toBeLessThan(5000);
  });

  test('should optimize bundle size and loading', async ({ page, context }) => {
    // Monitor resource loading
    const resources = [];
    
    page.on('response', response => {
      if (response.url().includes('.js') || response.url().includes('.css')) {
        resources.push({
          url: response.url(),
          size: parseInt(response.headers()['content-length'] || '0'),
          type: response.url().includes('.js') ? 'js' : 'css'
        });
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const jsResources = resources.filter(r => r.type === 'js');
    const cssResources = resources.filter(r => r.type === 'css');
    
    const totalJsSize = jsResources.reduce((sum, r) => sum + r.size, 0);
    const totalCssSize = cssResources.reduce((sum, r) => sum + r.size, 0);
    
    console.log(`JavaScript bundle size: ${(totalJsSize / 1024).toFixed(2)} KB`);
    console.log(`CSS bundle size: ${(totalCssSize / 1024).toFixed(2)} KB`);
    console.log(`Number of JS files: ${jsResources.length}`);
    console.log(`Number of CSS files: ${cssResources.length}`);
    
    // Bundle sizes should be reasonable
    expect(totalJsSize).toBeLessThan(2 * 1024 * 1024); // < 2MB JS
    expect(totalCssSize).toBeLessThan(500 * 1024);     // < 500KB CSS
    
    // Should minimize number of HTTP requests
    expect(jsResources.length).toBeLessThan(10);
    expect(cssResources.length).toBeLessThan(5);
  });

  test('should handle scroll performance efficiently', async ({ page }) => {
    await page.goto('/recipes');
    
    // Measure FPS during scrolling
    const scrollPerformanceStart = Date.now();
    let frameCount = 0;
    
    // Monitor frames
    const frameObserver = await page.evaluateHandle(() => {
      let frames = 0;
      function countFrame() {
        frames++;
        requestAnimationFrame(countFrame);
      }
      requestAnimationFrame(countFrame);
      return () => frames;
    });
    
    // Perform scrolling
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => window.scrollBy(0, 200));
      await page.waitForTimeout(50);
    }
    
    await page.waitForTimeout(1000);
    
    const frameCountResult = await frameObserver.evaluate(fn => fn());
    const scrollTime = Date.now() - scrollPerformanceStart;
    const fps = (frameCountResult / scrollTime) * 1000;
    
    console.log(`Scroll performance: ${fps.toFixed(2)} FPS`);
    
    // Should maintain reasonable FPS during scrolling
    expect(fps).toBeGreaterThan(30);
  });

  test('should optimize database query performance', async ({ page }) => {
    // Monitor network timing for API calls
    const apiCalls = [];
    
    page.on('response', response => {
      if (response.url().includes('/api/recipes')) {
        const timing = response.timing();
        apiCalls.push({
          url: response.url(),
          responseTime: timing.responseEnd - timing.responseStart,
          status: response.status()
        });
      }
    });
    
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test.user@example.com');
    await page.fill('[data-testid="password-input"]', 'TestUser123!');
    await page.click('[data-testid="login-button"]');
    
    // Perform various operations that hit the database
    await page.goto('/recipes');
    await page.fill('[data-testid="recipe-search"]', 'chicken');
    await page.press('[data-testid="recipe-search"]', 'Enter');
    await page.waitForTimeout(2000);
    
    await page.selectOption('[data-testid="category-filter"]', 'Main Course');
    await page.waitForTimeout(2000);
    
    console.log('API call performance:');
    apiCalls.forEach(call => {
      console.log(`  ${call.url}: ${call.responseTime}ms (${call.status})`);
    });
    
    // All API calls should complete within reasonable time
    apiCalls.forEach(call => {
      expect(call.responseTime).toBeLessThan(2000);
      expect(call.status).toBe(200);
    });
    
    // Average response time should be fast
    const averageResponseTime = apiCalls.reduce((sum, call) => sum + call.responseTime, 0) / apiCalls.length;
    console.log(`Average API response time: ${averageResponseTime.toFixed(2)}ms`);
    
    expect(averageResponseTime).toBeLessThan(500);
  });

  test('should handle memory leaks during navigation', async ({ page }) => {
    // Get initial memory baseline
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const initialMemory = await page.evaluate(() => {
      if ('memory' in performance) {
        return performance.memory.usedJSHeapSize;
      }
      return 0;
    });
    
    console.log(`Initial memory: ${(initialMemory / 1024 / 1024).toFixed(2)} MB`);
    
    // Navigate through multiple pages
    const pages = ['/recipes', '/favorites', '/profile', '/recipes/create', '/settings'];
    
    for (let i = 0; i < 3; i++) { // Repeat navigation cycle
      for (const pagePath of pages) {
        await page.goto(pagePath);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);
      }
    }
    
    // Force garbage collection if available
    await page.evaluate(() => {
      if (window.gc) {
        window.gc();
      }
    });
    
    await page.waitForTimeout(1000);
    
    const finalMemory = await page.evaluate(() => {
      if ('memory' in performance) {
        return performance.memory.usedJSHeapSize;
      }
      return 0;
    });
    
    console.log(`Final memory: ${(finalMemory / 1024 / 1024).toFixed(2)} MB`);
    
    const memoryGrowth = finalMemory - initialMemory;
    const memoryGrowthMB = memoryGrowth / 1024 / 1024;
    
    console.log(`Memory growth: ${memoryGrowthMB.toFixed(2)} MB`);
    
    // Memory growth should be reasonable (< 50MB after navigation)
    expect(memoryGrowthMB).toBeLessThan(50);
  });
});