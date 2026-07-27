# Code and Documentation Audit (2026-07-27)

## Scope

This audit compared the active project documentation with:

- Backend routes, controllers, services, repositories, Prisma schema, and
  environment-variable usage
- Frontend routes, API client, admin pages, and authentication guard
- Launcher API client, download/install flow, settings, prerequisite checks,
  self-update, error reporting, tests, and installer build script
- Nginx configuration and package-delivery path rules
- Package manifests and example environment files

Uploaded Markdown files under `backend/storage/downloads` and the original HTML
project brief are package/source artifacts, not maintained runtime
documentation, and were not rewritten.

## Documentation Updated

- Root, backend, frontend, infrastructure, and admin/operations documentation
  now uses current UI labels, routes, commands, package-source behavior, and
  environment variables.
- Nginx documentation now distinguishes `PACKAGE_ROOT` validation from
  `DOWNLOAD_ROOT` acceleration and recommends a shared private directory.
- Architecture diagrams now show token validation in the backend before direct
  streaming or `X-Accel-Redirect`.
- Requirements, design, and task files now state whether they are acceptance
  criteria, target design, or planning history rather than current runtime
  verification.
- Example database credentials were replaced with placeholders.
- User-management documentation now matches the six-user page size, shared
  user/email/group search, and four-group Group Access pagination.
- Group-management documentation now covers confirmed deletion and accurately
  states that membership/access mappings cascade while users and deployments
  remain.
- Notification documentation now distinguishes dropdown **Clear all** from
  individual deletion on the full Notifications page.
- Launcher documentation now reflects the deployment-first catalog, side-by-
  side version actions, and branded maintenance-mode dialog.

## Executable Verification

Run from the repository root unless noted:

```powershell
node --test backend\test\authMiddleware.test.js backend\test\downloadManagerService.test.js
dotnet test launcher\Launcher.Tests\Launcher.Tests.csproj -p:Configuration=Debug
```

Run from `backend`:

```powershell
npx.cmd prisma validate
```

Run from `frontend`:

```powershell
npm.cmd run build
```

Results:

- Backend tests: 17 passed
- Launcher tests: 14 passed
- Prisma schema validation: passed
- Frontend production build: passed

## Authorization Follow-up

The authorization gap found during this audit was fixed on 2026-07-27:

- `requireAdmin` middleware now protects all `/api/users` user/group routes.
- The frontend portal guard now requires an Admin role claim in the current,
  unexpired JWT and clears non-admin sessions.
- Middleware tests confirm Admin access and HTTP 403 rejection for non-admin or
  missing-role requests.

Deployment/version writes, settings, and admin reporting retain their existing
handler-level Admin checks. A future cleanup can centralize those checks on
route middleware as well.

## Remaining Code Gaps

### Test and CI coverage

- The backend has no `npm test` script even though Node test files exist.
- Full user, group, deployment, and route-level authorization flows still need
  API integration tests beyond the middleware unit coverage.
- Installer upgrade preservation and full hosted Nginx delivery still need
  environment-level smoke tests.

## Documentation Boundaries

- `design.md` remains an explicitly labeled original target design. Its
  `/api/admin/*` and proposed launcher endpoint tables are intentionally
  historical and are not the runtime API reference.
- `requirements.md` is acceptance criteria rather than implementation proof.
  Product behavior changed during this review: user pages now contain 6 rows,
  groups can be deleted with relational cleanup, and the launcher catalog is
  grouped by deployment rather than separated into channel sections. Those
  criteria were updated to match the approved behavior.
- Uploaded Markdown under `backend/storage/downloads` remains package content
  and is not maintained as project documentation.
