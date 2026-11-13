const STORAGE_KEY = "todo.tasks";
const THEME_KEY = "todo.theme";

const $ = (id) => document.getElementById(id);
const form = $("taskForm"), taskInput = $("taskInput"), priorityInput = $("priorityInput"), dueInput = $("dueInput");
const list = $("taskList"), emptyState = $("emptyState"), searchInput = $("searchInput");

let tasks = load();
let filter = "all";
let query = "";
let editingId = null;
let dragId = null;

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}
function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
function formatDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/* ---- Actions: each one updates Local Storage ---- */
function addTask(title, priority, due) {
  tasks.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title, priority, due, completed: false });
  save(); render();
}
function toggleTask(id) {
  const t = tasks.find((t) => t.id === id);
  if (t) { t.completed = !t.completed; save(); render(); }
}
function deleteTask(id) {
  tasks = tasks.filter((t) => t.id !== id);
  save(); render();
}
function updateTask(id, title) {
  const t = tasks.find((t) => t.id === id);
  if (t && title.trim()) t.title = title.trim();
  editingId = null;
  save(); render();
}
function clearCompleted() {
  tasks = tasks.filter((t) => !t.completed);
  save(); render();
}
function moveTask(fromId, toId) {
  const from = tasks.findIndex((t) => t.id === fromId);
  const to = tasks.findIndex((t) => t.id === toId);
  if (from < 0 || to < 0 || from === to) return;
  const [item] = tasks.splice(from, 1);
  tasks.splice(to, 0, item);
  save(); render();
}

/* ---- Rendering ---- */
function visibleTasks() {
  return tasks.filter((t) => {
    if (filter === "completed" && !t.completed) return false;
    if (filter === "pending" && t.completed) return false;
    return t.title.toLowerCase().includes(query);
  });
}

function render() {
  const total = tasks.length;
  const done = tasks.filter((t) => t.completed).length;
  $("totalCount").textContent = total;
  $("doneCount").textContent = done;
  $("completedCount").textContent = done;
  $("pendingCount").textContent = total - done;
  const pct = total ? Math.round((done / total) * 100) : 0;
  $("barFill").style.width = pct + "%";
  document.querySelector(".bar").setAttribute("aria-valuenow", pct);

  const items = visibleTasks();
  list.replaceChildren(...items.map(buildItem));

  if (items.length === 0) {
    emptyState.hidden = false;
    emptyState.textContent = total === 0
      ? "No tasks yet. Add your first task above."
      : "No tasks match this filter or search.";
  } else {
    emptyState.hidden = true;
  }
}

function buildItem(t) {
  const li = document.createElement("li");
  li.className = "task" + (t.completed ? " done" : "");
  li.dataset.priority = t.priority;
  li.dataset.id = t.id;

  // Drag and drop sorting only when the full list is showing
  if (filter === "all" && !query) {
    li.draggable = true;
    li.addEventListener("dragstart", () => { dragId = t.id; li.classList.add("dragging"); });
    li.addEventListener("dragend", () => { dragId = null; li.classList.remove("dragging"); });
    li.addEventListener("dragover", (e) => { e.preventDefault(); li.classList.add("over"); });
    li.addEventListener("dragleave", () => li.classList.remove("over"));
    li.addEventListener("drop", (e) => { e.preventDefault(); li.classList.remove("over"); if (dragId) moveTask(dragId, t.id); });
  }

  const check = document.createElement("input");
  check.type = "checkbox";
  check.checked = t.completed;
  check.setAttribute("aria-label", `Mark "${t.title}" as completed`);
  check.addEventListener("change", () => toggleTask(t.id));

  const body = document.createElement("div");
  if (editingId === t.id) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "edit-input";
    input.value = t.title;
    input.maxLength = 120;
    input.setAttribute("aria-label", "Edit task title");
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") updateTask(t.id, input.value);
      if (e.key === "Escape") { editingId = null; render(); }
    });
    body.append(input);
    setTimeout(() => { input.focus(); input.select(); }, 0);
  } else {
    const title = document.createElement("p");
    title.className = "title";
    title.textContent = t.title;
    const meta = document.createElement("p");
    meta.className = "meta";
    meta.textContent = t.priority[0].toUpperCase() + t.priority.slice(1) + " priority";
    if (t.due) {
      const due = document.createElement("span");
      const overdue = !t.completed && t.due < todayStr();
      due.textContent = ` · ${overdue ? "Overdue, was due" : "Due"} ${formatDate(t.due)}`;
      if (overdue) due.className = "overdue";
      meta.append(due);
    }
    body.append(title, meta);
  }

  const actions = document.createElement("div");
  actions.className = "actions";
  if (editingId === t.id) {
    actions.append(
      makeBtn("Save", () => updateTask(t.id, body.querySelector("input").value)),
      makeBtn("Cancel", () => { editingId = null; render(); })
    );
  } else {
    const edit = makeBtn("Edit", () => { editingId = t.id; render(); });
    const del = makeBtn("Delete", () => deleteTask(t.id));
    del.classList.add("del");
    actions.append(edit, del);
  }

  li.append(check, body, actions);
  return li;
}

function makeBtn(label, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "ghost";
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

/* ---- Events ---- */
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const title = taskInput.value.trim();
  if (!title) return;
  addTask(title, priorityInput.value, dueInput.value);
  form.reset();
  priorityInput.value = "medium";
  taskInput.focus();
});

document.querySelectorAll(".chip").forEach((btn) => {
  btn.addEventListener("click", () => {
    filter = btn.dataset.filter;
    document.querySelectorAll(".chip").forEach((b) => b.classList.toggle("active", b === btn));
    render();
  });
});
searchInput.addEventListener("input", () => { query = searchInput.value.trim().toLowerCase(); render(); });
$("clearDone").addEventListener("click", clearCompleted);

/* ---- Dark mode (saved in Local Storage too) ---- */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $("themeToggle").textContent = theme === "dark" ? "Light mode" : "Dark mode";
}
let savedTheme = null;
try { savedTheme = localStorage.getItem(THEME_KEY); } catch {}
applyTheme(savedTheme || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
$("themeToggle").addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);
});

render();
