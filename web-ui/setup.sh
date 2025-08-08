#!/bin/bash

echo "🚀 Setting up Verifast Test Runner Web UI"
echo "=========================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js and npm are installed"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Check for required environment variables
echo "🔧 Checking environment variables..."

if [ -z "$GITHUB_TOKEN" ]; then
    echo "⚠️  GITHUB_TOKEN is not set"
    echo "   Please set it with: export GITHUB_TOKEN=your_token"
    echo "   Required permissions: repo, workflow"
fi

if [ -z "$TESTRAIL_HOST" ]; then
    echo "⚠️  TESTRAIL_HOST is not set"
    echo "   Please set it with: export TESTRAIL_HOST=https://your-instance.testrail.io"
fi

if [ -z "$TESTRAIL_USER" ]; then
    echo "⚠️  TESTRAIL_USER is not set"
    echo "   Please set it with: export TESTRAIL_USER=your_email"
fi

if [ -z "$TESTRAIL_API_KEY" ]; then
    echo "⚠️  TESTRAIL_API_KEY is not set"
    echo "   Please set it with: export TESTRAIL_API_KEY=your_api_key"
fi

if [ -z "$TESTRAIL_PROJECT_ID" ]; then
    echo "⚠️  TESTRAIL_PROJECT_ID is not set"
    echo "   Please set it with: export TESTRAIL_PROJECT_ID=1"
fi

if [ -z "$TESTRAIL_SUITE_ID" ]; then
    echo "⚠️  TESTRAIL_SUITE_ID is not set"
    echo "   Please set it with: export TESTRAIL_SUITE_ID=1"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Set required environment variables (see above)"
echo "2. Start the server: npm start"
echo "3. Open http://localhost:3000 in your browser"
echo ""
echo "🔗 Useful commands:"
echo "   npm start          - Start the server"
echo "   npm run dev        - Start with auto-reload"
echo "   node testrail-integration.js - Test TestRail connection"
echo ""
