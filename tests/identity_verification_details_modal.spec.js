import { test, expect } from '@playwright/test';
import { admin, app } from './test_config';
import { findAndInviteApplication, openInviteModal, searchApplication } from './utils/applications-page';
import generateSessionForm from './utils/generate-session-form';
import { joinUrl } from './utils/helper';
import {
    setupInviteLinkSession,
    updateRentBudget
} from './utils/session-flow';
import {
    searchSessionWithText,
    openReportSection
} from './utils/report-page';
import { waitForJsonResponse } from './utils/wait-response';
import { cleanupSession } from './utils/cleanup-helper';
import { adminLoginAndNavigateToApplications } from './utils/session-utils';
import { gotoPage } from './utils/common';
import { allChecksPersonaConnectData } from './mock-data/identity-payload';
import { pollUntil } from './utils/polling-helper';

const APPLICATION_NAME = 'AutoTest - Identity Sim Step Only';

const cleanupData = {
    test1: { sessionId: null, passed: false },
    test2: { sessionId: null, passed: false },
    test3a: { sessionId: null, passed: false },
    test3b: { sessionId: null, passed: false },
};


test.describe('QA-360 identity_verification_details_modal', () => {
    test('VC-identity-modal-structure-all-passed', {
        timeout: 180_000,
        tag: ['@regression', '@core']
    }, async ({ page, browser }) => {
        test.setTimeout(180_000);

        // --- Setup: Create session with completed identity via PERSONA_PAYLOAD ---
        await adminLoginAndNavigateToApplications(page, admin);
        await findAndInviteApplication(page, APPLICATION_NAME);

        const user = {
            first_name: 'Identity',
            last_name: 'Details',
            email: `identity.details+${Date.now()}@verifast.com`
        };

        const {
            sessionId,
            sessionUrl,
            link
        } = await generateSessionForm.generateSessionAndExtractLink(page, user);
        cleanupData.test1.sessionId = sessionId;

        const inviteUrl = new URL(link);

        const applicantContext = await browser.newContext();
        const applicantPage = await applicantContext.newPage();

        await applicantPage.goto(joinUrl(app.urls.app, `${inviteUrl.pathname}${inviteUrl.search}`));

        await setupInviteLinkSession(applicantPage, {
            sessionUrl,
        });

        await updateRentBudget(applicantPage, sessionId, '2500');


        const data = allChecksPersonaConnectData({
            ...user,
            first_name: `Autot - ${user.first_name}`,
        });

        const connectBtn = applicantPage.getByTestId('id-simulation-connect-btn');

        applicantPage.on('dialog', async dialog => {
            console.log('💬 9️⃣ [Dialog] Browser prompt detected for ID simulation!');
            await applicantPage.waitForTimeout(500);
            await dialog.accept(JSON.stringify(data));
            console.log('✅ 9️⃣ [Dialog] Payload sent to the persona simulation dialog.');
        });

        // Start the simulation (acts as ID verification by applicant)
        console.log('🔗 1️⃣0️⃣ [Persona Sim] Clicking connect button for identity simulation...');
        await connectBtn.click();
        await applicantPage.waitForTimeout(2000);

        // Wait for next step in applicant summary using polling
        await pollUntil(async () => {
            const summaryStep = applicantPage.getByTestId('summary-step');
            const count = await summaryStep.count();
            if (count > 0) {
                const isVisible = await summaryStep.isVisible().catch(() => false);
                return isVisible;
            }
            return false;
        }, {
            maxPollTime: 60000, // 60 seconds
            pollInterval: 2000,
            description: 'summary-step to appear'
        });


        await applicantPage.waitForTimeout(3_000);
        await applicantContext.close();

        await page.bringToFront();
        // --- Navigate to session report and open Identity section ---
        await gotoPage(page, 'applicants-menu', 'applicants-submenu', '/sessions');
        const sessions = await searchSessionWithText(page, sessionId);

        const session = sessions.find(sess => sess.id === sessionId) || { id: sessionId };

        const [sessionResponse, idenityResponse] = await Promise.all([
            page.waitForResponse(resp =>
                resp.url().includes(`/sessions/${session.id}?fields[session]`) &&
                resp.request().method() === 'GET' &&
                resp.ok()
            ),
            page.waitForResponse(resp =>
                resp.url().includes(`/identity-verifications`) &&
                resp.url().includes(`${session.id}`) &&
                resp.request().method() === 'GET' &&
                resp.ok()
            ),
            page.locator(`.application-card[data-session="${session.id}"]`).first().click()
        ]);
        await waitForJsonResponse(sessionResponse);
        const { data: identities } = await waitForJsonResponse(idenityResponse);
        expect(identities.length).toBeGreaterThan(0);

        const identitySection = await openReportSection(page, 'identity-section');

        const identity = identities[0];
        // --- Step 1: Open Verification Details Modal ---
        console.log('🔍 1️⃣ [Step 1] Opening Identity Verification Details modal...');
        const identityCard = identitySection.getByTestId(`identity-detail-${identity?.identity?.applicant?.id}`);
        await expect(identityCard).toBeVisible();

        const moreDetailsBtn = identityCard.getByTestId('identity-more-details');
        await expect(moreDetailsBtn).toBeVisible();
        await moreDetailsBtn.click();

        const modal = page.getByTestId('identity-more-details-modal');
        await expect(modal).toBeVisible();
        await expect(modal).toContainText('ID Verification Details');

        // --- Step 2: ID Checks Section - All Passed ---
        console.log('🔍 2️⃣ [Step 2] Verifying ID Checks Section...');
        const idChecksSection = modal.getByTestId('id-checks-section');
        await expect(idChecksSection).toBeVisible();
        await expect(idChecksSection).toContainText('ID Checks');

        const idChecksStatus = idChecksSection.getByTestId('id-checks-status');
        await expect(idChecksStatus.locator('img[src*="success-tick-circle"]')).toBeVisible();
        await expect(idChecksStatus).toContainText('All Required Checks Passed');

        const idFailedGrid = modal.getByTestId('id-checks-failed-grid');
        expect(await idFailedGrid.count()).toBe(0);

        const idExpandBtn = modal.getByTestId('id-checks-expand-btn');
        await expect(idExpandBtn).toBeVisible();

        const idExpandedGridLocator = modal.getByTestId('id-checks-expanded-grid');
        if (await idExpandedGridLocator.count()) {
            await expect(idExpandedGridLocator).toBeHidden();
        }

        // --- Step 3: Selfie Checks Section - All Passed ---
        console.log('🔍 3️⃣ [Step 3] Verifying Selfie Checks Section...');
        const selfieSection = modal.getByTestId('selfie-checks-section');
        await expect(selfieSection).toBeVisible();

        const selfieStatus = selfieSection.getByTestId('selfie-checks-status');
        await expect(selfieStatus.locator('img[src*="success-tick-circle"]')).toBeVisible();
        await expect(selfieStatus).toContainText('All Required Checks Passed');

        const selfieFailedGrid = modal.getByTestId('selfie-checks-failed-grid');
        expect(await selfieFailedGrid.count()).toBe(0);

        // --- Step 4: AAMVA Checks Section - All Passed ---
        console.log('🔍 4️⃣ [Step 4] Verifying AAMVA Checks Section...');
        const aamvaSection = modal.getByTestId('aamva-checks-section');
        await expect(aamvaSection).toBeVisible();

        const aamvaStatus = aamvaSection.getByTestId('aamva-checks-status');
        await expect(aamvaStatus.locator('img[src*="success-tick-circle"]')).toBeVisible();
        await expect(aamvaStatus).toContainText('All Required Checks Passed');

        // --- Step 5: Expand ID Checks Section ---
        console.log('🔍 5️⃣ [Step 5] Expanding ID Checks section to view all checks...');
        await idExpandBtn.click();

        const idExpandedGrid = modal.getByTestId('id-checks-expanded-grid');
        await expect(idExpandedGrid).toBeVisible();

        const idTiles = idExpandedGrid.locator('[data-testid^="check-tile-"]');
        const idTileCount = await idTiles.count();
        expect(idTileCount).toBeGreaterThan(0);

        for (let i = 0; i < idTileCount; i++) {
            const tile = idTiles.nth(i);
            await expect(tile.locator('img[src*="success-tick-circle"]')).toBeVisible();
            const tileText = (await tile.innerText()).trim();
            expect(tileText).not.toMatch(/identity\./i);
        }

        // --- Step 6: Required vs Non-Required Indicators ---
        console.log('🔍 6️⃣ [Step 6] Verifying Required vs Non-Required Indicators...');
        let foundOptional = false;
        let foundRequired = false;

        for (let i = 0; i < idTileCount; i++) {
            const labelText = (await idTiles.nth(i).innerText()).trim();
            if (labelText.includes('*')) {
                foundOptional = true;
            } else {
                foundRequired = true;
            }
        }

        expect(foundOptional).toBeTruthy();
        expect(foundRequired).toBeTruthy();

        // --- Step 7: Collapse ID Checks Section ---
        console.log('🔍 7️⃣ [Step 7] Collapsing ID Checks section...');
        await idExpandBtn.click();
        await expect(idExpandedGrid).toBeHidden();

        // --- Step 8: Multiple Sections Expand Simultaneously ---
        console.log('🔍 8️⃣ [Step 8] Expanding Multiple Sections Simultaneously...');
        const selfieExpandBtn = modal.getByTestId('selfie-checks-expand-btn');

        await idExpandBtn.click();
        await selfieExpandBtn.click();

        const selfieExpandedGrid = modal.getByTestId('selfie-checks-expanded-grid');
        await expect(idExpandedGrid).toBeVisible();
        await expect(selfieExpandedGrid).toBeVisible();

        await idExpandBtn.click();
        await selfieExpandBtn.click();

        // --- Step 9: Footer Note and Close Modal ---
        console.log('🔍 9️⃣ [Step 9] Verifying Footer Note and Closing Modal...');
        const footerNote = modal.getByTestId('checks-footer-note');
        await expect(footerNote).toBeVisible();
        await expect(footerNote).toHaveText('* Checks marked with an asterisk are not required.');

        const closeBtn = page.getByTestId('identity-more-details-modal-cancel');
        await expect(closeBtn).toBeVisible();
        await closeBtn.click();
        await expect(modal).not.toBeVisible();

        cleanupData.test1.passed = true;

    });


    test('Failed Checks - Status Display, Failed Cards, Failure Reasons', {
        timeout: 240_000,
        tag: ['@regression', '@core']
    }, async ({ page, browser }) => {
        test.setTimeout(240_000);

        // --- Setup: Create session with completed identity via PERSONA_PAYLOAD ---
        console.log('🔧 [Setup] Creating session with mixed pass/fail results for ID checks...');
        await adminLoginAndNavigateToApplications(page, admin);
        await findAndInviteApplication(page, APPLICATION_NAME);

        const user = {
            first_name: 'Identity',
            last_name: 'Failed',
            email: `identity.failed+${Date.now()}@verifast.com`
        };

        const { sessionUrl, link, sessionId } = await generateSessionForm.generateSessionAndExtractLink(page, user);
        cleanupData.test2.sessionId = sessionId;

        const inviteUrl = new URL(link);

        const applicantContext = await browser.newContext();
        const applicantPage = await applicantContext.newPage();

        await applicantPage.goto(joinUrl(app.urls.app, `${inviteUrl.pathname}${inviteUrl.search}`));

        await setupInviteLinkSession(applicantPage, { sessionUrl });
        await updateRentBudget(applicantPage, sessionId, '2500');

        // Mixed state: gov-id partially fails (first 3 required checks), selfie all passes
        console.log('🔧 [Setup] Preparing mixed-state payload for ID simulation...');
        const data = allChecksPersonaConnectData({
            ...user,
            first_name: `Autot - ${user.first_name}`,
        }, 'primary', {
            governmentIdChecks: 'partially_failed',
            selfieChecks: 'all_passed',
        });

        const connectBtn = applicantPage.getByTestId('id-simulation-connect-btn');

        applicantPage.on('dialog', async dialog => {
            console.log('💬 [Dialog] Browser prompt detected for ID simulation (mixed-state payload)');
            await applicantPage.waitForTimeout(500);
            await dialog.accept(JSON.stringify(data));
            console.log('✅ [Dialog] Mixed-state payload sent: gov-id partially failed, selfie all passed');
        });

        console.log('🔗 [Persona Sim] Clicking connect button for identity simulation...');
        await connectBtn.click();
        await applicantPage.waitForTimeout(2000);

        // Wait for applicant to reach summary step
        await pollUntil(async () => {
            const summaryStep = applicantPage.getByTestId('summary-step');
            const count = await summaryStep.count();
            if (count > 0) {
                return await summaryStep.isVisible().catch(() => false);
            }
            return false;
        }, {
            maxPollTime: 60000,
            pollInterval: 2000,
            description: 'summary-step to appear'
        });

        await applicantPage.waitForTimeout(3_000);
        await applicantContext.close();

        await page.bringToFront();

        // --- Navigate to session report and open Identity section ---
        console.log('🔍 Navigating to session report and opening Identity section...');
        await gotoPage(page, 'applicants-menu', 'applicants-submenu', '/sessions');
        const sessions = await searchSessionWithText(page, sessionId);
        const sessionRecord = sessions.find(sess => sess.id === sessionId) || { id: sessionId };

        const [sessionResponse, identityResponse] = await Promise.all([
            page.waitForResponse(resp =>
                resp.url().includes(`/sessions/${sessionRecord.id}?fields[session]`) &&
                resp.request().method() === 'GET' &&
                resp.ok()
            ),
            page.waitForResponse(resp =>
                resp.url().includes(`/identity-verifications`) &&
                resp.url().includes(`${sessionRecord.id}`) &&
                resp.request().method() === 'GET' &&
                resp.ok()
            ),
            page.locator(`.application-card[data-session="${sessionRecord.id}"]`).first().click()
        ]);
        await waitForJsonResponse(sessionResponse);
        const { data: identities } = await waitForJsonResponse(identityResponse);
        expect(identities.length).toBeGreaterThan(0);

        const identitySection = await openReportSection(page, 'identity-section');
        const identity = identities[0];

        // --- Step 1: Open Modal ---
        console.log('🔍 1️⃣ [Step 1] Opening Identity Verification Details modal...');
        const identityCard = identitySection.getByTestId(`identity-detail-${identity?.identity?.applicant?.id}`);
        await expect(identityCard).toBeVisible();

        const moreDetailsBtn = identityCard.getByTestId('identity-more-details');
        await expect(moreDetailsBtn).toBeVisible();
        await moreDetailsBtn.click();

        const modal = page.getByTestId('identity-more-details-modal');
        await expect(modal).toBeVisible();
        await expect(modal).toContainText('ID Verification Details');

        // --- Step 2: Verify ID Checks Section - Some Failed ---
        console.log('🔍 2️⃣ [Step 2] Verifying ID Checks Section - Some Failed...');
        const idChecksSection = modal.getByTestId('id-checks-section');
        await expect(idChecksSection).toBeVisible();

        const idChecksStatus = idChecksSection.getByTestId('id-checks-status');
        await expect(idChecksStatus.locator('img[src*="error-x-circle"]')).toBeVisible();
        await expect(idChecksStatus).toContainText('Some Required Checks Did Not Pass');

        // Failed grid should be visible immediately without needing to expand
        const idFailedGrid = modal.getByTestId('id-checks-failed-grid');
        await expect(idFailedGrid).toBeVisible();

        const failedCards = idFailedGrid.locator('[data-testid^="failed-check-card-"]');
        const failedCardCount = await failedCards.count();
        expect(failedCardCount).toBeGreaterThan(0);
        console.log(`📋 Found ${failedCardCount} failed check card(s)`);

        // --- Step 3: Verify Failed Check Card Structure ---
        console.log('🔍 3️⃣ [Step 3] Verifying Failed Check Card Structure...');
        const firstFailedCard = failedCards.first();
        await expect(firstFailedCard).toBeVisible();

        // Check name must be a translated label, not a raw i18n key
        const cardText = await firstFailedCard.innerText();
        expect(cardText).not.toMatch(/views\./i);
        expect(cardText).not.toMatch(/id-checks\./i);
        expect(cardText.trim().length).toBeGreaterThan(0);

        // Red X icon visible inside the failed card
        await expect(firstFailedCard.locator('img[src*="error-x-circle"]')).toBeVisible();

        // Failure reasons list: must be a <ul> with at least one <li>
        const reasonsList = firstFailedCard.locator('ul');
        await expect(reasonsList).toBeVisible();

        const reasonItems = reasonsList.locator('li');
        const reasonCount = await reasonItems.count();
        expect(reasonCount).toBeGreaterThan(0);
        console.log(`📋 Found ${reasonCount} failure reason(s) in first failed card`);

        // Each reason must be translated (not a raw i18n key)
        for (let i = 0; i < reasonCount; i++) {
            const reasonText = (await reasonItems.nth(i).innerText()).trim();
            expect(reasonText).not.toMatch(/views\.id-failure-reasons\./i);
            expect(reasonText.length).toBeGreaterThan(0);
        }

        // --- Step 4: Verify Selfie Section - Independently Passed ---
        console.log('🔍 4️⃣ [Step 4] Verifying Selfie Section - Independently Passed...');
        const selfieSection = modal.getByTestId('selfie-checks-section');
        await expect(selfieSection).toBeVisible();

        const selfieStatus = selfieSection.getByTestId('selfie-checks-status');
        await expect(selfieStatus.locator('img[src*="success-tick-circle"]')).toBeVisible();
        await expect(selfieStatus).toContainText('All Required Checks Passed');

        // No failed grid should exist for selfie (confirms sections are independent)
        const selfieFailedGrid = modal.getByTestId('selfie-checks-failed-grid');
        expect(await selfieFailedGrid.count()).toBe(0);

        // --- Step 5: Expand ID Section to See All Checks ---
        console.log('🔍 5️⃣ [Step 5] Expanding ID Checks section to view all checks...');
        const idExpandBtn = idChecksSection.getByTestId('id-checks-expand-btn');
        await expect(idExpandBtn).toBeVisible();
        await idExpandBtn.click();

        const idExpandedGrid = modal.getByTestId('id-checks-expanded-grid');
        await expect(idExpandedGrid).toBeVisible();

        const allIdTiles = idExpandedGrid.locator('[data-testid^="check-tile-"]');
        const totalTileCount = await allIdTiles.count();
        // Total tiles (passed + failed) must exceed the failed-only card count
        expect(totalTileCount).toBeGreaterThan(failedCardCount);
        console.log(`📋 Expanded: ${totalTileCount} total tiles vs ${failedCardCount} failed cards`);

        // Both passed (green) and failed (red) tiles must be present
        const passedTiles = idExpandedGrid.locator('[data-testid^="check-tile-"]').filter({
            has: page.locator('img[src*="success-tick-circle"]')
        });
        const failedTilesInGrid = idExpandedGrid.locator('[data-testid^="check-tile-"]').filter({
            has: page.locator('img[src*="error-x-circle"]')
        });
        expect(await passedTiles.count()).toBeGreaterThan(0);
        expect(await failedTilesInGrid.count()).toBeGreaterThan(0);

        // --- Step 6: Verify Passed Checks Have No Reasons ---
        console.log('🔍 6️⃣ [Step 6] Verifying Passed Checks Have No Reasons...');
        const firstPassedTile = passedTiles.first();
        await expect(firstPassedTile).toBeVisible();
        // A passed tile must NOT render a <ul> failure reasons list
        expect(await firstPassedTile.locator('ul').count()).toBe(0);

        // --- Step 7: Expand Selfie Section Independently ---
        console.log('🔍 7️⃣ [Step 7] Expanding Selfie Section Independently...');
        const selfieExpandBtn = selfieSection.getByTestId('selfie-checks-expand-btn');
        await expect(selfieExpandBtn).toBeVisible();
        await selfieExpandBtn.click();

        const selfieExpandedGrid = modal.getByTestId('selfie-checks-expanded-grid');
        await expect(selfieExpandedGrid).toBeVisible();

        // ID section must still be expanded (both sections open simultaneously)
        await expect(idExpandedGrid).toBeVisible();
        console.log('✅ Both ID and Selfie sections expanded simultaneously');

        // Every selfie tile must show a green checkmark (all passed)
        const selfieCheckTiles = selfieExpandedGrid.locator('[data-testid^="check-tile-"]');
        const selfieTileCount = await selfieCheckTiles.count();
        expect(selfieTileCount).toBeGreaterThan(0);

        for (let i = 0; i < selfieTileCount; i++) {
            await expect(selfieCheckTiles.nth(i).locator('img[src*="success-tick-circle"]')).toBeVisible();
        }

        // --- Step 8: Close Modal ---
        console.log('🔍 8️⃣ [Step 8] Closing Modal...')  ;
        const closeBtn = page.getByTestId('identity-more-details-modal-cancel');
        await expect(closeBtn).toBeVisible();
        await closeBtn.click();
        await expect(modal).not.toBeVisible();

        cleanupData.test2.passed = true;
    });


    test('AAMVA Section Conditional Rendering', {
        timeout: 360_000,
        tag: ['@regression', '@core']
    }, async ({ page, browser }) => {
        test.setTimeout(360_000);

        // ── Helper: create a session, run identity sim with given payload options, return ids ──
        await adminLoginAndNavigateToApplications(page, admin);
        await searchApplication(page, APPLICATION_NAME);

        const createIdentitySession = async (user, payloadOptions = {}) => {

            await openInviteModal(page, APPLICATION_NAME);

            const { sessionUrl, link, sessionId } =
                await generateSessionForm.generateSessionAndExtractLink(page, user);

            const inviteUrl = new URL(link);
            const ctx = await browser.newContext();
            const applicantPage = await ctx.newPage();

            await applicantPage.goto(joinUrl(app.urls.app, `${inviteUrl.pathname}${inviteUrl.search}`));
            await setupInviteLinkSession(applicantPage, { sessionUrl });
            await updateRentBudget(applicantPage, sessionId, '2500');

            const data = allChecksPersonaConnectData(
                { ...user, first_name: `Autot - ${user.first_name}` },
                'primary',
                payloadOptions
            );

            const connectBtn = applicantPage.getByTestId('id-simulation-connect-btn');
            applicantPage.on('dialog', async dialog => {
                await applicantPage.waitForTimeout(500);
                await dialog.accept(JSON.stringify(data));
            });

            await connectBtn.click();
            await applicantPage.waitForTimeout(2000);

            await pollUntil(async () => {
                const summaryStep = applicantPage.getByTestId('summary-step');
                const count = await summaryStep.count();
                if (count > 0) return await summaryStep.isVisible().catch(() => false);
                return false;
            }, { maxPollTime: 60000, pollInterval: 2000, description: 'summary-step to appear' });

            await applicantPage.waitForTimeout(3_000);
            await ctx.close();

            return sessionId;
        };

        // ── Helper: navigate to a session report and open the identity section ──
        const navigateToSessionIdentity = async (sessionId) => {
            await page.bringToFront();
            await gotoPage(page, 'applicants-menu', 'applicants-submenu', '/sessions');
            const sessions = await searchSessionWithText(page, sessionId);
            const sessionRecord = sessions.find(s => s.id === sessionId) || { id: sessionId };

            const [sessionResponse, identityResponse] = await Promise.all([
                page.waitForResponse(resp =>
                    resp.url().includes(`/sessions/${sessionRecord.id}?fields[session]`) &&
                    resp.request().method() === 'GET' && resp.ok()
                ),
                page.waitForResponse(resp =>
                    resp.url().includes(`/identity-verifications`) &&
                    resp.url().includes(sessionRecord.id) &&
                    resp.request().method() === 'GET' && resp.ok()
                ),
                page.locator(`.application-card[data-session="${sessionRecord.id}"]`).first().click()
            ]);

            await waitForJsonResponse(sessionResponse);
            const { data: identities } = await waitForJsonResponse(identityResponse);
            expect(identities.length).toBeGreaterThan(0);

            const identitySection = await openReportSection(page, 'identity-section');
            const identity = identities[0];
            return { identitySection, identity };
        };

        // ── Helper: open the Verification Details modal for an identity ──
        const openModal = async (identitySection, identity) => {
            const identityCard = identitySection.getByTestId(
                `identity-detail-${identity?.identity?.applicant?.id}`
            );
            await expect(identityCard).toBeVisible();
            await identityCard.getByTestId('identity-more-details').click();

            const modal = page.getByTestId('identity-more-details-modal');
            await expect(modal).toBeVisible();
            return modal;
        };

        // ── Setup: create two sessions ─────────────────────────────────────────────────────────
        // Session A – AAMVA included (default behaviour)
        const userA = {
            first_name: 'Identity',
            last_name: 'WithAamva',
            email: `identity.aamva+${Date.now()}@verifast.com`
        };
        console.log('🔧 [Setup] Creating session A (with AAMVA)...');
        const sessionIdA = await createIdentitySession(userA, { includeAamva: true });
        cleanupData.test3a.sessionId = sessionIdA;
        console.log(`✅ [Setup] Session A created: ${sessionIdA}`);

        // Session B – AAMVA excluded from Persona payload
        const userB = {
            first_name: 'Identity',
            last_name: 'NoAamva',
            email: `identity.noaamva+${Date.now()}@verifast.com`
        };
        console.log('🔧 [Setup] Creating session B (without AAMVA)...');
        const sessionIdB = await createIdentitySession(userB, { includeAamva: false });
        cleanupData.test3b.sessionId = sessionIdB;
        console.log(`✅ [Setup] Session B created: ${sessionIdB}`);

        // ── Step 1: Session WITH AAMVA – verify AAMVA section is present ──────────────────────
        console.log('🔍 [Step 1] Navigating to session A (with AAMVA)...');
        const { identitySection: sectionA, identity: identityA } =
            await navigateToSessionIdentity(sessionIdA);

        console.log('🔍 [Step 1] Opening modal for session A...');
        const modalA = await openModal(sectionA, identityA);
        await expect(modalA).toContainText('ID Verification Details');

        console.log('🔍 [Step 1] Verifying AAMVA section is present in session A...');
        const aamvaSection = modalA.getByTestId('aamva-checks-section');
        await expect(aamvaSection).toBeVisible();
        await expect(aamvaSection).toContainText('AAMVA Checks');

        console.log('🔍 [Step 1] Verifying AAMVA status and expand button in session A...');
        const aamvaStatus = aamvaSection.getByTestId('aamva-checks-status');
        await expect(aamvaStatus).toBeVisible();

        console.log('🔍 [Step 1] Verifying AAMVA status is All Required Checks Passed in session A...');
        const aamvaExpandBtn = aamvaSection.getByTestId('aamva-checks-expand-btn');
        await expect(aamvaExpandBtn).toBeVisible();

        // Close modal before moving to next session
        console.log('🔍 [Step 1] Closing modal for session A...');
        const closeBtnA = page.getByTestId('identity-more-details-modal-cancel');
        await closeBtnA.click();
        await expect(modalA).not.toBeVisible();
        console.log('✅ [Step 1] AAMVA section confirmed present in session A');
        cleanupData.test3a.passed = true;

        // ── Step 2 & 3: Session WITHOUT AAMVA – verify AAMVA section is NOT present ──────────
        console.log('🔍 [Step 2] Navigating to session B (without AAMVA)...');
        const { identitySection: sectionB, identity: identityB } =
            await navigateToSessionIdentity(sessionIdB);

        console.log('🔍 [Step 2] Opening modal for session B...');
        const modalB = await openModal(sectionB, identityB);
        await expect(modalB).toContainText('ID Verification Details');

        // AAMVA section must be absent
        console.log('🔍 [Step 3] Verifying AAMVA section is NOT present in session B...');
        const aamvaAbsent = modalB.getByTestId('aamva-checks-section');
        expect(await aamvaAbsent.count()).toBe(0);
        console.log('✅ [Step 3] AAMVA section correctly absent in session B');

        // Only ID and Selfie sections should be visible
        console.log('🔍 [Step 3] Verifying only ID and Selfie sections are visible in session B...');
        await expect(modalB.getByTestId('id-checks-section')).toBeVisible();
        await expect(modalB.getByTestId('selfie-checks-section')).toBeVisible();

        // ── Step 4: Other sections work correctly without AAMVA ───────────────────────────────
        console.log('🔍 [Step 4] Verifying ID and Selfie sections function correctly without AAMVA in session B...');
        const idSectionB = modalB.getByTestId('id-checks-section');
        await expect(idSectionB).toBeVisible();

        console.log('🔍 [Step 4] Expanding ID section in session B...');
        const selfieSectionB = modalB.getByTestId('selfie-checks-section');
        await expect(selfieSectionB).toBeVisible();

        // Expand ID section – must still work with only 2 sections rendered
        console.log('🔍 [Step 4] Expanding ID Checks section in session B (without AAMVA)...');
        const idExpandBtnB = idSectionB.getByTestId('id-checks-expand-btn');
        await expect(idExpandBtnB).toBeVisible();
        await idExpandBtnB.click();

        console.log('🔍 [Step 4] Verifying ID expanded grid is visible and contains check tiles in session B...');
        const idExpandedGridB = modalB.getByTestId('id-checks-expanded-grid');
        await expect(idExpandedGridB).toBeVisible();

        const idTilesB = idExpandedGridB.locator('[data-testid^="check-tile-"]');
        expect(await idTilesB.count()).toBeGreaterThan(0);
        console.log('✅ [Step 4] ID section expands correctly without AAMVA present');

        // ── Step 5: Footer note still present ────────────────────────────────────────────────
        console.log('🔍 [Step 5] Verifying footer note is still present in session B...');
        const footerNote = modalB.getByTestId('checks-footer-note');
        await expect(footerNote).toBeVisible();
        await expect(footerNote).toHaveText('* Checks marked with an asterisk are not required.');
        console.log('✅ [Step 5] Footer note visible and correct');

        // ── Step 6: Close modal ───────────────────────────────────────────────────────────────
        console.log('🔍 [Step 6] Closing modal for session B...');
        const closeBtnB = page.getByTestId('identity-more-details-modal-cancel');
        await closeBtnB.click();
        await expect(modalB).not.toBeVisible();
        console.log('✅ [Step 6] Modal closed successfully');


        cleanupData.test3b.passed = true;
    });


    test.afterAll(async ({ request }) => {

        for (const testKey in cleanupData) {
            const { sessionId, passed } = cleanupData[testKey];
            if (sessionId) {
                if (passed) {
                    console.log(`🧹 Cleaning up session for ${testKey}: ${sessionId}, Passed: ${passed}`);
                    await cleanupSession(request, sessionId, passed);
                } else {
                    console.log(`⚠️  Skipping cleanup for ${testKey}: ${sessionId}, Passed: ${passed}`);
                }
            }
        }
    });
});

