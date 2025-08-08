#!/bin/bash

# Local test runner for debugging TestRail integration
# Usage: ./run-tests-for-debug.sh [tag]
# Example: ./run-tests-for-debug.sh core

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[DEBUG]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get tag from command line argument
TAG=${1:-core}

print_status "Starting debug test run for tag: @$TAG"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the web-app directory."
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_warning ".env file not found. Please ensure TestRail environment variables are set."
fi

# Clean up previous reports
print_status "Cleaning up previous test reports..."
rm -rf playwright-report/
rm -rf test-results/

# Install dependencies if needed
print_status "Installing dependencies..."
npm ci

# Install Playwright browsers if needed
print_status "Installing Playwright browsers..."
npx playwright install

# List available tests with the tag
print_status "Available tests with tag @$TAG:"
npx playwright test --grep "@$TAG" --list

# Run tests with the specified tag
print_status "Running tests with tag @$TAG..."
npx playwright test --grep "@$TAG" --reporter=html,junit || {
    print_warning "Some tests failed, but continuing with debug..."
}

# Check if JUnit XML was generated
if [ -f "playwright-report/results.xml" ]; then
    print_success "JUnit XML report generated: playwright-report/results.xml"
    
    # Show basic info about the XML
    print_status "JUnit XML content summary:"
    echo "File size: $(wc -c < playwright-report/results.xml) bytes"
    echo "Number of test suites: $(grep -c '<testsuite' playwright-report/results.xml || echo '0')"
    echo "Number of test cases: $(grep -c '<testcase' playwright-report/results.xml || echo '0')"
    
    # Show test suite names
    print_status "Test suites found:"
    grep -o 'hostname="[^"]*"' playwright-report/results.xml | sed 's/hostname="//;s/"//' | sort | uniq
    
else
    print_error "JUnit XML report not found!"
    print_status "Available files in playwright-report/:"
    ls -la playwright-report/ || echo "playwright-report directory not found"
    exit 1
fi

# Show test results summary
print_status "Test results summary:"
if [ -f "playwright-report/results.xml" ]; then
    echo "Total test cases: $(grep -c '<testcase' playwright-report/results.xml)"
    echo "Failed test cases: $(grep -c '<failure' playwright-report/results.xml)"
    echo "Skipped test cases: $(grep -c '<skipped' playwright-report/results.xml)"
fi

print_success "Test run completed! You can now run the debug script:"
echo "node tests/scripts/local-setup/debug-testrail-integration.js $TAG" 