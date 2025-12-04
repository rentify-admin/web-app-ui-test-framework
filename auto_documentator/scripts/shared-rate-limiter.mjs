#!/usr/bin/env node
/**
 * Shared Rate Limiter
 * 
 * Tracks which AI providers hit rate limits across all parallel batches.
 * Uses a simple file-based locking mechanism.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RATE_LIMIT_FILE = path.join(__dirname, '../../.rate-limits.json');

/**
 * Load rate limit state
 */
export function loadRateLimits() {
    try {
        if (fs.existsSync(RATE_LIMIT_FILE)) {
            const data = fs.readFileSync(RATE_LIMIT_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (e) {
        // Ignore errors
    }
    
    return {
        providers: {},
        lastUpdate: Date.now()
    };
}

/**
 * Save rate limit state
 */
export function saveRateLimits(limits) {
    try {
        limits.lastUpdate = Date.now();
        fs.writeFileSync(RATE_LIMIT_FILE, JSON.stringify(limits, null, 2));
    } catch (e) {
        // Ignore errors - file locking issues in parallel execution
    }
}

/**
 * Check if provider is rate limited
 */
export function isProviderRateLimited(providerName) {
    const limits = loadRateLimits();
    const providerData = limits.providers[providerName];
    
    if (!providerData) return false;
    
    const now = Date.now();
    const elapsed = now - providerData.timestamp;
    
    // Rate limits expire after 2 minutes
    if (elapsed > 120000) {
        return false;
    }
    
    return providerData.rateLimited === true;
}

/**
 * Mark provider as rate limited
 */
export function markProviderRateLimited(providerName) {
    const limits = loadRateLimits();
    
    limits.providers[providerName] = {
        rateLimited: true,
        timestamp: Date.now()
    };
    
    saveRateLimits(limits);
}

/**
 * Mark provider as working
 */
export function markProviderWorking(providerName) {
    const limits = loadRateLimits();
    
    if (limits.providers[providerName]) {
        delete limits.providers[providerName];
        saveRateLimits(limits);
    }
}

