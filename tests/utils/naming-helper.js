/**
 * Naming Helper - Centralized utility for adding 'AutoT - ' prefix to applicant names
 * 
 * This helper ensures all applicant names created in UI tests have a consistent
 * 'AutoT - ' prefix for easy identification and cleanup.
 * Also adds '+autotest' to emails since the app uses email to determine guest name.
 */

const NAME_PREFIX = 'AutoT - ';
const EMAIL_SUFFIX = '+autotest';

/**
 * Check if a name already has the prefix
 * @param {string} name - Name to check
 * @returns {boolean} True if name already has prefix
 */
const hasPrefix = (name) => {
    if (!name || typeof name !== 'string') return false;
    return name.startsWith(NAME_PREFIX);
};

/**
 * Add prefix to a name (idempotent - won't add if already prefixed)
 * @param {string} name - Name to prefix
 * @returns {string} Name with prefix
 */
const addPrefix = (name) => {
    if (!name || typeof name !== 'string') {
        return NAME_PREFIX + 'Test';
    }
    
    // If already has prefix, return as-is
    if (hasPrefix(name)) {
        return name;
    }
    
    return NAME_PREFIX + name;
};

/**
 * Generate a random name with prefix
 * @param {string} [baseName='Test'] - Base name to use (default: 'Test')
 * @returns {string} Random name with prefix (e.g., 'AutoT - Test12345')
 */
const generateRandomName = (baseName = 'Test') => {
    const randomSuffix = Math.floor(Math.random() * 100000);
    return addPrefix(`${baseName}${randomSuffix}`);
};

/**
 * Format user data object to ensure first_name has prefix
 * This is the main function to use when preparing user data for session creation
 * 
 * @param {Object} userData - User data object
 * @param {string} [userData.first_name] - First name (will be auto-prefixed)
 * @param {string} [userData.last_name] - Last name (unchanged)
 * @param {string} [userData.email] - Email (unchanged)
 * @returns {Object} User data with prefixed first_name
 */
const formatUserData = (userData = {}) => {
    if (!userData || typeof userData !== 'object') {
        return {
            first_name: addPrefix('Test'),
            last_name: 'User',
            email: 'test@verifast.com'
        };
    }
    
    return {
        ...userData,
        first_name: addPrefix(userData.first_name || 'Test')
    };
};

/**
 * Add '+autotest' suffix to email (before @)
 * Since the app uses email to determine guest name, we need to modify the email too
 * 
 * @param {string} email - Email to modify
 * @returns {string} Email with +autotest suffix
 * 
 * @example
 * addEmailSuffix('test@verifast.com') → 'test+autotest@verifast.com'
 * addEmailSuffix('test+something@verifast.com') → 'test+something+autotest@verifast.com'
 */
const addEmailSuffix = (email) => {
    if (!email || typeof email !== 'string' || !email.includes('@')) {
        return 'test+autotest@verifast.com';
    }
    
    // If already has +autotest, return as-is
    if (email.includes('+autotest')) {
        return email;
    }
    
    // Split email at @
    const [localPart, domain] = email.split('@');
    
    // Add +autotest to local part
    return `${localPart}${EMAIL_SUFFIX}@${domain}`;
};

/**
 * Format user data object to ensure first_name has prefix AND email has +autotest
 * This is the main function to use when preparing user data for session creation
 * 
 * @param {Object} userData - User data object
 * @param {string} [userData.first_name] - First name (will be auto-prefixed)
 * @param {string} [userData.last_name] - Last name (unchanged)
 * @param {string} [userData.email] - Email (will have +autotest added)
 * @returns {Object} User data with prefixed first_name and modified email
 */
const formatUserDataComplete = (userData = {}) => {
    if (!userData || typeof userData !== 'object') {
        return {
            first_name: addPrefix('Test'),
            last_name: 'User',
            email: addEmailSuffix('test@verifast.com')
        };
    }
    
    return {
        ...userData,
        first_name: addPrefix(userData.first_name || 'Test'),
        email: addEmailSuffix(userData.email || 'test@verifast.com')
    };
};

/**
 * Generate complete random user data with prefix
 * @param {string} [baseName='Test'] - Base name for first_name
 * @param {Object} [overrides={}] - Additional fields to override
 * @returns {Object} Complete user data object with prefixed random name
 */
const generateRandomUserData = (baseName = 'Test', overrides = {}) => {
    const randomSuffix = Math.floor(Math.random() * 100000);
    const timestamp = Date.now();
    
    return {
        first_name: addPrefix(`${baseName}${randomSuffix}`),
        last_name: 'User',
        email: addEmailSuffix(`test-${timestamp}-${randomSuffix}@verifast.com`),
        ...overrides
    };
};

export {
    NAME_PREFIX,
    EMAIL_SUFFIX,
    hasPrefix,
    addPrefix,
    addEmailSuffix,
    generateRandomName,
    formatUserData,
    formatUserDataComplete,
    generateRandomUserData
};

export default {
    NAME_PREFIX,
    EMAIL_SUFFIX,
    hasPrefix,
    addPrefix,
    addEmailSuffix,
    generateRandomName,
    formatUserData,
    formatUserDataComplete,
    generateRandomUserData
};

