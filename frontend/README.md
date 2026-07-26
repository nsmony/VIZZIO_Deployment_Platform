# Frontend Web App

React + Vite frontend panel for the VIZZIO Deployment Platform.

## Setup

```powershell
cd frontend
Copy-Item .env.example .env
npm install
npm run dev
```

Configuration:

```env
VITE_API_BASE=http://localhost:4000/api
VITE_DOWNLOAD_BASE=http://localhost:4000/downloads
```

Use `npm run build` for a production build and `npm run preview` to serve that
build locally.

If Windows PowerShell blocks `npm.ps1`, use `npm.cmd` for these commands.
