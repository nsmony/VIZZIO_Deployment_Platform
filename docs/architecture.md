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
  - Downloads build packages with resumable support
  - Installs versions side-by-side

- **File Delivery System**
  - Nginx serving large Unreal build files
  - HTTP range request support for resumable downloads
  - Static file delivery and reverse proxy for backend API

## Deployment Flow

1. Admin uploads or registers a new deployment version.
2. Backend stores metadata and issues secure download tokens.
3. Launcher authenticates the user and requests available deployments.
4. Launcher downloads build files from Nginx using resumable parallel streams.
5. User installs a version and can open the deployment folder.
