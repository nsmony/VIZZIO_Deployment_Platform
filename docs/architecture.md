# Architecture Overview

## Core Components

- **Admin Web Panel**
  - React SPA built with Vite
  - User and deployment management UI
  - Communicates with the backend API

- **Backend API**
  - Node.js + Express
  - PostgreSQL for persistent storage
  - JWT authentication and bcrypt password hashing
  - Deployment and version management endpoints

- **Launcher Client**
  - C# .NET 8 WPF application
  - Authenticates with backend API
  - Downloads build packages with resumable support, adaptive 4-16 stream selection, and jittered retry backoff
  - Installs versions side-by-side

- **File Delivery System**
  - Nginx serving large Unreal build files
  - HTTP range request support for resumable downloads
  - Backend-authorized `X-Accel-Redirect` delivery for private server files
  - Static file delivery and reverse proxy for backend API

## Deployment Flow

1. Admin copies large package files onto the server and registers the server file path on a deployment version.
2. Backend validates the package, stores metadata, and later issues scoped
   download-manager tokens.
3. Launcher authenticates the user and requests available deployments.
4. Launcher creates a download session and requests the tokenized backend file
   URL.
5. Backend validates the token and access. It either streams byte ranges
   directly or returns an internal `X-Accel-Redirect` for Nginx.
6. Launcher downloads resumable parallel ranges, verifies SHA-256, and extracts
   the package.
7. User can launch or uninstall the installed version.
