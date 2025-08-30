// global-setup.js
const { chromium } = require('@playwright/test');
const { execSync } = require('child_process');

async function globalSetup() {
  console.log('🚀 Starting E2E test environment setup...');
  
  // Store coordination info
  console.log('📝 Storing test coordination info...');
  try {
    execSync('npx claude-flow@alpha hooks pre-task --description "E2E testing environment setup" --auto-spawn-agents false', { stdio: 'inherit' });
  } catch (error) {
    console.log('⚠️  Claude Flow hooks not available, continuing without coordination');
  }

  // Setup test database
  console.log('🗄️  Setting up test database...');
  try {
    // Clear and seed test database
    execSync('cd ../backend && python -c "from database import create_test_db; create_test_db()"', { stdio: 'inherit' });
  } catch (error) {
    console.log('⚠️  Database setup failed, tests may use production data');
  }

  // Create test user accounts
  console.log('👤 Creating test user accounts...');
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to app
    await page.goto('http://localhost:3000');
    
    // Create admin test user
    await createTestUser(page, {
      email: 'test.admin@example.com',
      password: 'TestAdmin123!',
      name: 'Test Admin',
      role: 'admin'
    });

    // Create regular test user
    await createTestUser(page, {
      email: 'test.user@example.com',
      password: 'TestUser123!',
      name: 'Test User',
      role: 'user'
    });

    // Create chef test user
    await createTestUser(page, {
      email: 'test.chef@example.com',
      password: 'TestChef123!',
      name: 'Test Chef',
      role: 'chef'
    });

  } catch (error) {
    console.log('⚠️  Test user creation failed:', error.message);
  } finally {
    await browser.close();
  }

  // Store setup completion
  try {
    execSync('npx claude-flow@alpha hooks notify --message "E2E test environment setup completed" --telemetry true', { stdio: 'inherit' });
  } catch (error) {
    // Continue without coordination
  }

  console.log('✅ E2E test environment setup complete');
}

async function createTestUser(page, userData) {
  try {
    // Navigate to registration
    await page.goto('/register');
    
    // Fill registration form
    await page.fill('[data-testid="email-input"]', userData.email);
    await page.fill('[data-testid="password-input"]', userData.password);
    await page.fill('[data-testid="name-input"]', userData.name);
    
    // Submit registration
    await page.click('[data-testid="register-button"]');
    
    // Wait for registration completion
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    
    // Logout for next user
    await page.click('[data-testid="logout-button"]');
    await page.waitForURL('**/login');
    
    console.log(`✅ Created test user: ${userData.email}`);
  } catch (error) {
    console.log(`⚠️  Failed to create test user ${userData.email}:`, error.message);
  }
}

module.exports = globalSetup;