
/**
 * Join URL excluding extra /(slash)
 *
 * @param {string} baseUrl
 * @param {string} slug
 * @returns string
 */
const joinUrl = (baseUrl, slug) => {
    if (!baseUrl) {
        console.error('joinUrl: baseUrl is undefined or null');
        console.error('Available environment variables:', {
            APP_URL: process.env.APP_URL,
            API_URL: process.env.API_URL,
            APP_ENV: process.env.APP_ENV
        });
        throw new Error('baseUrl is required for joinUrl function');
    }
    if (!slug) {
        console.error('joinUrl: slug is undefined or null');
        throw new Error('slug is required for joinUrl function');
    }
    return `${baseUrl.replace(/\/+$/, '')}/${slug.replace(/^\/+/, '')}`;
};

/**
 * Remove certain special characters from regex
 *
 * @param {string} str
 * @returns string
 */
const escapeRegex = str => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Generate 5 character random number
 *
 * @returns number
 */
const getRandomNumber = () => Math.floor(Math.random() * 100000);

/**
 * Generate random email
 *
 * @returns string
 */
const getRandomEmail = () => `playwright+${getRandomNumber()}@verifast.com`;

/**
 * Decode URL where '+' used instead of %20
 *
 * @param {String} str
 * @returns String
 */
const customUrlDecode = str => decodeURIComponent(str.replace(/\+/g, ' '));

// eslint-disable-next-line max-len, vue/max-len, new-cap
const getAmount = (amount, locale, fraction = 2) => `$ ${Intl.NumberFormat(locale, { minimumFractionDigits: fraction }).format(amount)}`;
const getSafeAmount = (amount, locale, fraction) => amount ? getAmount(amount, locale, fraction) : 'N/A';
const getCentsToDollarsSafe = (amount, locale, fraction) => getSafeAmount(amount && amount / 100, locale, fraction);

export {
    joinUrl,
    escapeRegex,
    getRandomEmail,
    getRandomNumber,
    customUrlDecode,
    getAmount,
    getSafeAmount,
    getCentsToDollarsSafe
};
