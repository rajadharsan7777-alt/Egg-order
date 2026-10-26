# Security Specification (`security_spec.md`)

## 1. Data Invariants

1. **Global Default Deny**: Any path not explicitly matched (`/storefront/{configId}`, `/orders/{orderId}`, `/admins/{adminId}`) is unconditionally denied for both read and write.
2. **Administrator Identity Invariant (`isAdmin()`)**: Only a signed-in user with a verified email (`request.auth.token.email_verified == true`) matching the bootstrapped farm owner (`rajadharsan7777@gmail.com`) or an existing `/admins/$(request.auth.uid)` record is recognized as an administrator.
3. **Storefront Rate & Config Integrity (`/storefront/{configId}`)**:
   - Only `isAdmin()` may `create`, `update`, or `delete` `/storefront/{configId}` documents.
   - `ownerId` must match `request.auth.uid` on create and remain immutable (`incoming().ownerId == existing().ownerId`) on update.
   - `updatedAt` must strictly equal `request.time`.
   - Every string field enforces strict `.size()` bounds and regex patterns from `firebase-blueprint.json`.
4. **Order PII Isolation & Terminal State Locking (`/orders/{orderId}`)**:
   - Because `/orders/{orderId}` contains customer PII (`customerPhone`, `customerAddress`), `get` and `list` access is strictly isolated to `existing().ownerId == request.auth.uid || isAdmin()`. Blanket `isSignedIn()` reads are forbidden.
   - Once an order reaches a terminal state (`status in ['delivered', 'cancelled']`), non-admin updates are permanently locked.
   - `createdAt` and `ownerId` are immortal/immutable fields.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Payload 1 (Identity Spoofing on Order Create)**: Authenticated user `user_A` attempts to create `/orders/NK-1001` with `ownerId: "user_B"`.
   ```json
   { "orderId": "NK-1001", "ownerId": "user_B", "customerName": "Ravi", "status": "pending_payment" }
   ```
2. **Payload 2 (Shadow Field / Ghost Key Injection)**: Admin updates `/storefront/main` with an undeclared field `"isSuperVerified": true`.
   ```json
   { "configId": "main", "pricePerEgg": 12.5, "isSuperVerified": true }
   ```
3. **Payload 3 (Unverified Email Admin Spoof)**: Attacker with unverified email `rajadharsan7777@gmail.com` (`email_verified: false`) attempts to update `/storefront/main`.
   ```json
   { "configId": "main", "pricePerEgg": 1 }
   ```
4. **Payload 4 (PII Blanket Read Attack)**: Authenticated user `user_intruder` attempts `get` on `/orders/NK-1024` owned by `user_victim`.
   ```json
   { "operation": "get", "path": "/orders/NK-1024", "auth": { "uid": "user_intruder" } }
   ```
5. **Payload 5 (ID Poisoning / 2KB Path ID)**: User attempts to create `/orders/{2000_char_junk_id$%#}` to bypass regex and size guards.
   ```json
   { "orderId": "A_2000_CHAR_STRING_WITH_INVALID_CHARS_$$$" }
   ```
6. **Payload 6 (Value Poisoning on Update)**: User updates whitelisted field `status` on `/orders/NK-1001` with a boolean `true` or invalid enum `"hacked_status"`.
   ```json
   { "status": "hacked_status" }
   ```
7. **Payload 7 (Terminal State Mutation)**: Non-admin owner attempts to update `/orders/NK-1001` after `existing().status == 'delivered'`.
   ```json
   { "status": "pending_payment", "customerLandmark": "Changed after delivery" }
   ```
8. **Payload 8 (Immortal Field Mutation)**: Owner attempts to mutate `createdAt` or `ownerId` during an update on `/orders/NK-1001`.
   ```json
   { "ownerId": "new_owner_uid", "createdAt": "2020-01-01T00:00:00Z" }
   ```
9. **Payload 9 (Temporal Integrity Forgery)**: Client supplies a forged future/past timestamp instead of `request.time` for `createdAt` or `updatedAt`.
   ```json
   { "createdAt": "2099-01-01T00:00:00Z", "updatedAt": "2099-01-01T00:00:00Z" }
   ```
10. **Payload 10 (Self-Assigned Admin Privilege Escalation)**: Regular user `user_evil` attempts to create `/admins/user_evil` to grant themselves admin status.
    ```json
    { "adminId": "user_evil", "email": "evil@example.com" }
    ```
11. **Payload 11 (Unbounded String Denial-of-Wallet)**: User submits a 50,000-character string in `customerAddress` (exceeding `maxLength: 300`).
    ```json
    { "customerAddress": "X_REPEATED_50000_TIMES" }
    ```
12. **Payload 12 (Unauthorized Storefront Rate Tampering)**: Non-admin signed-in user attempts to lower `tray30Price` to `1` in `/storefront/main`.
    ```json
    { "tray30Price": 1 }
    ```
