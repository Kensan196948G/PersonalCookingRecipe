// global-teardown.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function globalTeardown() {
  console.log('🧹 Starting E2E test environment cleanup...');

  // Generate test summary
  await generateTestSummary();

  // Cleanup test database
  console.log('🗄️  Cleaning up test database...');
  try {
    execSync('cd ../backend && python -c "from database import cleanup_test_db; cleanup_test_db()"', { stdio: 'inherit' });
  } catch (error) {
    console.log('⚠️  Database cleanup failed:', error.message);
  }

  // Archive test artifacts
  console.log('📦 Archiving test artifacts...');
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveDir = `test-archives/${timestamp}`;
    
    if (!fs.existsSync('test-archives')) {
      fs.mkdirSync('test-archives');
    }
    
    execSync(`cp -r test-results ${archiveDir}`, { stdio: 'inherit' });
    console.log(`📁 Test artifacts archived to: ${archiveDir}`);
  } catch (error) {
    console.log('⚠️  Artifact archiving failed:', error.message);
  }

  // Store completion info
  try {
    execSync('npx claude-flow@alpha hooks post-task --task-id "e2e_testing" --analyze-performance true', { stdio: 'inherit' });
  } catch (error) {
    console.log('⚠️  Claude Flow hooks not available for teardown');
  }

  console.log('✅ E2E test environment cleanup complete');
}

async function generateTestSummary() {
  console.log('📊 Generating test summary...');
  
  try {
    const resultsPath = path.join(__dirname, 'test-results', 'results.json');
    
    if (!fs.existsSync(resultsPath)) {
      console.log('⚠️  No test results found');
      return;
    }

    const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
    
    const summary = {
      timestamp: new Date().toISOString(),
      stats: {
        total: results.stats?.total || 0,
        passed: results.stats?.passed || 0,
        failed: results.stats?.failed || 0,
        skipped: results.stats?.skipped || 0,
        duration: results.stats?.duration || 0
      },
      suites: results.suites?.map(suite => ({
        title: suite.title,
        tests: suite.tests?.length || 0,
        passed: suite.tests?.filter(t => t.outcome === 'passed').length || 0,
        failed: suite.tests?.filter(t => t.outcome === 'failed').length || 0
      })) || [],
      environment: {
        os: process.platform,
        node: process.version,
        playwright: require('@playwright/test/package.json').version
      }
    };

    // Write summary
    const summaryPath = path.join(__dirname, 'test-results', 'summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

    // Console output
    console.log('📈 Test Execution Summary:');
    console.log(`   Total Tests: ${summary.stats.total}`);
    console.log(`   ✅ Passed: ${summary.stats.passed}`);
    console.log(`   ❌ Failed: ${summary.stats.failed}`);
    console.log(`   ⏭️  Skipped: ${summary.stats.skipped}`);
    console.log(`   ⏱️  Duration: ${(summary.stats.duration / 1000).toFixed(2)}s`);
    console.log(`   📊 Success Rate: ${((summary.stats.passed / summary.stats.total) * 100).toFixed(1)}%`);

  } catch (error) {
    console.log('⚠️  Test summary generation failed:', error.message);
  }
}

module.exports = globalTeardown;