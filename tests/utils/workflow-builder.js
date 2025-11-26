import { app } from './../test_config';

function getHeaders(token, options = {}) {
    const headers = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
    };
    // If Content-Type needs to be included (for POST/PATCH), allow withContentType option
    if (options.withContentType) {
        headers['Content-Type'] = 'application/json';
    }
    return headers;
}

class WorkflowBuilder {
    constructor(request, workflowTemplate, token) {
        this.request = request;
        this.app = app;
        this.workflowTemplate = workflowTemplate;
        this.token = token;
        this.workflowDisplayName = workflowTemplate.split('-').join(' ');
        this.workflowId = null;
        this.workflow = null;
        this.taskTypes = [];
        this.documentTypes = [];
        this.providers = [];
        this.createdSteps = [];
        console.log(`[WorkflowBuilder] Initialized with template: ${this.workflowTemplate}`);
    }

    /**
     * Check if workflow exists by name, return workflow object if found, else null.
     */
    async checkWorkflowExists() {
        console.log('[WorkflowBuilder] Checking if workflow exists...');
        let workflowResponse = await this.request.get(
            `${this.app.urls.api}/workflows`,
            {
                headers: getHeaders(this.token),
                params: JSON.stringify({
                    "$and": {
                        "name": this.workflowTemplate,
                        "status": { "$in": ["READY", "PUBLISHED"] }
                    }
                })
            }
        );
        let workflowJson = workflowResponse.ok() ? await workflowResponse.json() : null;
        if (workflowJson && workflowJson.data && workflowJson.data.length > 0) {
            console.log(`[WorkflowBuilder] Workflow found: id=${workflowJson.data[0].id}, name=${workflowJson.data[0].name}`);
            return workflowJson.data[0];
        }
        console.log('[WorkflowBuilder] Workflow not found');
        return null;
    }

    /**
     * Checks for workflow existence and creates it if not present.
     * Sets this.workflow and this.workflowId
     */
    async checkOrCreateWorkflow() {
        console.log('[WorkflowBuilder] Step 1: Checking or creating workflow');
        // Use the new checkWorkflowExists helper for existence check
        this.workflow = await this.checkWorkflowExists();

        // Use workflow if exists, else create it
        if (this.workflow) {
            this.workflowId = this.workflow.id;
            console.log(`[WorkflowBuilder] Workflow exists: id=${this.workflowId}, name=${this.workflow.name}`);
        } else {
            console.log('[WorkflowBuilder] Workflow does not exist, creating...');
            const createWorkflowResp = await this.request.post(
                `${this.app.urls.api}/workflows`,
                {
                    headers: getHeaders(this.token, { withContentType: true }),
                    data: {
                        display_name: this.workflowDisplayName,
                        name: this.workflowTemplate,
                        restrictions: { countries: [], administrative_areas: [] }
                    }
                }
            );
            if (!createWorkflowResp.ok()) {
                throw new Error(`Failed to create workflow: ${await createWorkflowResp.text()}`);
            }
            const workflowCreated = await createWorkflowResp.json();
            this.workflowId = workflowCreated.data.id;
            this.workflow = workflowCreated.data;
            console.log(`[WorkflowBuilder] Created workflow id=${this.workflowId} (${this.workflow.name})`);
        }
    }

    async getRequiredData() {
        console.log('[WorkflowBuilder] Step 2: Getting required data (task types, document types, settings, providers, steps)');
        // 4. Get task types
        const taskTypesResp = await this.request.get(
            `${this.app.urls.api}/task-types`,
            { headers: getHeaders(this.token) }
        );
        if (!taskTypesResp.ok()) {
            throw new Error("Could not get task types");
        }
        this.taskTypes = (await taskTypesResp.json()).data;
        console.log(`[WorkflowBuilder] Got ${this.taskTypes.length} task types`);

        // 6. Get document types with fields
        const documentTypesResp = await this.request.get(
            `${this.app.urls.api}/document-types?fields[document_type]=id,name,key&order=created_at:desc&limit=1000&page=1`,
            { headers: getHeaders(this.token) }
        );
        if (!documentTypesResp.ok()) throw new Error("Could not get document types");
        this.documentTypes = (await documentTypesResp.json()).data;
        console.log(`[WorkflowBuilder] Got ${this.documentTypes.length} document types`);

        // 7. Get settings (throw on failure, but don't store)
        const settingsResp = await this.request.get(
            `${this.app.urls.api}/settings?fields[settings]=:all&limit=100`,
            { headers: getHeaders(this.token) }
        );
        if (!settingsResp.ok()) throw new Error("Could not get settings");
        console.log(`[WorkflowBuilder] Got settings`);

        // 8. Get workflow steps (initial fetch, not used later directly)
        const stepsRespInitial = await this.request.get(
            `${this.app.urls.api}/workflows/${this.workflowId}/steps`,
            { headers: getHeaders(this.token) }
        );
        if (!stepsRespInitial.ok()) throw new Error("Could not get workflow steps - initial");
        console.log(`[WorkflowBuilder] Got initial workflow steps`);

        // 9. Get all providers
        const providersResp = await this.request.get(
            `${this.app.urls.api}/providers?fields[provider]=:all`,
            { headers: getHeaders(this.token) }
        );
        if (!providersResp.ok()) throw new Error("Could not get providers");
        this.providers = (await providersResp.json()).data || [];
        console.log(`[WorkflowBuilder] Got ${this.providers.length} providers`);
    }

    /**
     * Create Identity Step with optional override of settings.
     * @param {object} settingsOverrides - Optional identity step settings to override default.
     */
    async createIdentityStep(settingsOverrides = {}) {
        console.log('[WorkflowBuilder] Step 3: Creating Identity step');
        // 10. Find IDENTITY_VERIFICATION task
        const identityTask = this.taskTypes.find(t => t && t.key === "IDENTITY_VERIFICATION");
        if (!identityTask) throw new Error("IDENTITY_VERIFICATION task not found");
        console.log('[WorkflowBuilder] Found IDENTITY_VERIFICATION task');

        // 11. Create Identity Verification Step
        const identityStepResp = await this.request.post(
            `${this.app.urls.api}/workflows/${this.workflowId}/steps`,
            {
                headers: getHeaders(this.token, { withContentType: true }),
                data: {
                    type: "TASK",
                    name: "Identity Verification",
                    description: "",
                    task: identityTask.id
                }
            }
        );
        if (!identityStepResp.ok()) throw new Error("Could not create Identity task step");
        this.identityStep = (await identityStepResp.json()).data;
        console.log(`[WorkflowBuilder] Created Identity Verification step with id=${this.identityStep.id}`);

        // 12. Find Persona provider with IDENTITY service
        const personaProvider = this.providers.find(
            p => p.services && p.services.includes("IDENTITY") && p.name === "Persona"
        );
        if (!personaProvider) throw new Error("Persona provider not found");
        console.log(`[WorkflowBuilder] Found Persona provider for IDENTITY: id=${personaProvider.id}`);

        // 13. PATCH settings for identity step with ability to override via param
        const defaultIdentitySettings = {
            "settings.workflows.tasks.verifications.identity.required": true,
            "settings.workflows.tasks.verifications.identity.skip.authority": "anyone",
            "settings.workflows.tasks.verifications.identity.hidden": false,
            "settings.workflows.tasks.verifications.identity.provider": personaProvider.id,
            "settings.workflows.tasks.verifications.identity.persona_template_id": "itmpl_gQ3heP8ModLLwJt5nxiUTm9S",
            "settings.workflows.tasks.verifications.identity.min_upload": 0,
            "settings.workflows.tasks.verifications.identity.enable_fallback": false
        };

        // Merge settingsOverrides, letting overrides take precedence
        const mergedSettings = {
            ...defaultIdentitySettings,
            ...settingsOverrides
        };

        const identityStepPatch = { settings: mergedSettings };
        console.log(`[WorkflowBuilder] Patching Identity step settings:`, mergedSettings);

        const patchIdentityResp = await this.request.patch(
            `${this.app.urls.api}/workflows/${this.workflowId}/steps/${this.identityStep.id}`,
            {
                headers: getHeaders(this.token, { withContentType: true }),
                data: identityStepPatch
            }
        );
        if (!patchIdentityResp.ok()) throw new Error("Could not PATCH identity step settings");
        console.log('[WorkflowBuilder] Patched Identity step settings successfully');
    }

    /**
     * Create Financial Step with optional override of settings.
     * @param {object} settingsOverrides - Optional financial step settings to override default.
     */
    async createFinancialStep(settingsOverrides = {}) {
        console.log('[WorkflowBuilder] Step 4: Creating Financial step');
        // 15. Find FINANCIAL_VERIFICATION task
        const financialTask = this.taskTypes.find(t => t && t.key === "FINANCIAL_VERIFICATION");
        if (!financialTask) throw new Error("FINANCIAL_VERIFICATION task not found");
        console.log('[WorkflowBuilder] Found FINANCIAL_VERIFICATION task');

        // 16. Find Plaid provider with FINANCIAL service
        const plaidProvider = this.providers.find(
            p => p && p.services && p.services.includes("FINANCIAL") && p.name === "Plaid"
        );
        if (!plaidProvider) throw new Error("Plaid provider not found");
        console.log(`[WorkflowBuilder] Found Plaid provider for FINANCIAL: id=${plaidProvider.id}`);

        // 17. Create Financial Verification Step
        const financialStepResp = await this.request.post(
            `${this.app.urls.api}/workflows/${this.workflowId}/steps`,
            {
                headers: getHeaders(this.token, { withContentType: true }),
                data: {
                    type: "TASK",
                    name: "Financial Verification",
                    description: "",
                    task: financialTask.id
                }
            }
        );
        if (!financialStepResp.ok()) throw new Error("Could not create Financial step");
        this.financialStep = (await financialStepResp.json()).data;
        console.log(`[WorkflowBuilder] Created Financial Verification step with id=${this.financialStep.id}`);

        // 18. PATCH settings for financial step with ability to override via param
        const defaultFinancialSettings = {
            "settings.workflows.tasks.verifications.financial.required": false,
            "settings.workflows.tasks.verifications.financial.skip.authority": "anyone",
            "settings.workflows.tasks.verifications.financial.hidden": false,
            "settings.workflows.tasks.verifications.financial.connection.enabled": true,
            "settings.workflows.tasks.verifications.financial.provider.primary": plaidProvider.id,
            "settings.workflows.tasks.verifications.financial.provider.secondary": plaidProvider.id,
            "settings.workflows.tasks.verifications.financial.max_connections": 1,
            "settings.workflows.tasks.verifications.financial.min_upload": "0",
            "settings.workflows.tasks.verifications.financial.transaction_types": "both"
        };

        const mergedSettings = {
            ...defaultFinancialSettings,
            ...settingsOverrides
        };

        const financialStepPatch = { settings: mergedSettings };
        console.log(`[WorkflowBuilder] Patching Financial step settings:`, mergedSettings);

        const patchFinancialResp = await this.request.patch(
            `${this.app.urls.api}/workflows/${this.workflowId}/steps/${this.financialStep.id}`,
            {
                headers: getHeaders(this.token, { withContentType: true }),
                data: financialStepPatch
            }
        );
        if (!patchFinancialResp.ok()) throw new Error("Could not PATCH financial step settings");
        console.log('[WorkflowBuilder] Patched Financial step settings successfully');
    }

    async fetchCreatedSteps() {
        console.log('[WorkflowBuilder] Step 5: Fetching created steps');
        // 19. Get workflow steps again
        const stepsResp = await this.request.get(
            `${this.app.urls.api}/workflows/${this.workflowId}/steps`,
            { headers: getHeaders(this.token) }
        );
        if (!stepsResp.ok()) throw new Error("Could not get workflow steps after creation");
        this.createdSteps = (await stepsResp.json()).data || [];
        console.log(`[WorkflowBuilder] Fetched ${this.createdSteps.length} steps from workflow`);
    }

    getStepByType(type, key = null) {
        if (type === "TASK" && key) {
            return this.createdSteps.find(
                s => s &&
                    s.type === "TASK" &&
                    s.task &&
                    s.task.key === key
            );
        }
        return this.createdSteps.find(s => s && s.type === type);
    }

    async createPaths() {
        console.log('[WorkflowBuilder] Step 6: Creating workflow paths (start->identity->financial->end)');
        // 20. Find start step (type === START)
        const startStep = this.getStepByType("START");
        if (!startStep) throw new Error("Start step not found");
        console.log(`[WorkflowBuilder] Found Start step: id=${startStep.id}`);

        // 21. Find end step (type === END)
        const endStep = this.getStepByType("END");
        if (!endStep) throw new Error("End step not found");
        console.log(`[WorkflowBuilder] Found End step: id=${endStep.id}`);

        // 22. Find identity step (type === TASK, task.key === IDENTITY_VERIFICATION)
        const identityStepFinal = this.getStepByType("TASK", "IDENTITY_VERIFICATION");
        if (!identityStepFinal) throw new Error("Final Identity step not found");
        console.log(`[WorkflowBuilder] Found Identity step: id=${identityStepFinal.id}`);

        // 23. Find financial step (type === TASK, task.key === FINANCIAL_VERIFICATION)
        const financialStepFinal = this.getStepByType("TASK", "FINANCIAL_VERIFICATION");
        if (!financialStepFinal) throw new Error("Final Financial step not found");
        console.log(`[WorkflowBuilder] Found Financial step: id=${financialStepFinal.id}`);

        // 24. POST path from start to identity step
        const path1Resp = await this.request.post(
            `${this.app.urls.api}/workflows/${this.workflowId}/paths`,
            {
                headers: getHeaders(this.token, { withContentType: true }),
                data: { from: startStep.id, to: identityStepFinal.id }
            }
        );
        if (!path1Resp.ok()) throw new Error("Could not create path start -> identity");
        console.log(
            `[WorkflowBuilder] Created path: START (${startStep.id}) -> IDENTITY (${identityStepFinal.id})`
        );

        // 25. POST path from identity to financial step
        const path2Resp = await this.request.post(
            `${this.app.urls.api}/workflows/${this.workflowId}/paths`,
            {
                headers: getHeaders(this.token, { withContentType: true }),
                data: { from: identityStepFinal.id, to: financialStepFinal.id }
            }
        );
        if (!path2Resp.ok()) throw new Error("Could not create path identity -> financial");
        console.log(
            `[WorkflowBuilder] Created path: IDENTITY (${identityStepFinal.id}) -> FINANCIAL (${financialStepFinal.id})`
        );

        // 26. POST path from financial to end step
        const path3Resp = await this.request.post(
            `${this.app.urls.api}/workflows/${this.workflowId}/paths`,
            {
                headers: getHeaders(this.token, { withContentType: true }),
                data: { from: financialStepFinal.id, to: endStep.id }
            }
        );
        if (!path3Resp.ok()) throw new Error("Could not create path financial -> end");
        console.log(
            `[WorkflowBuilder] Created path: FINANCIAL (${financialStepFinal.id}) -> END (${endStep.id})`
        );
    }

    /**
     * Complete workflow creation, accepts settings overrides for steps.
     * @param {object} options - Optional overrides for step settings.
     * @param {object} options.identitySettings - Settings to override for identity step.
     * @param {object} options.financialSettings - Settings to override for financial step.
     */
    async fullWorkflowCreationFlow(options = {}) {
        console.log('[WorkflowBuilder] Initiating full workflow creation flow');
        await this.checkOrCreateWorkflow();
        await this.getRequiredData();
        await this.createIdentityStep(options.identitySettings || {});
        await this.createFinancialStep(options.financialSettings || {});
        await this.fetchCreatedSteps();
        await this.createPaths();
        console.log('[WorkflowBuilder] Workflow creation completed');
    }
}

export default WorkflowBuilder;