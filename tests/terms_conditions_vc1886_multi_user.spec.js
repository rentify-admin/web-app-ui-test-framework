import { test, expect } from '@playwright/test';
import { admin, app } from './test_config';
import { adminLoginAndNavigateToApplications } from '~/tests/utils/session-utils';
import { findAndInviteApplication, openInviteModal } from '~/tests/utils/applications-page';
import generateSessionForm from '~/tests/utils/generate-session-form';
import { cleanupTrackedSession } from '~/tests/utils/cleanup-helper';
import { joinUrl, getRandomEmail } from '~/tests/utils/helper';
import {
    acceptTermsAndConditions,
    extractSessionUuid,
    getTermsLocalStorageEntry,
    hasAnyTermsLocalStorageKey,
    waitForTermsModal
} from './utils/terms-helper';

/**
 * @ticket VC-1886
 *
 * Verifies that each applicant in the same physical browser (shared browser context /
 * shared localStorage) is individually prompted to accept the Terms & Conditions.
 *
 * Key assertion: Accepting T&C for Session A must NOT pre-accept T&C for Session B,
 * even when both sessions are navigated in the same browser context.
 *
 * LocalStorage key format: [terms-conditions]-[privacy-policy]-[sessionUuid]
 */

const APPLICATION_NAME = 'AutoTest Suite - Full Test';

// ─── Module-level state (shared across beforeAll / test / afterAll) ───────────

let sessionIdA = null;
let sessionIdB = null;
let linkA = null;
let linkB = null;
let sharedContext = null;

// ─── Test Suite ───────────────────────────────────────────────────────────────

test.describe('QA-370: VC-1886: Multi-User T&C — Same Browser, Individual Prompts', () => {
    test.describe.configure({ mode: 'serial' });

    test('Test 1: Multi-User Same Browser — Each User Individually Prompted', { tag: ['@core', '@regression'] }, async ({ browser }) => {

        const adminContext = await browser.newContext();
        const adminPage = await adminContext.newPage();
        try {
            // ── Admin Login ──────────────────────────────────────────────────
            console.log('🔐 Logging in as admin...');
            await adminLoginAndNavigateToApplications(adminPage, admin);
            console.log('✅ Admin logged in and navigated to applications');

            // ── Session A (Guest A) ──────────────────────────────────────────
            console.log('📋 Creating Session A for Guest A...');
            await findAndInviteApplication(adminPage, APPLICATION_NAME);
            const resultA = await generateSessionForm.generateSessionAndExtractLink(adminPage, {
                first_name: 'GuestA',
                last_name: 'TermsTest',
                email: getRandomEmail()
            });
            sessionIdA = resultA.sessionId;
            linkA = resultA.link;
            console.log(`✅ Session A created — ID: ${sessionIdA}`);

            // ── Session B (Guest B) ──────────────────────────────────────────
            // Full page navigation clears the search input so filling the same
            // application name fires a fresh API request (avoids no-op fill issue).
            console.log('📋 Creating Session B for Guest B...');
            await openInviteModal(adminPage, APPLICATION_NAME);
            const resultB = await generateSessionForm.generateSessionAndExtractLink(adminPage, {
                first_name: 'GuestB',
                last_name: 'TermsTest',
                email: getRandomEmail()
            });
            sessionIdB = resultB.sessionId;
            linkB = resultB.link;
            console.log(`✅ Session B created — ID: ${sessionIdB}`);

            // ── Admin Logout ─────────────────────────────────────────────────
            console.log('🔒 Logging out admin...');
            await adminPage.getByTestId('user-dropdown-toggle-btn').click();
            await adminPage.getByTestId('user-logout-dropdown-item').click();
            await expect(adminPage.getByTestId('admin-login-btn')).toBeVisible({ timeout: 10_000 });
            console.log('✅ Admin logged out');
        } finally {
            await adminContext.close();
        }

        // ── Shared browser context ───────────────────────────────────────────
        // One context = one shared localStorage, simulating two applicants on the same physical browser
        sharedContext = await browser.newContext();
        const sharedPage = await sharedContext.newPage();
        try {
            const linkUrlA = new URL(linkA);
            const linkUrlB = new URL(linkB);
            const sessionUuidA = extractSessionUuid(linkA);
            const sessionUuidB = extractSessionUuid(linkB);

            // ── Step 1: Guest A navigates to Session A — T&C modal appears ──
            console.log('\n📋 Step 1: Guest A navigates to Session A...');
            await sharedPage.goto(joinUrl(app.urls.app, `${linkUrlA.pathname}${linkUrlA.search}`));
            await waitForTermsModal(sharedPage);
            await expect(sharedPage.getByTestId('user-terms')).toBeVisible();
            console.log('✅ Guest A is prompted with T&C modal');

            // ── Step 2: Guest A accepts T&C ─────────────────────────────────
            console.log('\n📋 Step 2: Guest A accepts T&C...');
            await acceptTermsAndConditions(sharedPage);
            await expect(sharedPage.getByTestId('user-terms')).not.toBeVisible();
            console.log('✅ T&C modal closed for Guest A');

            // ── Step 3: Verify localStorage has acceptance for Session A ─────
            console.log('\n📋 Step 3: Verifying localStorage for Session A...');
            const entryA = await getTermsLocalStorageEntry(sharedPage, sessionUuidA);
            expect(entryA, 'localStorage must have an entry for Session A').not.toBeNull();
            expect(entryA.value).toBe('true');
            console.log(`✅ Session A acceptance stored — key: ${entryA.key}`);

            // ── Step 4: Same browser navigates to Session B — T&C re-appears ─
            console.log('\n📋 Step 4: Same browser navigates to Session B...');
            await sharedPage.goto(joinUrl(app.urls.app, `${linkUrlB.pathname}${linkUrlB.search}`));
            await waitForTermsModal(sharedPage);
            await expect(sharedPage.getByTestId('user-terms')).toBeVisible();
            console.log('✅ Guest B is individually prompted — Session A acceptance did NOT bleed into Session B');

            // ── Step 5: Verify localStorage has NO acceptance for Session B yet
            console.log('\n📋 Step 5: Verifying no localStorage acceptance for Session B yet...');
            const entryBefore = await getTermsLocalStorageEntry(sharedPage, sessionUuidB);
            expect(entryBefore, 'Session B must NOT be pre-accepted in localStorage').toBeNull();
            console.log('✅ Session B has no localStorage entry — per-session isolation confirmed');

            // ── Step 6: Guest B accepts T&C — modal closes normally ──────────
            console.log('\n📋 Step 6: Guest B accepts T&C...');
            await acceptTermsAndConditions(sharedPage);
            await expect(sharedPage.getByTestId('user-terms')).not.toBeVisible();
            console.log('✅ T&C modal closed for Guest B');

            console.log('\n✅ All steps passed: per-session T&C isolation verified in shared browser context');
        } finally {
            await sharedPage.close();
        }
    });

    let t2SessionId = null;
    let t2InviteLink = null;
    test('Test 2: Internal User Bypass — Admin Never Sees T&C Modal', { tag: ['@core', '@regression'] }, async ({ page }) => {
        // Admin context is intentionally NOT closed here — the authenticated session
        // must persist into the test body
        // ── Admin Login ──────────────────────────────────────────────────────
        console.log('🔐 [T2] Logging in as admin...');
        await adminLoginAndNavigateToApplications(page, admin);
        console.log('✅ [T2] Admin logged in and navigated to applications');

        // ── Create Session ───────────────────────────────────────────────────
        console.log('📋 [T2] Creating session for bypass test...');
        await findAndInviteApplication(page, APPLICATION_NAME);
        const result = await generateSessionForm.generateSessionAndExtractLink(page, {
            first_name: 'AdminBypass',
            last_name: 'TermsTest',
            email: getRandomEmail()
        });
        t2SessionId = result.sessionId;
        t2InviteLink = result.link;
        console.log(`✅ [T2] Session created — ID: ${t2SessionId}`);

        // Do NOT log out — admin stays authenticated for the test
        // ── Step 1: Admin navigates to the guest session invite URL ──────
        // useLegalStore.js: _type === 'user' → ref(null) for admin/internal users
        // LegalModal.vue: v-if="isPreviouslyAccepted !== null" → false → never mounts
        console.log('\n📋 [T2] Step 1: Admin navigates to guest session invite URL...');
        const linkUrl = new URL(t2InviteLink);
        await page.goto(joinUrl(app.urls.app, `${linkUrl.pathname}${linkUrl.search}`));
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(3000); // Allow Vue components to fully mount

        const termsCount = await page.getByTestId('user-terms').count();
        expect(
            termsCount,
            'Admin (internal user) must NOT see the T&C modal — element should not be in the DOM'
        ).toBe(0);
        console.log('✅ [T2] user-terms element count is 0 — modal not rendered for admin');

        // ── Step 2: Verify no T&C key written to localStorage ───────────
        // Admin bypass is pure client-side: useLegalStore never runs isPreviouslyAccepted
        // logic for internal users, so no localStorage key should be written.
        console.log('\n📋 [T2] Step 2: Verifying no T&C key in localStorage...');
        const hasKey = await hasAnyTermsLocalStorageKey(page);
        expect(
            hasKey,
            'Admin must NOT write any terms-conditions/privacy-policy key to localStorage'
        ).toBe(false);
        console.log('✅ [T2] No T&C localStorage key found — admin bypass confirmed');

        console.log('\n✅ [T2] All steps passed: internal user correctly bypasses T&C modal');
    }
    );



    test.afterAll(async ({ request }, testInfo) => {
        if (sharedContext) {
            try { await sharedContext.close(); } catch { /* ignore */ }
        }
        if (sessionIdA) {
            await cleanupTrackedSession(request, sessionIdA, testInfo);
        }
        if (sessionIdB) {
            await cleanupTrackedSession(request, sessionIdB, testInfo);
        }
        if (t2SessionId) {
            await cleanupTrackedSession(request, t2SessionId, testInfo);
        }
    });
});

