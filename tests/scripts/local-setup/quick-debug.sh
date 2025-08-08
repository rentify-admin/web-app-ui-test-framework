#!/bin/bash

# Quick debug script - runs the entire debugging workflow
# Usage: ./quick-debug.sh [tag]
# Example: ./quick-debug.sh core

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

print_status "🚀 Starting comprehensive debug session for tag: @$TAG"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the web-app directory."
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_warning ".env file not found. Please ensure TestRail environment variables are set."
fi

print_status "Step 1: Analyzing current TestRail state..."
node tests/scripts/local-setup/analyze-testrail-state.js

print_status "Step 2: Running tests and generating JUnit XML..."
./tests/scripts/local-setup/run-tests-for-debug.sh $TAG

print_status "Step 3: Debugging TestRail integration..."
node tests/scripts/local-setup/debug-testrail-integration.js $TAG

print_success "🎉 Debug session completed!"
print_status "Check the output above to identify the root cause of the 'Untested' cases issue."
print_status "Look for:"
print_status "  - Unmatched test cases"
print_status "  - Duplicate titles in TestRail"
print_status "  - Missing custom fields"
print_status "  - Plan configuration issues" 