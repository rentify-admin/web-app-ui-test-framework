# Mobile Viewport Testing - Quick Start Guide

## 🚀 TL;DR - Get Started in 5 Minutes

### Step 1: Update Configuration
Copy the mobile project section from `playwright.config.mobile-example.js` to `playwright.config.js`:

```javascript
// Add to projects array in playwright.config.js
{
    name: 'mobile-chrome',
    use: {
        ...devices['Pixel 5'],
        contextOptions: { 
            permissions: [ 'geolocation', 'notifications', 'clipboard-read', 'clipboard-write' ] 
        },
        launchOptions: {
            args: [
                '--disable-web-security',
                '--use-fake-ui-for-media-stream',
                '--use-fake-device-for-media-stream'
            ]
        }
    }
}
```

### Step 2: Add NPM Scripts
Add to `package.json` scripts section:

```json
"test:mobile": "npx playwright test --project=mobile-chrome",
"test:mobile:ui": "npx playwright test --project=mobile-chrome --ui",
"test:mobile-heartbeat": "npx playwright test heartbeat_* --project=mobile-chrome"
```

### Step 3: Run Your First Mobile Test
```bash
npm run test:mobile-heartbeat
```

---

## 📱 Available Mobile Devices

Playwright includes pre-configured device emulations:

### Recommended Devices

| Device | Size | Use Case |
|--------|------|----------|
| `Pixel 5` | 393×851 | Modern Android (recommended) |
| `iPhone 12` | 390×844 | Modern iOS (recommended) |
| `iPhone SE` | 375×667 | Small screen iOS |
| `iPad (gen 7)` | 810×1080 | Tablet testing |

### How to Use Different Devices

```javascript
// In playwright.config.js
{ name: 'mobile-chrome', use: { ...devices['Pixel 5'] } }
{ name: 'mobile-safari', use: { ...devices['iPhone 12'] } }
{ name: 'tablet', use: { ...devices['iPad (gen 7)'] } }
```

---

## 🎯 Test Execution Commands

### Basic Commands
```bash
# Run all tests on mobile
npm run test:mobile

# Run specific test file on mobile
npx playwright test tests/frontend_heartbeat.spec.js --project=mobile-chrome

# Run tests with UI mode (visual debugging)
npm run test:mobile:ui

# Run heartbeat tests only
npm run test:mobile-heartbeat
```

### Environment-Specific Commands
```bash
# Development environment
APP_ENV=development npx playwright test --project=mobile-chrome

# Staging environment
APP_ENV=staging npx playwright test --project=mobile-chrome

# Run on specific test file with environment
APP_ENV=staging npx playwright test tests/create_session_from_dashboard.spec.js --project=mobile-chrome
```

### Multi-Project Testing
```bash
# Run on desktop AND mobile
npx playwright test --project=chromium --project=mobile-chrome

# Run on multiple mobile devices
npx playwright test --project=mobile-chrome --project=mobile-safari
```

---

## 🏷️ Selective Testing with Tags

If you only want certain tests to run on mobile:

### 1. Configure Selective Project
```javascript
// In playwright.config.js
{
    name: 'mobile-chrome',
    use: { ...devices['Pixel 5'], /* ... */ },
    grep: /@mobile-compatible/  // Only run tagged tests
}
```

### 2. Tag Your Tests
```javascript
// In your test file
test('Login and Dashboard',
    {
        tag: ['@core', '@mobile-compatible'],  // Add mobile tag
        timeout: 180_000
    },
    async ({ page }) => {
        // Test code
    }
);
```

### 3. Run Tagged Tests
```bash
npx playwright test --project=mobile-chrome  # Only runs @mobile-compatible tests
```

---

## 🔍 Debugging Mobile Tests

### Visual Debugging (Recommended)
```bash
# Open Playwright UI in mobile mode
npx playwright test --project=mobile-chrome --ui

# Debug specific test
npx playwright test tests/your-test.spec.js --project=mobile-chrome --debug
```

### Headed Mode (See Browser)
```bash
# Watch test run in browser
npx playwright test --project=mobile-chrome --headed

# Slow down execution
npx playwright test --project=mobile-chrome --headed --slow-mo=1000
```

### Screenshots & Videos
```bash
# Tests automatically capture video on failure (configured in playwright.config.js)
# Screenshots can be added in tests:
await page.screenshot({ path: 'mobile-screenshot.png' });
```

---

## ⚠️ Common Issues & Fixes

### Issue 1: Element Not Visible on Mobile
**Problem**: Test passes on desktop but fails on mobile - element not visible

**Solution**: Check if element is hidden on mobile viewport
```javascript
// Instead of expecting visibility, check if element exists
const element = page.getByTestId('some-button');
if (await element.isVisible({ timeout: 5000 })) {
    await element.click();
} else {
    // Element might be in hamburger menu on mobile
    await page.getByTestId('mobile-menu-toggle').click();
    await element.click();
}
```

### Issue 2: Click Not Working on Mobile
**Problem**: Clicks don't register on mobile viewport

**Solution**: Use `tap()` instead of `click()` for mobile
```javascript
// Desktop
await page.getByTestId('button').click();

// Mobile (more reliable)
await page.getByTestId('button').tap();

// Or use both
const isMobile = page.viewportSize()?.width < 768;
if (isMobile) {
    await page.getByTestId('button').tap();
} else {
    await page.getByTestId('button').click();
}
```

### Issue 3: Hover Actions Don't Work
**Problem**: Tests that rely on hover states fail on mobile (touch devices don't have hover)

**Solution**: Avoid hover-dependent tests or make them conditional
```javascript
// Bad (relies on hover)
await page.getByTestId('dropdown').hover();
await page.getByTestId('dropdown-item').click();

// Good (direct interaction)
await page.getByTestId('dropdown').click();
await page.getByTestId('dropdown-item').click();
```

### Issue 4: Tests Take Too Long on Mobile
**Problem**: Mobile tests timeout more frequently

**Solution**: Increase timeout for mobile projects
```javascript
// In playwright.config.js mobile project
{
    name: 'mobile-chrome',
    use: { ...devices['Pixel 5'] },
    timeout: 150_000  // Increase from default 100_000
}
```

### Issue 5: Scroll Behavior Issues
**Problem**: Elements not scrolling into view on mobile

**Solution**: Explicitly scroll before interaction
```javascript
await page.getByTestId('element').scrollIntoViewIfNeeded();
await page.getByTestId('element').click();
```

---

## 📊 Test Results & Reporting

### View HTML Report
```bash
# After test run
npx playwright show-report
```

### Filter Results by Project
Reports will show results for each project separately:
- ✅ chromium (Desktop)
- ✅ mobile-chrome (Mobile)
- ❌ mobile-safari (if configured)

### CI/CD Integration
Tests will automatically run on configured projects in CI/CD:
- JUnit reports include project name
- TestRail uploads can be filtered by project/browser
- Slack notifications show per-project results

---

## 🎨 Custom Viewport Sizes

For specific breakpoints or testing responsive design:

```javascript
// In playwright.config.js
{
    name: 'mobile-small',
    use: {
        viewport: { width: 320, height: 568 },  // iPhone 5/SE
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        // ... other config
    }
},
{
    name: 'mobile-large',
    use: {
        viewport: { width: 428, height: 926 },  // iPhone 14 Pro Max
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true
    }
}
```

### Common Breakpoints
- **Small Mobile**: 320-375px width
- **Standard Mobile**: 375-428px width
- **Large Mobile**: 428-480px width
- **Tablet Portrait**: 768-834px width
- **Tablet Landscape**: 1024-1194px width

---

## 📝 Adding Mobile Tests to CI/CD

### GitHub Actions Example

Create `.github/workflows/mobile-regression.yml`:

```yaml
name: Mobile Regression Tests

on:
  schedule:
    - cron: '0 12 * * *'  # Daily at noon UTC
  workflow_dispatch:

jobs:
  mobile-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
      
      - name: Run mobile tests
        run: npx playwright test --project=mobile-chrome
        env:
          APP_ENV: development
      
      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: mobile-playwright-report
          path: playwright-report/
```

---

## 🎯 Recommended Testing Strategy

### Phase 1: Proof of Concept (Week 1)
- [ ] Enable mobile-chrome project
- [ ] Run heartbeat tests: `npm run test:mobile-heartbeat`
- [ ] Fix any critical failures
- [ ] Document issues found

### Phase 2: Core Tests (Week 2)
- [ ] Tag 10-15 core tests with `@mobile-compatible`
- [ ] Run: `npx playwright test --grep @mobile-compatible --project=mobile-chrome`
- [ ] Validate critical user journeys work on mobile

### Phase 3: Full Coverage (Week 3-4)
- [ ] Add mobile-safari project
- [ ] Run all tests on mobile
- [ ] Create mobile-specific test reports
- [ ] Add to CI/CD pipeline

---

## 🆘 Need Help?

### Check Documentation
- [Playwright Device Emulation](https://playwright.dev/docs/emulation)
- [Available Devices List](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/server/deviceDescriptorsSource.json)

### Common Resources
- `playwright.config.mobile-example.js` - Full configuration examples
- `MOBILE_VIEWPORT_TESTING_SUMMARY.md` - Detailed implementation options
- `tests/utils/` - Utility functions that work on mobile

### Debugging Tips
1. Always start with UI mode: `--ui`
2. Use headed mode to see what's happening: `--headed`
3. Take screenshots at failure points
4. Check element visibility before interaction
5. Review viewport size in test: `console.log(page.viewportSize())`

---

**Ready to start? Run this command:**

```bash
npm run test:mobile-heartbeat
```

Good luck! 🚀📱

