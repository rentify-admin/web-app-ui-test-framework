import { test } from '@playwright/test';


const waitForJsonResponse = async response => {
    const responseContentType = response.headers()['content-type'];
    
    // Helper to handle protocol errors when response body is no longer available
    // This can happen due to redirects, timing issues, or if the response was already consumed
    const safeReadBodyAsText = async () => {
        try {
            // Read body as text first to avoid consuming it with json() then failing
            // This gives us more flexibility if parsing fails
            const text = await response.text();
            return text;
        } catch (err) {
            // Handle "Protocol error (Network.getResponseBody): No resource with given identifier found"
            if (err.message && err.message.includes('No resource with given identifier')) {
                // This typically happens when:
                // 1. Response was part of a redirect chain and intermediate request is gone
                // 2. Response object became stale due to timing issues
                // 3. Response body was already consumed by another operation
                console.error('❌ Response body unavailable - may be due to redirect or timing issue');
                throw new Error(`Response body unavailable (likely redirect/timing issue). Status: ${response.status()}, URL: ${response.url()}. Error: ${err.message}`);
            }
            throw err;
        }
    };
    
    if (responseContentType && responseContentType.includes('application/json')) {
        try {
            // Read as text first, then parse JSON
            // This avoids the issue where json() consumes the body and then fails
            const text = await safeReadBodyAsText();
            try {
                return JSON.parse(text);
            } catch (parseErr) {
                console.error('❌ Failed to parse JSON response:', parseErr.message);
                console.error('Raw response (first 200 chars):', text.substring(0, 200));
                throw new Error(`Response is not valid JSON. Parse error: ${parseErr.message}. Response preview: ${text.substring(0, 100)}...`);
            }
        } catch (err) {
            // Re-throw with context if it's already our custom error
            if (err.message && err.message.includes('Response body unavailable')) {
                throw err;
            }
            console.error('❌ Error reading JSON response:', err.message);
            throw err;
        }
    }
    
    // Non-JSON response: try to get text, but handle protocol errors
    try {
        const text = await safeReadBodyAsText();
        test.fail(`API did not return JSON. Content-Type: ${responseContentType || 'unknown'}. Body preview: ${text.substring(0, 100)}`);
        return text;
    } catch (err) {
        // Re-throw with context if it's already our custom error
        if (err.message && err.message.includes('Response body unavailable')) {
            console.error('❌ Response body no longer available for non-JSON response');
            test.fail(`Response body unavailable - may be due to redirect or timing. Error: ${err.message}`);
        }
        throw err;
    }
};

export { waitForJsonResponse };
