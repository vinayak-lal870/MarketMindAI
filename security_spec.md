# MarketMind AI — Security Specification (Payload-First TDD)

## 1. Data Invariants

1. **Strict Founder Isolation (`users/{userId}`)**:
   - Every document under `/users/{userId}`, `/users/{userId}/business_dna/{dnaId}`, and `/users/{userId}/outcome_ledger/{entryId}` is readable and writable **only** when `request.auth != null` and `request.auth.uid == userId`.
   - Every write must additionally satisfy `request.auth.token.email_verified == true`.
   - Collection listing on `/users` is explicitly denied (`allow list: if false`) to prevent founder enumeration.
   - `ownerId` / `uid` and `createdAt` are immutable after document creation.

2. **Temporal Integrity (`request.time`)**:
   - `createdAt` on create must equal `request.time`.
   - `updatedAt` on create and update must equal `request.time`.

3. **Terminal State Locking (`outcome_ledger`)**:
   - Once an `OutcomeLedgerEntry` reaches `status == 'Succeeded'` AND `sharedAnonymously == true`, it is a verified published win and cannot be modified further by client writes.
   - Updates are strictly partitioned into action branches using `incoming().diff(existing()).affectedKeys().hasOnly([...])`.

4. **Collective Playbook Anonymization (`shared_playbooks`)**:
   - Every document in `/shared_playbooks/{playbookId}` must have `isAnonymized == true` and `authorUid == request.auth.uid` on creation.
   - `implementationSteps` must be a non-empty bounded list (`1 <= size <= 6`) with string elements.
   - `allow list` and `allow get` enforce `existing().isAnonymized == true` (no blanket reads).
   - Published playbooks are immutable once created (`allow update, delete: if false` for non-owners or permanently immutable to preserve peer trust).

5. **Path Variable & Payload Size Hardening**:
   - All single-document operations enforce `isValidId(id)` (`^[a-zA-Z0-9_\-]+$`, max 128 chars).
   - Every string field enforces strict `.size()` upper and lower bounds to prevent resource exhaustion.

---

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Cross-Tenant Read**: User B (`uid: "userB"`) attempts `GET /users/userA/business_dna/primary`. -> `PERMISSION_DENIED`.
2. **Cross-Tenant Write**: User B attempts `CREATE /users/userA/outcome_ledger/dec_1` with `ownerId: "userA"`. -> `PERMISSION_DENIED`.
3. **Owner Spoofing**: User A attempts `CREATE /users/userA/business_dna/primary` with `ownerId: "userB"`. -> `PERMISSION_DENIED`.
4. **Shadow Ghost Field**: User A attempts `CREATE /users/userA/business_dna/primary` with extra field `isAdmin: true`. -> `PERMISSION_DENIED`.
5. **Unverified Email Write**: Unverified email user (`email_verified: false`) attempts `CREATE /users/userA/business_dna/primary`. -> `PERMISSION_DENIED`.
6. **Client Timestamp Forgery**: User A attempts `CREATE /users/userA/outcome_ledger/dec_1` with backdated `createdAt: "2020-01-01T00:00:00Z"`. -> `PERMISSION_DENIED`.
7. **Immutable Field Tampering**: User A attempts `UPDATE /users/userA/business_dna/primary` modifying `createdAt` or `ownerId`. -> `PERMISSION_DENIED`.
8. **Terminal State Mutation**: User A attempts `UPDATE /users/userA/outcome_ledger/dec_1` when `existing.status == "Succeeded"` and `existing.sharedAnonymously == true`. -> `PERMISSION_DENIED`.
9. **ID Poisoning**: User A attempts `CREATE /users/userA/outcome_ledger/${"x".repeat(300)}`. -> `PERMISSION_DENIED`.
10. **Unbounded Array / Type Poisoning on Playbook**: User A attempts `CREATE /shared_playbooks/pb_1` with `implementationSteps: ["a","b","c","d","e","f","g"]` (7 items) or `[123]`. -> `PERMISSION_DENIED`.
11. **Non-Anonymized Playbook Injection**: User A attempts `CREATE /shared_playbooks/pb_1` with `isAnonymized: false`. -> `PERMISSION_DENIED`.
12. **Blanket User Enumeration**: User A attempts `LIST /users`. -> `PERMISSION_DENIED`.
