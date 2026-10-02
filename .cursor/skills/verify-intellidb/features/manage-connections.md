# Manage connections (add / edit / delete)

## Sub-features

- Create a connection via the "New connection" dialog (TanStack Form + zod validation).
- Edit an existing connection (same dialog, prefilled).
- Delete a connection (confirmation dialog).

## How to get to it (user POV)

The app opens on `/` (Home). In the left sidebar, under **Connections**, the `+` button (`[aria-label="Add connection"]`) opens the dialog. Each connection row has a right-click context menu with **Edit** and **Delete**.

## Driving it with CDP

Create:

```bash
D=.cursor/skills/verify-intellidb/scripts/drive.mjs
node $D click '[aria-label="Add connection"]'
node $D fill '#name' 'Verify Test Conn'
node $D fill '#host' 'localhost'
node $D fill '#username' 'sa'
node $D fill '#password' 'Secret123!'
node $D fill '#database' 'master'
node $D click 'form#create-connection-form button[type="submit"]'
```

The DBMS select (`#DBMS`) defaults to `mssql`; only MS SQL Server is selectable (others are commented out in `src/components/index/ConnectionDialog.tsx`).

Edit: right-click the connection row → `node $D click '[role="menuitem"]:has-text("Edit")'` is not supported by the driver — instead list menu items with `node $D eval "[...document.querySelectorAll('[role=\"menuitem\"]')].map(m => m.textContent)"`, then click by index/text via `click` on the visible item.

Delete: right-click row → **Delete** → confirm in `DeleteConnectionDialog`.

Proof of end state (all three required):

1. Screenshot after submit: `node $D screenshot .../evidence/manage-connections.png` — sidebar shows the new row with a **red** dot (`span[aria-label="Disconnected"]` — created ≠ connected).
2. DOM: `node $D eval "document.querySelector('.SidebarMenu')?.textContent"` contains the connection name.
3. DB row: `node .cursor/skills/verify-intellidb/scripts/db-query.mjs "SELECT ID, Name, DBMS, Host, Username, Database FROM Connection;"` — the row must exist with the exact values typed into the form. After delete: the query returns no such row.

## Gotchas

- Validation is zod-backed: submitting with any required field empty keeps the dialog open and renders `FieldError`s. A proof of validation failure is legitimate evidence — capture the dialog screenshot with errors.
- `query_values` (advanced collapsible in the dialog) map to `sqlalchemy_query` JSON in the DB; only non-empty key/value pairs are saved.
- Edit resets the form to the connection's stored values on open; if you cancel, `setConnectionPendingEdit(null)` fires on close.
- The connection list lives in a zustand store (`src/stores/backendConnectionStore.ts`) hydrated from IPC — after main-process DB changes made outside the UI, the sidebar will NOT update until relaunch.
