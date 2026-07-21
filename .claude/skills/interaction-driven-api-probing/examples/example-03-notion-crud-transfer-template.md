# Example 03 — Transfer Template For Notion-Style CRUD Probing

## Why This Example Exists

The Kimi and GitHub Copilot examples are AI-chat shaped, but the skill is broader. Notion-style apps use the same principle: perform one UI mutation, capture the backend transaction, and map front-end intent to API semantics.

This file is a template for applying interaction-driven probing to page/database/row/block operations.

## Permission And Scratch Space

Before probing Notion or any workspace tool, get explicit permission for the mutation class.

Recommended scope:

- a scratch workspace or scratch parent page
- a unique prefix such as `api-probe-20260425`
- no customer/private data
- cleanup plan for created pages/databases/rows

## Probe Matrix

| Probe | UI Action | Unique Input | What To Capture |
|---|---|---|---|
| P1 | Create page under parent | `api-probe-page-001` | parent ID, page/block ID, title payload |
| P2 | Add paragraph block | `api-probe-block-001` | block type, parent ID, content field |
| P3 | Create database | `api-probe-db-001`, property `ProbeStatus` | collection/schema payload, view payload |
| P4 | Insert database row | `api-probe-row-001`, status `Alpha` | row/page ID, collection parent, property values |
| P5 | Edit row property | status `Beta` | property ID/value update operation |
| P6 | Refresh/reopen | no new mutation | persisted object returned by read/list API |

## Capture Setup

Use Chrome DevTools MCP with the logged-in running Chrome instance.

Install a MAIN-world fetch/XHR interceptor before the first mutation. Filter broadly at first:

```text
api, graphql, rpc, transaction, block, collection, page, record
```

Then narrow after observing actual endpoints.

## Correlation Strategy

Use the unique probe strings as anchors:

- `api-probe-page-001`
- `api-probe-db-001`
- `api-probe-row-001`
- `ProbeStatus`
- `Alpha` / `Beta`

For each captured request, ask:

1. Does the nonce appear in the request body?
2. Does the response return a new ID?
3. Does a later read/refetch return the same ID and value?
4. Which IDs are parent/container IDs and which are created object IDs?
5. Is this a batch transaction containing multiple operations?

## Dossier Shape

```markdown
## Notion-Like CRUD Protocol Dossier

### Create Page
- Endpoint:
- Method:
- Parent ID field:
- Created page/block ID field:
- Title field:
- Response confirmation:

### Add Block
- Endpoint:
- Method:
- Parent ID field:
- Block type field:
- Text/content field:
- Ordering field:

### Create Database
- Endpoint:
- Method:
- Collection/schema field:
- View field:
- Property IDs:
- Response confirmation:

### Insert Row
- Endpoint:
- Method:
- Collection/database parent field:
- Row/page ID field:
- Property value encoding:
- Response confirmation:

### Persistence Check
- Refresh behavior:
- Read/list endpoint:
- Fields that survived:
- Fields that were UI-only:
```

## Generalization Rules

1. Do not start by guessing API endpoints from route names.
2. Create one object with a unique name and capture what request creates it.
3. If the request is a transaction batch, split the batch into operations and label each operation by nonce.
4. Treat UI labels as display truth until a persisted API read proves otherwise.
5. Separate IDs: workspace ID, parent page ID, database/collection ID, block ID, row/page ID, view ID, property ID.
6. If another computer runs the same skill, the IDs will differ, but the action-to-field relationships should remain stable.
7. Save fixtures with redacted IDs but preserved structure once the protocol is understood.

## Cleanup

After the probe, either:

- delete the scratch page/database/rows through the UI while capturing the delete/archive transaction, or
- leave them if the user wants persistent test fixtures

Never assume cleanup is allowed just because creation was allowed.
