#!/bin/bash

# TestRail TRCLI Examples
# This script contains examples of common TRCLI commands for reference

# Load environment variables
source .env

echo "🔧 TestRail TRCLI Examples"
echo "=========================="
echo ""

# Example 1: Get all cases from a suite
echo "1. Get all cases from Master suite:"
echo "trcli -y -h \"$TESTRAIL_HOST\" --project \"$TESTRAIL_PROJECT_NAME\" --username \"$TESTRAIL_USER\" --key \"$TESTRAIL_API_KEY\" get_cases --suite-id $TESTRAIL_SUITE_ID"
echo ""

# Example 2: Create a new case
echo "2. Create a new test case:"
echo "trcli -y -h \"$TESTRAIL_HOST\" --project \"$TESTRAIL_PROJECT_NAME\" --username \"$TESTRAIL_USER\" --key \"$TESTRAIL_API_KEY\" add_case \\"
echo "  --suite-id $TESTRAIL_SUITE_ID \\"
echo "  --title \"C43 - New Test Case\" \\"
echo "  --type-id 1 \\"
echo "  --priority-id 2 \\"
echo "  --custom-automation-id \"C43\" \\"
echo "  --custom-tags \"@core,@smoke,@regression\" \\"
echo "  --custom-description \"Automatically created test case\""
echo ""

# Example 3: Update an existing case
echo "3. Update an existing case:"
echo "trcli -y -h \"$TESTRAIL_HOST\" --project \"$TESTRAIL_PROJECT_NAME\" --username \"$TESTRAIL_USER\" --key \"$TESTRAIL_API_KEY\" update_case \\"
echo "  --case-id 123 \\"
echo "  --custom-tags \"@core,@smoke,@regression,@newtag\""
echo ""

# Example 4: Get case by ID
echo "4. Get a specific case by ID:"
echo "trcli -y -h \"$TESTRAIL_HOST\" --project \"$TESTRAIL_PROJECT_NAME\" --username \"$TESTRAIL_USER\" --key \"$TESTRAIL_API_KEY\" get_case --case-id 123"
echo ""

# Example 5: Create a test run
echo "5. Create a test run:"
echo "trcli -y -h \"$TESTRAIL_HOST\" --project \"$TESTRAIL_PROJECT_NAME\" --username \"$TESTRAIL_USER\" --key \"$TESTRAIL_API_KEY\" add_run \\"
echo "  --suite-id $TESTRAIL_SUITE_ID \\"
echo "  --name \"Automated Test Run - $(date)\" \\"
echo "  --description \"Test run created by automation\""
echo ""

# Example 6: Parse JUnit results
echo "6. Parse JUnit XML results:"
echo "trcli -y -h \"$TESTRAIL_HOST\" --project \"$TESTRAIL_PROJECT_NAME\" --username \"$TESTRAIL_USER\" --key \"$TESTRAIL_API_KEY\" parse_junit \\"
echo "  --title \"Automated Tests from Local Run\" \\"
echo "  --suite-id $TESTRAIL_SUITE_ID \\"
echo "  --run-description \"Local run on $(date)\" \\"
echo "  --file playwright-report/results.xml"
echo ""

# Example 7: Get project information
echo "7. Get project information:"
echo "trcli -y -h \"$TESTRAIL_HOST\" --project \"$TESTRAIL_PROJECT_NAME\" --username \"$TESTRAIL_USER\" --key \"$TESTRAIL_API_KEY\" get_projects"
echo ""

# Example 8: Get suites in project
echo "8. Get all suites in project:"
echo "trcli -y -h \"$TESTRAIL_HOST\" --project \"$TESTRAIL_PROJECT_NAME\" --username \"$TESTRAIL_USER\" --key \"$TESTRAIL_API_KEY\" get_suites"
echo ""

echo "📝 Notes:"
echo "- Replace placeholder values (like case-id 123) with actual values"
echo "- Ensure all environment variables are set in .env file"
echo "- Use -y flag to skip confirmations in automated scripts"
echo "- Check TRCLI documentation for more options: https://github.com/TestRail/testrail-api2-client-cli" 