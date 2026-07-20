# Backend

Node.js + Express backend for the VIZZIO Deployment Platform.

## Setup

1. cd backend
2. npm install
3. npm run dev

## Notes

- Uses PostgreSQL for persistent storage.
- Uses JWT authentication for API access.
- Nginx is expected to serve large file delivery externally.
- Admin package uploads stream to disk under `storage/downloads`; set `PACKAGE_UPLOAD_MAX_BYTES` to cap upload size.
