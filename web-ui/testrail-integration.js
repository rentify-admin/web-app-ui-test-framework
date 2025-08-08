const fetch = require('node-fetch');

class TestRailWebUI {
    constructor(config) {
        this.host = config.host;
        this.user = config.user;
        this.apiKey = config.apiKey;
        this.projectId = config.projectId;
        this.suiteId = config.suiteId;
    }

    async request(endpoint, method = 'GET') {
        const url = `${this.host}/index.php?/api/v2/${endpoint}`;
        const auth = Buffer.from(`${this.user}:${this.apiKey}`).toString('base64');

        const response = await fetch(url, {
            method,
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`TestRail API error: ${response.status} - ${response.statusText}`);
        }

        return response.json();
    }

    async getTestCases() {
        try {
            const cases = await this.request(`get_cases/${this.projectId}&suite_id=${this.suiteId}`);
            
            return cases.map(testCase => ({
                id: testCase.id,
                title: testCase.title,
                description: testCase.custom_preconds || testCase.custom_steps_separated?.map(step => step.content).join('\n') || '',
                tags: this.extractTags(testCase.custom_steps_separated || []),
                priority: testCase.priority_id,
                type: testCase.type_id
            }));
        } catch (error) {
            console.error('Error fetching test cases:', error);
            // Return sample data if TestRail is not available
            return this.getSampleTestCases();
        }
    }

    extractTags(steps) {
        const tags = [];
        const text = steps.map(step => step.content).join(' ');
        
        if (text.toLowerCase().includes('smoke')) tags.push('smoke');
        if (text.toLowerCase().includes('regression')) tags.push('regression');
        if (text.toLowerCase().includes('document') || text.toLowerCase().includes('upload')) tags.push('document-upload');
        if (text.toLowerCase().includes('employment')) tags.push('employment-verification');
        if (text.toLowerCase().includes('financial')) tags.push('financial-verification');
        
        return tags.length > 0 ? tags : ['regression'];
    }

    getSampleTestCases() {
        return [
            { id: 1, title: "Frontend Heartbeat", description: "Basic frontend connectivity test", tags: ["smoke"] },
            { id: 2, title: "User Login", description: "User authentication flow", tags: ["smoke", "regression"] },
            { id: 3, title: "Document Upload", description: "File upload functionality", tags: ["regression", "document-upload"] },
            { id: 4, title: "Employment Verification", description: "Employment verification flow", tags: ["regression", "employment-verification"] },
            { id: 5, title: "Financial Verification", description: "Financial verification flow", tags: ["regression", "financial-verification"] },
            { id: 6, title: "Application Flow", description: "Complete application process", tags: ["regression"] },
            { id: 7, title: "Bank Statement Parsing", description: "Bank statement processing", tags: ["regression"] },
            { id: 8, title: "Report Generation", description: "Report creation and download", tags: ["regression"] }
        ];
    }

    async getTestCasesByTag(tag) {
        const cases = await this.getTestCases();
        return cases.filter(testCase => testCase.tags.includes(tag));
    }

    async getTestCasesByPriority(priority) {
        const cases = await this.getTestCases();
        return cases.filter(testCase => testCase.priority === priority);
    }
}

// Export for use in other modules
module.exports = TestRailWebUI;

// CLI usage
if (require.main === module) {
    const config = {
        host: process.env.TESTRAIL_HOST,
        user: process.env.TESTRAIL_USER,
        apiKey: process.env.TESTRAIL_API_KEY,
        projectId: process.env.TESTRAIL_PROJECT_ID,
        suiteId: process.env.TESTRAIL_SUITE_ID
    };

    const testrail = new TestRailWebUI(config);

    async function main() {
        try {
            console.log('🔍 Fetching test cases from TestRail...');
            const cases = await testrail.getTestCases();
            console.log(`✅ Found ${cases.length} test cases`);
            
            console.log('\n📋 Test Cases:');
            cases.forEach(testCase => {
                console.log(`  ${testCase.id}. ${testCase.title} [${testCase.tags.join(', ')}]`);
            });

            console.log('\n🏷️  Available Tags:');
            const allTags = [...new Set(cases.flatMap(c => c.tags))];
            allTags.forEach(tag => {
                const count = cases.filter(c => c.tags.includes(tag)).length;
                console.log(`  ${tag}: ${count} test cases`);
            });

        } catch (error) {
            console.error('❌ Error:', error.message);
        }
    }

    main();
}
