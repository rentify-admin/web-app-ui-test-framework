import { test, expect } from '@playwright/test';
import { adminLoginAndNavigateToApplications, findSessionLocator, loginWith } from '~/tests/utils/session-utils';
import { findAndInviteApplication } from '~/tests/utils/applications-page';
import { admin, app } from './test_config';
import generateSessionForm from '~/tests/utils/generate-session-form';
import { completePaystubConnection, fillhouseholdForm, setupInviteLinkSession, updateRentBudget, waitForButtonOrAutoAdvance, handleSkipReasonModal } from '~/tests/utils/session-flow';
import { getRandomEmail, joinUrl } from '~/tests/utils/helper';
import { searchSessionWithText } from '~/tests/utils/report-page';
import { waitForJsonResponse } from './utils/wait-response';
import { cleanupTrackedSessions } from './utils/cleanup-helper';

/**
 * Handle new "Upload Bank Statements" intro modal that appears
 * before the financial manual-upload step.
 *
 * We look for the "Upload Statements" button in the modal and click it
 * so the flow can proceed to the actual manual upload UI
 * (where `cancel-manual-upload-btn` exists).
 *
 * Safe to call when the modal is not present (older builds): it becomes a no-op.
 *
 * @param {import('@playwright/test').Page} page
 */
const handleBankConnectInfoModal = async page => {
    const uploadStatementsButton = page.getByRole('button', { name: /Upload Statements/i });

    const isVisible = await uploadStatementsButton.isVisible().catch(() => false);
    if (!isVisible) {
        return;
    }

    await uploadStatementsButton.click({ timeout: 20_000 });
};

test.describe('frontend-session-heartbeat', () => {
    // Per-attempt state for cleanup (retry-safe)
    let createdSessionIds = [];

    // Test includes improved state modal handling and uses utility function
    // for intelligent button interaction (handles manual clicks and auto-advance)
    test('Verify Frontend session heartbeat', { tag: ['@regression', '@staging-ready', '@rc-ready'] }, async ({ page }) => {
        test.setTimeout(250_000);
            const user = {
                email: getRandomEmail(),
                first_name: 'Playwright',
                last_name: 'Heartbeat',
                password: 'password'
            };

            const coApp = {
                email: getRandomEmail(),
                first_name: 'PWCoapp',
                last_name: 'Heartbeat'
            };

            const appName = 'Autotest - Application Heartbeat (Frontend) (No default income)';

            console.log('🚀 Login and go to application page')
            await adminLoginAndNavigateToApplications(page, admin);
            console.log('✅ Done Login and go to application page')

            console.log('🚀 Find application and click invite')
            await findAndInviteApplication(page, appName);
            console.log('✅ Done Find application and click invite')

            console.log('🚀 Invite Applicant')
            const { sessionId, sessionUrl, link } = await generateSessionForm.generateSessionAndExtractLink(page, user);
            if (sessionId) {
                createdSessionIds.push(sessionId);  // Store for cleanup (retry-safe)
            }
            console.log('✅ Done Invite Applicant')

            await page.getByTestId('user-dropdown-toggle-btn').click();
            await page.getByTestId('user-logout-dropdown-item').click();

            await expect(page.getByTestId('admin-login-btn')).toBeVisible({ timeout: 10_000 })

            console.log('🚀 Open invite URL')
            await page.goto(link);
            console.log('✅ Done Open invite URL')

            await setupInviteLinkSession(page, {
                sessionUrl,
                applicantTypeSelector: '#employed'
            });

            console.log('🚀 Filing rent budget')
            await updateRentBudget(page, sessionId, '500');
            console.log('✅ Filing rent budget')

            console.log('🚀 Skip invite page')
            await page.getByTestId('applicant-invite-skip-btn').click();
            await handleSkipReasonModal(page, "Skipping applicants step for test purposes");
            console.log('✅ Skip invite page')

            console.log('🚀 Id verification step')
            await expect(page.getByTestId('start-id-verification')).toBeVisible({ timeout: 10_000 });

            await page.waitForTimeout(4000);
            console.log('🚀 Going to Invite Page')
            await page.getByTestId('step-APPLICANTS-lg').filter({ visible: true }).click();

            await expect(page.getByTestId('applicant-invite-step')).toBeVisible({ timeout: 10_000 });
            console.log('✅ On Invite Page')

            console.log('🚀 Adding co applicant')
            await fillhouseholdForm(page, coApp);
            console.log('✅ Added co applicant')

            // Use utility function for intelligent button interaction
            await waitForButtonOrAutoAdvance(
                page,
                'applicant-invite-continue-btn',
                'start-id-verification',
                'co-applicant invite'
            );
            await expect(page.getByTestId('start-id-verification')).toBeVisible({ timeout: 10_000 });
            console.log('✅ On Id verification step')

            console.log('🚀 Clicking manual upload')
            await page.getByTestId('start-manual-upload-id-verification').click();
            console.log('✅ On Manual Upload Step')

            console.log('🚀 Clicking manual upload cancel')
            await page.getByTestId('cancel-manual-upload-btn').click();
            console.log('✅ On Id Step')

            console.log('🚀 Skipping ID Step')
            await page.getByTestId('skip-id-verification-btn').click();
            await handleSkipReasonModal(page, "Skipping identity verification step for test purposes");
            await expect(page.getByTestId('connect-bank')).toBeVisible({ timeout: 30_000 });
            console.log('✅ On Financial step')

            console.log('🚀 Clicking manual upload button financial')
            await page.getByTestId('financial-upload-statement-btn').click({ timeout: 20_000 });

            // Handle new bank connect information modal, if present
            await handleBankConnectInfoModal(page);

            await expect(page.getByTestId('cancel-manual-upload-btn')).toBeVisible({ timeout: 10_000 });
            console.log('✅ On Manual upload step')

            console.log('🚀 Cancelling manual upload step')
            await page.getByTestId('cancel-manual-upload-btn').click({ timeout: 20_000 });
            await expect(page.getByTestId('connect-bank')).toBeVisible({ timeout: 10_000 });
            console.log('✅ On Financial step')

            console.log('🚀 Skipping financial step')
            await page.getByTestId('skip-financials-btn').click({ timeout: 10_000 });
            await handleSkipReasonModal(page, "Skipping financial step for test purposes");
            await expect(page.getByTestId('upload-paystubs-btn')).toBeVisible({ timeout: 20_000 })
            console.log('✅ On employment step')

            console.log('🚀 Completing paystub connection')
            await completePaystubConnection(page);
            console.log('✅ Completed paystub connection')

            console.log('🚀 Completing employment step')

            // Use utility function for intelligent button interaction
            await waitForButtonOrAutoAdvance(
                page,
                'employment-step-continue',
                'summary-step',
                'employment'
            );

            await expect(page.getByTestId('summary-step')).toBeVisible({ timeout: 10_000 });
            console.log('✅ On summary page')

            console.log('🚀 Logging out guest page')
            await page.getByTestId('profile-dropdown-btn').click();

            await page.getByTestId('logout-dropdown-btn').click();

            await expect(page.getByTestId('get-started-btn')).toBeVisible({ timeout: 20_000 })
            console.log('✅ Guest logged out')

            console.log('🚀 Going to admin login')
            await page.goto('/');

            console.log('🚀 Logging in with admin')
            await loginWith(page, admin);
            console.log('✅ Successfully logged in with Admin')

            console.log('🚀 Searching session with session ID')
            await searchSessionWithText(page, sessionId);

            const sessionLocator = await findSessionLocator(page, `.application-card[data-session="${sessionId}"]`);
            console.log('✅ Session Found')

            console.log('🚀 Clicking on the session')
            const [sessionResponse] = await Promise.all([
                page.waitForResponse(resp => resp.url().includes(`/sessions/${sessionId}?fields[session]`)
                    && resp.ok()
                    && resp.request().method() === 'GET'),
                sessionLocator.click()
            ]);

            await waitForJsonResponse(sessionResponse);
            await page.waitForTimeout(3000);
            console.log('✅ Session data loaded')

            // ADD: Wait for income sources counter > 0, then make API call
            let attempts = 0;
            const maxAttempts = 5; // 5 attempts total
            let incomeSourcesCount = 0;

            do {
                // Check income sources counter in the header SVG
                console.log(`🚀 ~ Attempt ${attempts + 1}: Checking income sources counter...`);
                try {
                    // Focus the container and scroll all the way down to trigger lazy loading
                    const container = page.locator('#container');
                    await container.focus();
                    
                    // Scroll container to bottom to trigger SVG rendering
                    await container.evaluate(element => {
                        element.scrollTop = element.scrollHeight;
                    });
                    
                    await page.waitForTimeout(3000); // Wait 3 seconds after scroll for lazy loading
                    
                    // Look for the counter text inside the SVG in the income source section header
                    const incomeSourceHeader = page.getByTestId('income-source-section-header');
                    const counterText = incomeSourceHeader.locator('svg text');
                    const counterValue = await counterText.textContent({ timeout: 5000 });
                    incomeSourcesCount = parseInt(counterValue) || 0;
                    console.log(`🚀 ~ Attempt ${attempts + 1}: Income sources counter:`, incomeSourcesCount);
                } catch (error) {
                    console.log(`🚀 ~ Attempt ${attempts + 1}: No income sources counter found yet`);
                    incomeSourcesCount = 0;
                }

                // If counter is 0 and we haven't reached max attempts, reload and try again
                if (incomeSourcesCount === 0 && attempts < maxAttempts - 1) {
                    console.log(`🚀 ~ Attempt ${attempts + 1}: Income sources counter is 0, reloading page...`);
                    
                    // After reload, session is already focused, so response comes automatically
                    const [reloadSessionResponse] = await Promise.all([
                        page.waitForResponse(resp => resp.url().includes(`/sessions/${sessionId}?fields[session]`)
                            && resp.ok()
                            && resp.request().method() === 'GET'),
                        page.reload()
                    ]);
                    await waitForJsonResponse(reloadSessionResponse);
                    await page.waitForTimeout(3000); // Wait for UI to render after reload
                }
                
                attempts++;
            } while (incomeSourcesCount === 0 && attempts < maxAttempts);

            // Now that we have income sources, make the API call
            console.log('🚀 ~ Income sources counter > 0, making API call...');
            const incomeSourceHeader = await page.getByTestId('income-source-section-header');
            
            const [incomeSourceResponse] = await Promise.all([
                page.waitForResponse((resp) => {
                    return resp.url().includes(`/sessions/${sessionId}/income-sources?fields[income_source]`)
                        && resp.ok()
                        && resp.request().method() === 'GET';
                }),
                incomeSourceHeader.click()
            ]);

            const incomeSources = await waitForJsonResponse(incomeSourceResponse);
            console.log('✅ Income Source loaded')
            await expect(incomeSources.data.length).toBeGreaterThan(0)

            console.log('🚀 Checking Income source visible')
            for (let index = 0; index < incomeSources.data.length; index++) {
                const element = incomeSources.data[index];
                await expect(page.getByTestId(`income-source-${element.id}`)).toBeVisible()
            }
            console.log('✅ Income Source visible')

            console.log('✅ Frontend session heartbeat test completed successfully');
        // Note: Page is managed by Playwright fixture, cleanup happens in afterAll
    });
    
    // Cleanup disabled - sessions will not be automatically cleaned up
    // test.afterEach(async ({ request }, testInfo) => {
    //     await cleanupTrackedSessions({ request, sessionIds: createdSessionIds, testInfo });
    // });
});
