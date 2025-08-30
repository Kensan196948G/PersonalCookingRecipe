// tests/auth.spec.js
import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

test.describe('Authentication Flow @auth', () => {
  test.beforeEach(async ({ page }) => {
    // Store test coordination
    try {
      execSync('npx claude-flow@alpha hooks pre-search --query "authentication test" --cache-results true');
    } catch (error) {
      // Continue without coordination
    }
    
    await page.goto('/');
  });

  test.afterEach(async ({ page }) => {
    // Store test results
    try {
      execSync('npx claude-flow@alpha hooks post-edit --file "auth.spec.js" --memory-key "testing/auth/completed"');
    } catch (error) {
      // Continue without coordination
    }
  });

  test('should display login form correctly', async ({ page }) => {
    await page.goto('/login');
    
    // Check form elements
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="register-link"]')).toBeVisible();
    
    // Check form validation
    await page.click('[data-testid="login-button"]');
    await expect(page.locator('.error-message')).toContainText('Email is required');
    
    await page.fill('[data-testid="email-input"]', 'invalid-email');
    await page.click('[data-testid="login-button"]');
    await expect(page.locator('.error-message')).toContainText('Please enter a valid email');
  });

  test('should register new user successfully', async ({ page }) => {
    await page.goto('/register');
    
    const testUser = {
      name: 'New Test User',
      email: `test.${Date.now()}@example.com`,
      password: 'SecurePassword123!'
    };
    
    // Fill registration form
    await page.fill('[data-testid="name-input"]', testUser.name);
    await page.fill('[data-testid="email-input"]', testUser.email);
    await page.fill('[data-testid="password-input"]', testUser.password);
    await page.fill('[data-testid="confirm-password-input"]', testUser.password);
    
    // Accept terms
    await page.check('[data-testid="terms-checkbox"]');
    
    // Submit registration
    await page.click('[data-testid="register-button"]');
    
    // Check successful registration
    await expect(page).toHaveURL('**/dashboard');
    await expect(page.locator('[data-testid="welcome-message"]')).toContainText(testUser.name);
  });

  test('should login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    
    // Use pre-created test user
    await page.fill('[data-testid="email-input"]', 'test.user@example.com');
    await page.fill('[data-testid="password-input"]', 'TestUser123!');
    
    // Submit login
    await page.click('[data-testid="login-button"]');
    
    // Check successful login
    await expect(page).toHaveURL('**/dashboard');
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    await expect(page.locator('[data-testid="logout-button"]')).toBeVisible();
  });

  test('should reject invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    // Try with wrong password
    await page.fill('[data-testid="email-input"]', 'test.user@example.com');
    await page.fill('[data-testid="password-input"]', 'WrongPassword');
    
    await page.click('[data-testid="login-button"]');
    
    // Check error message
    await expect(page.locator('.error-message')).toContainText('Invalid email or password');
    await expect(page).toHaveURL('**/login');
  });

  test('should logout user successfully', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test.user@example.com');
    await page.fill('[data-testid="password-input"]', 'TestUser123!');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('**/dashboard');
    
    // Logout
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-button"]');
    
    // Check successful logout
    await expect(page).toHaveURL('**/');
    await expect(page.locator('[data-testid="login-button"]')).toBeVisible();
  });

  test('should redirect unauthenticated users', async ({ page }) => {
    // Try to access protected route
    await page.goto('/dashboard');
    
    // Should redirect to login
    await expect(page).toHaveURL('**/login');
    await expect(page.locator('.info-message')).toContainText('Please log in to access this page');
  });

  test('should remember user session', async ({ page, context }) => {
    // Login
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test.user@example.com');
    await page.fill('[data-testid="password-input"]', 'TestUser123!');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('**/dashboard');
    
    // Create new tab
    const newPage = await context.newPage();
    await newPage.goto('/dashboard');
    
    // Should still be logged in
    await expect(newPage).toHaveURL('**/dashboard');
    await expect(newPage.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('should handle password reset flow', async ({ page }) => {
    await page.goto('/login');
    
    // Click forgot password
    await page.click('[data-testid="forgot-password-link"]');
    await expect(page).toHaveURL('**/forgot-password');
    
    // Enter email
    await page.fill('[data-testid="email-input"]', 'test.user@example.com');
    await page.click('[data-testid="reset-button"]');
    
    // Check success message
    await expect(page.locator('.success-message')).toContainText('Password reset email sent');
  });

  test('should validate password strength on registration', async ({ page }) => {
    await page.goto('/register');
    
    const testCases = [
      { password: '123', expected: 'Password is too weak' },
      { password: 'password', expected: 'Password must contain uppercase' },
      { password: 'Password', expected: 'Password must contain numbers' },
      { password: 'Password123', expected: 'Password must contain special characters' },
      { password: 'Pass123!', expected: 'Password must be at least 8 characters' }
    ];
    
    for (const testCase of testCases) {
      await page.fill('[data-testid="password-input"]', testCase.password);
      await page.fill('[data-testid="email-input"]', 'test@example.com'); // Trigger validation
      
      await expect(page.locator('.password-strength-indicator')).toContainText(testCase.expected);
    }
    
    // Test strong password
    await page.fill('[data-testid="password-input"]', 'StrongPassword123!');
    await expect(page.locator('.password-strength-indicator')).toContainText('Strong password');
  });

  test('should handle social login (Google OAuth)', async ({ page }) => {
    await page.goto('/login');
    
    // Mock Google OAuth (in real tests, you'd use proper OAuth testing)
    await page.route('**/auth/google', async route => {
      await route.fulfill({
        status: 302,
        headers: {
          'Location': '/dashboard?auth=success'
        }
      });
    });
    
    await page.click('[data-testid="google-login-button"]');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('**/dashboard*');
  });
});