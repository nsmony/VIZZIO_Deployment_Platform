# Deployment prerequisites

Deployments may include an optional `prerequisites.json` file beside `Launch.bat`.
The launcher evaluates this file before running the deployment.

Example:

```json
{
  "prerequisites": [
    {
      "name": "Node.js",
      "check": {
        "type": "command",
        "command": "node",
        "args": ["--version"]
      }
    },
    {
      "name": "npm",
      "check": {
        "type": "command",
        "command": "npm",
        "args": ["--version"]
      }
    }
  ],
  "requiredPorts": [
    { "name": "Frontend", "port": 3000 },
    { "name": "Local API", "port": 8080 }
  ]
}
```

Supported check types:

- `command`: runs a command and passes if it exits with code 0.
- `file`: passes if the declared file or folder exists.
- `env`: passes if an environment variable exists, or matches `equals`.

If a missing prerequisite has an `installer`, the launcher asks the user before
running it. Installer paths are relative to the installed deployment folder.

Port conflict checks:

- `ports`: a simple array of port numbers, such as `[3000, 8080]`.
- `requiredPorts`: named ports used for readable manifests.

The launcher checks only the TCP ports declared by the deployment being
launched. If any are already listening, launch is blocked with a clear error so
the user can close the conflicting app first. Multiple deployments can run at
the same time as long as their declared ports do not conflict.
