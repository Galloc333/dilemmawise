@echo off
REM DilemmaWise Docker Quick Start for Windows Command Prompt
echo ========================================
echo DilemmaWise Docker Setup
echo ========================================
echo.

REM Check if Docker is running
echo Checking Docker...
docker --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not installed or not running!
    echo Please install Docker Desktop from: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)
echo [OK] Docker found
echo.

REM Check if .env file exists
if not exist ".env" (
    echo [INFO] Creating .env file...
    (
        echo # DilemmaWise Environment Variables
        echo.
        echo # REQUIRED: Google AI API Key ^(Gemini^)
        echo # Get your free API key at: https://aistudio.google.com/apikey
        echo GOOGLE_AI_API_KEY=your_google_ai_api_key_here
        echo.
        echo # OPTIONAL: Google Custom Search API Key
        echo GOOGLE_SEARCH_API_KEY=
        echo.
        echo # OPTIONAL: Google Custom Search Engine ID
        echo SEARCH_ENGINE_ID=
    ) > .env
    
    echo [OK] .env file created!
    echo.
    echo ========================================
    echo IMPORTANT: Please add your Google AI API key
    echo Get your API key at: https://aistudio.google.com/apikey
    echo ========================================
    echo.
    echo Opening .env file in Notepad...
    timeout /t 2 >nul
    notepad.exe .env
    
    echo.
    set /p continue="Have you added your API key? (yes/no): "
    if /i not "%continue%"=="yes" (
        echo Please add your API key and run this script again.
        pause
        exit /b 0
    )
) else (
    echo [OK] .env file found
)

echo.
echo ========================================
echo Starting DilemmaWise with Docker...
echo This may take 3-5 minutes on first run
echo ========================================
echo.

docker-compose up --build

echo.
echo [OK] DilemmaWise has stopped.
echo To start again, run: docker-compose up
pause

