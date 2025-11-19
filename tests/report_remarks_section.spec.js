import { test, expect } from '@playwright/test';
import { admin } from './test_config';
import { adminLoginAndNavigateToApplications } from './utils/session-utils';
import { findAndInviteApplication } from './utils/applications-page';
import generateSessionForm from './utils/generate-session-form';
import { fillMultiselect, gotoPage } from './utils/common';
import { findSessionLocator, searchSessionWithText } from './utils/report-page';
import { waitForJsonResponse } from './utils/wait-response';
import { cleanupSession } from './utils/cleanup-helper';


// --- Global/Scoped Variables ---
let createdSessionId = null;
let allTestsPassed = true;
// Declaring these at the top level so helper functions can access them
let sessionId = null;
let remarkHistorySection = null;


// Helper to check if request payload contains all keys/values in expectedPayload
function requestContainsPayload(request, expectedPayload) {
    try {
        const data = JSON.parse(request.postData() || '{}');
        return Object.entries(expectedPayload).every(
            ([key, value]) => Array.isArray(value)
                ? Array.isArray(data[key]) && value.length === data[key].length && value.every((v, i) => v === data[key][i])
                : data[key] === value
        );
    } catch {
        return false;
    }
}

const waitForCommentCreateResponse = (page, sessionId, payload) => {
    const response = page.waitForResponse(resp => {
        return resp.url().includes(`/sessions/${sessionId}/comments`)
            && resp.request().method() === "POST"
            && requestContainsPayload(resp.request(), payload);
    });
    return response;
}

async function hideComment(page, sessionId, remarkHistorySection, commentToHide, selector) {
    const hideCommentDiv = remarkHistorySection.getByTestId(`remark-comment-${commentToHide.id}`)

    await expect(hideCommentDiv).toBeVisible();
    const hideBtn = hideCommentDiv.getByTestId(selector)
    await expect(hideBtn).toBeVisible();

    console.log('Clicking on hide/unhide button for comment', commentToHide.id);

    const getComments = page.waitForResponse(resp => resp.url().includes(`/sessions/${sessionId}/comments`)
        && resp.ok()
        && resp.request().method() === 'GET'
    )

    const [commentsResponse] = await Promise.all([
        getComments,
        page.waitForResponse(resp => resp.url().includes(`/sessions/${sessionId}/comments/${commentToHide.id}`)
            && resp.ok()
            && resp.request().method() === 'PATCH'
        ),
        hideBtn.click()
    ]);

    console.log('Hide/unhide comment response received.');

    const { data: comments } = await waitForJsonResponse(commentsResponse);
    return comments;
}

function formatIsoToCustom(datetimeString) {
    const dateObj = new Date(datetimeString);

    const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    const day = dateObj.getDate();
    // Determine day suffix
    let suffix = 'th';
    if (day % 10 === 1 && day !== 11) suffix = 'st';
    else if (day % 10 === 2 && day !== 12) suffix = 'nd';
    else if (day % 10 === 3 && day !== 13) suffix = 'rd';

    const month = months[dateObj.getMonth()];
    const year = dateObj.getFullYear();

    // Format hours for 12-hour time
    let hours = dateObj.getHours();
    const minutes = dateObj.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;

    return `${month} ${day}${suffix} ${year}, ${hours}:${minutes} ${ampm}`;
}

async function submitRemarkAndWaitForComments({ page, sessionId, remarkPayload }) {
    const remarkModal = page.getByTestId('remark-history-modal')
    const postComment = waitForCommentCreateResponse(page, sessionId, remarkPayload);
    const getComments = page.waitForResponse(resp =>
        resp.url().includes(`/sessions/${sessionId}/comments`)
        && resp.ok()
        && resp.request().method() === "GET"
    );
    const [commentResponse, commentsResponse] = await Promise.all([
        postComment,
        getComments,
        remarkModal.getByTestId('submit-remark-btn').click()
    ]);

    const { data: comment } = await waitForJsonResponse(commentResponse)
    const { data: comments } = await waitForJsonResponse(commentsResponse)

    return {
        comment,
        comments
    };
}


// --- Test Suite ---
test.describe('QA-221 report_remarks_section.spec', () => {

    const appName = 'Autotest - Heartbeat Test - Financial';

    test('Check Remarks (Comments) Section on Applicant Report', {
        tag: ['@core', '@smoke', '@regression'],
        timeout: 150_000
    }, async ({ page }) => {
        try {
            console.log('Logging in as admin and navigating to applications page');
            await adminLoginAndNavigateToApplications(page, admin)

            console.log('Inviting the target application for session creation...');
            await findAndInviteApplication(page, appName);

            const userData = {
                first_name: 'Remark Btn',
                last_name: 'test',
                full_name: 'Autot - Remark Btn Test',
                email: 'test-remarkbtn@verifast.com'
            };

            console.log('Filling session form with test applicant data');
            await generateSessionForm.fill(page, userData);
            const sessionData = await generateSessionForm.submit(page);
            createdSessionId = sessionData.data?.id;
            sessionId = sessionData.data?.id; // Set the scoped variable here
            await page.getByTestId('generate-session-modal-cancel').click();

            console.log('Navigating to sessions list...');
            await gotoPage(
                page,
                'applicants-menu',
                'applicants-submenu',
                '/sessions?fields[session]'
            );

            console.log('Searching for created session...');
            await searchSessionWithText(page, sessionId);

            const sessionLocator = await findSessionLocator(
                page,
                `.application-card[data-session="${sessionId}"]`
            );

            console.log('Opening session detail page...');
            const [sessionResponse] = await Promise.all([
                page.waitForResponse(
                    resp => resp.url().includes(`/sessions/${sessionId}?fields[session]`)
                        && resp.ok()
                        && resp.request().method() === 'GET'
                ),
                sessionLocator.click()
            ]);

            const session = await waitForJsonResponse(sessionResponse);

            const viewRemarksBtn = page.getByTestId('view-remarks-btn');

            console.log('Opening remark history modal by clicking on remarks button');
            await expect(viewRemarksBtn).toBeVisible()
            await viewRemarksBtn.click()

            const remarkHistoryModal = page.getByTestId('remark-history-modal');
            await expect(remarkHistoryModal).toBeVisible()

            const remarkHistoryFormSection = remarkHistoryModal.getByTestId('remark-history-form-section');
            await expect(remarkHistoryFormSection).toBeVisible()

            const commentDiv = remarkHistoryFormSection.getByTestId('remark-textarea');
            await expect(commentDiv).toBeVisible()

            // Set the scoped variable here for use in helper functions
            remarkHistorySection = page.getByTestId('remark-history-display-section');

            const firstComment = 'Internal remark without notifications'
            const secondComment = 'Remark with organization notification'
            const thirdComment = 'Remark with applicant notification'
            const fourthComment = 'Remark with organization and applicant notification'
            const clearComment = 'Clear comment notification'

            // Step 1: adding comment without send to org and applicants
            console.log('step 1: Adding comment without sending to organization and applicants');
            await commentDiv.locator('#remark-content').fill(firstComment)
            console.log('Filled comment textarea:', firstComment);

            const {
                comment: comment1
            } = await submitRemarkAndWaitForComments({
                page,
                sessionId,
                remarkPayload: { comment: firstComment }
            });

            if (comment1) {
                console.log('Submitted comment, verifying display in UI');
                const commentLocator = remarkHistorySection.getByTestId(`remark-comment-${comment1.id}`)
                await expect(commentLocator).toBeVisible()
                await expect(commentLocator).toContainText(firstComment)
                console.log('Step 1 success: Comment visible as expected.');
            }

            // Step 2: adding comment with send to org
            console.log('step 2: Adding comment with sending to organization.');
            await commentDiv.locator('#remark-content').fill(secondComment)
            console.log('Filled comment textarea:', secondComment);
            await remarkHistoryFormSection.getByTestId('remark-notify-org-checkbox').check();
            console.log('Checked org notify checkbox');

            const { comment: comment2 } = await submitRemarkAndWaitForComments({
                page,
                sessionId,
                remarkPayload: {
                    comment: secondComment,
                    notify_organization: true
                }
            });

            if (comment2) {
                console.log('Submitted org-notified comment, verifying display and bell icon');
                const commentLocator = remarkHistorySection.getByTestId(`remark-comment-${comment2.id}`)
                await expect(commentLocator).toBeVisible()
                await expect(commentLocator).toContainText(secondComment)
                await expect(commentLocator.getByTestId('notify-comment-btn')).toBeVisible();
                console.log('Step 2 success: Notify org comment and button found.');
            }

            // Step 3: adding comment with applicants
            console.log('step 3: Adding comment with applicant notified.');
            await commentDiv.locator('#remark-content').fill(thirdComment)
            console.log('Filled comment textarea:', thirdComment);
            await fillMultiselect(page, remarkHistoryFormSection.getByTestId('remark-applicant-dropdown'), [userData.full_name]);
            console.log('Applicant selected via multiselect');

            let {
                comment: comment3,
                comments
            } = await submitRemarkAndWaitForComments({
                page,
                sessionId,
                remarkPayload: {
                    comment: thirdComment,
                    notify_applicant: true,
                    applicants: [session.data.applicant.id]
                }
            })

            if (comment3) {
                console.log('Checking comment with applicant notification and bell icon');
                const commentLocator = remarkHistorySection.getByTestId(`remark-comment-${comment3.id}`)
                await expect(commentLocator).toBeVisible()
                await expect(commentLocator).toContainText(thirdComment)
                await expect(commentLocator.getByTestId('notify-comment-btn')).toBeVisible();
                console.log('Step 3 success: Notify applicant comment and button found.');
            }

            // Step 4: adding comment send to org and applicants
            console.log('step 4: Adding comment with notify org and applicant together.');
            await commentDiv.locator('#remark-content').fill(fourthComment)
            console.log('Filled comment textarea:', fourthComment);
            await fillMultiselect(page, remarkHistoryFormSection.getByTestId('remark-applicant-dropdown'), [userData.full_name]);
            console.log('Applicant added in dropdown');
            await remarkHistoryFormSection.getByTestId('remark-notify-org-checkbox').check();
            console.log('Org checkbox checked for org+app notification');

            let {
                comment: comment4
            } = await submitRemarkAndWaitForComments({
                page,
                sessionId,
                remarkPayload: {
                    comment: fourthComment,
                    notify_organization: true,
                    notify_applicant: true,
                    applicants: [session.data.applicant.id]
                }
            });

            if (comment4) {
                console.log('Verifying org+applicant notify comment & button visible');
                const commentLocator = remarkHistorySection.getByTestId(`remark-comment-${comment4.id}`)
                await expect(commentLocator).toBeVisible()
                await expect(commentLocator).toContainText(fourthComment)
                await expect(commentLocator.getByTestId('notify-comment-btn')).toBeVisible()
                console.log('Step 4 success: Notify org and applicant comment is visible.');
            }

            // Step 5: Clear button check comment after
            console.log('step 5: Clearing comment form after fill with clear button and checking fields state');
            await commentDiv.locator('#remark-content').fill(clearComment)
            await fillMultiselect(page, remarkHistoryFormSection.getByTestId('remark-applicant-dropdown'), [userData.full_name]);
            await remarkHistoryFormSection.getByTestId('remark-notify-org-checkbox').check()
            console.log('Clear scenario filled with data, clicking clear-remark-btn');
            await remarkHistoryFormSection.getByTestId('clear-remark-btn').click()

            await expect(commentDiv.locator('#remark-content')).toHaveValue('');
            console.log('Comment textarea is empty after clear');
            await expect(remarkHistoryFormSection.getByTestId('remark-notify-org-checkbox')).not.toBeChecked();
            console.log('Notify org checkbox is unchecked after clear');

            // Check that the "multiselect__tags-wrap" div is not visible
            await expect(
                remarkHistoryFormSection
                    .getByTestId('remark-applicant-dropdown')
                    .locator('div.multiselect__tags-wrap')
            ).not.toBeVisible();
            console.log('Applicants dropdown multiselect tags cleared after clear action.');

            // Step 6: comment hide/unhide check
            console.log('step 6: Checking hide/unhide functionality for comment');
            for (let index = 0; index < comments.length; index++) {
                const element = comments[index];
                const commentLocator = remarkHistorySection.getByTestId(`remark-comment-${element.id}`)

                await expect(commentLocator).toContainText(element.comment)
                await expect(commentLocator).toContainText(element.author.user.full_name)
                await expect(commentLocator).toContainText(formatIsoToCustom(element.created_at))
                await expect(commentLocator.getByTestId('hide-comment-btn')).toBeVisible()
                console.log(`Verified visible comment #${element.id} for hide button and details UI`);
            }

            const commentToHide = comments[0]

            console.log('Hiding first comment on the list:', commentToHide.id);
            comments = await hideComment(page, sessionId, remarkHistorySection, commentToHide, 'hide-comment-btn')
            const hideCommentDiv = remarkHistorySection.getByTestId(`remark-comment-${commentToHide.id}`)

            const toggleBtn = remarkHistorySection.getByTestId('toggle-hidden-comments-btn');
            await expect(toggleBtn).toBeVisible();
            console.log('Toggle hidden comments button is visible');

            await toggleBtn.click();
            console.log('Show hidden comments clicked, ensuring hidden comment appears dimmed');
            await expect(hideCommentDiv).toBeVisible()
            await expect(hideCommentDiv).toContainClass('bg-slate-100')

            await toggleBtn.click();
            console.log('Hide hidden comments clicked, checking hidden comment is now hidden');
            await expect(hideCommentDiv).not.toBeVisible()

            await toggleBtn.click();
            console.log('Show hidden comments again for unhide test');
            await expect(hideCommentDiv).toBeVisible()
            await expect(hideCommentDiv.getByTestId('unhide-comment-btn')).toBeVisible()

            console.log('Unhiding the previously hidden comment');
            comments = await hideComment(page, sessionId, remarkHistorySection, commentToHide, 'unhide-comment-btn')
            await expect(hideCommentDiv).toBeVisible()
            await expect(hideCommentDiv).not.toContainClass('bg-slate-100')
            console.log('Hide/unhide feature tested successfully on comment.');

            // End of all steps
            console.log('All steps in remarks section test completed successfully.');
        }
        catch (error) {
            console.log('❌ Test case: tests/report_remarks_section.spec.js')
            allTestsPassed = false
            throw error;
        }

    })

    test.afterAll(async ({ request }) => {
        await cleanupSession(request, createdSessionId, allTestsPassed);
    });
})