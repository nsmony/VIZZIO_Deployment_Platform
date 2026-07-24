# VIZZIO Diagrams

This document centralizes project diagrams for architecture and flow reviews.

## 1. System Architecture

```mermaid
graph TD
    A[Admin Web Panel\nReact + Vite] -->|REST /api| B[Backend API\nNode.js + Express]
    L[Windows Launcher\n.NET 8 WPF] -->|REST /api| B
    B -->|Prisma| D[(PostgreSQL)]
    L -->|Range file download| F[Nginx or Node Delivery]
    F -->|Token validation| B
    F --> S[(Package Storage)]
    B --> S
```

## 2. End-to-End User Flow

```mermaid
flowchart LR
    A1[Admin logs in] --> A2[Create deployment]
    A2 --> A3[Add version\nupload archive or register server archive or prepare staging folder]
    A3 --> A4[Set channel and release state]
    A4 --> A5[Grant group access]

    U1[Launcher user logs in] --> U2[Fetch accessible items]
    U2 --> U3{Start download?}
    U3 -->|Yes| U4[Create session and token]
    U4 --> U5[Parallel range download with resume]
    U5 --> U6[SHA-256 verification]
    U6 --> U7[Extraction]
    U7 --> U8[Installed state]
    U3 -->|No| U9[Refresh later]
```

## 3. Admin Use Cases

```mermaid
flowchart TB
    Admin((Admin))
    UC1[Login]
    UC2[Manage Users]
    UC3[Manage Groups]
    UC4[Manage Deployments]
    UC5[Manage Versions]
    UC6[Grant/Revoke Access]
    UC7[Review Download Logs]
    UC8[Maintenance and Settings]

    Admin --> UC1
    Admin --> UC2
    Admin --> UC3
    Admin --> UC4
    Admin --> UC5
    Admin --> UC6
    Admin --> UC7
    Admin --> UC8
```

## 4. Launcher User Use Cases

```mermaid
flowchart TB
    User((Launcher User))
    U1[Login]
    U2[View Deployments]
    U3[Start Download]
    U4[Pause Resume Cancel]
    U5[Verify Package Integrity]
    U6[Install Version]
    U7[Open Installed Folder]
    U8[Change Install Root]
    U9[Sign Out]

    User --> U1
    User --> U2
    User --> U3
    User --> U4
    User --> U5
    User --> U6
    User --> U7
    User --> U8
    User --> U9
```

## 5. Download Pipeline Sequence

```mermaid
sequenceDiagram
    participant U as Launcher User
    participant L as Launcher App
    participant B as Backend API
    participant F as File Delivery

    U->>L: Start download
    L->>B: Create download session
    B-->>L: Metadata and token
    L->>F: Range requests with token
    F->>B: Validate token
    B-->>F: Approved
    F-->>L: Chunks
    L->>L: Merge and checksum
    L->>L: Extract and mark installed
    L->>B: Write activity log
```
