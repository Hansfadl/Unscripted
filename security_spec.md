# UNSCRIPTED Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Booking Privacy**: Public users may NEVER read (`get` or `list`) any document in `/bookings` or `/customers`.
2. **Public Booking Integrity**: Public users may only `create` a `/bookings/{bookingId}` document when:
   - `bookingId` matches `^UNSC-[0-9]{6}-[A-Z0-9]{4}$`
   - `bookingCode == bookingId`
   - `status == 'NEW_INQUIRY'`
   - `paymentStatus == 'UNPAID'`
   - `source == 'PUBLIC_WEB'`
   - `createdAt == request.time` and `updatedAt == request.time`
   - `packageId` references an existing active package in `/packages/{packageId}`
3. **Immutable Audit & Ownership**: `activity_logs` are admin-only (`get`, `list`, `create`) and never updatable or deletable by non-admins.
4. **Role Escalation Prevention**: Only verified admins (`request.auth.uid` present, `request.auth.token.email_verified == true`, and either custom claim `admin == true`, verified email in the backend allowlist `['syehansf@gmail.com', 'unscriptedwcc29@gmail.com']`, or an existing `/users/{uid}` doc where `uid == request.auth.uid`, `email == request.auth.token.email`, and `role == 'admin'`) can read/write admin collections or manage `/users`.
5. **Public Content Isolation**: Unauthenticated visitors can only read `packages` where `isActive == true`, `portfolio` where `published == true`, `availability`, and `settings/public`.

## 2. The "Dirty Dozen" Attack Payloads
1. **Unauthenticated Booking Read**: `GET /bookings/UNSC-261118-A1B2` as unauthenticated user -> `PERMISSION_DENIED`.
2. **Booking List Scraping**: `LIST /bookings` as unauthenticated user or non-admin signed-in user -> `PERMISSION_DENIED`.
3. **Status Spoofing on Create**: `CREATE /bookings/UNSC-261118-A1B2` with `status: "CONFIRMED"` -> `PERMISSION_DENIED`.
4. **Payment Spoofing on Create**: `CREATE /bookings/UNSC-261118-A1B2` with `paymentStatus: "FULLY_PAID"` -> `PERMISSION_DENIED`.
5. **Timestamp Forgery**: `CREATE /bookings/UNSC-261118-A1B2` with backdated `createdAt` (`!= request.time`) -> `PERMISSION_DENIED`.
6. **Shadow Ghost Field Injection**: `CREATE /bookings/UNSC-261118-A1B2` including `{ isAdminOverride: true }` -> `PERMISSION_DENIED`.
7. **ID Poisoning / Denial of Wallet**: `CREATE /bookings/<1500-char-id>` or `notes` > 1500 chars -> `PERMISSION_DENIED`.
8. **Self-Assigned Admin Role**: Signed-in non-admin writes `/users/{uid}` with `role: "admin"` -> `PERMISSION_DENIED`.
9. **Unverified Admin Email Spoof**: Request with matching email but `email_verified: false` -> `PERMISSION_DENIED`.
10. **PII Customer Directory Read**: Non-admin reads `/customers/{customerId}` -> `PERMISSION_DENIED`.
11. **Unpublished Portfolio Leak**: Public user queries `/portfolio` without `published == true` or reads draft doc -> `PERMISSION_DENIED`.
12. **Inactive Package Injection**: Public user queries `/packages` without `isActive == true` or references non-existent `packageId` in booking -> `PERMISSION_DENIED`.
