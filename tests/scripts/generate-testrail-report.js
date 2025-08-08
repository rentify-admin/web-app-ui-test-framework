import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';

dotenv.config();

const TESTRAIL_HOST = process.env.TESTRAIL_HOST;
const TESTRAIL_USER = process.env.TESTRAIL_USER;
const TESTRAIL_API_KEY = process.env.TESTRAIL_API_KEY;

// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {};
    
    for (let i = 0; i < args.length; i += 2) {
        if (args[i].startsWith('--')) {
            const key = args[i].slice(2);
            const value = args[i + 1];
            options[key] = value;
        }
    }
    
    return options;
}

const testrail = axios.create({
    baseURL: `${TESTRAIL_HOST}/index.php?/api/v2/`,
    auth: {
        username: TESTRAIL_USER,
        password: TESTRAIL_API_KEY,
    },
});

async function generateTestRailReport(testrailData, templateId, outputFile) {
    try {
        const testrailInfo = JSON.parse(testrailData);
        
        if (!testrailInfo.runIds || testrailInfo.runIds.length === 0) {
            console.log('No TestRail run IDs found, skipping PDF generation');
            return;
        }

        console.log(`Generating PDF report for ${testrailInfo.runIds.length} TestRail runs`);
        
        // For each run ID, generate a PDF report
        for (const runId of testrailInfo.runIds) {
            try {
                console.log(`Generating PDF for run ID: ${runId}`);
                
                // Call TestRail API to generate PDF report
                const response = await testrail.post(`get_report/${runId}`, {
                    format: 'pdf',
                    template_id: templateId || 1, // Default template ID
                    include_attachments: true,
                    include_comments: true,
                    include_defects: true,
                    include_requirements: true,
                    include_results: true,
                    include_summary: true
                });
                
                if (response.data && response.data.pdf_url) {
                    console.log(`PDF report generated for run ${runId}: ${response.data.pdf_url}`);
                    
                    // Download the PDF
                    const pdfResponse = await axios.get(response.data.pdf_url, {
                        responseType: 'stream',
                        auth: {
                            username: TESTRAIL_USER,
                            password: TESTRAIL_API_KEY,
                        }
                    });
                    
                    // Save the PDF
                    const pdfFileName = `${outputFile}-run-${runId}.pdf`;
                    const writer = fs.createWriteStream(pdfFileName);
                    pdfResponse.data.pipe(writer);
                    
                    await new Promise((resolve, reject) => {
                        writer.on('finish', resolve);
                        writer.on('error', reject);
                    });
                    
                    console.log(`PDF saved as: ${pdfFileName}`);
                } else {
                    console.warn(`No PDF URL returned for run ${runId}`);
                }
                
            } catch (error) {
                console.error(`Error generating PDF for run ${runId}:`, error.message);
                if (error.response) {
                    console.error('TestRail API response:', error.response.data);
                }
            }
        }
        
    } catch (error) {
        console.error('Error generating TestRail PDF report:', error);
        throw error;
    }
}

(async () => {
    try {
        const options = parseArgs();
        const testrailData = options['testrail-data'];
        const templateId = options['template-id'];
        const outputFile = options['output-file'];
        
        if (!testrailData) {
            console.error('Missing required argument: --testrail-data');
            process.exit(1);
        }
        
        if (!outputFile) {
            console.error('Missing required argument: --output-file');
            process.exit(1);
        }
        
        console.log('Generating TestRail PDF report...');
        console.log(`Template ID: ${templateId || 'default'}`);
        console.log(`Output file: ${outputFile}`);
        console.log(`TestRail data length: ${testrailData.length} characters`);
        console.log(`TestRail data preview: ${testrailData.substring(0, 100)}...`);
        
        // Validate JSON before processing
        let parsedData;
        try {
            parsedData = JSON.parse(testrailData);
            console.log('JSON parsed successfully');
            console.log('Parsed data keys:', Object.keys(parsedData));
        } catch (jsonError) {
            console.error('Failed to parse JSON data:', jsonError.message);
            console.error('Raw data:', testrailData);
            process.exit(1);
        }
        
        await generateTestRailReport(testrailData, templateId, outputFile);
        
        console.log('TestRail PDF report generation completed');
        
    } catch (error) {
        console.error('Fatal error in generate-testrail-report.js:', error);
        process.exit(1);
    }
})(); 