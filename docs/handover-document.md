# Handover Document

## 1. System Summary

VIZZIO Deployment Platform is composed of:

- Backend API: Node.js + Express + Prisma + PostgreSQL
- Admin Portal: React + Vite
- Windows Launcher: .NET 8 WPF
- Delivery Layer: Node streaming and optional Nginx accelerated delivery

The platform enables controlled software release and distribution with group-based access, resumable downloads, and integrity checks.

## 2. Repository Ownership Areas

- backend: APIs, business logic, data model, download sessions, security
- frontend: admin UX, auth guard behavior, management pages
- launcher: end-user discovery/download/install experience
- infra: nginx config for reverse proxy and file delivery
- scripts and installer: packaging and distribution tooling

## 3. Runtime Topology

- PostgreSQL database for persistent state
- Backend API serving admin and launcher endpoints
- Optional Nginx path for large-file range delivery
- Launcher clients authenticating and downloading package artifacts

## 4. Critical Business Flows

- Admin auth and session lifecycle
- User/group/access management
- Deployment/version creation and release state transitions
- Launcher authentication and deployment discovery
- Download session creation, tokenized range fetches, checksum verification, extraction

## 5. Security Controls

- bcrypt hashing for user/admin passwords
- JWT auth for admin and launcher users
- Short-lived signed download tokens
- Login rate limiting to reduce brute-force attempts
- Package root and path safety validation
- Maintenance mode controls

## 6. Key Operational Procedures

- Publishing new versions: see docs/operations-publishing-guide.md
- Admin operations: see docs/admin-user-guide.md
- Architecture reference: see docs/architecture.md and README diagrams

## 7. Build and Validation Commands

### Frontend

```powershell
cd frontend
npm run build
```

### Launcher

```powershell
dotnet build launcher\Launcher.csproj -p:Configuration=Debug
```

### Backend

```powershell
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

## 8. Environment and Configuration

- backend/.env for API, DB, token, and package delivery settings
- frontend/.env for API and download base URLs
- launcher branding and runtime settings for client presentation

## 9. Known Risks and Guardrails

- Port conflicts in local development causing false negatives
- Large transfer reliability under unstable networks
- Token expiry during prolonged download
- Inconsistent test coverage across services

Guardrails:

- Single active backend instance in local validation
- Release smoke checks with real launcher account
- Post-release download log verification

## 10. Recommended Next Engineering Steps

- Add unified CI checks for backend, frontend, and launcher builds
- Expand backend automated tests beyond current service scope
- Add scripted health checks for local and deployment environments
- Formalize release note template and runbook enforcement

## 11. Support Handoff Notes

When transferring ownership:

1. Share environment secrets via approved secure channel only.
2. Walk through publish and rollback flow live.
3. Validate one end-to-end release in recipient environment.
4. Confirm access to database backups and server package storage.
5. Confirm installer build prerequisites on maintainer machine.
