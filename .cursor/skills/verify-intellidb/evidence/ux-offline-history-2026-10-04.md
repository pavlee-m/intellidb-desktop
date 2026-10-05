# UX: offline history fetch, wait-disable, add-chat tooltip (2026-10-04)

Drove the isolated Electron app from `launch.sh` (scratch HOME `/tmp/intellidb-verify-home`).

## Setup
- Created connection `Verify UX Conn` via the Add connection dialog. Status dot stayed Disconnected.
- Inserted fixture `Chat` row id=2 (`Offline Chat`) so an existing thread could be opened while offline. The plus button cannot create a persisted chat while disconnected.

## Observed
- Offline plus (`Add item to Verify UX Conn`): `disabled`, parent `span.cursor-not-allowed` with `data-slot=tooltip-trigger`, hover tooltip `Connection is not active`, computed cursor `not-allowed`.
- Opening `Offline Chat` while disconnected invoked `agent:connect`. Sonner showed `Connect the database before using the agent` (gate still in `src/main.ts`, file left untouched). Chat rendered `Messages will appear here` with no hang. Textarea and Send stayed disabled. Textarea wrap hover showed `Connection is not active`.
- Store-forced `backendConnectionId=verify-online` and opened a chat whose `id === 1` (existing connect skip). Spinner (`aria-label=Loading`) stayed up. Textarea and Send were disabled. Offline tooltip wrap was absent.
- Opened chat id=2 while still store-online. Connect rejected, wait cleared, spinner gone, textarea enabled. After `fill textarea` with `hello from verify`, Send enabled. Plus button was enabled and not tooltip-wrapped.

## tsc
`npx -p typescript@5.6.3 tsc --noEmit` reported only `src/main.tsx(10,29)` strictNullChecks.

## Cleanup
`cleanup.sh` after this note.
