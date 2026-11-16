# Firestore Security Specification

## 1. Roles & Capabilities
- **Authenticated Trader (`request.auth.uid`)**:
  - Can read/create/update their own `/users/{userId}` profile (no `list`, no `delete`).
  - Can read/create/update/delete their own `/users/{userId}/connections/{connectionId}` Pocket Option gateway config.
  - Can read/create/update their own `/users/{userId}/orders/{orderId}` order records (immutable history, no `delete`).
  - Can read/create/update/delete their own `/users/{userId}/settings/{settingId}` risk configuration.
  - Can read/list (filtered by `userId == request.auth.uid`), create (prefix-enforced `tradeId`), update (immutable `userId` & `id`), and delete their own `/userTrades/{tradeId}` documents.
- **Unauthenticated Users & Cross-User Access**:
  - Zero access to any collection (`allow read, write: if false;` catch-all at top).
- **Backend-Only Collections**:
  - `/admins/{adminId}`, `/activation_codes/{codeId}`, `/devices/{deviceId}`, `/audit_logs/{logId}` are managed exclusively by Express APIs and are denied to client SDKs (`allow read, write: if false;`).

## 2. Schema & Field Constraints
- Every writable collection enforces `hasAll(...)` for required fields, `hasOnly(...)` for allowed fields, explicit type checks, string length bounds, and enum checks.
- Path IDs (`userId`, `connectionId`, `orderId`, `settingId`, `tradeId`) are validated via `isValidId()`.
