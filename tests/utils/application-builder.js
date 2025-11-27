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

class ApplicationBuilder {
    constructor(request, token) {
        this.request = request;
        this.app = app;
        this.token = token;
    }

    async checkApplicationExists(applicationName) {
        const response = await this.request.get(`${this.app.urls.api}/applications`, {
            params: {
                filters: JSON.stringify({ $and: { name: { $like: applicationName } } })
            },
            headers: getHeaders(this.token)
        });
        const data = await response.json();
        const existingApplications = data?.data || [];
        let applicationExists = false;
        if (Array.isArray(existingApplications) && existingApplications.length > 0) {
            applicationExists = true;
        }
        return {
            applicationExists,
            existingApplications
        };
    }

    /**
     * Creates an application with the necessary pre-requisites and applies relevant configuration.
     * @param {Object} options - Options for application creation.
     * @param {string} options.organizationName - Organization name.
     * @param {string} options.applicationName - Application name.
     * @param {Array} options.applicantTypes - Applicant types; used for settings.
     * @param {string} options.workflowTemplate - Workflow template (name).
     * @param {string} options.flagCollection - Flag Collection name ('High Risk', etc).
     * @param {string|number} options.minimumAmount - Minimum target (500, etc).
     * @param {string} [options.incomeSourceTemplateName='Default'] - Name of the income source template to use.
     * @returns {Promise<{ applicationId: string, workflowId: string, application: object }>}
     */
    async createApplicationFullFlow({
        organizationName,
        applicationName,
        workflowTemplate,
        applicantTypes = [],
        flagCollection = 'High Risk',
        minimumAmount = 500,
        incomeSourceTemplateName = 'Default',
    }) {
        this.workflowTemplate = workflowTemplate;
        // 1. Get Organization by Name
        const orgRes = await this.request.get(`${this.app.urls.api}/organizations`, {
            params: {
                filters: JSON.stringify({ name: organizationName })
            },
            headers: getHeaders(this.token),
        });
        const orgJson = await orgRes.json();
        const orgData = orgJson?.data?.[0];
        if (!orgData) throw new Error(`Organization "${organizationName}" not found`);
        const organizationId = orgData.id;

        // 2. Get all portfolios (not used in POST body but may be needed for advanced scenarios)
        const portfoliosRes = await this.request.get(`${this.app.urls.api}/portfolios`, {
            params: {
                'fields[portfolio]': 'id,name'
            },
            headers: getHeaders(this.token)
        });
        await portfoliosRes.json();

        // 3. Get settings (not directly used here, but could be for applicant types or pdf components)
        const settingsRes = await this.request.get(`${this.app.urls.api}/settings`, {
            params: {
                'fields[setting]': 'options,key',
                'fields[options]': 'label,value',
                order: 'created_at:desc',
                filters: encodeURIComponent(JSON.stringify({
                    key: {
                        $in: [
                            "settings.applications.applicant_types",
                            "settings.applications.pms.pdf.components"
                        ]
                    }
                })),
                limit: '20',
                page: '1'
            },
            headers: getHeaders(this.token)
        });
        await settingsRes.json();

        // 4. POST /applications
        const createAppRes = await this.request.post(`${this.app.urls.api}/applications`, {
            data: {
                organization: organizationId,
                name: applicationName,
                enable_verisync_integration: false,
                address_line_1: "",
                settings: {
                    "settings.applications.applicant_types": applicantTypes,
                    "settings.applications.pms.pdf.upload_trigger": "session_acceptance",
                    "settings.applications.pms.pdf.components": [],
                }
            },
            headers: getHeaders(this.token, { withContentType: true })
        });
        const createAppJson = await createAppRes.json();
        let application = createAppJson.data;
        const applicationId = application.id;

        // 5. Get Workflow by name & status
        const workflowFilter = {
            $and: [
                { name: workflowTemplate },
                { status: { $in: ["READY", "PUBLISHED"] } }
            ]
        };
        const workflowRes = await this.request.get(`${this.app.urls.api}/workflows`, {
            params: {
                filters: JSON.stringify(workflowFilter),
                'fields[workflow]': 'id,name'
            },
            headers: getHeaders(this.token)
        });
        const workflowJson = await workflowRes.json();
        const workflow = workflowJson?.data?.[0];
        if (!workflow) throw new Error(`Workflow "${workflowTemplate}" (READY/PUBLISHED) not found`);
        const workflowId = workflow.id;

        // 6. PATCH application to attach workflow
        const patchAttachWorkflowRes = await this.request.patch(`${this.app.urls.api}/applications/${applicationId}`, {
            headers: getHeaders(this.token, { withContentType: true }),
            data: { workflow: workflowId }
        });
        await patchAttachWorkflowRes.json();

        // 7. Get Income Source Templates (find the one by incomeSourceTemplateName param)
        const istResp = await this.request.get(`${this.app.urls.api}/income-source-templates`, {
            params: {
                'fields[income_source_template]': 'id,name'
            },
            headers: getHeaders(this.token)
        });
        const istJson = await istResp.json();
        const ist = istJson?.data?.find(
            t => String(t.name).toLowerCase() === String(incomeSourceTemplateName).toLowerCase()
        );
        if (!ist) throw new Error(`Income source template "${incomeSourceTemplateName}" not found`);
        const incomeSourceTemplateId = ist.id;

        // 8. Get Flag Collections (find flag collection by flagCollection param)
        const fcRes = await this.request.get(`${this.app.urls.api}/flag-collections`, {
            params: {
                'fields[flag_collection]': 'id,name,flags'
            },
            headers: getHeaders(this.token)
        });
        const fcJson = await fcRes.json();
        const flagColl = fcJson?.data?.find(fc => String(fc.name).toLowerCase() === String(flagCollection).toLowerCase());
        if (!flagColl) throw new Error(`Flag Collection "${flagCollection}" not found`);
        const flagCollectionId = flagColl.id;

        // 9. PATCH /applications/{application.id} to set advanced settings and flag collection
        const patchAppRes1 = await this.request.patch(`${this.app.urls.api}/applications/${applicationId}`, {
            data: {
                settings: {
                    "settings.applications.income.ratio.type": "gross",
                    "settings.applications.income.ratio.target": 300,
                    "settings.applications.income.ratio.target.conditional": 300,
                    "settings.applications.income.ratio.guarantor": 500,
                    "settings.applications.income.source_template": incomeSourceTemplateId,
                    "settings.applications.target.enabled": 1,
                    "settings.applications.target.required": 1,
                    "settings.applications.target.default": "",
                    "settings.applications.target.locked": 0,
                    "settings.applications.target.range.min": Number(minimumAmount),
                    "settings.applications.target.range.max": 10000,
                    "settings.applications.fast_entry": 0
                },
                flag_collection: flagCollectionId
            },
            headers: getHeaders(this.token, { withContentType: true })
        });
        await patchAppRes1.json();

        const patchAppRes2 = await this.request.patch(`${this.app.urls.api}/applications/${applicationId}`, {
            data: {
                settings: {
                    "settings.applications.income.ratio.type": "gross",
                    "settings.applications.income.ratio.target": 300,
                    "settings.applications.income.ratio.target.conditional": 300,
                    "settings.applications.income.ratio.guarantor": 500,
                    "settings.applications.income.source_template": incomeSourceTemplateId,
                    "settings.applications.target.enabled": 1,
                    "settings.applications.target.required": 1,
                    "settings.applications.target.default": "",
                    "settings.applications.target.locked": 0,
                    "settings.applications.target.range.min": Number(minimumAmount),
                    "settings.applications.target.range.max": 10000,
                    "settings.applications.fast_entry": 0
                },
                flag_collection: flagCollectionId
            },
            headers: getHeaders(this.token, { withContentType: true })
        });

        await patchAppRes2.json();

        const patchAppRes3 = await this.request.patch(`${this.app.urls.api}/applications/${applicationId}`, {
            data: {
                published: true
            },
            headers: getHeaders(this.token, { withContentType: true })
        });
        const applicationJson = await patchAppRes3.json()
        application = applicationJson.data;

        return {
            applicationId,
            workflowId,
            application
        };
    }
}

export default ApplicationBuilder;