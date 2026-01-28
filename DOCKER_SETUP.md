# 🐳 Docker Setup Guide for DilemmaWise

This guide will help you run DilemmaWise using Docker, even if you've never used Docker before.

## 📋 Prerequisites

### Step 1: Install Docker

#### Windows
1. Download **Docker Desktop for Windows** from: https://www.docker.com/products/docker-desktop
2. Run the installer and follow the installation wizard
3. Restart your computer if prompted
4. Open Docker Desktop - it should show "Docker Desktop is running" in the system tray
5. Verify installation by opening PowerShell or Command Prompt and typing:
   ```bash
   docker --version
   docker-compose --version
   ```
   You should see version numbers displayed.

#### Mac
1. Download **Docker Desktop for Mac** from: https://www.docker.com/products/docker-desktop
2. Drag Docker.app to your Applications folder
3. Open Docker from Applications
4. Verify installation by opening Terminal and typing:
   ```bash
   docker --version
   docker-compose --version
   ```

#### Linux (Ubuntu/Debian)
```bash
# Update package index
sudo apt-get update

# Install Docker
sudo apt-get install docker.io docker-compose

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Add your user to docker group (to run without sudo)
sudo usermod -aG docker $USER

# Log out and back in, then verify
docker --version
docker-compose --version
```

### Step 2: Get Your Google AI API Key

DilemmaWise requires a Google AI API key to work:

1. Go to: https://aistudio.google.com/apikey
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Copy the generated API key - you'll need it in the next step
5. **Keep this key secret!** Don't share it publicly.

> 💡 **Free Tier**: The free tier includes 15 requests per minute, which is more than enough for personal use.

---

## 🚀 Running DilemmaWise with Docker

### Method 1: Using Docker Compose (Recommended - Easiest)

This is the simplest method, perfect for beginners.

#### Step 1: Create Environment File

1. In the project folder, copy the example environment file:
   
   **Windows (PowerShell):**
   ```powershell
   Copy-Item .env.example .env
   ```
   
   **Mac/Linux:**
   ```bash
   cp .env.example .env
   ```

2. Open the `.env` file with any text editor (Notepad, VS Code, etc.)

3. Replace `your_google_ai_api_key_here` with your actual API key:
   ```
   GOOGLE_AI_API_KEY=AIzaSyD-your-actual-api-key-here
   ```

4. Save and close the file

#### Step 2: Build and Start the Application

Open your terminal/PowerShell in the project folder and run:

```bash
docker-compose up --build
```

**What this does:**
- `docker-compose`: Uses the docker-compose.yml configuration
- `up`: Starts the application
- `--build`: Builds the Docker image first

**First-time setup**: This might take 3-5 minutes as Docker downloads dependencies and builds the application.

#### Step 3: Access the Application

Once you see messages like:
```
✓ Ready in 2.1s
```

Open your web browser and go to:
```
http://localhost:3000
```

🎉 **That's it!** DilemmaWise should now be running!

#### Step 4: Stopping the Application

To stop the application:

1. Press `Ctrl + C` in the terminal
2. Wait for containers to stop
3. (Optional) To remove containers completely:
   ```bash
   docker-compose down
   ```

---

### Method 2: Using Docker Commands Directly

If you prefer more control or docker-compose isn't working:

#### Step 1: Set Environment Variables

**Windows (PowerShell):**
```powershell
$env:GOOGLE_AI_API_KEY="your_api_key_here"
```

**Mac/Linux:**
```bash
export GOOGLE_AI_API_KEY="your_api_key_here"
```

#### Step 2: Build the Docker Image

```bash
docker build -t dilemmawise:latest .
```

**What this does:**
- `docker build`: Creates a Docker image
- `-t dilemmawise:latest`: Tags it with the name "dilemmawise"
- `.`: Uses the current directory

This takes 3-5 minutes the first time.

#### Step 3: Run the Container

**Windows (PowerShell):**
```powershell
docker run -d `
  --name dilemmawise-app `
  -p 3000:3000 `
  -e GOOGLE_AI_API_KEY=$env:GOOGLE_AI_API_KEY `
  --restart unless-stopped `
  dilemmawise:latest
```

**Mac/Linux:**
```bash
docker run -d \
  --name dilemmawise-app \
  -p 3000:3000 \
  -e GOOGLE_AI_API_KEY=$GOOGLE_AI_API_KEY \
  --restart unless-stopped \
  dilemmawise:latest
```

**What these flags mean:**
- `-d`: Run in background (detached mode)
- `--name`: Give the container a friendly name
- `-p 3000:3000`: Map port 3000 from container to your computer
- `-e`: Pass environment variable
- `--restart unless-stopped`: Auto-restart if it crashes

#### Step 4: Check if Running

```bash
docker ps
```

You should see your container listed.

#### Step 5: Access the Application

Open your browser to: http://localhost:3000

#### Step 6: View Logs (if needed)

```bash
docker logs dilemmawise-app
```

To follow logs in real-time:
```bash
docker logs -f dilemmawise-app
```

#### Step 7: Stop and Remove Container

```bash
# Stop the container
docker stop dilemmawise-app

# Remove the container
docker rm dilemmawise-app
```

---

## 🔧 Troubleshooting

### "Port 3000 is already in use"

Another application is using port 3000. Either:

1. Stop the other application, or
2. Use a different port by changing the docker-compose.yml file:
   ```yaml
   ports:
     - "8080:3000"  # Use port 8080 instead
   ```
   Then access the app at http://localhost:8080

### "Error: Missing API Key"

- Check your `.env` file has the correct API key
- Make sure there are no extra spaces or quotes
- Restart the container after changing the `.env` file

### Container Won't Start

Check logs for errors:
```bash
docker-compose logs
```
or
```bash
docker logs dilemmawise-app
```

### Need to Rebuild After Code Changes

If you modify the code:
```bash
docker-compose down
docker-compose up --build
```

### Clear Everything and Start Fresh

```bash
# Stop and remove containers
docker-compose down

# Remove the built image
docker rmi dilemmawise:latest

# Remove all unused Docker data (careful!)
docker system prune -a

# Start fresh
docker-compose up --build
```

---

## 📝 Useful Docker Commands

| Command | What it Does |
|---------|--------------|
| `docker ps` | Show running containers |
| `docker ps -a` | Show all containers (including stopped) |
| `docker images` | List Docker images |
| `docker-compose up` | Start the application |
| `docker-compose up -d` | Start in background |
| `docker-compose down` | Stop and remove containers |
| `docker-compose logs` | View application logs |
| `docker-compose logs -f` | Follow logs in real-time |
| `docker exec -it dilemmawise-app sh` | Open shell inside container |
| `docker stats` | Show resource usage |

---

## 🌐 Deploying to Production

### Using a Cloud Service

You can deploy this Docker setup to any cloud platform that supports Docker:

1. **Render.com** (Easiest)
   - Create account at https://render.com
   - Click "New +" → "Web Service"
   - Connect your Git repository
   - Render will auto-detect the Dockerfile
   - Add environment variables (GOOGLE_AI_API_KEY)
   - Deploy!

2. **Railway.app**
   - Create account at https://railway.app
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository
   - Add environment variables
   - Deploy!

3. **Google Cloud Run**
   ```bash
   # Install Google Cloud CLI first
   gcloud builds submit --tag gcr.io/PROJECT-ID/dilemmawise
   gcloud run deploy --image gcr.io/PROJECT-ID/dilemmawise --platform managed
   ```

4. **AWS ECS, Azure Container Instances, DigitalOcean App Platform** - all support Docker deployments

---

## 💡 Tips for Docker Beginners

1. **Docker Desktop** provides a GUI to see all containers and images
2. **Containers are isolated** - they have their own filesystem
3. **Images are blueprints** - containers are running instances of images
4. **Volumes** can be used to persist data (not needed for this app)
5. **Don't commit .env files** to Git - they contain secrets!

---

## ❓ Still Having Issues?

- Check the main README.md for general troubleshooting
- Visit Docker documentation: https://docs.docker.com/get-started/
- Open an issue on the GitHub repository

---

**Enjoy using DilemmaWise! 🎯**

