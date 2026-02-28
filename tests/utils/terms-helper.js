// ─── T&C Modal Helpers ────────────────────────────────────────────────────────

/**
 * Wait for the T&C modal checkbox to become visible.
 * @param {import('@playwright/test').Page} page
 * @param {number} [timeoutMs=10000]
 */
async function waitForTermsModal(page, timeoutMs = 10_000) {
    await page.getByTestId('user-terms').waitFor({ state: 'visible', timeout: timeoutMs });
}

/**
 * Accept the T&C modal: check checkbox → click submit → wait for modal to close.
 * @param {import('@playwright/test').Page} page
 */
async function acceptTermsAndConditions(page) {
    await page.getByTestId('user-terms').click();
    await page.getByTestId('terms-submit-btn').click();
    await page.getByTestId('user-terms').waitFor({ state: 'hidden', timeout: 10_000 });
}

/**
 * Get the localStorage entry for a specific session's T&C acceptance.
 * Key format: [termsLink]-[privacyLink]-[sessionUuid]
 * @param {import('@playwright/test').Page} page
 * @param {string} sessionUuid  UUID extracted from the session invite URL path
 * @returns {Promise<{ key: string, value: string } | null>}
 */
async function getTermsLocalStorageEntry(page, sessionUuid) {
    return page.evaluate((uuid) => {
        const matchingKey = Object.keys(localStorage).find(key =>
            key.includes('terms-conditions') &&
            key.includes('privacy-policy') &&
            key.includes(uuid)
        );
        return matchingKey
            ? { key: matchingKey, value: localStorage.getItem(matchingKey) }
            : null;
    }, sessionUuid);
}

/**
 * Returns true if ANY T&C acceptance key exists in localStorage
 * (regardless of which session UUID it belongs to).
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<boolean>}
 */
async function hasAnyTermsLocalStorageKey(page) {
    return page.evaluate(() =>
        Object.keys(localStorage).some(key =>
            key.includes('terms-conditions') && key.includes('privacy-policy')
        )
    );
}

/**
 * Extract the session UUID from an invite link URL.
 * Invite URL path format: /sessions/{uuid}
 * @param {string} link  Full invite URL string
 * @returns {string} Session UUID
 */
function extractSessionUuid(link) {
    return new URL(link).pathname.split('/sessions/')[1]?.split('?')[0];
}

export {
    waitForTermsModal,
    acceptTermsAndConditions,
    getTermsLocalStorageEntry,
    hasAnyTermsLocalStorageKey,
    extractSessionUuid
};