# First-question chat title (2026-10-23)

Scratch home `/tmp/intellidb-verify-home`. CDP port 9333 because 9222 was already bound. Viewport overridden to 1400x900 so the sidebar rendered.

## String rule

`node --experimental-strip-types scripts/check-initial-chat-title.mts` printed `ok`.

## UI

1. Enabled Cursor CLI and set the binary to `/home/pavle/.local/bin/cursor-agent`. Settings rows confirmed in the scratch DB.
2. Created connection `verify-title` through the Add connection dialog and connected. Toast `Connected to verify-title`. Status `Connected`.
3. New chat, sent `How do I list tables?`. Header, sidebar, and `Chat.Name` were `How do I list tab...` (length 20). The message bubble still showed the full question. Screenshot `chat-title-first-question-2026-10-23.png`.
4. Second chat, sent `List tables`. Header and `Chat.Name` were `List tables` (length 11).
5. Manual rename of that chat to `This manual name is intentionally longer than twenty`. Header and `Chat.Name` kept all 52 characters. The first chat stayed `How do I list tab...`.

```
SELECT ID, Name, length(Name) AS n FROM Chat ORDER BY ID;
```

ID 1 length 20. ID 2 length 52 after the manual rename.
