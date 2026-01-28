# 🚀 DilemmaWise - Docker Quick Start

## Super Simple 3-Step Setup

### Step 1: Install Docker
Download and install Docker Desktop: https://www.docker.com/products/docker-desktop

### Step 2: Get API Key
Get a free Google AI API key: https://aistudio.google.com/apikey

### Step 3: Run the App

**Windows PowerShell:**
```powershell
./docker-start.ps1
```

**Mac/Linux:**
```bash
chmod +x docker-start.sh
./docker-start.sh
```

**Or manually:**
1. Create a `.env` file with:
   ```
   GOOGLE_AI_API_KEY=your_api_key_here
   ```
2. Run:
   ```bash
   docker-compose up --build
   ```

### Access the App
Open your browser to: **http://localhost:3000**

---

## Common Commands

| What you want to do | Command |
|---------------------|---------|
| Start the app | `docker-compose up` |
| Start in background | `docker-compose up -d` |
| Stop the app | `Ctrl + C` or `docker-compose down` |
| View logs | `docker-compose logs` |
| Restart after changes | `docker-compose up --build` |
| Clean everything | `docker-compose down && docker system prune -a` |

---

## Troubleshooting

**"Port already in use"**  
→ Edit `docker-compose.yml`, change `3000:3000` to `8080:3000`

**"Missing API key"**  
→ Check your `.env` file has `GOOGLE_AI_API_KEY=your_key`

**Need more help?**  
→ See [DOCKER_SETUP.md](./DOCKER_SETUP.md) for detailed instructions

---

**That's it! Enjoy DilemmaWise! 🎯**

