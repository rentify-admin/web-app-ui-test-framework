#!/usr/bin/env node
/**
 * Advanced Model Balancer
 * 
 * Tracks which models are currently in use across parallel batches.
 * Ensures efficient load distribution by marking models as busy/available.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BALANCER_FILE = path.join(__dirname, '../../.model-balancer.json');
const LOCK_TIMEOUT_MS = 60000; // 1 minute timeout for stuck locks

/**
 * Load balancer state
 */
function loadBalancerState() {
    try {
        if (fs.existsSync(BALANCER_FILE)) {
            const data = fs.readFileSync(BALANCER_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (e) {
        // Ignore errors
    }
    
    return {
        models: {},
        lastUpdate: Date.now()
    };
}

/**
 * Save balancer state
 */
function saveBalancerState(state) {
    try {
        state.lastUpdate = Date.now();
        fs.writeFileSync(BALANCER_FILE, JSON.stringify(state, null, 2));
    } catch (e) {
        // Ignore file locking errors in parallel execution
    }
}

/**
 * Check if model is currently busy
 */
export function isModelBusy(modelName) {
    const state = loadBalancerState();
    const modelState = state.models[modelName];
    
    if (!modelState) return false;
    
    const now = Date.now();
    const elapsed = now - modelState.timestamp;
    
    // If locked for more than timeout, consider it stale
    if (elapsed > LOCK_TIMEOUT_MS) {
        return false;
    }
    
    return modelState.busy === true;
}

/**
 * Mark model as busy (in use)
 */
export function markModelBusy(modelName, batchId) {
    const state = loadBalancerState();
    
    state.models[modelName] = {
        busy: true,
        batchId: batchId,
        timestamp: Date.now()
    };
    
    saveBalancerState(state);
}

/**
 * Mark model as available (free)
 */
export function markModelAvailable(modelName) {
    const state = loadBalancerState();
    
    if (state.models[modelName]) {
        delete state.models[modelName];
        saveBalancerState(state);
    }
}

/**
 * Get next available model from list
 */
export function getNextAvailableModel(models) {
    for (const model of models) {
        if (!isModelBusy(model.name)) {
            return model;
        }
    }
    return null;
}

/**
 * Clean up stale locks
 */
export function cleanupStaleLocks() {
    const state = loadBalancerState();
    const now = Date.now();
    let cleaned = false;
    
    for (const modelName in state.models) {
        const elapsed = now - state.models[modelName].timestamp;
        if (elapsed > LOCK_TIMEOUT_MS) {
            delete state.models[modelName];
            cleaned = true;
        }
    }
    
    if (cleaned) {
        saveBalancerState(state);
    }
}


