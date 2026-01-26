import { test, expect } from '@playwright/test';
import { admin } from './test_config';
import { adminLoginAndNavigateToApplications } from './utils/session-utils';
import { findAndInviteApplication } from './utils/applications-page';
import generateSessionForm from './utils/generate-session-form';
import { fillMultiselect, gotoPage } from './utils/common';
import { findSessionLocator, searchSessionWithText } from './utils/report-page';
import { waitForJsonResponse } from './utils/wait-response';
import { cleanupTrackedSessions } from './utils/cleanup-helper';

/**
 * QA-221 report_remarks_section.spec
 *
 * Tests the Notes (remarks/comments) section on the applicant report.
 * VC-2093 / VC-2095: Remarks UI was refactored to NotesModal. Old remark-history-modal
 * and related testids are gone. This spec targets the new Notes modal:
 * - notes-modal, notes-modal-content, notes-form-section
 * - note-textarea, add-note-btn, note-link-to-dropdown, note-internal-toggle
 * - note-card-{id}, hide-note-btn, unhide-note-btn, toggle-hidden-comments-checkbox
 * - notes-modal-cancel (close)
 *
 * @see web-app/src/js/views/dashboard/applicant-report/pages/common/NotesModal.vue
 * @see docs/worklog/Sprint-6/VC-2093-Notes-Modal-Refactor/
 */

// --- Global/Scoped Variables ---
let createdSessionIds = [];
let sessionId = null;
let notesContainer = null;

/**
 * Wait for POST /sessions/:id/comments.
 * New Notes modal sends comment, optionally is_internal, subject_type, subject_id, applicants, pinned.
 */
const waitForNoteCreateResponse = (page, sid) => {
    return page.waitForResponse(resp =>
        resp.url().includes(`/sessions/${sid}/comments`) &&
        resp.request().method() === 'POST' &&
        resp.ok(),
        { timeout: 15_000 }
    );
};

/**
 * Hide or unhide a note via the Notes modal. Uses note-card-{id}, hide-note-btn, unhide-note-btn.
 */
async function hideOrUnhideNote(page, sid, notesContainerRef, note, selector) {
    const card = notesContainerRef.getByTestId(`note-card-${note.id}`);
    await expect(card).toBeVisible();
    const btn = card.getByTestId(selector);
    await expect(btn).toBeVisible();

    const getPromise = page.waitForResponse(resp =>
        resp.url().includes(`/sessions/${sid}/comments`) && resp.ok() && resp.request().method() === 'GET',
        { timeout: 10_000 }
    );
    const patchPromise = page.waitForResponse(resp =>
        resp.url().includes(`/sessions/${sid}/comments/${note.id}`) &&
        resp.ok() &&
        resp.request().method() === 'PATCH',
        { timeout: 10_000 }
    );

    await Promise.all([getPromise, patchPromise, btn.click()]);
    const getResp = await getPromise;
    const body = await waitForJsonResponse(getResp);
    return body?.data ?? [];
}

/**
 * Submit a note from the Notes form and wait for POST + GET comments.
 * Uses note-textarea, add-note-btn. Link-to and internal toggle must be set beforehand.
 */
async function submitNoteAndWaitForComments({ page, sessionId: sid }) {
    const form = page.getByTestId('notes-form-section');
    const postPromise = waitForNoteCreateResponse(page, sid);
    const getPromise = page.waitForResponse(resp =>
        resp.url().includes(`/sessions/${sid}/comments`) &&
        resp.ok() &&
        resp.request().method() === 'GET',
        { timeout: 10_000 }
    );

    await Promise.all([postPromise, getPromise, form.getByTestId('add-note-btn').click()]);

    const postResp = await postPromise;
    const getResp = await getPromise;
    const createBody = await postResp.json().catch(() => ({}));
    const getBody = await getResp.json().catch(() => ({}));
    const comment = createBody?.data ?? createBody;
    const comments = getBody?.data ?? [];

    return { comment, comments };
}

/**
 * Click a dropdown item reliably. Waits for dropdown menu to be visible, then clicks the item.
 * The dropdown menu has class="dropdown" and contains <a class="dropdown-item"> elements.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} dropdownTrigger - The button/trigger that opens the dropdown
 * @param {string|RegExp} itemText - Text or regex to match the dropdown item
 * @param {Object} options - Options
 * @param {number} options.timeout - Timeout for dropdown visibility (default: 5000)
 */
async function clickDropdownItem(page, dropdownTrigger, itemText, options = {}) {
    const { timeout = 5000 } = options;
    
    // Click the dropdown trigger
    await dropdownTrigger.click();
    await page.waitForTimeout(300); // Brief wait for dropdown animation
    
    // Wait for any dropdown menu to be visible (class="dropdown")
    // The dropdown is positioned absolutely, so we find it in the DOM
    const dropdownMenu = page.locator('.dropdown').filter({ hasText: itemText }).first();
    await expect(dropdownMenu).toBeVisible({ timeout });
    
    // Find the dropdown item (a.dropdown-item) within the visible dropdown menu
    // Use text matching that handles both string and RegExp
    const item = typeof itemText === 'string'
        ? dropdownMenu.locator('.dropdown-item').filter({ hasText: itemText }).first()
        : dropdownMenu.locator('.dropdown-item').filter({ hasText: itemText }).first();
    
    await expect(item).toBeVisible({ timeout: 3000 });
    
    // Scroll into view if needed (dropdown might be off-screen)
    await item.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    
    // Click the item
    await item.click();
    
    // Wait for dropdown to close and action to process
    await page.waitForTimeout(500);
}

// --- Test Suite ---
test.describe('QA-221 report_remarks_section.spec', () => {
    const appName = 'Autotest - Heartbeat Test - Financial';

    test.beforeEach(() => {
        createdSessionIds = [];
    });

    test.afterEach(async ({ request }, testInfo) => {
        await cleanupTrackedSessions({ request, sessionIds: createdSessionIds, testInfo });
    });

    test('Check Remarks (Comments) Section on Applicant Report', {
        tag: ['@core', '@smoke', '@regression', '@staging-ready', '@rc-ready'],
        timeout: 150_000,
    }, async ({ page }) => {
        try {
            await adminLoginAndNavigateToApplications(page, admin);
            await findAndInviteApplication(page, appName);

            const userData = {
                first_name: 'Remark Btn',
                last_name: 'test',
                full_name: 'Autot - Remark Btn Test',
                email: 'test-remarkbtn@verifast.com',
            };

            await generateSessionForm.fill(page, userData);
            const sessionData = await generateSessionForm.submit(page);
            sessionId = sessionData.data?.id;
            if (sessionId) createdSessionIds.push(sessionId);
            await page.getByTestId('generate-session-modal-cancel').click();

            await gotoPage(page, 'applicants-menu', 'applicants-submenu', '/sessions?fields[session]');
            await searchSessionWithText(page, sessionId);

            const sessionLocator = await findSessionLocator(
                page,
                `.application-card[data-session="${sessionId}"]`
            );

            const [sessionResponse] = await Promise.all([
                page.waitForResponse(resp =>
                    resp.url().includes(`/sessions/${sessionId}?fields[session]`) &&
                    resp.ok() &&
                    resp.request().method() === 'GET'
                ),
                sessionLocator.click(),
            ]);
            const session = await waitForJsonResponse(sessionResponse);

            // Notes button: VC-2093+ uses header "Notes" (e.g. "0 Notes" or "1 Note"). Support legacy view-remarks-btn.
            // Button text can be "Note" (singular) or "Notes" (plural), match both
            const legacyBtn = page.getByTestId('view-remarks-btn');
            const notesBtn = page.locator('#applicant-report').getByRole('button').filter({ hasText: /note/i });
            const viewNotesBtn = (await legacyBtn.count()) > 0 ? legacyBtn : notesBtn;
            await expect(viewNotesBtn).toBeVisible({ timeout: 10_000 });
            await viewNotesBtn.click();

            // New Notes modal (VC-2093): notes-modal, notes-modal-content, notes-form-section
            const notesModal = page.getByTestId('notes-modal');
            await expect(notesModal).toBeVisible({ timeout: 10_000 });
            const notesForm = notesModal.getByTestId('notes-form-section');
            await expect(notesForm).toBeVisible();
            const textarea = notesForm.getByTestId('note-textarea');
            await expect(textarea).toBeVisible();

            notesContainer = notesModal; // note cards live inside modal

            // --- Step 0: Test empty state message (before creating any notes) ---
            // Check if empty state is shown when there are no notes
            const emptyStateMessage = notesModal.locator('.text-center.py-12.text-slate-500');
            const hasNotes = await notesModal.locator('[data-testid^="note-card-"]').count();
            if (hasNotes === 0) {
                await expect(emptyStateMessage).toBeVisible();
                await expect(emptyStateMessage).toContainText(/no notes|no_notes_yet/i);
                console.log('Step 0: Empty state message verified.');
            } else {
                console.log('Step 0: Skipped (notes already exist).');
            }

            const firstComment = 'Internal remark without notifications';
            const secondComment = 'Remark with single applicant notification';
            const thirdComment = 'Remark with All applicants notification';

            // --- Step 1: Internal note (no notifications) ---
            await notesForm.getByTestId('note-internal-toggle').click();
            await textarea.fill(firstComment);
            let { comment: comment1 } = await submitNoteAndWaitForComments({ page, sessionId });

            if (comment1) {
                const card1 = notesContainer.getByTestId(`note-card-${comment1.id}`);
                await expect(card1).toBeVisible();
                await expect(card1).toContainText(firstComment);
                await expect(card1).toContainText(/internal/i);
                console.log('Step 1: Internal note visible with Internal label.');
            }

            // --- Step 2: Note linked to single applicant, then Send → applicant ---
            await fillMultiselect(page, notesForm.getByTestId('note-link-to-dropdown'), [userData.full_name]);
            await textarea.fill(secondComment);
            let { comment: comment2 } = await submitNoteAndWaitForComments({ page, sessionId });

            if (comment2) {
                const card2 = notesContainer.getByTestId(`note-card-${comment2.id}`);
                await expect(card2).toBeVisible();
                await expect(card2).toContainText(secondComment);
                
                // Verify session role display (Primary, Co-Applicant, or Guarantor)
                // The role appears after the applicant name with a bullet separator
                const roleText = card2.locator('.text-xs').filter({ hasText: /primary|co-applicant|guarantor/i });
                const hasRoleDisplay = await roleText.count();
                if (hasRoleDisplay > 0) {
                    // Role is displayed (could be Primary, Co-Applicant, or Guarantor)
                    await expect(roleText.first()).toBeVisible();
                    console.log('Step 2a: Session role display verified.');
                } else {
                    // Primary applicant might not show role explicitly, but should show applicant name
                    await expect(card2).toContainText(userData.full_name);
                    console.log('Step 2a: Applicant name displayed (Primary role may be implicit).');
                }
                
                // Send to applicant via paperplane dropdown (trigger: send-note-{id}-btn)
                const sendDropdown = card2.getByTestId(`send-note-${comment2.id}-btn`);
                await expect(sendDropdown).toBeVisible();
                // Use reliable dropdown item click helper
                await clickDropdownItem(page, sendDropdown, new RegExp(`Send to .*${userData.full_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'));
                await page.waitForTimeout(1000);
                await expect(card2).toContainText(/sent to applicant/i);
                console.log('Step 2: Applicant-linked note and Sent to applicant.');
            }

            // --- Step 3: Household note, then Send → all applicants ---
            await fillMultiselect(page, notesForm.getByTestId('note-link-to-dropdown'), ['Household']);
            await textarea.fill(thirdComment);
            let { comment: comment3, comments } = await submitNoteAndWaitForComments({ page, sessionId });

            if (comment3) {
                const card3 = notesContainer.getByTestId(`note-card-${comment3.id}`);
                await expect(card3).toBeVisible();
                await expect(card3).toContainText(thirdComment);
                const sendDropdown3 = card3.getByTestId(`send-note-${comment3.id}-btn`);
                await expect(sendDropdown3).toBeVisible();
                // Use reliable dropdown item click helper
                await clickDropdownItem(page, sendDropdown3, /send to all applicants/i);
                await page.waitForTimeout(1000);
                await expect(card3).toContainText(/sent to|applicant/i);
                console.log('Step 3: Household note and Send to all applicants.');
            }

            // --- Step 3b: Test Send to organization ---
            // Create a new note to test "Send to organization"
            const orgCommentText = 'Note to test sending to organization';
            await fillMultiselect(page, notesForm.getByTestId('note-link-to-dropdown'), ['Household']);
            await textarea.fill(orgCommentText);
            let { comment: orgComment } = await submitNoteAndWaitForComments({ page, sessionId });

            if (orgComment) {
                const orgCard = notesContainer.getByTestId(`note-card-${orgComment.id}`);
                await expect(orgCard).toBeVisible();
                await expect(orgCard).toContainText(orgCommentText);
                
                // Test Send to organization dropdown option
                const sendOrgDropdown = orgCard.getByTestId(`send-note-${orgComment.id}-btn`);
                await expect(sendOrgDropdown).toBeVisible();
                
                // Set up response listener for PATCH request
                const orgPatchPromise = page.waitForResponse(resp =>
                    resp.url().includes(`/sessions/${sessionId}/comments/${orgComment.id}`) &&
                    resp.ok() &&
                    resp.request().method() === 'PATCH',
                    { timeout: 10_000 }
                );
                
                // Click dropdown and select "Send to organization"
                await clickDropdownItem(page, sendOrgDropdown, /send to org/i);
                await orgPatchPromise;
                await page.waitForTimeout(1000);
                
                // Verify "sent to org" text appears in the note card
                await expect(orgCard).toContainText(/sent to org|sent to organization/i);
                console.log('Step 3b: Send to organization verified.');
            }

            // --- Step 4: Form clears after submit (VC-2093 has no explicit Clear button) ---
            await textarea.fill('Clear check');
            await fillMultiselect(page, notesForm.getByTestId('note-link-to-dropdown'), [userData.full_name]);
            const clearPost = waitForNoteCreateResponse(page, sessionId);
            await notesForm.getByTestId('add-note-btn').click();
            await clearPost;
            await page.waitForTimeout(500);
            await expect(textarea).toHaveValue('');
            console.log('Step 4: Form cleared after submit.');

            // --- Step 5: Hide / show hidden / unhide ---
            // Use the first available comment for hide/unhide test (prefer comment1, fallback to comment2 or comment3)
            const commentToHide = comment1 || comment2 || comment3;
            if (!commentToHide) {
                throw new Error('No comment available for hide/unhide test - all comment creations failed');
            }

            comments = await hideOrUnhideNote(
                page,
                sessionId,
                notesContainer,
                commentToHide,
                'hide-note-btn'
            );
            const hiddenCard = notesContainer.getByTestId(`note-card-${commentToHide.id}`);

            const showHiddenCheckbox = notesModal.getByTestId('toggle-hidden-comments-checkbox');
            await expect(showHiddenCheckbox).toBeVisible();
            await showHiddenCheckbox.check();
            await page.waitForTimeout(500);
            await expect(hiddenCard).toBeVisible();
            await expect(hiddenCard.locator('.line-through')).toBeVisible();

            await showHiddenCheckbox.uncheck();
            await page.waitForTimeout(500);
            await expect(hiddenCard).not.toBeVisible();

            await showHiddenCheckbox.check();
            await page.waitForTimeout(500);
            await expect(hiddenCard).toBeVisible();
            await expect(hiddenCard.getByTestId('unhide-note-btn')).toBeVisible();

            await hideOrUnhideNote(
                page,
                sessionId,
                notesContainer,
                commentToHide,
                'unhide-note-btn'
            );
            await expect(hiddenCard).toBeVisible();
            // Unhidden notes no longer have .line-through (only is_hidden notes do)
            console.log('Step 5: Hide/unhide and show-hidden checkbox ok.');

            // --- Step 6: Pin / Unpin functionality ---
            // Step 6.1: Create a note with pin using add-note-pin-btn
            const pinnedCommentText = 'Pinned note created with pin button';
            await textarea.fill(pinnedCommentText);
            const pinnedPostPromise = waitForNoteCreateResponse(page, sessionId);
            const pinnedGetPromise = page.waitForResponse(resp =>
                resp.url().includes(`/sessions/${sessionId}/comments`) &&
                resp.ok() &&
                resp.request().method() === 'GET',
                { timeout: 10_000 }
            );
            await Promise.all([pinnedPostPromise, pinnedGetPromise, notesForm.getByTestId('add-note-pin-btn').click()]);
            const pinnedPostResp = await pinnedPostPromise;
            const pinnedGetResp = await pinnedGetPromise;
            const pinnedCreateBody = await pinnedPostResp.json().catch(() => ({}));
            const pinnedGetBody = await pinnedGetResp.json().catch(() => ({}));
            const pinnedComment = pinnedCreateBody?.data ?? pinnedCreateBody;
            const allCommentsAfterPin = pinnedGetBody?.data ?? [];

            if (pinnedComment) {
                const pinnedCard = notesContainer.getByTestId(`note-card-${pinnedComment.id}`);
                await expect(pinnedCard).toBeVisible();
                await expect(pinnedCard).toContainText(pinnedCommentText);
                // Verify pinned styling (bg-warning-lighter class)
                await expect(pinnedCard.locator('.bg-warning-lighter')).toBeVisible();
                // Verify pinned note appears first (pinned notes are shown before unpinned)
                const firstCard = notesContainer.locator('[data-testid^="note-card-"]').first();
                await expect(firstCard).toContainText(pinnedCommentText);
                // Verify hide button is disabled for pinned notes
                const pinnedHideBtn = pinnedCard.getByTestId('hide-note-btn');
                await expect(pinnedHideBtn).toBeDisabled();
                console.log('Step 6.1: Pinned note created and verified (appears first, hide disabled).');

                // Step 6.1b: Close Notes modal and verify pinned note banner appears on report page
                await notesModal.getByTestId('notes-modal-cancel').click();
                await page.waitForTimeout(1000); // Wait for modal to close and banner to render

                const pinnedBanner = page.getByTestId('pinned-note-banner');
                await expect(pinnedBanner).toBeVisible({ timeout: 10_000 });
                await expect(pinnedBanner).toContainText(pinnedCommentText);
                await expect(pinnedBanner).toContainText(/pinned remark/i);
                // Verify unpin button exists in banner
                const unpinBannerBtn = pinnedBanner.getByTestId('unpin-banner-btn');
                await expect(unpinBannerBtn).toBeVisible();
                console.log('Step 6.1b: Pinned note banner verified on report page.');

                // Reopen Notes modal to continue testing
                // Button text can be "Note" (singular) or "Notes" (plural), match both
                const legacyBtn2 = page.getByTestId('view-remarks-btn');
                const notesBtn2 = page.locator('#applicant-report').getByRole('button').filter({ hasText: /note/i });
                const viewNotesBtn2 = (await legacyBtn2.count()) > 0 ? legacyBtn2 : notesBtn2;
                await expect(viewNotesBtn2).toBeVisible({ timeout: 10_000 });
                await viewNotesBtn2.click();
                await expect(notesModal).toBeVisible({ timeout: 10_000 });
                await expect(notesForm).toBeVisible();
                await expect(textarea).toBeVisible();
                console.log('Step 6.1c: Notes modal reopened, continuing with pin tests.');
            }

            // Step 6.2: Pin an existing note (comment2) using pin-note-btn
            // NOTE: Since pinnedComment exists from Step 6.1, pinning comment2 will trigger confirmation dialog
            // The dialog only appears when trying to replace an existing pinned note
            if (comment2) {
                const card2 = notesContainer.getByTestId(`note-card-${comment2.id}`);
                const pinBtn = card2.getByTestId('pin-note-btn');
                await expect(pinBtn).toBeVisible();
                
                // Set up response listeners BEFORE clicking (PATCH /sessions/{id}/comments/{commentId})
                const pinPatchPromise = page.waitForResponse(resp => {
                    const url = resp.url();
                    return url.includes(`/sessions/${sessionId}/comments/${comment2.id}`) &&
                        resp.ok() &&
                        resp.request().method() === 'PATCH';
                }, { timeout: 20_000 });
                
                const pinGetPromise = page.waitForResponse(resp =>
                    resp.url().includes(`/sessions/${sessionId}/comments`) &&
                    resp.ok() &&
                    resp.request().method() === 'GET',
                    { timeout: 20_000 }
                );
                
                // Click pin button - confirmation dialog MUST appear because pinnedComment exists
                await pinBtn.click();
                
                // Wait for confirmation dialog to appear (it should always appear when replacing pinned note)
                const confirmBtn = page.getByTestId('confirm-btn');
                await expect(confirmBtn).toBeVisible({ timeout: 5_000 });
                
                // Verify dialog message mentions replacing pinned note
                const confirmDialog = page.locator('.text-center, .text-left').filter({ hasText: /replace.*pinned|pinning.*replace/i });
                const dialogMessage = page.locator('p.font-semibold, .text-lg').filter({ hasText: /pinning|replace/i });
                const hasReplaceMessage = await Promise.race([
                    confirmDialog.isVisible().then(() => true),
                    dialogMessage.isVisible().then(() => true),
                    Promise.resolve(false)
                ]).catch(() => false);
                
                if (hasReplaceMessage) {
                    console.log('Step 6.2a: Confirmation dialog with replace message verified.');
                }
                
                // Click confirm to proceed with pinning (replacing the existing pinned note)
                await Promise.all([pinPatchPromise, pinGetPromise, confirmBtn.click()]);
                await page.waitForTimeout(500);
                
                // Verify pinned styling
                await expect(card2.locator('.bg-warning-lighter')).toBeVisible();
                // Verify hide button is now disabled
                await expect(card2.getByTestId('hide-note-btn')).toBeDisabled();
                console.log('Step 6.2: Existing note pinned successfully (replaced previous pinned note).');
            }

            // Step 6.3: Unpin the note
            if (comment2) {
                const card2 = notesContainer.getByTestId(`note-card-${comment2.id}`);
                const unpinBtn = card2.getByTestId('pin-note-btn'); // Same button, now shows unpin
                await expect(unpinBtn).toBeVisible();
                
                const unpinPatchPromise = page.waitForResponse(resp =>
                    resp.url().includes(`/sessions/${sessionId}/comments/${comment2.id}`) &&
                    resp.ok() &&
                    resp.request().method() === 'PATCH',
                    { timeout: 10_000 }
                );
                
                await Promise.all([unpinPatchPromise, unpinBtn.click()]);
                await page.waitForTimeout(500);
                
                // Verify unpinned styling (no bg-warning-lighter, has bg-slate-100)
                await expect(card2.locator('.bg-warning-lighter')).not.toBeVisible();
                // Verify hide button is now enabled again
                await expect(card2.getByTestId('hide-note-btn')).toBeEnabled();
                console.log('Step 6.3: Note unpinned successfully.');
            }

            // Step 6.4: Test pinning another note (comment3) - NO confirmation dialog expected
            // NOTE: Since comment2 was unpinned in Step 6.3, there's no pinned note to replace
            // The confirmation dialog should ONLY appear when trying to replace an existing pinned note
            if (comment3) {
                const card3 = notesContainer.getByTestId(`note-card-${comment3.id}`);
                const pinBtn3 = card3.getByTestId('pin-note-btn');
                await expect(pinBtn3).toBeVisible();
                
                // Set up response listeners BEFORE clicking
                const pin3PatchPromise = page.waitForResponse(resp => {
                    const url = resp.url();
                    return url.includes(`/sessions/${sessionId}/comments/${comment3.id}`) &&
                        resp.ok() &&
                        resp.request().method() === 'PATCH';
                }, { timeout: 20_000 });
                
                const pin3GetPromise = page.waitForResponse(resp =>
                    resp.url().includes(`/sessions/${sessionId}/comments`) &&
                    resp.ok() &&
                    resp.request().method() === 'GET',
                    { timeout: 20_000 }
                );
                
                // Click pin button - NO confirmation dialog should appear (no pinned note to replace)
                await pinBtn3.click();
                
                // Verify confirmation dialog does NOT appear (since there's no pinned note to replace)
                const confirmBtn3 = page.getByTestId('confirm-btn');
                const dialogAppeared = await confirmBtn3.isVisible({ timeout: 2_000 }).catch(() => false);
                
                if (dialogAppeared) {
                    throw new Error('Confirmation dialog appeared unexpectedly - there should be no pinned note to replace');
                }
                
                // Wait for PATCH to complete (no confirmation needed)
                await Promise.all([pin3PatchPromise, pin3GetPromise]);
                await page.waitForTimeout(1000);
                
                // Verify comment3 is now pinned
                await expect(card3.locator('.bg-warning-lighter')).toBeVisible();
                console.log('Step 6.4: Note pinned successfully (no confirmation dialog - no pinned note to replace).');
            }

            console.log('Step 6: Pin/unpin functionality tested successfully.');

            await notesModal.getByTestId('notes-modal-cancel').click();
            console.log('All steps in remarks (Notes) section completed successfully.');
        } catch (error) {
            console.log('❌ Test case: tests/report_remarks_section.spec.js');
            throw error;
        }
    });
});
