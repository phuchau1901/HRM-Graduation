# Contract numbers and document sequences

## Audit and migration

The audited source had no DocumentSequence entity, document_sequences table mapping/migration, or ContractType.Prefix. ContractNo was client-supplied. Added migration `20261116104348_AddContractDocumentSequences` adds only:

- Nullable contract_types.prefix VARCHAR(20), without defaults/backfill.
- document_sequences(document_type VARCHAR(30), document_year INT, last_number BIGINT).
- Composite PRIMARY KEY(document_type, document_year): this is the required unique key used by atomic UPSERT.
- Restrict FK document_type -> contract_types.code. The existing unique uq_contracts_contract_no is retained.

No existing contracts, sequence counters or contract-type codes/names are rewritten. No default prefixes are guessed. Configure a prefix through Contract Types before issuing new contracts. Migration has been generated and tested offline, **not applied**; no live database schema was inspected or mutated and no Railway deployment was performed.

## Contract Type prefix configuration

Existing `/api/contract-types` GET/list/detail and POST/PUT responses now include nullable `prefix`. Permissions remain WEB_CONTRACT_TYPES/VIEW, NEW, UPDATE, DELETE.

POST `/api/contract-types`:

```json
{"code":"FIXED_TERM","name":"Fixed term","prefix":"HDLD","isActive":true,"sortOrder":0}
```

PUT `/api/contract-types/FIXED_TERM`:

```json
{"name":"Fixed term","prefix":"HDLD","isActive":true,"sortOrder":0}
```

Prefix format is 1..20 uppercase ASCII letters/digits, starting with a letter. Invalid provided values return 400. Omission on PUT preserves the current prefix; explicit null clears it and blocks subsequent issuance until configured. Catalog rows may remain without a prefix for migration/configuration; creating a contract requires an active type with a valid prefix.

Updating prefix affects future numbers only. It never resets document_sequences.last_number or changes a previously issued ContractNo. Types with sequence history cannot be deleted, even after contracts change type; deactivate instead to preserve numbering history.

## POST /api/contracts

Root creation endpoint accepts employeeId plus existing contract fields:

```json
{"employeeId":1,"contractType":"FIXED_TERM","startDate":"2027-01-01","endDate":null,"status":"DRAFT","attachmentUrl":null}
```

Returns 201 ContractDto and Location pointing to the existing nested contract detail endpoint. Employee-scoped POST `/api/employees/{employeeId}/contracts` remains supported and uses the same allocator. Both require WEB_CONTRACTS/NEW and its ALL/DEPARTMENT scope, plus existing employee/date/lifecycle/type validation.

Do not supply ContractNo: the server generates it. A legacy create request supplying ContractNo is ignored (within the existing maximum length validation). Example generated response field: `contractNo: "HDLD-2027-000001"`.

PUT retains the issued ContractNo when omitted or unchanged. Attempts to change it return 400. Prefix edits and changing other contract fields never renumber an issued document. The frontend create form has no manual number input; edit displays the number read-only.

## Allocation algorithm

1. Open the contract creation transaction (Serializable) and verify action/scope, employee, dates, lifecycle, active ContractType and valid prefix.
2. Capture the creation year through VietnamBusinessDate(TimeProvider) using Asia/Ho_Chi_Minh. Contract StartDate does not determine the numbering year.
3. Atomic UPSERT on the type/year key: a missing row starts at 1; an existing row increments by 1. No SELECT-then-INSERT sequence race.
4. Read the allocated number on the same DbContext connection and transaction. Format PREFIX-YYYY-NNNNNN (minimum six digits, never truncated).
5. Insert contract, audit and notification/outbox, then commit once. No second connection, standalone sequence commit or number reservation endpoint is used.

MySQL commands (bound parameters):

```sql
INSERT INTO document_sequences (document_type, document_year, last_number)
VALUES (@type, @year, LAST_INSERT_ID(1))
ON DUPLICATE KEY UPDATE last_number = LAST_INSERT_ID(last_number + 1);
SELECT LAST_INSERT_ID();
```

`@type` is exactly the configured contract_types.code; prefix is not the sequence key. LAST_INSERT_ID(1) on insert deliberately overwrites any previous connection-local value. EF's later contract ID insert does not affect the already captured formatted number.

The SQLite test provider uses an equivalent atomic ON CONFLICT ... DO UPDATE ... RETURNING, also inside the caller's transaction. Concurrent requests are tested against separate file-database connections; production MySQL SQL/migration is checked offline, not against a live MySQL service.

## Collision, retry and rollback

- ContractNo has a database UNIQUE index. All committed numbers, including terminated/cancelled and legacy records, remain occupied.
- Legacy numbers or prefix reuse can collide with a candidate. After UPSERT, an indexed lookup checks occupancy; occupied candidates are skipped by further atomic increments, bounded to 100 candidates. This exception prevents reissuing an old number rather than changing historical contracts. Choose distinct prefixes for unrelated types to avoid such collisions. A new empty key normally issues number 1 immediately.
- Concurrent unique-key races, MySQL deadlocks (1213) and lock timeouts (1205) retry the entire rolled-back creation transaction up to 3 attempts. Duplicate-key retry is limited to uq_contracts_contract_no; unrelated constraint/validation/connection errors are not retried. Retries clear request tracking and revalidate permissions/type/prefix.
- After the retry bound, return 409. Unknown commit outcomes are not retried automatically.
- Allocation and contract/audit/notification roll back together on failure. An uncommitted candidate was never issued and may be allocated on the next successful transaction. A committed ContractNo is never renamed, reset or reused.
- Each type/year has a separate key; Vietnam midnight starts a new year row lazily. No annual reset job is needed.

## Verification

ContractNumberTests covers first number/year, repeated allocation, separate type prefixes/counters, Vietnam 2026->2027 midnight, mutable catalog prefix without reset, client number ignoring, immutable issued numbers, legacy collision skipping, invalid/inactive prefixes, rollback for absent/existing sequences, concurrent requests on separate connections and RBAC/scope. ContractSequenceMigrationTests verifies schema uniqueness, unchanged legacy data and existing ContractNo uniqueness, snapshot and offline MySQL SQL. React tests verify generated/read-only numbers and unchanged mutation/refetch paths.

Validation: solution build succeeded (0 warnings/errors); 57 focused contract/numbering/scope/migration tests passed. Full backend: 365 passed, 9 pre-existing EmployeeCreationTests failures from NV expectations versus unchanged TX generation. Frontend: 31 tests passed and Vite production build succeeded. Production MySQL allocation was reviewed through its SQL and offline migration; concurrency tests ran on separate SQLite database connections. No migration or deployment was performed.
