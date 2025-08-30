# E2E Testing Suite for Personal Cooking Recipe App

This comprehensive End-to-End (E2E) testing suite provides thorough coverage of the Personal Cooking Recipe application using Playwright. The tests are designed to validate the complete user experience from registration through advanced features.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Install Playwright browsers
npm run install

# Run all tests
npm test

# Run tests in headed mode (see browser)
npm run test:headed

# Run tests with UI mode
npm run test:ui
```

## 📋 Test Coverage

### Core Functionality Tests

#### 1. Authentication (`auth.spec.js`) @auth
- User registration with validation
- Login/logout functionality
- Password reset flow
- Social login (Google OAuth)
- Session management
- Password strength validation

#### 2. Recipe CRUD (`recipe-crud.spec.js`) @recipe
- Recipe creation with all fields
- Recipe viewing and details
- Recipe editing and updates
- Recipe deletion with confirmation
- Form validation and error handling
- Bulk operations
- Image uploads
- Recipe favorites

#### 3. Search & Filter (`search-filter.spec.js`) @search
- Text search functionality
- Category and cuisine filters
- Difficulty and time filters
- Dietary restriction filters
- Combined filter operations
- Search autocomplete
- Advanced ingredient search
- Filter presets and saved searches
- Pagination in results
- Sort functionality

### Integration Tests

#### 4. API Integration (`api-integration.spec.js`) @api @integration
- Authentication endpoints
- Recipe CRUD operations via API
- Search API functionality
- File upload endpoints
- Error handling and validation
- Rate limiting
- CORS headers
- Analytics endpoints
- Export functionality

#### 5. External Integrations (`external-integrations.spec.js`) @integration
- **YouTube Integration**
  - Video embedding
  - URL validation
  - Metadata extraction
  - Playlist handling
- **Gmail Integration**
  - Recipe sharing via email
  - OAuth authentication
  - Recipe import from emails
- **Notion Integration**
  - Recipe export to Notion
  - Sync functionality
  - Import from Notion databases
- **Social Media**
  - Facebook sharing
  - Instagram posting
- **Grocery Services**
  - Shopping list generation
  - Third-party cart integration
- **Error Handling**
  - Service unavailability
  - Network timeouts
  - Authentication failures

### Quality Assurance Tests

#### 6. Responsive Design (`responsive-design.spec.js`) @responsive
- **Mobile Viewport (375x667)**
  - Mobile navigation
  - Touch interactions
  - Vertical card stacking
  - Mobile-optimized forms
- **Tablet Viewport (768x1024)**
  - 2-column layouts
  - Navigation adaptation
  - Form optimization
- **Desktop Viewport (1920x1080)**
  - Multi-column grids
  - Full navigation
  - Sidebar layouts
- **Cross-viewport Consistency**
  - Functionality across devices
  - Dynamic viewport changes
- **Accessibility**
  - Touch target sizes
  - Screen reader support
  - Focus indicators

#### 7. Performance (`performance.spec.js`) @performance
- Page load times and Core Web Vitals
- Large dataset handling
- Image lazy loading
- Search performance and debouncing
- Concurrent API requests
- Caching efficiency
- Bundle size optimization
- Scroll performance
- Memory leak detection
- Database query optimization

### Comprehensive Journey Tests

#### 8. Full User Journey (`full-user-journey.spec.js`) @integration
- **Complete New User Journey**
  - Registration → Profile Setup → Recipe Creation → Search → Social Features
  - 14-step comprehensive flow
  - Mobile responsiveness testing
  - Error handling verification
- **Power User Journey**
  - Advanced features and bulk operations
  - API integrations and automation
  - Custom collections and collaboration
  - Recipe versioning
- **Mobile-First Journey**
  - Complete mobile experience
  - Touch interactions
  - Mobile-optimized workflows

## 🛠️ Test Configuration

### Playwright Configuration
- **Browsers**: Chrome, Firefox, Safari, Mobile Chrome, Mobile Safari, Edge
- **Parallel Execution**: Tests run concurrently for speed
- **Retries**: CI environments get 2 retries
- **Screenshots**: Captured on failure
- **Videos**: Recorded on failure
- **Traces**: Available for debugging

### Test Environment Setup
- **Global Setup**: Creates test users, seeds database
- **Global Teardown**: Cleanup and test summary generation
- **Base URL**: http://localhost:3000 (frontend)
- **API URL**: http://localhost:8000 (backend)
- **Test Data**: Predefined users and recipes

## 📊 Test Execution

### Running Specific Test Suites

```bash
# Run authentication tests only
npm run test:auth

# Run recipe CRUD tests
npm run test:recipe

# Run search functionality tests
npm run test:search

# Run API integration tests
npm run test:api

# Run external integration tests
npm run test:integration

# Run performance tests
npm run test:performance

# Run responsive design tests
npm run test:responsive
```

### Browser-Specific Testing

```bash
# Test on Chrome only
npm run test:chrome

# Test on Firefox only
npm run test:firefox

# Test on Safari only
npm run test:safari

# Test on mobile devices
npm run test:mobile
```

### Debugging and Development

```bash
# Run tests in debug mode
npm run test:debug

# Generate test code
npm run codegen

# View test reports
npm run report

# Show trace viewer
npm run trace
```

## 🎯 Test Strategies

### Test Data Management
- **Dynamic Test Data**: Uses timestamps for unique data
- **Cleanup Strategy**: Global teardown removes test data
- **Isolation**: Each test creates its own data
- **Realistic Data**: Uses comprehensive recipe examples

### Error Handling
- **Network Failures**: Tests offline scenarios
- **API Errors**: Validates error messages
- **Form Validation**: Comprehensive input testing
- **Edge Cases**: Invalid URLs, missing data, etc.

### Performance Testing
- **Load Times**: Homepage < 3s, Recipe lists < 5s
- **Memory Usage**: < 100MB JavaScript heap
- **Search Speed**: < 1s response time
- **Core Web Vitals**: LCP < 2.5s, FCP < 1.8s, CLS < 0.1

### Accessibility Testing
- **Keyboard Navigation**: Tab order and focus
- **Screen Reader Support**: ARIA labels and headings
- **Touch Targets**: Minimum 44px for mobile
- **Color Contrast**: Automated and manual checks

## 📈 Test Reporting

### Available Reports
- **HTML Report**: Visual test results with screenshots
- **JSON Report**: Machine-readable results
- **JUnit Report**: CI/CD integration
- **Line Report**: Console output for quick feedback

### Test Metrics Tracked
- **Execution Time**: Per test and total suite
- **Pass/Fail Rates**: Success percentage
- **Performance Metrics**: Load times, memory usage
- **Coverage Areas**: Feature completeness
- **Error Types**: Categorized failure analysis

### Continuous Integration
- **Automated Runs**: On push and pull requests
- **Parallel Execution**: Faster CI feedback
- **Artifact Storage**: Screenshots and videos
- **Performance Budgets**: Automatic alerts for regressions

## 🔧 Customization

### Adding New Tests
1. Create test file in `/tests/` directory
2. Use descriptive test names with tags
3. Follow established patterns for setup/teardown
4. Include coordination hooks for Claude Flow integration
5. Add test to appropriate npm scripts

### Test Configuration Options
- Modify `playwright.config.js` for global settings
- Update `package.json` scripts for new test categories
- Customize timeouts and retry strategies
- Configure additional browsers or devices

### Environment Variables
- `CI`: Enables CI-specific configurations
- `BASE_URL`: Override default application URL
- `API_URL`: Override default API URL
- `HEADLESS`: Control browser visibility
- `WORKERS`: Set parallel execution count

## 🚀 Best Practices

### Test Writing Guidelines
1. **Descriptive Names**: Tests should be self-documenting
2. **Single Responsibility**: One feature per test
3. **Independent Tests**: No dependencies between tests
4. **Realistic Data**: Use meaningful test data
5. **Error Scenarios**: Test both success and failure paths

### Performance Considerations
1. **Parallel Execution**: Use `test.describe.configure({ mode: 'parallel' })`
2. **Resource Cleanup**: Ensure proper teardown
3. **Smart Waits**: Use `waitForSelector` instead of `waitForTimeout`
4. **Data Efficiency**: Minimize test data creation

### Maintenance Guidelines
1. **Regular Updates**: Keep Playwright version current
2. **Test Review**: Regular audit of test effectiveness
3. **Documentation**: Update README for new features
4. **Monitoring**: Track test flakiness and performance

## 🔍 Troubleshooting

### Common Issues
1. **Test Timeouts**: Increase timeout or improve selectors
2. **Flaky Tests**: Add proper wait conditions
3. **Browser Crashes**: Check memory usage and cleanup
4. **Network Issues**: Mock external services

### Debugging Tools
1. **Playwright Inspector**: `npm run test:debug`
2. **Trace Viewer**: `npm run trace`
3. **Console Logs**: Add `console.log` in tests
4. **Screenshots**: Automatic on failure

### Performance Issues
1. **Slow Tests**: Profile and optimize selectors
2. **Memory Leaks**: Use `page.close()` when needed
3. **Network Bottlenecks**: Mock heavy API calls
4. **Resource Usage**: Monitor browser processes

## 📞 Support

- **Documentation**: Playwright official docs
- **Issues**: GitHub repository issues
- **Performance**: Lighthouse and Core Web Vitals
- **Accessibility**: axe-core integration available

---

This E2E testing suite provides comprehensive coverage ensuring the Personal Cooking Recipe application delivers a high-quality user experience across all devices and browsers.