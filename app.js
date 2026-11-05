/* ===== Icons (inline SVG, no external libraries) ===== */
function svg(body, strokeWidth) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"'
       + ' stroke-width="' + (strokeWidth || 2) + '"'
       + ' stroke-linecap="round" stroke-linejoin="round">'
       + body
       + '</svg>';
}

const IC = {
  left:  svg('<polyline points="15 18 9 12 15 6"/>', 2.2),
  right: svg('<polyline points="9 18 15 12 9 6"/>', 2.2),
  pup:   svg('<polyline points="18 15 12 9 6 15"/>', 2.4),
  pdn:   svg('<polyline points="6 9 12 15 18 9"/>', 2.4),
  check: svg('<polyline points="20 6 9 17 4 12"/>', 3),

  trash: svg(
    '<polyline points="3 6 5 6 21 6"/>' +
    '<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>' +
    '<path d="M10 11v6M14 11v6"/>' +
    '<path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>'
  ),
  archive: svg(
    '<rect x="2" y="3" width="20" height="5" rx="1"/>' +
    '<path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/>' +
    '<path d="M12 11v6M9 14l3 3 3-3"/>'
  ),
  pencil: svg(
    '<path d="M12 20h9"/>' +
    '<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'
  ),
  restore: svg(
    '<polyline points="1 4 1 10 7 10"/>' +
    '<path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>'
  ),
  sun: svg(
    '<circle cx="12" cy="12" r="4"/>' +
    '<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41' +
    'M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>'
  ),
  moon: svg('<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'),

  grip:
    '<svg viewBox="0 0 24 24" fill="currentColor">' +
    '<circle cx="9"  cy="6"  r="1.6"/><circle cx="15" cy="6"  r="1.6"/>' +
    '<circle cx="9"  cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/>' +
    '<circle cx="9"  cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/>' +
    '</svg>'
};


/* ===== State ===== */
let S = { tasks: [], archived: [], checklist: [] };
let currentTab = 'board';
let filterMonth = 'all';
let archiveSearch = '';
let arcPage = 1;
let arcSize = 5;          // 0 means "All"
let dragId = null;

const COLS = [
  ['todo', 'To Do'],
  ['inprogress', 'In Progress'],
  ['done', 'Done']
];
const PRIORITY_LABEL = ['', 'LOW', 'MED', 'HIGH', 'CRIT'];
const app = document.getElementById('app');


/* ===== Helpers ===== */
function esc(s) {
  const d = document.createElement('div');
  d.textContent = (s == null) ? '' : String(s);
  return d.innerHTML;
}

function fmt(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d)) return '-';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function badge(p) {
  if (p <= 0) return '';
  return '<span class="badge p' + p + '">' + PRIORITY_LABEL[p] + '</span>';
}

function btn(cls, act, id, icon, title) {
  return '<button class="ib ' + cls + '"'
       + ' data-act="' + act + '"'
       + ' data-id="' + id + '"'
       + ' title="' + title + '">'
       + icon
       + '</button>';
}

function clampPriority(p) {
  return Math.max(0, Math.min(4, p));
}

function bumpPriority(list, id, delta) {
  const item = list.find(x => x.id === id);
  if (!item) return;
  item.priority = clampPriority((item.priority || 0) + delta);
  save();
}


/* ===== Persistence ===== */
async function load() {
  try {
    const res = await fetch('/tasks');
    const data = await res.json();
    S = {
      tasks: data.tasks || [],
      archived: data.archived || [],
      checklist: data.checklist || []
    };
  } catch (e) {
    /* keep empty state */
  }
  render();
}

async function save() {
  try {
    await fetch('/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(S)
    });
  } catch (e) {
    /* ignore network errors */
  }
  render();
}

function render() {
  if (currentTab === 'board') renderBoard();
  else if (currentTab === 'archive') renderArchive();
  else renderChecklist();
}


/* ===== Theme ===== */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('themeBtn').innerHTML =
    (theme === 'light') ? IC.sun : IC.moon;
}

document.getElementById('themeBtn').onclick = function () {
  const current = document.documentElement.getAttribute('data-theme');
  const next = (current === 'light') ? 'dark' : 'light';
  localStorage.setItem('kb-theme', next);
  applyTheme(next);
};

applyTheme(localStorage.getItem('kb-theme') || 'dark');


/* ===== Tabs ===== */
document.getElementById('tabs').onclick = function (e) {
  const b = e.target.closest('button');
  if (!b) return;

  currentTab = b.dataset.tab;
  filterMonth = 'all';
  archiveSearch = '';
  arcPage = 1;

  document.querySelectorAll('#tabs button').forEach(function (x) {
    x.classList.toggle('active', x === b);
  });
  render();
};


/* ===== Inline editing (board, archive, checklist) ===== */
function startEdit(container, id, list, textSelector, textKey) {
  const item = list.find(x => x.id === id);
  const textEl = container.querySelector(textSelector);
  const editBtn = container.querySelector('.ib.edit');
  if (!item || !textEl || !editBtn) return;
  if (container.querySelector('.edit-input')) return;

  const input = document.createElement('input');
  input.className = 'edit-input';
  input.value = item[textKey];
  textEl.replaceWith(input);

  editBtn.innerHTML = IC.check;
  editBtn.title = 'Save';
  editBtn.dataset.act = 'save';

  function commit() {
    const value = input.value.trim();
    if (!value) {
      input.focus();
      return;
    }
    item[textKey] = value;
    save();
  }

  editBtn.onclick = function (ev) {
    ev.stopPropagation();
    commit();
  };

  input.onkeydown = function (ev) {
    if (ev.key === 'Enter') commit();
    else if (ev.key === 'Escape') render();
  };

  input.focus();
  input.select();
}


/* ===== Board view ===== */
function renderBoard() {
  let h = '<div class="board">';

  for (const [status, name] of COLS) {
    const items = S.tasks
      .filter(t => t.status === status)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    h += '<div class="col" data-status="' + status + '">';
    h +=   '<div class="col-head">';
    h +=     '<span class="dot ' + status + '"></span>';
    h +=     '<span class="col-name">' + name + '</span>';
    h +=     '<span class="count">' + items.length + '</span>';

    if (status === 'todo') {
      h +=   '<div class="add-row">';
      h +=     '<input id="addTask" placeholder="Add a task..." maxlength="200">';
      h +=     '<button class="add-btn" id="addTaskBtn">+</button>';
      h +=   '</div>';
    }

    h +=   '</div>';
    h +=   '<div class="list">';

    if (items.length === 0) {
      h += '<div class="empty">Drop tasks here</div>';
    }

    for (const t of items) {
      h += taskCardHtml(t, status);
    }

    h +=   '</div>';
    h += '</div>';
  }

  h += '</div>';
  app.innerHTML = h;

  const input = document.getElementById('addTask');

  function addTask() {
    const title = input.value.trim();
    if (!title) return;
    S.tasks.push({
      id: crypto.randomUUID(),
      title: title,
      status: 'todo',
      createdAt: new Date().toISOString(),
      doneAt: null,
      priority: 0
    });
    save();
  }

  document.getElementById('addTaskBtn').onclick = addTask;
  input.onkeydown = function (e) {
    if (e.key === 'Enter') addTask();
  };

  wireBoardDragAndDrop();
}

function clearDropHighlights() {
  document.querySelectorAll('.col.drag-over').forEach(function (c) {
    c.classList.remove('drag-over');
  });
}

function wireBoardDragAndDrop() {
  // Cards are drag sources
  document.querySelectorAll('.board .card').forEach(function (card) {
    card.addEventListener('dragstart', function (e) {
      if (card.querySelector('.edit-input')) {
        e.preventDefault();
        return;
      }
      dragId = card.dataset.id;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragId);
    });

    card.addEventListener('dragend', function () {
      dragId = null;
      card.classList.remove('dragging');
      clearDropHighlights();
    });
  });

  // Columns are drop targets
  document.querySelectorAll('.board .col').forEach(function (col) {
    col.addEventListener('dragover', function (e) {
      if (!dragId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      col.classList.add('drag-over');
    });

    col.addEventListener('dragleave', function (e) {
      if (!col.contains(e.relatedTarget)) {
        col.classList.remove('drag-over');
      }
    });

    col.addEventListener('drop', function (e) {
      if (!dragId) return;
      e.preventDefault();
      col.classList.remove('drag-over');
      const id = dragId;
      dragId = null;
      setTaskStatus(id, col.dataset.status);
    });
  });
}

function taskCardHtml(t, status) {
  let h = '<div class="card' + (status === 'done' ? ' done' : '') + '"'
        + ' draggable="true" data-id="' + t.id + '">';

  if (status === 'done') {
    h += '<div class="tag-done">' + IC.check + ' Done</div>';
  }

  h += '<div class="title">' + esc(t.title) + '</div>';
  h += '<div class="date">Created ' + fmt(t.createdAt) + '</div>';
  h += badge(t.priority || 0);

  h += '<div class="actions">';
  if (status !== 'todo') h += btn('', 'left', t.id, IC.left, 'Move left');
  if (status !== 'done') h += btn('', 'right', t.id, IC.right, 'Move right');
  if (status === 'done') h += btn('archive', 'archive', t.id, IC.archive, 'Archive');
  h += btn('pup', 'pup', t.id, IC.pup, 'Priority up');
  h += btn('pdn', 'pdn', t.id, IC.pdn, 'Priority down');
  h += btn('edit', 'edit', t.id, IC.pencil, 'Edit');
  h += btn('del', 'del', t.id, IC.trash, 'Delete');
  h += '</div>';

  h += '</div>';
  return h;
}

function setTaskStatus(id, newStatus) {
  const task = S.tasks.find(x => x.id === id);
  if (!task || task.status === newStatus) return;

  task.status = newStatus;
  task.doneAt = (newStatus === 'done') ? new Date().toISOString() : null;
  save();
}

function moveTask(id, direction) {
  const task = S.tasks.find(x => x.id === id);
  if (!task) return;

  const order = ['todo', 'inprogress', 'done'];
  const idx = order.indexOf(task.status) + direction;
  if (idx < 0 || idx > 2) return;

  setTaskStatus(id, order[idx]);
}


/* ===== Click handling for all action buttons ===== */
app.addEventListener('click', function (e) {
  const b = e.target.closest('button[data-act]');
  if (!b) return;

  const act = b.dataset.act;
  const id = b.dataset.id;

  if (currentTab === 'board') {
    const card = b.closest('.card');

    if (act === 'left') {
      moveTask(id, -1);
    } else if (act === 'right') {
      moveTask(id, 1);
    } else if (act === 'archive') {
      const i = S.tasks.findIndex(x => x.id === id);
      if (i < 0) return;
      const t = S.tasks.splice(i, 1)[0];
      t.status = 'archived';
      t.archivedAt = new Date().toISOString();
      S.archived.push(t);
      save();
    } else if (act === 'pup') {
      bumpPriority(S.tasks, id, 1);
    } else if (act === 'pdn') {
      bumpPriority(S.tasks, id, -1);
    } else if (act === 'edit') {
      startEdit(card, id, S.tasks, '.title', 'title');
    } else if (act === 'del') {
      S.tasks = S.tasks.filter(x => x.id !== id);
      save();
    }

  } else if (currentTab === 'archive') {
    const card = b.closest('.card');

    if (act === 'restore') {
      const i = S.archived.findIndex(x => x.id === id);
      if (i < 0) return;
      const t = S.archived.splice(i, 1)[0];
      t.status = 'done';
      delete t.archivedAt;
      S.tasks.push(t);
      save();
    } else if (act === 'edit') {
      startEdit(card, id, S.archived, '.title', 'title');
    } else if (act === 'del') {
      S.archived = S.archived.filter(x => x.id !== id);
      save();
    }

  } else {
    const row = b.closest('.chk');

    if (act === 'pup') {
      bumpPriority(S.checklist, id, 1);
    } else if (act === 'pdn') {
      bumpPriority(S.checklist, id, -1);
    } else if (act === 'edit') {
      startEdit(row, id, S.checklist, '.chk-text', 'text');
    } else if (act === 'del') {
      S.checklist = S.checklist.filter(x => x.id !== id);
      save();
    }
  }
});


/* ===== Archive view ===== */
function monthKey(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return 'Unknown';
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function renderArchive() {
  // Newest archived first
  const all = S.archived.slice().sort(function (a, b) {
    return new Date(b.archivedAt || 0) - new Date(a.archivedAt || 0);
  });

  // Count per month for the dropdown
  const months = {};
  all.forEach(function (t) {
    const k = monthKey(t.archivedAt);
    months[k] = (months[k] || 0) + 1;
  });
  if (filterMonth !== 'all' && !months[filterMonth]) filterMonth = 'all';

  // Apply filters
  const q = archiveSearch.trim().toLowerCase();
  const filtered = all.filter(function (t) {
    const monthOk = (filterMonth === 'all') || (monthKey(t.archivedAt) === filterMonth);
    const searchOk = !q || (t.title || '').toLowerCase().includes(q);
    return monthOk && searchOk;
  });

  // Pagination
  const pages = (arcSize === 0) ? 1 : Math.max(1, Math.ceil(filtered.length / arcSize));
  if (arcPage > pages) arcPage = pages;
  const shown = (arcSize === 0)
    ? filtered
    : filtered.slice((arcPage - 1) * arcSize, arcPage * arcSize);

  // Header: month filter + search
  let h = '<div class="panel">';
  h += '<div class="view-head">';
  h +=   '<h2>Archive</h2>';
  h +=   '<div class="spacer"></div>';
  h +=   '<select class="sel" id="monthSel">';
  h +=     '<option value="all">All (' + all.length + ')</option>';
  for (const k in months) {
    h += '<option value="' + esc(k) + '"' + (k === filterMonth ? ' selected' : '') + '>'
       + esc(k) + ' (' + months[k] + ')</option>';
  }
  h +=   '</select>';
  h +=   '<input class="search" id="arcSearch" placeholder="Search archive..."'
       + ' value="' + esc(archiveSearch) + '">';
  h += '</div>';

  // Cards
  h += '<div class="arc-list">';
  if (shown.length === 0) {
    h += '<div class="empty">'
       + (all.length ? 'No archived tasks matching current filters' : 'No archived tasks')
       + '</div>';
  }
  for (const t of shown) {
    h += '<div class="card" data-id="' + t.id + '">';
    h +=   '<div class="title">' + esc(t.title) + '</div>';
    h +=   '<div class="date">Created ' + fmt(t.createdAt) + '</div>';
    h +=   '<div class="date">Completed ' + fmt(t.doneAt) + '</div>';
    h +=   '<div class="date">Archived ' + fmt(t.archivedAt) + '</div>';
    h +=   badge(t.priority || 0);
    h +=   '<div class="actions">';
    h +=     btn('restore', 'restore', t.id, IC.restore, 'Restore');
    h +=     btn('edit', 'edit', t.id, IC.pencil, 'Edit');
    h +=     btn('del', 'del', t.id, IC.trash, 'Delete permanently');
    h +=   '</div>';
    h += '</div>';
  }
  h += '</div>';

  // Pager
  h += '<div class="pager"><span>Show:</span>';
  const sizes = [['All', 0], ['5', 5], ['10', 10], ['15', 15], ['20', 20]];
  for (const [label, value] of sizes) {
    h += '<button class="pill' + (arcSize === value ? ' active' : '') + '"'
       + ' data-size="' + value + '">' + label + '</button>';
  }
  if (pages > 1 && arcSize !== 0) {
    h += '<button class="pill" id="prevP"' + (arcPage <= 1 ? ' disabled' : '') + '>Prev</button>';
    h += '<span>Page ' + arcPage + ' of ' + pages + '</span>';
    h += '<button class="pill" id="nextP"' + (arcPage >= pages ? ' disabled' : '') + '>Next</button>';
  }
  h += '</div>';
  h += '</div>';

  app.innerHTML = h;

  // Wire up controls
  document.getElementById('monthSel').onchange = function (e) {
    filterMonth = e.target.value;
    arcPage = 1;
    renderArchive();
  };

  document.getElementById('arcSearch').oninput = function (e) {
    archiveSearch = e.target.value;
    arcPage = 1;
    renderArchive();
    const el = document.getElementById('arcSearch');
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  };

  document.querySelectorAll('.pill[data-size]').forEach(function (p) {
    p.onclick = function () {
      arcSize = Number(p.dataset.size);
      arcPage = 1;
      renderArchive();
    };
  });

  const prev = document.getElementById('prevP');
  const next = document.getElementById('nextP');
  if (prev) prev.onclick = function () { arcPage--; renderArchive(); };
  if (next) next.onclick = function () { arcPage++; renderArchive(); };
}


/* ===== Daily checklist view ===== */
// Checklist in display order: highest priority first, stored order within a priority
function sortedChecklist() {
  return S.checklist
    .slice()
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));
}

function renderChecklist() {
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const items = sortedChecklist();

  let h = '<div class="panel">';
  h += '<div class="view-head">';
  h +=   '<div><h2>Daily Checklist</h2><div class="sub">' + today + '</div></div>';
  h +=   '<div class="spacer"></div>';
  h +=   '<button class="btn" id="uncheckAll">Uncheck All</button>';
  h += '</div>';

  h += '<div class="add-row" style="margin-bottom:16px">';
  h +=   '<input id="addChk" placeholder="Add a daily item..." maxlength="200">';
  h +=   '<button class="add-btn" id="addChkBtn">+</button>';
  h += '</div>';

  h += '<div class="chk-list">';
  if (items.length === 0) {
    h += '<div class="empty">No items yet</div>';
  }
  for (const c of items) {
    h += '<div class="chk' + (c.checked ? ' checked' : '') + '" draggable="true" data-id="' + c.id + '">';
    h +=   '<span class="grip">' + IC.grip + '</span>';
    h +=   '<div class="box" data-toggle="' + c.id + '">' + IC.check + '</div>';
    h +=   '<div class="chk-body">';
    h +=     '<div class="chk-text">' + esc(c.text) + '</div>';
    h +=     '<div class="chk-meta">';
    h +=       '<span class="date">' + fmt(c.createdAt) + '</span>';
    h +=       badge(c.priority || 0);
    h +=     '</div>';
    h +=   '</div>';
    h +=   '<div class="chk-actions">';
    h +=     btn('pup', 'pup', c.id, IC.pup, 'Priority up');
    h +=     btn('pdn', 'pdn', c.id, IC.pdn, 'Priority down');
    h +=     btn('edit', 'edit', c.id, IC.pencil, 'Edit');
    h +=     btn('del', 'del', c.id, IC.trash, 'Delete');
    h +=   '</div>';
    h += '</div>';
  }
  h += '</div>';
  h += '</div>';

  app.innerHTML = h;

  // Add item
  const input = document.getElementById('addChk');

  function addItem() {
    const text = input.value.trim();
    if (!text) return;
    S.checklist.push({
      id: crypto.randomUUID(),
      text: text,
      checked: false,
      createdAt: new Date().toISOString(),
      priority: 0
    });
    save();
  }

  document.getElementById('addChkBtn').onclick = addItem;
  input.onkeydown = function (e) {
    if (e.key === 'Enter') addItem();
  };

  // Uncheck all
  document.getElementById('uncheckAll').onclick = function () {
    S.checklist.forEach(function (c) { c.checked = false; });
    save();
  };

  // Toggle checkbox
  document.querySelectorAll('.box').forEach(function (box) {
    box.onclick = function () {
      const item = S.checklist.find(x => x.id === box.dataset.toggle);
      if (item) {
        item.checked = !item.checked;
        save();
      }
    };
  });

  // Drag and drop reordering
  document.querySelectorAll('.chk').forEach(function (row) {
    row.addEventListener('dragstart', function (e) {
      if (row.querySelector('.edit-input')) {
        e.preventDefault();
        return;
      }
      dragId = row.dataset.id;
      row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragId);
    });

    row.addEventListener('dragover', function (e) {
      e.preventDefault();
      row.classList.add('over');
    });

    row.addEventListener('dragleave', function (e) {
      // Ignore leave events fired when moving over this row's own children
      if (!row.contains(e.relatedTarget)) {
        row.classList.remove('over');
      }
    });

    row.addEventListener('drop', function (e) {
      e.preventDefault();
      row.classList.remove('over');
      if (!dragId || dragId === row.dataset.id) return;

      // Work on the order the user actually sees (sorted by priority),
      // not the raw storage order, then store that order back.
      const visible = sortedChecklist();
      const from = visible.findIndex(x => x.id === dragId);
      const target = visible.find(x => x.id === row.dataset.id);
      if (from < 0 || !target) return;

      const moved = visible.splice(from, 1)[0];
      // The list is grouped by priority, so dropping into another group
      // moves the item into that group to make the new position stick.
      moved.priority = target.priority || 0;

      // Insert before the target row (matches the blue top-border indicator)
      const to = visible.findIndex(x => x.id === target.id);
      visible.splice(to, 0, moved);

      S.checklist = visible;
      dragId = null;
      save();
    });

    row.addEventListener('dragend', function () {
      dragId = null;
      row.classList.remove('dragging');
      document.querySelectorAll('.chk.over').forEach(function (x) {
        x.classList.remove('over');
      });
    });
  });
}


/* ===== Start ===== */
load();
