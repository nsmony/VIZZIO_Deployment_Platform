# VIZZIO Deployment Platform - Task Breakdown

## 1. Week 1: Design & Architecture
- Review requirements and confirm product scope.
- Define high-level system architecture.
- Choose final technology stack: React admin/web UI, Node.js + Express backend, PostgreSQL, Nginx file delivery, C# .NET 8 WPF launcher.
- Create wireframes/user flows for:
  - Admin Web Panel
  - User Launcher
- Document API design and data model.
- Present architecture and tech choices for sign-off.

## 2. Backend Foundations
- Set up Node.js + Express project structure.
- Configure PostgreSQL database and schema.
- Implement user authentication:
  - bcrypt password hashing
  - JWT-based authentication
  - login endpoints for admin and launcher
- Implement role/permission model and user access control.
- Build deployment/version management APIs:
  - create/edit deployments
  - upload/register new versions
  - mark versions stable/beta and released/archived
  - assign deployment access to users
- Add secure download token generation API.
- Add rate limiting on auth and sensitive endpoints.

## 3. Admin Web Panel
- Build React admin UI scaffold.
- Implement login page and session handling.
- Implement user management screens:
  - create/edit/disable/reset password
  - assign deployment access
- Implement deployment and version management screens:
  - add new deployment
  - register a release folder/version
  - toggle stable/beta
  - release/archive versions
- Add deployment history / download activity tracking.
- Implement tabular filters and search for admin data.

## 4. Windows Launcher Client
- Build C# .NET 8 WPF launcher application.
- Implement login screen using same credentials.
- Display accessible deployments and versions grouped stable/beta.
- Implement download manager:
  - parallel streams
  - resumable downloads with HTTP range support
  - pause/resume/cancel controls
  - progress, speed, remaining size, ETA
- Verify downloaded file integrity after download.
- Let user pick install root folder.
- Support side-by-side installs of stable and beta versions.
- Provide "Open folder" button to launch batch file.
- Check free disk space before download.
- Show friendly error messages.

## 5. File Delivery & Infrastructure
- Set up Nginx as file delivery server.
- Configure direct delivery of large Unreal builds.
- Enable HTTP range requests for resumable download support.
- Integrate secure download token validation in Nginx (auth_request or similar).
- Ensure static assets and large files are served efficiently.
- Document deployment options: cloud or on-premise.

## 6. Integration & Security
- Connect launcher and admin panel to backend APIs.
- Secure API access with JWT validation.
- Secure download delivery with short-lived signed tokens.
- Store credentials securely on launcher machines (Windows Credential Manager or equivalent).
- Add rate limiting on login/auth endpoints.
- Test permission-based access control thoroughly.

## 7. Quality & Hardening
- Implement unit/integration tests for backend APIs.
- Build end-to-end tests for login, deployment creation, and downloads.
- Stress-test scenarios:
  - slow network
  - dropped connection mid-download
  - corrupted download recovery
  - fresh machine install
- Fix bugs from week 6 demo.
- Validate port conflict handling and bandwidth constraints if implemented.

## 8. Documentation & Deliverables
- [x] Write admin user guide.
- [x] Write operations guide for publishing a new version.
- [x] Write handover document describing architecture and deployment.
- Prepare final demo and sign-off materials.

## 9. Optional Bonus Objectives (if core is on track)
- Launch deployments directly from the launcher and show a running/stopped state.
- Auto-install prerequisites on first run if required software is missing.
- Launcher self-update mechanism.
- Bandwidth cap setting in launcher.
- Port conflict detection before launch.
- Automatic error reporting/log upload from launcher.
