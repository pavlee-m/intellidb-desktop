# Chat markdown rendering

Date: 2026-10-22

## What changed

`agent_message` entries in `ActivityEntry` (`src/components/index/ChatView.tsx`) render through `react-markdown` inside a `.chat-markdown` wrapper. Styling is a scoped block in `src/styles/global/globals.css`. No `rehype-raw`, so raw HTML in agent output stays escaped.

## Proof

Live agent reply through the real UI (scratch home, Cursor CLI, model Auto), DOM of `.chat-markdown`:

```html
<h2>Connection ready</h2>
<ul>
<li>Target: AdventureWorks2025</li>
<li>Mode: <code>dangerousQueries</code> off</li>
</ul>
```

The user bubble for the same turn stayed a plain text node (`whitespace-pre-wrap`, no child elements). The agent thought line above the reply stayed italic plain text. Screenshot: `chat-markdown-render-2026-10-22.png`.
