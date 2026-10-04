const DEFAULT_STATE = {
  notes: [{ id: crypto.randomUUID(), title: 'Welcome note', blocks: [{ id: crypto.randomUUID(), title: 'Ideas', html: '<p>Start writing here.</p>', collapsed: false, width: 100, height: 180 }] }],
  tasks: [],
  stopwatch: { startedAt: null, elapsed: 0, laps: [] },
  countdown: { endsAt: null, remaining: 0 },
  settings: { configuredUrl: 'example.com', clockAllPages: false, textColor: '#263238', highlightColor: '#123b66', enabled: true }
};

let state;
let activeNoteId;
let activeEditor;
let stopwatchInterval;
let countdownInterval;

const clone = value => JSON.parse(JSON.stringify(value));
const $ = selector => document.querySelector(selector);
const now = () => Date.now();

async function loadState() {
  const stored = await chrome.storage.local.get('todoState');
  state = { ...clone(DEFAULT_STATE), ...(stored.todoState || {}) };
  state.notes = Array.isArray(state.notes) && state.notes.length ? state.notes : clone(DEFAULT_STATE.notes);
  state.tasks = Array.isArray(state.tasks) ? state.tasks : [];
  state.settings = { ...clone(DEFAULT_STATE.settings), ...(state.settings || {}) };
  activeNoteId = state.notes[0].id;
  renderAll();
  startClockLoops();
}

async function saveState(message) {
  await chrome.storage.local.set({ todoState: state });
  if (message) setStatus(message);
}

function setStatus(message) {
  const status = $('#app-status');
  if (status) status.textContent = message;
}

function renderAll() {
  renderNotes();
  renderTasks();
  renderSettings();
  renderLaps();
  updateStopwatch();
  updateCountdown();
}

function renderNotes() {
  const list = $('#note-list');
  const panel = $('#note-editor-panel');
  list.replaceChildren();
  state.notes.forEach(note => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `note-list-item${note.id === activeNoteId ? ' is-active' : ''}`;
    button.textContent = note.title || 'Untitled note';
    button.addEventListener('click', () => { activeNoteId = note.id; renderNotes(); });
    list.appendChild(button);
  });
  const note = state.notes.find(item => item.id === activeNoteId) || state.notes[0];
  activeNoteId = note.id;
  panel.replaceChildren();

  const heading = document.createElement('div');
  heading.className = 'note-heading';
  const title = document.createElement('input');
  title.className = 'note-title';
  title.value = note.title;
  title.setAttribute('aria-label', 'Note title');
  title.addEventListener('input', () => { note.title = title.value; renderNotesListOnly(); saveState(); });
  const deleteNote = button('Delete note', 'danger');
  deleteNote.addEventListener('click', () => {
    if (state.notes.length === 1 || confirm('Delete this note?')) {
      state.notes = state.notes.filter(item => item.id !== note.id);
      activeNoteId = state.notes[0]?.id;
      saveState('Note deleted'); renderNotes();
    }
  });
  heading.append(title, deleteNote);
  panel.appendChild(heading);

  note.blocks.forEach((block, index) => panel.appendChild(createBlock(note, block, index)));
  const addBlock = button('+ Add text box', 'primary');
  addBlock.addEventListener('click', () => { note.blocks.push({ id: crypto.randomUUID(), title: 'New text box', html: '', collapsed: false, width: 100, height: 180 }); saveState(); renderNotes(); });
  panel.appendChild(addBlock);
}

function renderNotesListOnly() {
  const list = $('#note-list');
  [...list.children].forEach((item, index) => { item.textContent = state.notes[index].title || 'Untitled note'; });
}

function createBlock(note, block, index) {
  const article = document.createElement('article');
  article.className = `editor-card${block.collapsed ? ' is-collapsed' : ''}`;
  article.style.width = `${block.width || 100}%`;
  const toolbar = document.createElement('div');
  toolbar.className = 'editor-toolbar';
  const drag = button('↕', 'icon'); drag.title = 'Move text box'; drag.setAttribute('aria-label', 'Move text box');
  drag.draggable = true;
  drag.addEventListener('dragstart', event => event.dataTransfer.setData('text/plain', String(index)));
  article.addEventListener('dragover', event => event.preventDefault());
  article.addEventListener('drop', event => {
    event.preventDefault();
    const from = Number(event.dataTransfer.getData('text/plain'));
    if (Number.isInteger(from) && from !== index) { const [moved] = note.blocks.splice(from, 1); note.blocks.splice(index, 0, moved); saveState(); renderNotes(); }
  });
  const blockTitle = document.createElement('input'); blockTitle.className = 'block-title'; blockTitle.value = block.title || 'Text box'; blockTitle.setAttribute('aria-label', 'Text box title');
  blockTitle.addEventListener('input', () => { block.title = blockTitle.value; saveState(); });
  const collapse = button(block.collapsed ? 'Expand' : 'Collapse', 'icon'); collapse.setAttribute('aria-label', collapse.textContent + ' text box');
  collapse.addEventListener('click', () => { block.collapsed = !block.collapsed; saveState(); renderNotes(); });
  const remove = button('Delete', 'danger'); remove.addEventListener('click', () => { note.blocks = note.blocks.filter(item => item.id !== block.id); saveState(); renderNotes(); });
  toolbar.append(drag, blockTitle, formatButton('B', 'Bold', 'bold'), formatButton('I', 'Italic', 'italic'), formatButton('U', 'Underline', 'underline'), formatButton('H', 'Highlight', 'hiliteColor', state.settings.highlightColor), colorPicker(block), collapse, remove);
  const editor = document.createElement('div'); editor.className = 'wysiwyg'; editor.contentEditable = 'true'; editor.innerHTML = block.html || ''; editor.style.height = `${block.height || 180}px`; editor.style.fontFamily = 'Handlee, cursive'; editor.dataset.placeholder = 'Start typing...';
  editor.addEventListener('focus', () => { activeEditor = editor; });
  editor.addEventListener('input', () => { block.html = editor.innerHTML; saveState(); });
  editor.addEventListener('blur', () => { block.html = editor.innerHTML; saveState(); });
  if (block.collapsed) editor.hidden = true;
  article.append(toolbar, editor);
  return article;
}

function button(label, className = '') { const item = document.createElement('button'); item.type = 'button'; item.textContent = label; item.className = className; return item; }
function formatButton(label, title, command, value = null) { const item = button(label, 'format-button'); item.title = title; item.setAttribute('aria-label', title); item.addEventListener('mousedown', event => event.preventDefault()); item.addEventListener('click', () => { if (!activeEditor) return; activeEditor.focus(); document.execCommand(command, false, value); activeEditor.dispatchEvent(new Event('input')); }); return item; }
function colorPicker(block) { const input = document.createElement('input'); input.type = 'color'; input.value = block.color || state.settings.textColor; input.title = 'Text color'; input.setAttribute('aria-label', 'Text color'); input.addEventListener('input', () => { block.color = input.value; if (activeEditor) { activeEditor.focus(); document.execCommand('foreColor', false, input.value); activeEditor.dispatchEvent(new Event('input')); } }); return input; }

function renderTasks() {
  const list = $('#task-list'); list.replaceChildren();
  if (!state.tasks.length) { list.innerHTML = '<p class="empty-state">No tasks yet. Add one to start planning.</p>'; return; }
  [...state.tasks].sort((a, b) => new Date(a.start) - new Date(b.start)).forEach(task => {
    const card = document.createElement('article'); card.className = `task-card task-${task.status || 'scheduled'}`; card.style.setProperty('--task-color', task.color || '#e07a5f');
    const start = new Date(task.start); const end = new Date(task.end); const actual = task.completedAt ? new Date(task.completedAt) : null;
    card.innerHTML = `<div class="task-color"></div><div class="task-content"><div class="task-card-heading"><h3>${escapeHtml(task.title)}</h3><span>${task.status || 'scheduled'}</span></div><p>${escapeHtml(task.description || '')}</p><p class="task-time">${formatDate(start)} - ${formatDate(end)}${actual ? ` · completed ${formatDate(actual)}` : ''}</p></div>`;
    const actions = document.createElement('div'); actions.className = 'task-actions';
    if (task.status !== 'completed') { const complete = button('Complete', 'small primary'); complete.addEventListener('click', () => completeTask(task)); actions.appendChild(complete); const delay = button('Delay', 'small'); delay.addEventListener('click', () => delayTask(task)); actions.appendChild(delay); }
    const edit = button('Edit', 'small'); edit.addEventListener('click', () => editTask(task)); actions.appendChild(edit); card.appendChild(actions); list.appendChild(card);
  });
}
function completeTask(task) { task.status = 'completed'; task.completedAt = new Date().toISOString(); saveState('Task completed'); renderTasks(); }
function delayTask(task) { const start = prompt('New start time (YYYY-MM-DDTHH:mm)', task.start.slice(0, 16)); if (!start) return; const end = prompt('New end time (YYYY-MM-DDTHH:mm)', task.end.slice(0, 16)); if (!end) return; task.start = new Date(start).toISOString(); task.end = new Date(end).toISOString(); task.status = 'delayed'; saveState('Task delayed'); renderTasks(); }
function editTask(task) {
  const start = prompt('Start time (YYYY-MM-DDTHH:mm)', task.start.slice(0, 16));
  const end = prompt('End time (YYYY-MM-DDTHH:mm)', task.end.slice(0, 16));
  if (start && end && new Date(end) > new Date(start)) { task.start = new Date(start).toISOString(); task.end = new Date(end).toISOString(); }
  const completed = prompt('Actual completion time (leave blank to keep task open)', task.completedAt ? task.completedAt.slice(0, 16) : '');
  if (completed) { task.completedAt = new Date(completed).toISOString(); task.status = 'completed'; }
  saveState('Task details saved'); renderTasks();
}
function formatDate(date) { return date.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }); }
function escapeHtml(value) { const item = document.createElement('div'); item.textContent = value; return item.innerHTML; }

function renderSettings() { $('#configured-url').value = state.settings.configuredUrl; $('#clock-all-pages').checked = state.settings.clockAllPages; $('#default-text-color').value = state.settings.textColor; $('#highlight-color').value = state.settings.highlightColor; }
function renderLaps() { $('#lap-list').replaceChildren(...state.stopwatch.laps.map((lap, index) => { const item = document.createElement('label'); item.className = 'lap-row'; item.innerHTML = `<span>Lap ${index + 1} · ${formatDuration(lap.elapsed)}</span>`; const input = document.createElement('input'); input.placeholder = 'Description'; input.value = lap.description || ''; input.addEventListener('input', () => { lap.description = input.value; saveState(); }); item.appendChild(input); return item; })); }
function formatDuration(milliseconds) { const seconds = Math.floor(milliseconds / 1000); return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(value => String(value).padStart(2, '0')).join(':'); }
function updateStopwatch() { const elapsed = state.stopwatch.elapsed + (state.stopwatch.startedAt ? now() - state.stopwatch.startedAt : 0); $('#stopwatch-display').textContent = formatDuration(elapsed); }
function updateCountdown() { const remaining = state.countdown.endsAt ? Math.max(0, state.countdown.endsAt - now()) : state.countdown.remaining; $('#countdown-display').textContent = formatDuration(remaining).slice(3); if (state.countdown.endsAt && remaining === 0) { state.countdown.endsAt = null; saveState('Countdown finished'); chrome.runtime.sendMessage({ type: 'COUNTDOWN_FINISHED' }); } }
function startClockLoops() { clearInterval(stopwatchInterval); clearInterval(countdownInterval); stopwatchInterval = setInterval(updateStopwatch, 1000); countdownInterval = setInterval(updateCountdown, 1000); }

function wireEvents() {
  document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => { document.querySelectorAll('.tab').forEach(item => item.classList.toggle('is-active', item === tab)); document.querySelectorAll('.view').forEach(view => view.classList.toggle('is-visible', view.id === tab.dataset.view)); }));
  $('#new-note').addEventListener('click', () => { const note = { id: crypto.randomUUID(), title: 'New note', blocks: [{ id: crypto.randomUUID(), title: 'Text box', html: '', collapsed: false, width: 100, height: 180 }] }; state.notes.push(note); activeNoteId = note.id; saveState(); renderNotes(); });
  $('#new-task').addEventListener('click', () => { $('#task-form').hidden = false; $('#task-form').elements.start.value = new Date(now() + 3600000).toISOString().slice(0, 16); $('#task-form').elements.end.value = new Date(now() + 7200000).toISOString().slice(0, 16); });
  $('#cancel-task').addEventListener('click', () => { $('#task-form').hidden = true; });
  $('#task-form').addEventListener('submit', event => { event.preventDefault(); const form = new FormData(event.currentTarget); const start = form.get('startMode') === 'now' ? new Date() : new Date(form.get('start')); const end = new Date(form.get('end')); if (!(end > start)) { alert('End time must be after the start time.'); return; } state.tasks.push({ id: crypto.randomUUID(), title: form.get('title'), description: form.get('description'), color: form.get('color'), start: start.toISOString(), end: end.toISOString(), status: form.get('startMode') === 'now' ? 'active' : 'scheduled', completedAt: null }); saveState('Task saved'); event.currentTarget.reset(); event.currentTarget.hidden = true; renderTasks(); });
  $('#stopwatch-toggle').addEventListener('click', () => { if (state.stopwatch.startedAt) { state.stopwatch.elapsed += now() - state.stopwatch.startedAt; state.stopwatch.startedAt = null; $('#stopwatch-toggle').textContent = 'Resume'; } else { state.stopwatch.startedAt = now(); $('#stopwatch-toggle').textContent = 'Pause'; } saveState(); });
  $('#stopwatch-reset').addEventListener('click', () => { state.stopwatch = { startedAt: null, elapsed: 0, laps: [] }; $('#stopwatch-toggle').textContent = 'Start'; saveState(); renderLaps(); updateStopwatch(); });
  $('#lap-button').addEventListener('click', () => { const elapsed = state.stopwatch.elapsed + (state.stopwatch.startedAt ? now() - state.stopwatch.startedAt : 0); state.stopwatch.laps.push({ elapsed, description: '' }); saveState(); renderLaps(); });
  $('#countdown-start').addEventListener('click', () => { if (!state.countdown.endsAt) state.countdown.endsAt = now() + Number($('#countdown-minutes').value || 1) * 60000; saveState(); });
  $('#countdown-reset').addEventListener('click', () => { state.countdown = { endsAt: null, remaining: 0 }; saveState(); updateCountdown(); });
  $('#configured-url').addEventListener('change', event => { state.settings.configuredUrl = event.target.value.trim() || 'example.com'; saveState('Page setting saved'); });
  $('#clock-all-pages').addEventListener('change', event => { state.settings.clockAllPages = event.target.checked; saveState('Clock setting saved'); });
  $('#default-text-color').addEventListener('change', event => { state.settings.textColor = event.target.value; saveState(); });
  $('#highlight-color').addEventListener('change', event => { state.settings.highlightColor = event.target.value; saveState(); });
  $('#export-all').addEventListener('click', () => downloadJson('notes-tasks-time-backup.json', state));
  $('#export-notes').addEventListener('click', () => downloadJson('notes.json', { notes: state.notes }));
  $('#export-tasks').addEventListener('click', () => downloadJson('schedules.json', { tasks: state.tasks }));
  $('#export-settings').addEventListener('click', () => downloadJson('settings.json', { settings: state.settings }));
  $('#export-timers').addEventListener('click', () => downloadJson('timers.json', { stopwatch: state.stopwatch, countdown: state.countdown }));
  $('#import-all').addEventListener('change', importJson);
  $('#import-notes').addEventListener('change', event => importCategory(event, 'notes'));
  $('#import-tasks').addEventListener('change', event => importCategory(event, 'tasks'));
  $('#import-settings').addEventListener('change', event => importCategory(event, 'settings'));
  $('#import-timers').addEventListener('change', async event => {
    const imported = await readJson(event);
    if (imported) { state.stopwatch = imported.stopwatch || state.stopwatch; state.countdown = imported.countdown || state.countdown; await saveState('Timers imported'); renderAll(); }
  });
}
function downloadJson(name, data) { const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); link.download = name; link.click(); URL.revokeObjectURL(link.href); }
async function importJson(event) { const file = event.target.files[0]; if (!file) return; try { const imported = JSON.parse(await file.text()); state = { ...state, ...imported, settings: { ...state.settings, ...(imported.settings || {}) } }; await saveState('Backup imported'); renderAll(); } catch { setStatus('Import failed: choose a valid JSON backup.'); } event.target.value = ''; }
async function readJson(event) { const file = event.target.files[0]; event.target.value = ''; if (!file) return null; try { return JSON.parse(await file.text()); } catch { setStatus('Import failed: choose a valid JSON file.'); return null; } }
async function importCategory(event, category) { const imported = await readJson(event); if (!imported) return; if (category === 'settings') { if (!imported.settings || typeof imported.settings !== 'object') return setStatus('Import failed: no settings data found.'); state.settings = { ...state.settings, ...imported.settings }; } else { if (!Array.isArray(imported[category])) return setStatus(`Import failed: no ${category} data found.`); state[category] = imported[category]; } await saveState(`${category} imported`); renderAll(); }

wireEvents();
loadState();
chrome.storage.onChanged.addListener(changes => {
  if (!changes.todoState?.newValue || activeEditor) return;
  state = changes.todoState.newValue;
  renderAll();
});
