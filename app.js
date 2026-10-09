const DEFAULT_STATE = {
  notes: [{ id: crypto.randomUUID(), title: 'Welcome note', blocks: [{ id: crypto.randomUUID(), title: 'Ideas', html: '<p>Start writing here.</p>', collapsed: false, width: 100, height: 180 }] }],
  tasks: [],
  stopwatch: { startedAt: null, elapsed: 0, laps: [] },
  countdown: { endsAt: null, remaining: 0 },
  settings: { textColor: '#d7e3f4', highlightColor: '#123b66', enabled: true }
};

let state;
let activeNoteId;
let activeEditor;
let stopwatchInterval;
let countdownInterval;
let calendarInterval;
let taskBeingEdited = null;
let saving = false;

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
  saving = true;
  await chrome.storage.local.set({ todoState: state });
  saving = false;
  if (message) setStatus(message);
}

function setStatus(message) {
  const status = $('#app-status');
  if (status) status.textContent = message;
}

function renderAll() {
  renderNotes();
  renderTasks();
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
  const fontFamily = document.createElement('select'); fontFamily.setAttribute('aria-label', 'Font family'); [['Handlee', 'Handlee, cursive'], ['Arial', 'Arial, sans-serif'], ['Georgia', 'Georgia, serif'], ['Monospace', 'monospace']].forEach(([label, value]) => { const option = new Option(label, value); option.selected = (block.fontFamily || 'Handlee, cursive') === value; fontFamily.appendChild(option); }); fontFamily.addEventListener('change', () => { if (activeEditor) { activeEditor.focus(); document.execCommand('fontName', false, fontFamily.value); activeEditor.dispatchEvent(new Event('input')); } });
  const fontSize = document.createElement('select'); fontSize.setAttribute('aria-label', 'Font size'); [['Small', '2'], ['Normal', '3'], ['Large', '5'], ['Huge', '7']].forEach(([label, value]) => fontSize.appendChild(new Option(label, value))); fontSize.addEventListener('change', () => { if (activeEditor) { activeEditor.focus(); document.execCommand('fontSize', false, fontSize.value); activeEditor.dispatchEvent(new Event('input')); } });
  toolbar.append(drag, blockTitle, formatButton('B', 'Bold', 'bold'), formatButton('I', 'Italic', 'italic'), formatButton('U', 'Underline', 'underline'), fontFamily, fontSize, formatButton('H', 'Highlight', 'toggleHighlight', state.settings.highlightColor), colorPicker(block), collapse, remove);
  const editor = document.createElement('div'); editor.className = 'wysiwyg'; editor.contentEditable = 'true'; editor.innerHTML = block.html || ''; editor.style.fontFamily = 'Handlee, cursive'; editor.dataset.placeholder = 'Start typing...';
  editor.addEventListener('focus', () => { activeEditor = editor; });
  editor.addEventListener('input', () => { applyTypingShortcut(editor); block.html = editor.innerHTML; block.fontFamily = fontFamily.value; saveState(); });
  editor.addEventListener('blur', () => { block.html = editor.innerHTML; saveState(); });
  if (block.collapsed) editor.hidden = true;
  editor.style.fontFamily = block.fontFamily || 'Handlee, cursive';
  article.append(toolbar, editor);
  return article;
}

function button(label, className = '') { const item = document.createElement('button'); item.type = 'button'; item.textContent = label; item.className = className; return item; }
function formatButton(label, title, command, value = null) { const item = button(label, 'format-button'); item.title = title; item.setAttribute('aria-label', title); item.addEventListener('mousedown', event => event.preventDefault()); item.addEventListener('click', () => { if (!activeEditor) return; activeEditor.focus(); if (command === 'toggleHighlight') toggleHighlight(value); else document.execCommand(command, false, value); activeEditor.dispatchEvent(new Event('input')); }); return item; }
function toggleHighlight(color) { const current = document.queryCommandValue('hiliteColor') || document.queryCommandValue('backColor'); const isHighlighted = current && current !== 'transparent' && current !== 'rgba(0, 0, 0, 0)' && current !== 'rgb(255, 255, 255)'; document.execCommand('hiliteColor', false, isHighlighted ? 'transparent' : color); }
function colorPicker(block) { const input = document.createElement('input'); input.type = 'color'; input.value = block.color || state.settings.textColor; input.title = 'Text color'; input.setAttribute('aria-label', 'Text color'); input.addEventListener('input', () => { block.color = input.value; if (activeEditor) { activeEditor.focus(); document.execCommand('foreColor', false, input.value); activeEditor.dispatchEvent(new Event('input')); } }); return input; }
function applyTypingShortcut(editor) { const selection = window.getSelection(); if (!selection.rangeCount || !editor.contains(selection.anchorNode)) return; const text = selection.anchorNode.textContent || ''; const beforeCursor = text.slice(0, selection.anchorOffset); if (!/(^|\n)# $/.test(beforeCursor)) return; const range = selection.getRangeAt(0); range.setStart(selection.anchorNode, selection.anchorOffset - 2); range.deleteContents(); selection.removeAllRanges(); selection.addRange(range); document.execCommand('formatBlock', false, 'h1'); }

function renderTasks() {
  const calendar = $('#day-calendar'); calendar.replaceChildren();
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0); const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
  const header = document.createElement('div'); header.className = 'calendar-day-header'; header.innerHTML = `<strong>${dayStart.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</strong><span>Today</span>`; calendar.appendChild(header);
  const body = document.createElement('div'); body.className = 'calendar-day-body';
  const axis = document.createElement('div'); axis.className = 'calendar-axis';
  for (let minutes = 0; minutes < 1440; minutes += 30) { const label = document.createElement('span'); label.textContent = minutes % 60 === 0 ? formatClock(new Date(dayStart.getTime() + minutes * 60000)) : ''; label.style.top = `${(minutes / 1440) * 100}%`; axis.appendChild(label); }
  const grid = document.createElement('div'); grid.className = 'calendar-grid'; for (let index = 0; index < 48; index += 1) { const line = document.createElement('i'); line.style.top = `${(index / 48) * 100}%`; grid.appendChild(line); }
  const events = document.createElement('div'); events.className = 'calendar-events';
  state.tasks.filter(task => isValidDate(task.start) && isValidDate(task.end) && new Date(task.start) < dayEnd && new Date(task.end) > dayStart).forEach(task => {
    const start = Math.max(dayStart.getTime(), new Date(task.start).getTime()); const end = Math.min(dayEnd.getTime(), new Date(task.end).getTime());
    const event = document.createElement('article'); event.className = `calendar-event task-${task.status || 'scheduled'}`; event.style.setProperty('--task-color', task.color || '#234f7d'); event.style.top = `${((start - dayStart) / 86400000) * 100}%`; event.style.height = `${Math.max(2, ((end - start) / 86400000) * 100)}%`; event.innerHTML = `<strong>${escapeHtml(task.title)}</strong><span>${formatClock(new Date(start))} - ${formatClock(new Date(end))}</span>`;
    event.title = task.description || task.title; event.tabIndex = 0; event.addEventListener('click', () => editTask(task)); event.addEventListener('keydown', keyboardEvent => { if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') { keyboardEvent.preventDefault(); editTask(task); } }); events.appendChild(event);
  });
  const marker = document.createElement('b'); marker.className = 'current-time-marker'; marker.style.top = `${((Date.now() - dayStart.getTime()) / 86400000) * 100}%`; body.append(axis, grid, events, marker); calendar.appendChild(body);
}
function completeTask(task) { task.status = 'completed'; task.completedAt = new Date().toISOString(); saveState('Task completed'); renderTasks(); }
function delayTask(task) { const start = prompt('Start time (YYYY-MM-DDTHH:mm)', localInputValue(new Date(task.start))); if (!start) return; const end = prompt('End time (YYYY-MM-DDTHH:mm)', localInputValue(new Date(task.end))); if (!end) return; const startIso = safeIsoDate(start); const endIso = safeIsoDate(end); if (!startIso || !endIso || new Date(endIso) <= new Date(startIso)) return; task.start = startIso; task.end = endIso; task.status = 'delayed'; saveState('Task delayed'); renderTasks(); }
function editTask(task) {
  const form = $('#task-form');
  taskBeingEdited = task;
  form.hidden = false;
  form.elements.title.value = task.title || '';
  form.elements.description.value = task.description || '';
  form.elements.color.value = task.color || '#2f6fae';
  form.elements.startDate.value = localInputValue(new Date(task.start)).slice(0, 10);
  form.elements.endDate.value = localInputValue(new Date(task.end)).slice(0, 10);
  setTimeFields(form, 'start', new Date(task.start));
  setTimeFields(form, 'end', new Date(task.end));
  form.closest('.view').scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function formatDate(date) { return date.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }); }
function formatClock(date) { return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
function isValidDate(value) { const date = value instanceof Date ? value : new Date(value); return !Number.isNaN(date.getTime()); }
function safeIsoDate(value) { if (!value) return ''; const date = new Date(value); if (!isValidDate(date)) return ''; try { return date.toISOString(); } catch { return ''; } }
function localInputValue(date) { if (!isValidDate(date)) return ''; const offset = date.getTimezoneOffset() * 60000; const localDate = new Date(date.getTime() - offset); return isValidDate(localDate) ? localDate.toISOString().slice(0, 16) : ''; }
function setTimeFields(form, prefix, date) {
  const value = localInputValue(date);
  const [hourText, minute] = value.slice(11).split(':');
  const hour = Number(hourText);
  form.elements[`${prefix}Time`].value = `${hour % 12 || 12}:${minute}`;
  form.elements[`${prefix}Period`].value = hour >= 12 ? 'PM' : 'AM';
}
function parseDateTime(dateValue, timeValue, period) {
  const match = String(timeValue).trim().match(/^(\d{1,2}):([0-5]\d)$/);
  if (!dateValue || !match) return null;
  const hour = Number(match[1]);
  if (hour < 1 || hour > 12) return null;
  const date = new Date(`${dateValue}T${String((hour % 12) + (period === 'PM' ? 12 : 0)).padStart(2, '0')}:${match[2]}`);
  return isValidDate(date) ? date : null;
}
function escapeHtml(value) { const item = document.createElement('div'); item.textContent = value; return item.innerHTML; }

function renderLaps() { $('#lap-list').replaceChildren(...state.stopwatch.laps.map((lap, index) => { const item = document.createElement('label'); item.className = 'lap-row'; item.innerHTML = `<span>Lap ${index + 1} · ${formatDuration(lap.elapsed)}</span>`; const input = document.createElement('input'); input.placeholder = 'Description'; input.value = lap.description || ''; input.addEventListener('input', () => { lap.description = input.value; saveState(); }); item.appendChild(input); return item; })); }
function formatDuration(milliseconds) { const seconds = Math.floor(milliseconds / 1000); return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(value => String(value).padStart(2, '0')).join(':'); }
function updateStopwatch() { const elapsed = state.stopwatch.elapsed + (state.stopwatch.startedAt ? now() - state.stopwatch.startedAt : 0); $('#stopwatch-display').textContent = formatDuration(elapsed); }
function updateCountdown() { const remaining = state.countdown.endsAt ? Math.max(0, state.countdown.endsAt - now()) : state.countdown.remaining; $('#countdown-display').textContent = formatDuration(remaining).slice(3); }
function startClockLoops() { clearInterval(stopwatchInterval); clearInterval(countdownInterval); clearInterval(calendarInterval); stopwatchInterval = setInterval(updateStopwatch, 1000); countdownInterval = setInterval(updateCountdown, 1000); calendarInterval = setInterval(renderTasks, 30000); }

function wireEvents() {
  document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => { document.querySelectorAll('.tab').forEach(item => item.classList.toggle('is-active', item === tab)); document.querySelectorAll('.view').forEach(view => view.classList.toggle('is-visible', view.id === tab.dataset.view)); }));
  $('#new-note').addEventListener('click', () => { const note = { id: crypto.randomUUID(), title: 'New note', blocks: [{ id: crypto.randomUUID(), title: 'Text box', html: '', collapsed: false, width: 100, height: 180 }] }; state.notes.push(note); activeNoteId = note.id; saveState(); renderNotes(); });
  $('#new-task').addEventListener('click', () => { taskBeingEdited = null; const form = $('#task-form'); form.reset(); form.hidden = false; const start = new Date(now() + 3600000); const end = new Date(now() + 7200000); form.elements.startDate.value = localInputValue(start).slice(0, 10); form.elements.endDate.value = localInputValue(end).slice(0, 10); setTimeFields(form, 'start', start); setTimeFields(form, 'end', end); });
  $('#cancel-task').addEventListener('click', () => { taskBeingEdited = null; $('#task-form').hidden = true; });
  $('#task-form').addEventListener('submit', event => {
    event.preventDefault();
    const form = event.currentTarget;
    const start = form.elements.startMode.value === 'now' && !taskBeingEdited ? new Date() : parseDateTime(form.elements.startDate.value, form.elements.startTime.value, form.elements.startPeriod.value);
    const end = parseDateTime(form.elements.endDate.value, form.elements.endTime.value, form.elements.endPeriod.value);
    if (!start || !end || end < start) { setStatus('End time cannot be before the start time.'); return; }
    if (taskBeingEdited) {
      Object.assign(taskBeingEdited, { title: form.elements.title.value, description: form.elements.description.value, color: form.elements.color.value, start: start.toISOString(), end: end.toISOString() });
      saveState('Task details saved');
    } else {
      state.tasks.push({ id: crypto.randomUUID(), title: form.elements.title.value, description: form.elements.description.value, color: form.elements.color.value, start: start.toISOString(), end: end.toISOString(), status: form.elements.startMode.value === 'now' ? 'active' : 'scheduled', completedAt: null });
      saveState('Task saved');
    }
    taskBeingEdited = null; form.reset(); form.hidden = true; renderTasks();
  });
  $('#stopwatch-toggle').addEventListener('click', () => { if (state.stopwatch.startedAt) { state.stopwatch.elapsed += now() - state.stopwatch.startedAt; state.stopwatch.startedAt = null; $('#stopwatch-toggle').textContent = 'Resume'; } else { state.stopwatch.startedAt = now(); $('#stopwatch-toggle').textContent = 'Pause'; } saveState(); });
  $('#stopwatch-reset').addEventListener('click', () => { state.stopwatch = { startedAt: null, elapsed: 0, laps: [] }; $('#stopwatch-toggle').textContent = 'Start'; saveState(); renderLaps(); updateStopwatch(); });
  $('#lap-button').addEventListener('click', () => { const elapsed = state.stopwatch.elapsed + (state.stopwatch.startedAt ? now() - state.stopwatch.startedAt : 0); state.stopwatch.laps.push({ elapsed, description: '' }); saveState(); renderLaps(); });
  $('#countdown-start').addEventListener('click', () => { if (!state.countdown.endsAt) { state.countdown = { endsAt: now() + Math.max(0, Number($('#countdown-minutes').value || 0)) * 60000, remaining: 0, alarmActive: false }; chrome.runtime.sendMessage({ type: 'START_COUNTDOWN', endsAt: state.countdown.endsAt }); saveState(); } });
  $('#countdown-reset').addEventListener('click', () => { state.countdown = { endsAt: null, remaining: 0, alarmActive: false }; chrome.runtime.sendMessage({ type: 'RESET_COUNTDOWN' }); saveState(); updateCountdown(); });
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
  if (!changes.todoState?.newValue || saving || activeEditor || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable) return;
  state = changes.todoState.newValue;
  renderAll();
});
