#!/usr/bin/env python3
"""Standalone Kanban Board - Python stdlib only. Run: python kanban.py"""
import http.server
import json
import os
import socketserver
import threading
import webbrowser

PORT = 8888
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TASKS_FILE = os.path.join(BASE_DIR, "tasks.json")


def load_data():
    data = {}
    if os.path.exists(TASKS_FILE):
        try:
            with open(TASKS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (ValueError, OSError):
            data = {}
    if not isinstance(data, dict):
        data = {}
    data.setdefault("tasks", [])
    data.setdefault("archived", [])
    data.setdefault("checklist", [])
    return data


def save_data(data):
    with open(TASKS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


# ---------------------------------------------------------------------------
# Frontend files (served from disk, next to this script)
# ---------------------------------------------------------------------------
STATIC_FILES = {
    "/": ("index.html", "text/html; charset=utf-8"),
    "/index.html": ("index.html", "text/html; charset=utf-8"),
    "/style.css": ("style.css", "text/css; charset=utf-8"),
    "/app.js": ("app.js", "application/javascript; charset=utf-8"),
}


def read_static(name):
    with open(os.path.join(BASE_DIR, name), "rb") as f:
        return f.read()


# ---------------------------------------------------------------------------
# HTTP server
# ---------------------------------------------------------------------------
class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass  # silence request logs

    def _send(self, code, body, ctype):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path in STATIC_FILES:
            name, ctype = STATIC_FILES[path]
            try:
                self._send(200, read_static(name), ctype)
            except OSError:
                self._send(404, ("Missing file: " + name).encode("utf-8"), "text/plain")
        elif path == "/tasks":
            self._send(200, json.dumps(load_data()).encode("utf-8"), "application/json")
        else:
            self._send(404, b"Not found", "text/plain")

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        if path != "/tasks":
            self._send(404, b"Not found", "text/plain")
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            data = json.loads(self.rfile.read(length).decode("utf-8"))
            if not isinstance(data, dict):
                raise ValueError("bad payload")
            data.setdefault("tasks", [])
            data.setdefault("archived", [])
            data.setdefault("checklist", [])
            save_data(data)
            self._send(200, b'{"ok": true}', "application/json")
        except (ValueError, OSError):
            self._send(400, b'{"ok": false}', "application/json")


def main():
    socketserver.TCPServer.allow_reuse_address = True
    url = "http://localhost:%d" % PORT
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print("Kanban board running at %s" % url)
        print("Tasks file: %s" % TASKS_FILE)
        threading.Timer(0.7, lambda: webbrowser.open(url)).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nGoodbye!")


if __name__ == "__main__":
    main()
