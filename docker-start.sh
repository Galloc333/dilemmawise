#!/bin/bash
# DilemmaWise Docker Quick Start Script for Mac/Linux
# This script helps you set up and run DilemmaWise with Docker

echo "🐳 DilemmaWise Docker Setup"
echo "================================"
echo ""

# Check if Docker is installed
echo "Checking Docker installation..."
if ! command -v docker &> /dev/null; then
    echo "✗ Docker is not installed!"
    echo "Please install Docker Desktop from: https://www.docker.com/products/docker-desktop"
    exit 1
fi

DOCKER_VERSION=$(docker --version)
echo "✓ Docker found: $DOCKER_VERSION"

# Check if .env file exists
echo ""
echo "Checking environment configuration..."
if [ ! -f ".env" ]; then
    echo "✗ .env file not found!"
    echo ""
    echo "Creating .env file..."
    
    cat > .env << 'EOF'
# DilemmaWise Environment Variables

# REQUIRED: Google AI API Key (Gemini)
# Get your free API key at: https://aistudio.google.com/apikey
GOOGLE_AI_API_KEY=your_google_ai_api_key_here

# OPTIONAL: Google Custom Search API Key
GOOGLE_SEARCH_API_KEY=

# OPTIONAL: Google Custom Search Engine ID
SEARCH_ENGINE_ID=
EOF
    
    echo "✓ .env file created!"
    echo ""
    echo "⚠️  IMPORTANT: Please edit the .env file and add your Google AI API key!"
    echo "   Get your API key at: https://aistudio.google.com/apikey"
    echo ""
    echo "Opening .env file in default editor..."
    sleep 2
    
    # Try to open with common editors
    if command -v nano &> /dev/null; then
        nano .env
    elif command -v vim &> /dev/null; then
        vim .env
    elif command -v vi &> /dev/null; then
        vi .env
    else
        echo "Please edit .env manually with your preferred editor"
        exit 0
    fi
    
    echo ""
    read -p "Have you added your API key to the .env file? (yes/no): " continue
    if [ "$continue" != "yes" ]; then
        echo "Please add your API key and run this script again."
        exit 0
    fi
else
    echo "✓ .env file found!"
    
    # Check if API key is set
    if grep -q "GOOGLE_AI_API_KEY=your_google_ai_api_key_here" .env || ! grep -q "GOOGLE_AI_API_KEY=.+" .env; then
        echo "⚠️  Warning: API key might not be configured!"
        read -p "Would you like to edit the .env file? (yes/no): " edit
        if [ "$edit" = "yes" ]; then
            if command -v nano &> /dev/null; then
                nano .env
            elif command -v vim &> /dev/null; then
                vim .env
            elif command -v vi &> /dev/null; then
                vi .env
            fi
        fi
    fi
fi

echo ""
echo "🚀 Starting DilemmaWise with Docker..."
echo "This may take a few minutes on the first run..."
echo ""

# Start with docker-compose
docker-compose up --build

echo ""
echo "✓ DilemmaWise has stopped."
echo "To start again, run: docker-compose up"


