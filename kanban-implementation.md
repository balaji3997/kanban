# Kanban Board — Full Regeneration Prompt

Paste this prompt into Claude Code on any system to regenerate the exact same application.

---

Build a standalone Kanban Board application as a single Python file called `kanban.py`. It must use only Python stdlib (no pip installs) and embed the entire frontend (HTML/CSS/JS) as a raw string inside the Python file.

## Runtime & Architecture
- Python stdlib only: `http.server`, `json`, `os`, `socketserver`, `threading`, `webbrowser`
- Serve on port **8888** via `socketserver.TCPServer` with `allow_reuse_address = True` (define it once as a `PORT = 8888` constant and build the URL `http://localhost:8888` from it)
- On startup: print the URL and tasks file path to the console, then auto-open the browser after a 0.7s delay using `threading.Timer`
- Persist all data to `tasks.json` in the same directory as the script (use `os.path.dirname(os.path.abspath(__file__))`)
- Silence HTTP request logs (override `log_message(self, *_)` to do nothing)
- Send `Cache-Control: no-store` and a correct `Content-Length` on every response; POST `/tasks` returns `{"ok": true}` on success and HTTP 400 `{"ok": false}` for a malformed/non-object body
- The Python file must be organised with section comments (data helpers, embedded frontend, HTTP server) and a `main()` guarded by `if __name__ == "__main__":`
- Handle Ctrl+C gracefully with a "Goodbye!" message
- Routes: GET `/` and `/index.html` → HTML page; GET `/tasks` → JSON; POST `/tasks` → save JSON; everything else → 404
- JSON persistence: load with `setdefault` for `tasks`, `archived`, `checklist` keys; save with `indent=2`

## Data Model (tasks.json)
```json
{
  "tasks": [{"id": "uuid4", "title": "...", "status": "todo|inprogress|done", "createdAt": "ISO8601", "doneAt": "ISO8601|null", "priority": 0}],
  "archived": [{"id":"...","title":"...","status":"archived","createdAt":"...","doneAt":"...","archivedAt":"...","priority":0}],
  "checklist": [{"id": "uuid4", "text": "...", "checked": false, "createdAt": "ISO8601", "priority": 0}]
}
```

## UI — Three Tabs
Header: logo mark "KB" (gradient square, 38×38px, border-radius 11px), title "My Board" (gradient text), theme toggle button (sun/moon SVG icon, persisted to localStorage as `kb-theme`, default dark), and a tab nav pill group with tabs: **Board**, **Archive**, **Daily**.

---

### Tab 1: Board View
Three columns side by side: **To Do**, **In Progress**, **Done**.
- Each column has a colored glowing dot (blue=todo, amber=in-progress, green=done), uppercase column name, and a count badge
- **To Do column only** has an add-task input + "+" button in the column header
- Pressing Enter in the add input calls the same add handler as clicking "+"
- Task cards are sorted highest priority first within each column
- **Drag and drop between columns** (HTML5 drag events, same style as the Daily checklist):
  - Every board card has `draggable="true"` and a `grab` cursor; each column element carries a `data-status` attribute (`todo`, `inprogress`, `done`)
  - A card can be dragged from any column and dropped on any other column, including skipping one (e.g. To Do → Done, Done → To Do)
  - `dragstart` stores the task id in a module-level `dragId` (also set via `dataTransfer.setData`) and adds a `.dragging` class (35% opacity, popIn animation and hover lift disabled); `dragend` clears `dragId`, the class, and any column highlights
  - `dragstart` is cancelled if the card is currently in inline-edit mode (contains `.edit-input`)
  - While a card is dragged over a column, the column gets a `.drag-over` class (blue border + soft blue glow ring); `dragleave` removes it only when the pointer actually leaves the column (check `relatedTarget`)
  - On `drop`, call `setTaskStatus(id, column.dataset.status)`; dropping on the card's own column is a no-op. The whole column (including the empty "Drop tasks here" placeholder) is the drop zone, so empty columns accept drops
  - `setTaskStatus(id, newStatus)` is the single place that changes status: sets `doneAt` to now when the new status is `done`, otherwise `null`, then calls `save()`. The arrow buttons (`moveTask`) call it too
  - The left/right arrow buttons remain as an alternative to dragging
- Each task card shows:
  - A green "✓ Done" tag (only on done cards)
  - Task title text
  - "Created DD Mon YYYY" date line
  - Priority badge (only if priority > 0): LOW (gray), MED (blue), HIGH (amber), CRIT (red)
  - Action buttons:
    - Left arrow (move left) — hidden on todo cards
    - Right arrow (move right) — hidden on done cards
    - Archive button (box-with-arrow SVG) — only on done cards; moves card to archived list
    - Priority Up (chevron up)
    - Priority Down (chevron down)
    - Edit (pencil) — triggers inline edit mode
    - Delete (trash) — permanently removes from tasks
- Moving a task to "done" (via arrows or drag and drop) sets `doneAt`; moving away clears it
- Cards animate in with a spring pop-in (`popIn` keyframe: translateY -10px + scale 0.96 → normal)
- Hover: lift 2px + box-shadow + border becomes visible
- Done cards get a subtle green-tinted background
- Empty column shows a dashed-border placeholder "Drop tasks here"
- Board height is `calc(100vh - 200px)`, columns are flex with internal scroll

---

### Tab 2: Archive View
- Archived tasks sorted newest-first by `archivedAt`
- Month/year filter dropdown (auto-populated from data, shows count per month, includes "All (N)" option)
- Search input (filters by title, case-insensitive)
- Pagination controls at the bottom:
  - "Show:" pill buttons for page size: All, 5, 10, 15, 20 (default 5)
  - Prev / Page X of Y / Next navigation (hidden when only 1 page or showing All)
- Each archived card shows: title, Restore button (undo-arrow SVG), Edit button, Delete button (permanent), plus three date lines: Created, Completed, Archived (all formatted DD Mon YYYY), plus priority badge if > 0
- Restore moves the card back to `tasks` with `status: "done"`, removing `archivedAt`
- Inline editing works the same as on the board (Enter saves, Escape cancels)
- Empty state text: "No archived tasks" or "No archived tasks matching current filters"

---

### Tab 3: Daily Checklist View (tab label: "Daily")
- Header shows "Daily Checklist" and today's full date (e.g. "Thursday, 05 November 2026")
- "Uncheck All" button resets all items to unchecked
- Add input + "+" button (Enter key supported)
- Items sorted highest priority first
- Each item:
  - Drag handle (6-dot grip SVG icon, visible on hover)
  - Checkbox (custom styled square, turns green with checkmark when checked)
  - Item text (strikethrough + muted color when checked)
  - Priority badge (if > 0)
  - Created date
  - Priority Up / Priority Down buttons
  - Edit button (inline edit, Enter saves, Escape cancels)
  - Delete button
- Checked items get green-tinted background + border
- **Drag-and-drop reordering**: HTML5 drag events (`draggable="true"`, dragstart/dragover/dragleave/drop/dragend). Dragged item fades to 35% opacity; drop target gets a blue top-border indicator. On drop, splice the item from its old index to the new one and save.

---

## Styling & Theming
CSS custom properties on `:root` for dark mode (default):
- `--bg: #0b0e17`, `--surface: #141824`, `--surface2: #1c2133`, `--card: #1a1f30`, `--card-h: #202537`, `--border: #272d45`, `--text: #dde1f5`, `--muted: #5d6490`
- Accent colors: `--blue: #4f8ef7`, `--blue-g: #7c5ef7`, `--amber: #f5a623`, `--green: #27c485`, `--red: #f25c5c`

`[data-theme="light"]` overrides: `--bg: #f0f2f8`, `--surface: #ffffff`, `--surface2: #eaecf5`, `--card: #ffffff`, `--card-h: #f4f6ff`, `--border: #d4d8ee`, `--text: #1a1d2e`, `--muted: #8b91b8` (accent colors unchanged). In light mode, `h1` uses a dark-to-blue gradient text instead of white-to-muted.

Font: `'Comic Sans MS', 'Comic Sans', 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`

Custom scrollbar: 6px wide, transparent track, `--border` colored thumb, 4px radius.

Max-width 1260px centered, 28px side padding.

All action buttons (28×28px, `--surface2` background, `--border` on hover) have specific hover tints:
- Archive btn hover: blue tint
- Delete btn hover: red tint
- Edit btn hover: amber tint
- Restore btn hover: green tint
- Priority-up btn hover: amber tint
- Priority-down btn hover: muted tint

Theme toggle button: 36×36px, border `var(--border)`.
Add "+" buttons: 38×38px, blue-to-purple gradient, `border-radius: 9px`.

**Responsive** (≤780px): 16px side padding, header stacks vertically, board columns stack vertically with `max-height: 55vh` scroll on task lists.

## All Inline SVG Icons (no external icon libraries)
Define all icons as strings in a `const IC = {}` object. Build the stroke-style icons with a small `svg(body, strokeWidth)` helper that wraps the path markup in a shared `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">` element (default stroke width 2), so each icon is a short readable line; `grip` is a filled-circle SVG written out directly:
- `left`: chevron-left (move task left)
- `right`: chevron-right (move task right)
- `trash`: trash/delete
- `archive`: archive box with down-arrow
- `check`: checkmark (also used as "Done" tag and inline-edit save confirmation)
- `pencil`: edit/pencil
- `restore`: undo-arrow (restore from archive)
- `sun`: sun (shown when in light mode, to switch to dark)
- `moon`: crescent moon (shown when in dark mode, to switch to light)
- `pup`: chevron-up (priority increase)
- `pdn`: chevron-down (priority decrease)
- `grip`: 6-dot grid (drag handle for checklist)

## Inline Editing (all three views)
Clicking the edit/pencil button on any item (board card, archive card, or checklist item) replaces the title/text element in-place with an `<input class="edit-input">` pre-filled with the current value, focused and selected. The pencil button becomes a checkmark "save" button. Pressing Enter or clicking the checkmark saves and re-renders. Pressing Escape cancels and re-renders. Empty input on save does nothing (keeps focus). After saving, persist to `tasks.json`.

## State & API
- Frontend state: `S = { tasks: [], archived: [], checklist: [] }` loaded from `GET /tasks` on page load
- Every mutation calls `save()` which does `POST /tasks` with the full state as JSON body, then calls `render()`
- `render()` dispatches to `renderBoard()`, `renderArchive()`, or `renderChecklist()` based on `currentTab`
- Use `crypto.randomUUID()` for new IDs
- Dates formatted as DD Mon YYYY (e.g. "05 Nov 2026") using `toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'})`
- Always HTML-escape user text before inserting into innerHTML (use a `esc()` helper that creates a temp div, sets textContent, returns innerHTML)
- Priority system: 0=none, 1=LOW, 2=MED, 3=HIGH, 4=CRIT; clamped to [0,4]; badge only shown if > 0
- Switching tabs resets filterMonth, archiveSearch, and arcPage to defaults
- Only Board cards and Daily checklist rows are draggable; Archive cards are not
- Board drag state reuses the single module-level `dragId` variable shared with the Daily checklist drag-and-drop

## Code Layout & Readability (embedded HTML template)
The embedded frontend must be human-readable, not minified:
- Full, properly indented HTML document (`<head>` with `<style>`, `<body>` with the header/nav and `<main id="app">`, then one `<script>`)
- CSS expanded with one property per line, grouped under comment headers (Theme variables, Base, Header, Board, Inputs, Cards, Priority badges, Action buttons, Archive & Daily views, Checklist, Responsive); short one-line rules are acceptable only for tiny colour/variant groups such as the `.p1`–`.p4` badges and the `.ib.*:hover` tints
- JavaScript split into labelled sections with comment banners: Icons, State, Helpers, Persistence, Theme, Tabs, Inline editing, Board view, Click handling, Archive view, Daily checklist view, Start
- Long HTML strings built across several `h += ...` lines (one element per line, indented to mirror nesting); the board card markup lives in its own `taskCardHtml(t, status)` function
- No line in the file longer than about 110 characters
- Drag-and-drop wiring for the board lives in `wireBoardDragAndDrop()`, called at the end of `renderBoard()`; a `clearDropHighlights()` helper removes `.drag-over` from all columns

The final file must be runnable with just `python kanban.py` on any system with Python 3.6+, with no installs required.
