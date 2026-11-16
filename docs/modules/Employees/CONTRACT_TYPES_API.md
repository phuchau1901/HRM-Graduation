# Contract types — audit, schema and API specification

[Contracts API](CONTRACTS_API.md) · [API inventory](../../API/README.md) · [Postman](../../HRM-API.postman_collection.json)

## Audit

Before this change, Contract.ContractType was a required free-text string mapped to contracts.contract_type VARCHAR(30). No configuration table/entity/API existed. POST/PUT contracts accepted any nonempty type up to 30 characters. Employees/contract reads and writes already used independent WEB_CONTRACTS action scopes and retain those checks.

## Schema and migration

New table `contract_types`:

| Column | Type | Meaning |
| --- | --- | --- |
| code | varchar(30), primary key | Stable code submitted as contractType; immutable after creation |
| name | varchar(150), required | Display name |
| prefix | varchar(20), nullable | Prefix for future server-generated ContractNo |
| description | varchar(500), nullable | Optional notes |
| is_active | tinyint(1), required | Whether selectable on new contracts/type changes |
| sort_order | int, required | Nonnegative display order |

`contracts.contract_type` now references `contract_types.code`, with an index and ON DELETE RESTRICT. Existing contracts keep their existing columns, codes and identities; no ContractTypeId is introduced.

Migration `20261116061708_AddContractTypeCatalog` creates the catalog, inserts each DISTINCT existing contract_type with name equal to the code, is_active=true and sort_order=0, then adds the FK. Legacy values are not trimmed, recased or rewritten. Configure display names after migration if needed. A new empty database has an empty catalog: create configured types before creating contracts. No predefined employment/legal categories are invented or automatically seeded.

Migration and snapshot are generated only. The migration is **not applied** by this task; no live database changes or Railway deployment are performed.

## Permissions

All endpoints require JWT and an active `WEB_CONTRACT_TYPES` grant for the corresponding action. Catalog metadata is global and does not contain employee records; it does not require Employee Data Scope. This does not grant access to contracts belonging to employees: existing contract APIs retain WEB_CONTRACTS/VIEW, NEW or UPDATE scope (SELF/DEPARTMENT/ALL for reads; DEPARTMENT/ALL for writes).

| Method | Endpoint | Action | Success |
| --- | --- | --- | --- |
| GET | /api/contract-types | VIEW | 200 PageResult<ContractTypeDto> |
| GET | /api/contract-types/{code} | VIEW | 200 ContractTypeDto |
| POST | /api/contract-types | NEW | 201 ContractTypeDto + Location |
| PUT | /api/contract-types/{code} | UPDATE | 200 ContractTypeDto |
| DELETE | /api/contract-types/{code} | DELETE | 204 |

## List and detail

`GET /api/contract-types?isActive=true&page=1&pageSize=100&search=FIXED`

- page >= 1, default 1; pageSize 1..100, default 30; optional search max 150 characters matches code or name.
- isActive is optional; omit it to include retired types.
- Filter before count/paging. Stable sort by sortOrder, then code.
- No matches returns total=0/data=[], not 404. Unknown detail code returns 404.

```json
{
  "success": true,
  "total": 1,
  "page": 1,
  "pageSize": 100,
  "data": [{"code":"FIXED_TERM","name":"Hợp đồng có thời hạn","prefix":"HDLD","description":null,"isActive":true,"sortOrder":0}]
}
```

## Create

`POST /api/contract-types`

```json
{"code":"FIXED_TERM","name":"Hợp đồng có thời hạn","prefix":"HDLD","description":null,"isActive":true,"sortOrder":0}
```

Code: 1..30 characters, starts with a letter/digit, then letters/digits/underscore/hyphen. Name: required, max 150. Description: optional, max 500. sortOrder >= 0. Defaults: isActive=true, sortOrder=0. Duplicate code: 409. Invalid fields: 400.

## Update and retirement

`PUT /api/contract-types/FIXED_TERM`

```json
{"name":"Hợp đồng có thời hạn","prefix":"HDLD","description":"Ngừng dùng cho hợp đồng mới","isActive":false,"sortOrder":10}
```

Code is identified by the path and is not an editable request field. Update changes name, description, isActive and sortOrder. Legacy codes can be maintained without recoding contracts. Deactivating a referenced type is allowed.

## Delete

Unreferenced type: 204. Referenced by any contract (including closed contracts): 409; deactivate instead. Unknown code: 404. FK enforces RESTRICT even outside API validation. Mutations and CONTRACT_TYPE_CREATED/UPDATED/DELETED AuditLog records are saved in the same Serializable transaction. No employee identity/count is exposed in catalog responses.

## Changes to contract APIs

Routes and request field `contractType` remain unchanged. Use the catalog code, not its display name. New contracts and changed type assignments require an existing active code; unknown or inactive selection: 400. Existing contracts may retain their current inactive type while other permitted fields/status are maintained. Existing closed-contract immutability, dates, overlap, notification, audit and scope rules remain.

All contract GET/list/POST/PUT responses add `contractTypeName`:

```json
{"id":1,"employeeId":1,"contractNo":"C001","contractType":"FIXED_TERM","contractTypeName":"Hợp đồng có thời hạn","startDate":"2024-01-01","endDate":null,"status":"DRAFT","attachmentUrl":null}
```

Names reflect current catalog configuration, including retired types. List/detail project the name through an EF SQL join; no per-contract lookups or N+1 queries.

## Verification

ContractTypeApiTests covers JWT/action permissions, global catalog access, pagination/filter/order, audits, reference-safe deletion, active/unknown types, maintenance of retired types, read names, Employee Data Scope and bounded query counts. ContractTypeMigrationTests checks the offline MySQL script, snapshot, FK and preservation/backfill of legacy codes. The existing contract lifecycle test is retained with explicitly configured catalog types.

Validation: backend build succeeded. Full backend run: 305 passed / 9 failed (314 total); failures are the pre-existing EmployeeCreationTests NV-vs-TX code-prefix mismatch, outside ContractType changes. All ContractType/API/migration regressions passed, including a legacy code with whitespace. SQL was generated offline; no migration was applied.

## Separate Contract Types screen

Catalog API permissions belong to screen `WEB_CONTRACT_TYPES` (display name: Contract Type). Employee contract APIs retain `WEB_CONTRACTS` and their Employee Data Scope checks. A grant on either screen does not implicitly grant access to the other. Users selecting types through `/api/contract-types` need WEB_CONTRACT_TYPES/VIEW; creating a contract needs WEB_CONTRACTS/NEW plus its scope, not Contract Type NEW.

Register the screen through the existing screen administration API if absent, then assign its actions through role permissions and sign in again for updated JWT grants. No direct database or automatic permission grant is performed by this change.

Example `POST /api/screens` (requires screen administration permission):

```json
{"code":"WEB_CONTRACT_TYPES","name":"Contract Type","platform":"WEB","isActive":true}
```

## Prefix extension

GET/list/detail responses include nullable prefix. POST/PUT accept prefix; omission preserves the old value on PUT, explicit null clears it. Valid prefix: 1..20 uppercase ASCII letters/digits starting with a letter. Contract creation requires a configured active type/prefix. Prefix edits do not reset counters or renumber old contracts. Types referenced by document_sequences cannot be deleted. See [numbering specification](CONTRACT_NUMBERING.md).
