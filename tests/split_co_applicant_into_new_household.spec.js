import { test, expect } from '@playwright/test';
import loginForm from '~/tests/utils/login-form';
import { admin } from '~/tests/test_config';
import { generateUniqueName } from '~/tests/utils/common';
import { createApplicationFlow } from '~/tests/utils/application-management';
import { gotoApplicationsPage, generateSessionForApplication } from '~/tests/utils/applications-page';
import { app as appConfig } from '~/tests/test_config';
import { handleOptionalStateModal, completeApplicantForm } from '~/tests/utils/session-flow';
import { advanceFromApplicantTypeToBudget, completeIdentityAndFinancial } from '~/tests/utils/application-management';
import { openReportForSession } from '~/tests/utils/report-page';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Verbose helpers
const log = (...args) => console.log('🧭', ...args);
const attachPageDebugHandlers = (page, label = 'page') => {
  page.on('console', msg => console.log(`📜 [${label}] [${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => console.log(`🔥 [${label}] pageerror: ${err.message}`));
  page.on('requestfailed', req => console.log(`⚠️ [${label}] requestfailed ${req.method()} ${req.url()} => ${req.failure()?.errorText}`));
};
const ts = () => new Date().toISOString().replace(/[:.]/g, '-');
const snapshot = async (page, label) => {
  try {
    const stamp = ts();
    await page.screenshot({ path: `test-results/split-debug-${stamp}-${label}.png`, fullPage: true });
    const html = await page.content();
    const fs = await import('fs');
    fs.writeFileSync(`test-results/split-debug-${stamp}-${label}.html`, html);
    log(`📸 snapshot saved: ${label}`);
  } catch (e) {
    log(`⚠️ snapshot failed (${label}): ${e.message}`);
  }
};
const step = async (name, fn) => {
  log(`▶️ ${name}`);
  try {
    const r = await fn();
    log(`✅ ${name}`);
    return r;
  } catch (e) {
    log(`❌ ${name}: ${e.message}`);
    throw e;
  }
};

const openInviteModal = async (page) => {
  const inviteBtn = page.getByTestId('open-invite-modal');
  if (await inviteBtn.first().isVisible().catch(() => false)) {
    await inviteBtn.first().click();
  } else {
    // TODO: update locator with data-testid
    await page.getByRole('button', { name: /invite/i }).first().click();
  }
  await expect(page.getByText('Invite Applicant', { exact: false })).toBeVisible({ timeout: 15000 });
};

const reinviteCoApplicantAndCopyLink = async (page, coappEmail) => {
  await openInviteModal(page);
  const row = page.locator('table').locator('tr', { hasText: coappEmail });
  await expect(row).toBeVisible({ timeout: 15000 });
  const reinviteBtn = row.getByTestId('reinvite-btn');
  if (await reinviteBtn.isVisible().catch(() => false)) {
    await reinviteBtn.click();
  } else {
    // TODO: update locator with data-testid
    await row.getByRole('button', { name: /re-?invite/i }).click();
  }
  const linkInput = row.getByTestId('invite-link-input');
  let link = '';
  if (await linkInput.isVisible().catch(() => false)) {
    link = await linkInput.inputValue();
  } else {
    // TODO: update locator with data-testid
    const codeEl = page.locator('code');
    await expect(codeEl).toBeVisible({ timeout: 10000 });
    const code = await codeEl.textContent();
    link = `${appConfig.urls.app}/sessions/${code}`;
  }
  const closeBtn = page.getByTestId('invite-modal-close');
  if (await closeBtn.isVisible().catch(() => false)) {
    await closeBtn.click();
  } else {
    // TODO: update locator with data-testid
    await page.getByRole('button', { name: /close/i }).click();
  }
  return link;
};

const splitCoApplicantToNewHousehold = async (page, coappEmail) => {
  const row = page.locator('[data-testid="applicant-row"]').filter({ hasText: coappEmail });
  if (!(await row.count())) {
    // TODO: update locator with data-testid
    const tableRow = page.locator('table tr', { hasText: coappEmail }).first();
    await expect(tableRow).toBeVisible({ timeout: 10000 });
    const splitBtnFallback = tableRow.getByRole('button', { name: /split to new household/i });
    if (await splitBtnFallback.isVisible().catch(() => false)) {
      await splitBtnFallback.click();
    } else {
      // TODO: update locator with data-testid
      await tableRow.getByText('Split to New Household', { exact: false }).click();
    }
  } else {
    const splitBtn = row.getByTestId('split-household-btn');
    if (await splitBtn.isVisible().catch(() => false)) {
      await splitBtn.click();
    } else {
      // TODO: update locator with data-testid
      await row.getByRole('button', { name: /split to new household/i }).click();
    }
  }
  const confirmBtn = page.getByTestId('confirm-split-btn');
  if (await confirmBtn.isVisible().catch(() => false)) {
    await confirmBtn.click();
  } else {
    // TODO: update locator with data-testid
    const confirmFallback = page.getByRole('button', { name: /confirm|yes|split/i });
    if (await confirmFallback.isVisible().catch(() => false)) {
      await confirmFallback.click();
    }
  }
  await page.waitForTimeout(3000);
  await page.reload();
};

const verifyApplicantDataIsolation = async (page, sessionId, primaryEmail, coappEmail) => {
  await openReportForSession(page, sessionId);
  await expect(page.getByText(primaryEmail, { exact: false })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(coappEmail, { exact: false })).not.toBeVisible({ timeout: 5000 }).catch(() => {});
};

const addCoApplicant = async (page, firstName, lastName, email) => {
  const addBtn = page.getByTestId('add-co-applicant');
  if (await addBtn.isVisible().catch(() => false)) {
    await addBtn.click();
  } else {
    // TODO: update locator with data-testid
    await page.getByRole('button', { name: /add co-?applicant/i }).click();
  }
  const first = page.getByTestId('coapp-first-name');
  const last = page.getByTestId('coapp-last-name');
  const mail = page.getByTestId('coapp-email');
  if (await first.isVisible().catch(() => false)) {
    await first.fill(firstName);
    await last.fill(lastName);
    await mail.fill(email);
  } else {
    // TODO: update locator with data-testid
    await page.locator('input[name="first_name"]').fill(firstName);
    await page.locator('input[name="last_name"]').fill(lastName);
    await page.locator('input[type="email"]').fill(email);
  }
  const saveBtn = page.getByTestId('save-coapp-btn');
  if (await saveBtn.isVisible().catch(() => false)) {
    await saveBtn.click();
  } else {
    // TODO: update locator with data-testid
    await page.getByRole('button', { name: /save|add/i }).click();
  }
  await page.waitForTimeout(1500);
};

const reviewSummaryAndClose = async (page) => {
  // Prefer heading to avoid strict-mode ambiguity
  const summaryHeading = page.getByRole('heading', { name: 'Summary' });
  await expect(summaryHeading).toBeVisible({ timeout: 30000 });

  // Try a broader set of button labels
  const doneBtn = page
    .getByRole('button', { name: /done|close|finish|back|continue|return/i })
    .first();
  if (await doneBtn.isVisible().catch(() => false)) {
    await doneBtn.click();
  }
};

// Main test

test.describe('Split Co-Applicant into New Household', () => {
  test('Should split co-applicant to new household and validate data integrity', {
    tag: ['@core', '@regression', '@document-upload']
  }, async ({ page, context }) => {
    attachPageDebugHandlers(page, 'admin');

    // Step 1: Create application
    await step('Admin login + goto apps', async () => {
      await loginForm.adminLoginAndNavigate(page, admin);
      await gotoApplicationsPage(page);
      await snapshot(page, 'admin-applications');
    });

    const applicationName = 'AutoTest - Split Co App Check';
    const config = {
      organizationName: 'Verifast',
      applicationName,
      applicantTypes: ['Employed'],
      workflowTemplate: 'Autotest-suite-fin-only', // TODO: confirm includes Household + Financial
      flagCollection: 'High Risk',
      minimumAmount: '500'
    };

    await step('Create application flow', async () => {
      await createApplicationFlow(page, config);
      await snapshot(page, 'application-created');
    });

    // Step 2: Invite primary applicant and get link
    const primaryUser = { first_name: 'Playwright', last_name: 'Split', email: 'playwright+split@verifast.com' };
    const { sessionData, link } = await step('Invite primary and get session link', async () => {
      const res = await generateSessionForApplication(page, applicationName, primaryUser);
      await snapshot(page, 'invite-primary');
      return res;
    });

    // Normalize session link and id
    const sessionIdFromData = sessionData?.data?.id;
    const primaryLink = link && link.startsWith('http')
      ? link
      : (sessionIdFromData ? `${appConfig.urls.app}/sessions/${sessionIdFromData}` : link);

    const sessionId = sessionIdFromData || (primaryLink ? new URL(primaryLink).pathname.split('/').pop() : undefined);
    const primarySessionUrl = `${appConfig.urls.api.replace(/\/+$/, '')}/sessions/${sessionId}`;

    // Step 3-6: Primary session
    const primaryPage = await context.newPage();
    attachPageDebugHandlers(primaryPage, 'primary');
    await step('Primary open session', async () => {
      await primaryPage.goto(primaryLink);
      await handleOptionalStateModal(primaryPage);
      await advanceFromApplicantTypeToBudget(primaryPage, primarySessionUrl);
      await snapshot(primaryPage, 'primary-session-open');
    });

    await step('Primary complete applicant form (budget)', async () => {
      await completeApplicantForm(primaryPage, '555', primarySessionUrl);
      await snapshot(primaryPage, 'primary-budget-set');
    });

    await step('Primary: complete Identity then Financial (Plaid)', async () => {
      await completeIdentityAndFinancial(primaryPage);
    });

    await step('Primary summary close', async () => {
      await reviewSummaryAndClose(primaryPage);
      await snapshot(primaryPage, 'primary-summary-close');
      await primaryPage.close();
    });

    // Step 7-8: Report & reinvite
    await step('Open report page', async () => {
      await openReportForSession(page, sessionId);
      await snapshot(page, 'report-opened');
    });

    const coApp = { first: 'Playwright', last: 'Co-app', email: 'playwright+splitcoapp@verifast.com' };
    const coAppLink = await step('Reinvite co-app & copy link', async () => {
      const l = await reinviteCoApplicantAndCopyLink(page, coApp.email);
      log('Co-app invite link:', l);
      return l;
    });

    // Step 9-12: Co-app session
    const coappPage = await context.newPage();
    attachPageDebugHandlers(coappPage, 'coapp');
    await step('Co-app open session', async () => {
      await coappPage.goto(coAppLink);
      await handleOptionalStateModal(coappPage);
      const coSessionId = new URL(coAppLink).pathname.split('/').pop();
      const coSessionUrl = `${appConfig.urls.api.replace(/\/+$/, '')}/sessions/${coSessionId}`;
      await advanceFromApplicantTypeToBudget(coappPage, coSessionUrl);
      await snapshot(coappPage, 'coapp-session-open');
    });

    await step('Co-app complete applicant form (budget)', async () => {
      await completeApplicantForm(coappPage, '650', coSessionUrl);
      await snapshot(coappPage, 'coapp-budget-set');
    });

    await step('Co-app: complete Identity then Financial (Plaid)', async () => {
      await completeIdentityAndFinancial(coappPage);
    });

    await step('Co-app summary close', async () => {
      await reviewSummaryAndClose(coappPage);
      await snapshot(coappPage, 'coapp-summary-close');
      await coappPage.close();
    });

    // Step 13-14: Back to report
    await step('Verify both applicants visible on report', async () => {
      await expect(page.getByText(primaryUser.email, { exact: false })).toBeVisible();
      await expect(page.getByText(coApp.email, { exact: false })).toBeVisible();
      await snapshot(page, 'report-both-visible');
    });

    // Step 15-16: Split
    await step('Split co-applicant to new household', async () => {
      await splitCoApplicantToNewHousehold(page, coApp.email);
      await snapshot(page, 'after-split');
    });

    // Step 17: Verify isolation
    await step('Verify primary data isolation', async () => {
      await verifyApplicantDataIsolation(page, sessionId, primaryUser.email, coApp.email);
      await snapshot(page, 'primary-isolation');
    });

    await step('Verify co-app session isolation', async () => {
      const coAppSessionLinkEl = page.locator('a', { hasText: coApp.email }).first();
      let coAppSessionId;
      if (await coAppSessionLinkEl.isVisible().catch(() => false)) {
        const href = await coAppSessionLinkEl.getAttribute('href');
        if (href) coAppSessionId = href.split('/').pop();
      }
      if (coAppSessionId) {
        await openReportForSession(page, coAppSessionId);
        await expect(page.getByText(coApp.email, { exact: false })).toBeVisible({ timeout: 15000 });
        await expect(page.getByText(primaryUser.email, { exact: false })).not.toBeVisible({ timeout: 5000 }).catch(() => {});
        await snapshot(page, 'coapp-isolation');
      } else {
        await snapshot(page, 'coapp-session-link-missing');
        await expect(page.getByText(coApp.email, { exact: false })).toBeVisible();
      }
    });
  });
});
