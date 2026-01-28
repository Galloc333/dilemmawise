# DilemmaWise Docker Quick Start Script for Windows
# This script helps you set up and run DilemmaWise with Docker

Write-Host "DilemmaWise Docker Setup" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is installed
Write-Host "Checking Docker installation..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version
    Write-Host "[OK] Docker found: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Docker is not installed!" -ForegroundColor Red
    Write-Host "Please install Docker Desktop from: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}

# Check if .env file exists
Write-Host ""
Write-Host "Checking environment configuration..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    Write-Host "[ERROR] .env file not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Creating .env file..." -ForegroundColor Yellow
    
    $envContent = @"
# DilemmaWise Environment Variables

# REQUIRED: Google AI API Key (Gemini)
# Get your free API key at: https://aistudio.google.com/apikey
GOOGLE_AI_API_KEY=your_google_ai_api_key_here

# OPTIONAL: Google Custom Search API Key
GOOGLE_SEARCH_API_KEY=

# OPTIONAL: Google Custom Search Engine ID
SEARCH_ENGINE_ID=
"@
    
    Set-Content -Path ".env" -Value $envContent -Encoding UTF8
    Write-Host "[OK] .env file created!" -ForegroundColor Green
    Write-Host ""
    Write-Host "IMPORTANT: Please edit the .env file and add your Google AI API key!" -ForegroundColor Yellow
    Write-Host "Get your API key at: https://aistudio.google.com/apikey" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Opening .env file..." -ForegroundColor Yellow
    Start-Sleep -Seconds 2
    notepad.exe ".env"
    
    Write-Host ""
    $continue = Read-Host "Have you added your API key to the .env file? (yes/no)"
    if ($continue -ne "yes") {
        Write-Host "Please add your API key and run this script again." -ForegroundColor Yellow
        exit 0
    }
} else {
    Write-Host "[OK] .env file found!" -ForegroundColor Green
    
    # Check if API key is set
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "GOOGLE_AI_API_KEY=your_google_ai_api_key_here" -or $envContent -notmatch "GOOGLE_AI_API_KEY=.+") {
        Write-Host "[WARNING] API key might not be configured!" -ForegroundColor Yellow
        $edit = Read-Host "Would you like to edit the .env file? (yes/no)"
        if ($edit -eq "yes") {
            notepad.exe ".env"
            Write-Host ""
            Read-Host "Press Enter when you are done editing"
        }
    }
}

Write-Host ""
Write-Host "Starting DilemmaWise with Docker..." -ForegroundColor Cyan
Write-Host "This may take a few minutes on the first run..." -ForegroundColor Yellow
Write-Host ""

# Start with docker-compose
docker-compose up --build

Write-Host ""
Write-Host "[OK] DilemmaWise has stopped." -ForegroundColor Green
Write-Host "To start again, run: docker-compose up" -ForegroundColor Cyan
