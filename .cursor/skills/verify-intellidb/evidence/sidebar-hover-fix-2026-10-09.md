# Sidebar connections/chats hover fix — 2026-10-09

## Reported

- Expanding a connection highlighted the whole block (header + entire chat list).
- Each chat had no distinct hover highlight.
- The add-chat button's hover reveal behaved strangely while expanded.

## Repro surface

Real Electron renderer via `launch.sh` + `drive.mjs` (scratch HOME). Connection "Repro Local" created through the real Add-connection dialog (verified in scratch config DB: `SELECT ID, Name FROM Connection` → ID 1). Three chat rows seeded directly into the scratch config DB (`Chat` table) because creating a chat needs a live MSSQL server; expansion then loads them through the real `chats:get` IPC path.

## Before-fix evidence

- `evidence/repro-expanded.png` — expanded block is one muted slab covering header + all chats.
- Computed styles (open block): block bg `oklch(0.97 0 0)`; chat button idle `rgba(0,0,0,0)` with class `hover:bg-muted` (`--muted` = `oklch(0.97 0 0)`). Hovering a chat painted it exactly the block's color → invisible.
- Add button while hovering row: computed opacity stable at **0.5** for 3s (polled at 200/500/1000/2000/3000ms — not a transition). Cause: button `disabled` (inactive connection) + shadcn `disabled:opacity-50` fighting `group-hover/connection:opacity-100`.

## Fix (src/routes/index.tsx)

1. Removed `data-[state=open]:bg-muted` from the `Collapsible` — the block no longer highlights as a whole; each chat's own `hover:bg-muted` becomes visible.
2. Add button's reveal classes (`group-hover/connection:visible/scale-100/opacity-100`) are now applied only when the connection is active (`backendConnectionId` truthy). Disabled button stays hidden on hover instead of ghosting in at half opacity; the red status dot and the "Connection is not active" tooltip keep signaling the state.

## After-fix evidence

- `evidence/after-fix-chat-hover.png` — hovered chat ("Quarterly revenue") has its own pill highlight; siblings and block stay plain.
- Computed: hovered chat bg `oklch(0.97 0 0)`, sibling chats `rgba(0,0,0,0)`, block `rgba(0,0,0,0)`.
- Add button on chat hover: `visibility: hidden` (scoped to row, unchanged).
- Row hover with inactive connection: button stays hidden (`visibility: hidden`, no half-opacity ghost).
- Enabled-branch proof (no live MSSQL available): clone of the button with the enabled class composition inside the real `group/connection` context fades to `opacity: 1, visibility: visible` on row hover.
- `evidence/after-fix-row-hover.png` — row hover with inactive connection, no ghost button.

## Notes

- Two relaunches failed with "Failed to start backend" — the app's ~2.5s health window vs cold backend boot is borderline (harness flake, not app code); the third launch passed unchanged. Potential follow-up for the verify skill: warm longer or raise the retry count.

## Follow-up: shared margins + vertical rhythm — 2026-10-09 (later)

Reported: connection row and its chats had different margins, and elements sat too close vertically.

Before (measured): connection pill left 0 / right 253; chat pills left 10 / right 271; row→first chat 0px; chat→chat 4px; connection→connection 0px (SidebarMenu `gap-0`).

Fix (4 class changes): `SidebarMenu className="gap-1.5"`; `CollapsibleContent` padding `p-2.5 pt-0` → `p-0 pt-1.5`; chat list `ul` `gap-1` → `gap-1.5 pr-7` (pr-7 mirrors the row's reserved add-button width, `size-7`); `ChatItem` button `px-2` → `px-2.5` to match the connection button's horizontal padding.

After (measured): all pills left 0 / right 227 — identical horizontal box; row→first chat 6px; chat→chat 6px; collapsed connection→connection 6px; expanded list→next connection 6px.

Evidence: `evidence/after-spacing-fix.png` (hovered chat pill aligned to the connection pill's box).

Note: the harness launch was blocked by a user instance holding ports 5173/8000; proceeded after the user closed it (asked per the skill's isolation rules).

## Follow-up: add-button visibility + full-row hover — 2026-10-09 (later still)

Reported: the add-chat button was completely invisible when the connection was offline, and hovering the row did not highlight the strip where the button sits.

Before (measured): the row's hover highlight (the trigger Button pill) ended at right 227 while the row box extended to 255, so the reserved button strip never highlighted; the offline button revealed nothing on hover (previous fix made reveal classes conditional on connection state).

Fix (2 class changes in src/routes/index.tsx):
1. Reverted the reveal classes to unconditional — the button fades in on hover for offline connections too. When disabled it fades to opacity 0.5 (shadcn's disabled styling), with cursor-not-allowed and the "Connection is not active" tooltip.
2. Moved the hover and expanded backgrounds from the trigger Button to the row container (`group/connection ... rounded-md hover:bg-muted group-data-[state=open]:bg-muted`), so the highlight covers the full row including the button strip. The expanded-connection indicator also moved to the row; chats stay outside it.

After (measured, dark theme): hovering the row center or the button strip → row bg highlighted, button `visibility: visible, opacity: 0.5` (disabled); hovering a chat → button hidden, chat highlighted, row unchanged. Enabled branch re-proven via the same clone technique: `{"opacity":"1","visibility":"visible"}` on row hover.

Evidence: `evidence/after-addbtn-fix-row-hover.png` (offline row hover: full-row highlight + faint plus button).

Note: mid-verification the app window was interacted with directly (theme switched to dark in the scratch DB, sidebar toggled), which briefly invalidated probe coordinates; all measurements above were retaken against fresh geometry.

## Follow-up: full-width chat hover — 2026-10-09 (later still)

Reported: hovering a chat left an unhighlightable strip on the right.

Cause: the `pr-7` I had added to the chat `ul` (to mirror the connection pill's reserved add-button width) bounded chat pills at right 227 while the row box extended to 255.

Fix: removed `pr-7` from the chat `ul`. Chat pills now span the same 0→255 box as the connection row's highlight, so hover covers the full width everywhere. Tradeoff accepted: chat pills extend 28px past the connection button's pill on the right, matching the row highlight rather than the pill; the connection row's own hover/expanded highlight covers that same full width, so the sidebar reads as one consistent column.

After (measured, light theme): chat pills left 0 / right 255 = row box; hovering chat center or the far-right strip (x=247) both highlight (`oklch(0.97 0 0)`); add button stays hidden on chat hover.

Evidence: `evidence/after-chat-fullwidth-hover.png` (hovered chat pill spanning the full row width).