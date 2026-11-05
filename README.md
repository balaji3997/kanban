# Kanban Board

A standalone Kanban board. The backend is a single Python file (`kanban.py`) that uses only the Python standard library (no `pip install`). The frontend is plain HTML, CSS and JavaScript kept in separate files (`index.html`, `style.css`, `app.js`) for easy maintenance, with no frameworks or build step. Data is saved to a local `tasks.json`.

## Quick start

```bash
python kanban.py
```

Requires Python 3.6+. Keep all the files in this repo together in one folder. The app serves on **http://localhost:8888** and opens your browser automatically. Press `Ctrl+C` to stop it.

## Features

### Board tab
- Three columns: **To Do**, **In Progress**, **Done**, each with a coloured glowing dot and a count badge
- Add tasks from the To Do column (button or Enter key)
- **Drag and drop** cards from any column to any other column (for example To Do straight to Done); the target column highlights while you hover. Left/right arrow buttons still work too
- Cards are sorted by priority (highest first) and show created date and a priority badge (LOW / MED / HIGH / CRIT)
- Per-card actions: move left/right, archive (Done cards only), priority up/down, inline edit, delete
- Moving a task into Done sets `doneAt`; moving it out clears it

### Archive tab
- Archived tasks, newest first, with month/year filter, title search and pagination (All / 5 / 10 / 15 / 20 per page)
- Restore (back to Done), inline edit, permanent delete
- Shows created, completed and archived dates

### Daily tab
- Daily checklist with today's date, an "Uncheck All" button and add/edit/delete
- Priority up/down and drag-and-drop reordering via the grip handle. Items are grouped by priority, so dropping an item onto one with a different priority moves it into that priority group

### General
- Dark (default) and light theme, remembered in `localStorage` (`kb-theme`)
- Inline editing everywhere: Enter saves, Escape cancels
- Responsive layout (columns stack below 780px)
- All icons are inline SVG; no external libraries or network access

## How it works

| Part | Details |
|------|---------|
| Server | `http.server` + `socketserver.TCPServer` on port `8888` (`PORT` constant), `allow_reuse_address = True` |
| Routes | `GET /` and `/index.html` return `index.html`, `GET /style.css` and `GET /app.js` return the stylesheet and script, `GET /tasks` returns JSON, `POST /tasks` saves JSON, anything else is 404 |
| Static files | Only `index.html`, `style.css` and `app.js` are served (fixed whitelist) and are read from disk on each request, so edit and refresh without restarting |
| Storage | `tasks.json` next to the script, written with `indent=2`; missing keys are filled with defaults on load |
| Frontend | Vanilla JS in `app.js`. State `S = {tasks, archived, checklist}` is loaded from `/tasks`; every change POSTs the full state and re-renders |
| Startup | Prints the URL and tasks file path, opens the browser after 0.7s |

### Data model (`tasks.json`)

```json
{
  "tasks": [
    {"id": "uuid", "title": "...", "status": "todo|inprogress|done",
     "createdAt": "ISO8601", "doneAt": "ISO8601|null", "priority": 0}
  ],
  "archived": [
    {"id": "uuid", "title": "...", "status": "archived", "createdAt": "...",
     "doneAt": "...", "archivedAt": "...", "priority": 0}
  ],
  "checklist": [
    {"id": "uuid", "text": "...", "checked": false, "createdAt": "ISO8601", "priority": 0}
  ]
}
```

Priority is `0` (none), `1` LOW, `2` MED, `3` HIGH, `4` CRIT.

## Project files

| File | Purpose |
|------|---------|
| `kanban.py` | Backend: HTTP server, static file serving and JSON persistence |
| `index.html` | Page markup (header, tabs, app container) |
| `style.css` | All styling, themes and responsive rules |
| `app.js` | All frontend logic: state, rendering, drag and drop, editing |
| `kanban-implementation.md` | Full specification / prompt to regenerate the app |
| `tasks.json` | Your data, created on first run (git-ignored) |
| `.gitignore` | Keeps `tasks.json` and Python/editor files out of git |

## Configuration

To change the port, edit `PORT` at the top of `kanban.py`. If startup fails with "address already in use", another program is using that port.

## Regenerating the app

`kanban-implementation.md` contains a complete prompt that can be pasted into Claude Code to rebuild all four app files (`kanban.py`, `index.html`, `style.css`, `app.js`) from scratch.
