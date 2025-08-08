#!/bin/bash

# Local Regression Execution with TestRail Reports
# This script runs all tests in develop with retry configuration and generates TestRail reports

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BROWSER="chromium"
MAX_RETRIES=3
TIMEOUT=300000  # 5 minutes per test

# Environment configuration
DEFAULT_ENV="develop"
ENV_FILE=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --env)
            ENV_FILE="tests/.env.$2"
            shift 2
            ;;
        --staging)
            ENV_FILE="tests/.env.staging"
            shift
            ;;
        --develop)
            ENV_FILE="tests/.env.develop"
            shift
            ;;
        --skip-document-upload)
            SKIP_DOCUMENT_UPLOAD=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --env ENV        Use specific environment file (tests/.env.ENV)"
            echo "  --staging        Use staging environment (tests/.env.staging)"
            echo "  --develop        Use develop environment (tests/.env.develop) [default]"
            echo "  --skip-document-upload  Skip tests tagged with @document-upload"
            echo "  --help, -h       Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                    # Run against develop (default)"
            echo "  $0 --develop          # Run against develop"
            echo "  $0 --staging          # Run against staging"
            echo "  $0 --env production   # Run against tests/.env.production"
            echo "  $0 --develop --skip-document-upload  # Run develop without document upload tests"
            echo ""
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Set default environment if not specified
if [ -z "$ENV_FILE" ]; then
    ENV_FILE="tests/.env.develop"
fi

# Set test run name based on environment
ENV_NAME=$(echo "$ENV_FILE" | sed 's/tests\/\.env\.//')
TEST_RUN_NAME="Local Regression Run - $ENV_NAME - $TIMESTAMP"

# Set skip document upload flag
SKIP_DOCUMENT_UPLOAD=${SKIP_DOCUMENT_UPLOAD:-false}

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Local Regression Execution Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${YELLOW}Timestamp:${NC} $TIMESTAMP"
echo -e "${YELLOW}Environment:${NC} $ENV_NAME"
echo -e "${YELLOW}Environment File:${NC} $ENV_FILE"
echo -e "${YELLOW}Test Run Name:${NC} $TEST_RUN_NAME"
echo -e "${YELLOW}Browser:${NC} $BROWSER"
echo -e "${YELLOW}Max Retries:${NC} $MAX_RETRIES"
echo -e "${YELLOW}Timeout per test:${NC} ${TIMEOUT}ms"
echo -e "${YELLOW}Skip Document Upload Tests:${NC} $SKIP_DOCUMENT_UPLOAD"
echo ""

# Function to check if required environment variables are set
check_environment() {
    echo -e "${BLUE}Checking environment variables...${NC}"
    
    local required_vars=(
        "TESTRAIL_HOST"
        "TESTRAIL_PROJECT_NAME" 
        "TESTRAIL_USER"
        "TESTRAIL_API_KEY"
        "TESTRAIL_SUITE_ID"
    )
    
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        echo -e "${RED}❌ Missing required environment variables:${NC}"
        for var in "${missing_vars[@]}"; do
            echo -e "${RED}   - $var${NC}"
        done
        echo ""
        echo -e "${YELLOW}Please set these variables in your $ENV_FILE file or export them:${NC}"
        echo "export TESTRAIL_HOST='your-testrail-host'"
        echo "export TESTRAIL_PROJECT_NAME='your-project-name'"
        echo "export TESTRAIL_USER='your-username'"
        echo "export TESTRAIL_API_KEY='your-api-key'"
        echo "export TESTRAIL_SUITE_ID='your-suite-id'"
        echo ""
        echo -e "${YELLOW}Available environment files:${NC}"
        ls -la tests/.env.* 2>/dev/null || echo "No tests/.env.* files found"
        echo ""
        exit 1
    fi
    
    echo -e "${GREEN}✅ All required environment variables are set${NC}"
    echo ""
}

# Function to install dependencies
install_dependencies() {
    echo -e "${BLUE}Installing dependencies...${NC}"
    
    # Install npm dependencies
    echo -e "${YELLOW}Installing npm dependencies...${NC}"
    npm ci
    
    # Install Playwright browsers
    echo -e "${YELLOW}Installing Playwright browsers...${NC}"
    npx playwright install
    
    # Add trcli to PATH if not already there
    if ! command -v trcli &> /dev/null; then
        echo -e "${YELLOW}Adding trcli to PATH...${NC}"
        export PATH="/Users/isecco/Library/Python/3.11/bin:$PATH"
    fi
    
    echo -e "${GREEN}✅ Dependencies installed successfully${NC}"
    echo ""
}

# Function to update Playwright config for retries
update_playwright_config() {
    echo -e "${BLUE}Updating Playwright configuration for retries...${NC}"
    
    # Create backup of original config
    cp playwright.config.js playwright.config.js.backup
    
    # Update retry configuration
    sed -i.bak "s/retries: isCI ? [0-9]* : [0-9]*/retries: $MAX_RETRIES/g" playwright.config.js
    sed -i.bak "s/timeout: [0-9_]*/timeout: $TIMEOUT/g" playwright.config.js
    
    echo -e "${GREEN}✅ Playwright configuration updated${NC}"
    echo -e "${YELLOW}   - Retries: $MAX_RETRIES${NC}"
    echo -e "${YELLOW}   - Timeout: ${TIMEOUT}ms${NC}"
    echo ""
}

# Function to restore original Playwright config
restore_playwright_config() {
    echo -e "${BLUE}Restoring original Playwright configuration...${NC}"
    mv playwright.config.js.backup playwright.config.js
    rm -f playwright.config.js.bak
    echo -e "${GREEN}✅ Original configuration restored${NC}"
    echo ""
}

# Function to run tests
run_tests() {
    echo -e "${BLUE}Running all tests against $ENV_NAME environment...${NC}"
    echo -e "${YELLOW}This may take a while...${NC}"
    echo ""
    
    # Set environment variables for the test run
    export PLAYWRIGHT_JUNIT_OUTPUT_NAME="playwright-report/results-${BROWSER}-${ENV_NAME}-${TIMESTAMP}.xml"
    
    # Build the test command
    local test_cmd="npx playwright test --project=${BROWSER}"
    
    # Add document upload filter if requested
    if [ "$SKIP_DOCUMENT_UPLOAD" = true ]; then
        echo -e "${YELLOW}Skipping tests tagged with @document-upload${NC}"
        test_cmd="$test_cmd --grep-invert '@document-upload'"
    fi
    
    # Run tests with the specified browser
    case $BROWSER in
        "chromium")
            eval "$test_cmd"
            ;;
        "firefox")
            eval "$test_cmd"
            ;;
        "webkit")
            eval "$test_cmd"
            ;;
        *)
            echo -e "${RED}❌ Invalid browser: $BROWSER${NC}"
            exit 1
            ;;
    esac
    
    echo ""
    echo -e "${GREEN}✅ Tests completed${NC}"
    echo ""
}

# Function to generate TestRail report
generate_testrail_report() {
    echo -e "${BLUE}Generating TestRail report...${NC}"
    
    local results_file="playwright-report/results-${BROWSER}-${ENV_NAME}-${TIMESTAMP}.xml"
    
    if [ ! -f "$results_file" ]; then
        echo -e "${RED}❌ Test results file not found: $results_file${NC}"
        return 1
    fi
    
    echo -e "${YELLOW}Uploading results to TestRail...${NC}"
    
    # Ensure trcli is in PATH
    export PATH="/Users/isecco/Library/Python/3.11/bin:$PATH"
    
    # Use trcli to upload results to TestRail
    trcli -y \
        -h "$TESTRAIL_HOST" \
        --project "$TESTRAIL_PROJECT_NAME" \
        --username "$TESTRAIL_USER" \
        --key "$TESTRAIL_API_KEY" \
        parse_junit \
        --title "$TEST_RUN_NAME" \
        --suite-id "$TESTRAIL_SUITE_ID" \
        --run-description "Local regression run against $ENV_NAME on $(date)" \
        --file "$results_file"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ TestRail report generated successfully${NC}"
    else
        echo -e "${RED}❌ Failed to generate TestRail report${NC}"
        return 1
    fi
    
    echo ""
}

# Function to show test results
show_results() {
    echo -e "${BLUE}Test Results Summary${NC}"
    echo -e "${BLUE}==================${NC}"
    
    local results_file="playwright-report/results-${BROWSER}-${ENV_NAME}-${TIMESTAMP}.xml"
    
    if [ -f "$results_file" ]; then
        echo -e "${YELLOW}Results file:${NC} $results_file"
        
        # Extract test statistics from XML
        local total_tests=$(grep -c '<testcase' "$results_file" || echo "0")
        local failed_tests=$(grep -c '<failure' "$results_file" || echo "0")
        local skipped_tests=$(grep -c '<skipped' "$results_file" || echo "0")
        local passed_tests=$((total_tests - failed_tests - skipped_tests))
        
        echo -e "${YELLOW}Total tests:${NC} $total_tests"
        echo -e "${GREEN}Passed:${NC} $passed_tests"
        echo -e "${RED}Failed:${NC} $failed_tests"
        echo -e "${YELLOW}Skipped:${NC} $skipped_tests"
        
        if [ $failed_tests -gt 0 ]; then
            echo ""
            echo -e "${RED}Failed tests:${NC}"
            grep -A 1 '<failure' "$results_file" | grep 'name=' | sed 's/.*name="\([^"]*\)".*/- \1/'
        fi
    else
        echo -e "${RED}❌ Results file not found${NC}"
    fi
    
    echo ""
}

# Function to open HTML report
open_html_report() {
    echo -e "${BLUE}Opening HTML report...${NC}"
    npx playwright show-report &
    echo -e "${GREEN}✅ HTML report opened in browser${NC}"
    echo ""
}

# Function to cleanup
cleanup() {
    echo -e "${BLUE}Cleaning up...${NC}"
    
    # Remove temporary files
    rm -f playwright.config.js.bak
    
    echo -e "${GREEN}✅ Cleanup completed${NC}"
    echo ""
}

# Main execution
main() {
    echo -e "${BLUE}Starting Local Regression Execution...${NC}"
    echo ""
    
    # Check if environment file exists
    if [ ! -f "$ENV_FILE" ]; then
        echo -e "${RED}❌ Environment file not found: $ENV_FILE${NC}"
        echo ""
        echo -e "${YELLOW}Available environment files:${NC}"
        ls -la tests/.env.* 2>/dev/null || echo "No tests/.env.* files found"
        echo ""
        echo -e "${YELLOW}Usage examples:${NC}"
        echo "  $0                    # Run against develop (default)"
        echo "  $0 --develop          # Run against develop"
        echo "  $0 --staging          # Run against staging"
        echo "  $0 --env production   # Run against tests/.env.production"
        echo ""
        exit 1
    fi
    
    # Load environment variables from specified .env file
    echo -e "${BLUE}Loading environment variables from $ENV_FILE...${NC}"
    export $(grep -v '^#' "$ENV_FILE" | xargs)
    echo -e "${GREEN}✅ Environment variables loaded from $ENV_FILE${NC}"
    echo ""
    
    # Check environment
    check_environment
    
    # Install dependencies
    install_dependencies
    
    # Update Playwright config
    update_playwright_config
    
    # Set trap to restore config on exit
    trap restore_playwright_config EXIT
    
    # Run tests
    run_tests
    
    # Generate TestRail report
    generate_testrail_report
    
    # Show results
    show_results
    
    # Open HTML report
    open_html_report
    
    # Cleanup
    cleanup
    
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Local Regression Execution Complete!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "${YELLOW}Environment:${NC} $ENV_NAME"
    echo -e "${YELLOW}Test Run:${NC} $TEST_RUN_NAME"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo -e "${YELLOW}1. Review the HTML report in your browser${NC}"
    echo -e "${YELLOW}2. Check TestRail for the uploaded results${NC}"
    echo -e "${YELLOW}3. Investigate any failed tests${NC}"
    echo ""
}

# Run main function
main "$@" 