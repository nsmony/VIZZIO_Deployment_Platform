# Infrastructure

This directory contains starter configuration for the VIZZIO Deployment Platform.

## Nginx Setup

- Proxy `/api/` traffic to the backend API.
- Serve build files from `/builds/` with HTTP range support.
- Use Nginx to offload large file delivery from the API server.

## Notes

- Configure `alias` to the build storage path used by your Unreal package repository.
- Add authentication checks to protect download URLs when the project is ready.
