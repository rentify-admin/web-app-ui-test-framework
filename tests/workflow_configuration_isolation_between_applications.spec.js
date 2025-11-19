import { test, expect } from './fixtures/api-data-fixture';
import loginForm from '~/tests/utils/login-form';
import { admin } from './test_config';
import { createApplicationFlow } from './utils/application-management';
import { cleanupApplication } from './utils/cleanup-helper';
import { 
    gotoApplicationEditById,
    configureFinancialStep,
    verifyFinancialStepConfiguration 
} from './utils/application-edit-flow';
import { generateUniqueName } from './utils/common';

// Global state for cleanup
let application1 = { name: null, id: null };
let application2 = { name: null, id: null };

test.describe('Workflow Configuration Isolation Between Applications', () => {
    test.describe.configure({
        mode: 'serial',
        timeout: 250_000
    });

    test.afterAll(async ({ request }) => {
        console.log('🧹 Starting cleanup...');
        try {
            if (application1.id) {
                await cleanupApplication(request, application1.id, true);
                console.log(`✅ Cleaned up Application 1: ${application1.name}`);
            }
            if (application2.id) {
                await cleanupApplication(request, application2.id, true);
                console.log(`✅ Cleaned up Application 2: ${application2.name}`);
            }
        } catch (error) {
            console.log(`⚠️ Cleanup error: ${error.message}`);
        }
    });

    test('Should isolate workflow configuration changes between applications using same template', { 
        tag: ['@core', '@regression', '@staging-ready', '@rc-ready'],
    }, async ({ page }) => {
        console.log('='.repeat(80));
        console.log('🧪 TEST: Workflow Configuration Isolation');
        console.log('='.repeat(80));

        // ========================================================================
        // STEP 1: Login as Admin
        // ========================================================================
        console.log('\n📍 STEP 1: Login as Admin');
        await page.goto('/');
        await loginForm.fill(page, admin);
        await loginForm.submitAndSetLocale(page);
        await expect(page.getByTestId('applicants-menu')).toBeVisible();
        console.log('✅ Admin logged in successfully');

        // ========================================================================
        // STEP 2: Create Application 1
        // ========================================================================
        console.log('\n📍 STEP 2: Create Application 1');
        
        application1.name = generateUniqueName('AutoTest Workflow_Isolation_1');
        
        const app1Config = {
            organizationName: 'Verifast',
            applicationName: application1.name,
            applicantTypes: [
                'Affordable Occupant',
                'Affordable Primary', 
                'Employed',
                'International',
                'Self-Employed',
                'Other'
            ],
            workflowTemplate: 'Autotest-full-id-fin-employ-simulation',
            flagCollection: 'High Risk',
            minimumAmount: '500'
        };

        console.log(`Creating Application 1: ${application1.name}`);
        const app1Responses = await createApplicationFlow(page, app1Config);
        application1.id = app1Responses.applicationId;
        console.log(`✅ Application 1 created with ID: ${application1.id}`);

        // ========================================================================
        // STEP 3: Create Application 2 (Same Workflow Template)
        // ========================================================================
        console.log('\n📍 STEP 3: Create Application 2 (Same Workflow)');
        
        application2.name = generateUniqueName('AutoTest Workflow_Isolation_2');

        const app2Config = {
            organizationName: 'Verifast',
            applicationName: application2.name,
            applicantTypes: [
                'Affordable Occupant',
                'Affordable Primary', 
                'Employed',
                'International',
                'Self-Employed',
                'Other'
            ],
            workflowTemplate: 'Autotest-full-id-fin-employ-simulation', // SAME WORKFLOW
            flagCollection: 'High Risk',
            minimumAmount: '500'
        };

        console.log(`Creating Application 2: ${application2.name}`);
        const app2Responses = await createApplicationFlow(page, app2Config);
        application2.id = app2Responses.applicationId;
        console.log(`✅ Application 2 created with ID: ${application2.id}`);
        console.log(`📋 Both applications use workflow: "Autotest-full-id-fin-employ-simulation"`);

        // ========================================================================
        // STEP 4: Edit Application 1 - Change Financial Step Configuration
        // ========================================================================
        console.log('\n📍 STEP 4: Edit Application 1 - Financial Step');
        
        // Navigate to Application 1 edit page
        await gotoApplicationEditById(page, application1.id, application1.name);
        console.log(`✅ Navigated to Application 1 edit page`);

        // Define NEW financial configuration for Application 1
        const newFinancialConfig = {
            primaryProvider: 'Plaid',        // Changed from: Simulation
            secondaryProvider: 'MX',          // Changed from: Plaid
            maxConnection: '3',               // Changed from: 1
            retriveTransactionType: 'Credits', // Changed from: Both
            minDoc: '0',
            docs: [
                {
                    testid: 'bank-statement',
                    docType: 'Bank Statement',
                    visibility: ['Always'],
                    policy: 'Sample Bank Statement Policy',
                    maxUpload: '2'
                    // No action field - document will be added (not updated)
                }
            ]
        };

        console.log('Applying new Financial configuration to Application 1:');
        console.log(`  - Primary Provider: Simulation → Plaid`);
        console.log(`  - Secondary Provider: Plaid → MX`);
        console.log(`  - Max Connections: 1 → 3`);
        console.log(`  - Transaction Type: Both → Credits`);

        await configureFinancialStep(page, newFinancialConfig);
        console.log('✅ Application 1 Financial step updated');
        await page.waitForTimeout(5000);

        // ========================================================================
        // STEP 5: Verify Application 1 Changes Were Saved
        // ========================================================================
        console.log('\n📍 STEP 5: Verify Application 1 Has New Configuration');
        
        await verifyFinancialStepConfiguration(page, newFinancialConfig);
        console.log('✅ Application 1 configuration verified successfully');

        // ========================================================================
        // STEP 6: Verify Application 2 Remains UNCHANGED (Original Config)
        // ========================================================================
        console.log('\n📍 STEP 6: Verify Application 2 Remains Unchanged');
        
        // Navigate to Application 2 edit page
        await gotoApplicationEditById(page, application2.id, application2.name);
        console.log(`✅ Navigated to Application 2 edit page`);

        // Define ORIGINAL financial configuration (what Application 2 should still have)
        const originalFinancialConfig = {
            primaryProvider: 'Simulation',    // Original
            secondaryProvider: 'Plaid',       // Original
            maxConnection: '1',               // Original
            retriveTransactionType: 'Both',   // Original
            minDoc: '0'
        };

        console.log('Verifying Application 2 retains original configuration:');
        console.log(`  - Primary Provider: Simulation (unchanged)`);
        console.log(`  - Secondary Provider: Plaid (unchanged)`);
        console.log(`  - Max Connections: 1 (unchanged)`);
        console.log(`  - Transaction Type: Both (unchanged)`);

        await verifyFinancialStepConfiguration(page, originalFinancialConfig);
        console.log('✅ Application 2 configuration verified - UNCHANGED as expected');

        // ========================================================================
        // TEST COMPLETE
        // ========================================================================
        console.log('\n' + '='.repeat(80));
        console.log('✅ TEST PASSED: Workflow isolation verified successfully!');
        console.log('📊 Summary:');
        console.log(`   - Application 1 (${application1.id}): Modified workflow configuration`);
        console.log(`   - Application 2 (${application2.id}): Retained original workflow configuration`);
        console.log(`   - Both applications use the same workflow template but remain isolated`);
        console.log('='.repeat(80));
    });
}); 
