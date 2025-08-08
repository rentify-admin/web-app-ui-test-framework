import { test, expect } from '@playwright/test';

// Test 1: Fast Pass - Simple assertion that always passes
test('WITNESS-001 - Fast Pass Test', {
  tag: ['@witness', '@pipeline', '@fast'],
}, async ({ page }) => {
  // Simple test that should always pass
  await expect(1 + 1).toBe(2);
  await expect('hello').toBe('hello');
  await expect(true).toBe(true);
  
  // Add a small delay to simulate some work
  await page.waitForTimeout(500);
});

// Test 2: Fast Fail - Simple assertion that always fails
test('WITNESS-002 - Fast Fail Test', {
  tag: ['@witness', '@pipeline', '@fast'],
}, async ({ page }) => {
  // Simple test that should always fail
  await expect(1 + 1).toBe(3); // This will always fail
});

// Test 3: Flaky Test - Sometimes passes, sometimes fails
test('WITNESS-003 - Flaky Test', {
  tag: ['@witness', '@pipeline', '@flaky'],
  retries: 2, // Allow 2 retries to demonstrate flakiness
}, async ({ page }) => {
  // Create a flaky test that fails 50% of the time
  const random = Math.random();
  
  if (random < 0.5) {
    // 50% chance to fail
    await expect(1 + 1).toBe(3);
  } else {
    // 50% chance to pass
    await expect(1 + 1).toBe(2);
  }
  
  // Add a small delay to simulate some work
  await page.waitForTimeout(300);
});
