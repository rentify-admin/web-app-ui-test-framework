import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { expect } from '@playwright/test';
import { wait } from '../utils/helper';
import { createCurrentStep, waitForStepTransition } from './session-helpers';

function getCurrentStepKey(session) {
    return session?.state?.current_step?.task?.key || session?.state?.current_step?.type || null;
}

async function pollUntil(fn, { timeoutMs = 120_000, intervalMs = 3_000, debugName = 'pollUntil' } = {}) {
    const start = Date.now();
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const result = await fn();
        if (result) return result;
        if (Date.now() - start > timeoutMs) {
            throw new Error(`Timeout waiting for condition (${debugName})`);
        }
        await wait(intervalMs);
    }
}

/**
 * Ensure a session reaches BACKGROUND_CHECK as the current step.
 * Currently supports workflows where BACKGROUND_CHECK follows START.
 */
async function ensureBackgroundCheckCurrentStep(sessionApi, session, { rentBudget = 2000 } = {}) {
    let s = session;
    const key = getCurrentStepKey(s);

    if (key === 'START') {
        const startStep = await createCurrentStep(sessionApi, s);
        await sessionApi.update(s.id, { target: rentBudget });
        await sessionApi.step(s.id).update(startStep.id, { status: 'COMPLETED' });
        s = await waitForStepTransition(sessionApi, s, 'START');
    }

    const next = getCurrentStepKey(s);
    if (next !== 'BACKGROUND_CHECK') {
        throw new Error(`Expected current step BACKGROUND_CHECK but got "${next}"`);
    }

    return s;
}

async function createBackground(adminClient, sessionId, sessionStepId, {
    firstName = 'John',
    lastName = 'Doe',
    dob = '1990-01-01',
    ssn = '123456789',
    address1 = '1 Market St',
    city = 'San Francisco',
    state = 'CA',
    postal = '94105',
    country = 'US',
    signatureFilePath
} = {}) {
    if (!signatureFilePath) {
        throw new Error('signatureFilePath is required');
    }
    const resolved = path.resolve(signatureFilePath);
    if (!fs.existsSync(resolved)) {
        throw new Error(`Signature file not found: ${resolved}`);
    }

    const form = new FormData();
    form.append('first_name', firstName);
    form.append('last_name', lastName);
    form.append('date_of_birth', dob);
    form.append('ssn', ssn);
    form.append('address_line_1', address1);
    form.append('city', city);
    form.append('administrative_area', state);
    form.append('postal_code', postal);
    form.append('country', country);
    form.append('signature', fs.createReadStream(resolved));

    const res = await adminClient.post(`/sessions/${sessionId}/steps/${sessionStepId}/backgrounds`, form, {
        headers: {
            ...form.getHeaders(),
            Accept: 'application/json'
        },
        timeout: 120_000
    });

    expect(res.status).toBe(201);
    return res.data.data;
}

async function waitForCreditReportCount(adminClient, sessionId, { minCount = 1, timeoutMs = 120_000 } = {}) {
    return pollUntil(async () => {
        const res = await adminClient.get(`/sessions/${sessionId}/credit-reports`);
        const items = res?.data?.data || [];
        return items.length >= minCount ? items : null;
    }, { timeoutMs, debugName: `credit reports >= ${minCount}` });
}

export {
    ensureBackgroundCheckCurrentStep,
    createBackground,
    waitForCreditReportCount
};


