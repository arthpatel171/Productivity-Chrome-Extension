const FONT_OPTIONS = [
  ['Arial', 'Arial, sans-serif'], ['Calibri', 'Calibri, sans-serif'], ['Cambria', 'Cambria, serif'],
  ['Candara', 'Candara, sans-serif'], ['Comic Sans MS', '"Comic Sans MS", cursive'], ['Consolas', 'Consolas, monospace'],
  ['Courier New', '"Courier New", monospace'], ['Georgia', 'Georgia, serif'], ['Helvetica', 'Helvetica, sans-serif'],
  ['Impact', 'Impact, sans-serif'], ['Inter', 'Inter, sans-serif'], ['Lucida Console', '"Lucida Console", monospace'],
  ['Lucida Sans', '"Lucida Sans", sans-serif'], ['Merriweather', 'Merriweather, serif'], ['Monaco', 'Monaco, monospace'],
  ['Montserrat', 'Montserrat, sans-serif'], ['Nunito', 'Nunito, sans-serif'], ['Palatino', 'Palatino, serif'],
  ['Roboto', 'Roboto, sans-serif'], ['Segoe UI', '"Segoe UI", sans-serif'], ['Tahoma', 'Tahoma, sans-serif'],
  ['Times New Roman', '"Times New Roman", serif'], ['Trebuchet MS', '"Trebuchet MS", sans-serif'],
  ['Verdana', 'Verdana, sans-serif'], ['Handlee', 'Handlee, cursive']
];
const STANDARD_COLORS = [['Dark Red', '#8b0000'], ['Red', '#dc2626'], ['Orange', '#f97316'], ['Yellow', '#facc15'], ['Light Green', '#86efac'], ['Green', '#16a34a'], ['Teal', '#14b8a6'], ['Blue', '#2563eb'], ['Dark Blue', '#123b66'], ['Purple', '#8b5cf6']];
const CALENDAR_PIXELS_PER_MINUTE = 2;
function defaultCalendarStart(tasks = []) { const current = new Date(); const currentMinutes = current.getHours() * 60 + current.getMinutes(); const starts = [Math.floor(currentMinutes / 30) * 30]; tasks.filter(task => isValidDate(task.start) && sameLocalDay(new Date(task.start), current)).forEach(task => { const start = new Date(task.start); starts.push(Math.floor((start.getHours() * 60 + start.getMinutes()) / 30) * 30); }); return Math.min(...starts, 8 * 60); }
const DEFAULT_STATE = {
  notes: [{ id: crypto.randomUUID(), title: 'Welcome note', blocks: [{ id: crypto.randomUUID(), title: 'Ideas', html: '<p>Start writing here.</p>', collapsed: false, width: 100, height: 180, fontFamily: 'Arial, sans-serif', customColors: [] }] }],
  tasks: [], stopwatch: { startedAt: null, elapsed: 0, laps: [] },
  countdown: { endsAt: null, remaining: 0, alarmActive: false, occurrence: null, dismissed: false },
  settings: { textColor: '#d7e3f4', highlightColor: '#123b66', silentNotifications: false, theme: 'dark' },
  calendar: { visibleStart: defaultCalendarStart(), visibleEnd: 1440, visibleStartUserSet: false }
};

let state;
let activeNoteId;
let activeEditor;
let stopwatchInterval;
let countdownInterval;
let calendarInterval;
let taskBeingEdited;
let calendarScrollTop = 0;
let saving = false;
let lastSavedStateJson = '';
const $ = selector => document.querySelector(selector);
const now = () => Date.now();
const clone = value => JSON.parse(JSON.stringify(value));

async function loadState() {
  const stored = await chrome.storage.local.get('todoState');
  state = { ...clone(DEFAULT_STATE), ...(stored.todoState || {}) };
  state.notes = Array.isArray(state.notes) && state.notes.length ? state.notes : clone(DEFAULT_STATE.notes);
  state.tasks = Array.isArray(state.tasks) ? state.tasks : [];
  const taskCountBeforeCleanup = state.tasks.length;
  state.tasks = state.tasks.filter(task => !isFromPreviousDay(task));
  const removedPreviousDayTasks = state.tasks.length !== taskCountBeforeCleanup;
  state.settings = { ...clone(DEFAULT_STATE.settings), ...(state.settings || {}) };
  applyTheme(state.settings.theme, false);
  applyBackgroundImage(state.settings.backgroundImageUrl);
  state.calendar = { ...clone(DEFAULT_STATE.calendar), ...(state.calendar || {}) };
  if (!stored.todoState?.calendar || !state.calendar.visibleStartUserSet || (state.calendar.visibleStart === 0 && state.calendar.visibleEnd === 1440)) {
    state.calendar.visibleStart = defaultCalendarStart(state.tasks);
    state.calendar.visibleEnd = 1440;
    state.calendar.visibleStartUserSet = false;
  }
  activeNoteId = state.notes[0].id;
  lastSavedStateJson = JSON.stringify(state);
  if (removedPreviousDayTasks) await chrome.storage.local.set({ todoState: state });
  renderAll();
  startClockLoops();
}
async function saveState(message) {
  saving = true;
  lastSavedStateJson = JSON.stringify(state);
  await chrome.storage.local.set({ todoState: state });
  saving = false;
  if (message) setStatus(message);
}
function setStatus(message) { const status = $('#app-status'); if (status) status.textContent = message; }
function applyTheme(value, animate = true) {
  const current = value === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', current);
  const toggle = $('#theme-toggle');
  if (toggle) {
    toggle.textContent = current === 'light' ? '☀️' : '🌙';
    if (!animate) toggle.style.transition = 'none';
    toggle.style.transform = current === 'dark' ? 'rotateY(180deg)' : 'rotateY(0deg)';
    if (!animate) requestAnimationFrame(() => { toggle.style.transition = ''; });
    toggle.setAttribute('aria-label', `Switch to ${current === 'light' ? 'dark' : 'light'} theme`);
    toggle.title = `Switch to ${current === 'light' ? 'dark' : 'light'} theme`;
  }
  const select = $('#theme-select');
  if (select) select.value = current;
}
function applyBackgroundImage(value) {
  const url = typeof value === 'string' ? value.trim() : '';
  document.body.style.backgroundImage = url ? `url("${url.replaceAll('"', '%22')}")` : '';
  document.body.style.backgroundRepeat = url ? 'no-repeat' : '';
  document.body.style.backgroundSize = url ? 'cover' : '';
  document.body.style.backgroundPosition = url ? 'center' : '';
  document.body.style.backgroundAttachment = url ? 'fixed' : '';
}
function button(label, className = '') { const item = document.createElement('button'); item.type = 'button'; item.textContent = label; item.className = className; return item; }
function escapeHtml(value) { const item = document.createElement('div'); item.textContent = value || ''; return item.innerHTML; }

function renderAll() { renderNotes(); renderTasks(); renderLaps(); updateStopwatch(); updateCountdown(); }
function renderNotes() {
  const list = $('#note-list'); const panel = $('#note-editor-panel'); list.replaceChildren();
  state.notes.forEach(note => {
    const row = document.createElement('div'); row.className = 'note-list-row';
    const item = button(note.title || 'Untitled note', `note-list-item${note.id === activeNoteId ? ' is-active' : ''}`);
    item.addEventListener('click', () => { activeNoteId = note.id; renderNotes(); });
    const remove = button('🗑️', 'note-delete-button'); remove.title = 'Delete note'; remove.setAttribute('aria-label', `Delete ${note.title || 'untitled note'}`);
    remove.addEventListener('click', event => { event.stopPropagation(); deleteNote(note); });
    row.append(item, remove); list.appendChild(row);
  });
  $('#new-note').onclick = () => addNote();
  const note = state.notes.find(item => item.id === activeNoteId) || state.notes[0]; activeNoteId = note.id; panel.replaceChildren();
  const heading = document.createElement('div'); heading.className = 'note-heading';
  const title = document.createElement('input'); title.className = 'note-title'; title.value = note.title; title.setAttribute('aria-label', 'Note title'); title.addEventListener('input', () => { note.title = title.value; renderNotesListOnly(); saveState(); });
  const add = button('+ Add Text Box', 'primary add-box-button'); add.addEventListener('click', () => { note.blocks.push(newBlock()); saveState(); renderNotes(); }); heading.append(title, add); panel.appendChild(heading);
  const blockList = document.createElement('div'); blockList.className = 'note-block-list';
  note.blocks.forEach((block, index) => blockList.appendChild(createBlock(note, block, index, blockList)));
  panel.appendChild(blockList);
}
function addNote() {
  const note = { id: crypto.randomUUID(), title: 'New note', blocks: [newBlock()] };
  state.notes.push(note); activeNoteId = note.id; saveState(); renderNotes();
}
function deleteNote(note) {
  if (state.notes.length === 1) return setStatus('At least one note must remain.');
  if (!confirm(`Delete "${note.title || 'Untitled note'}"?`)) return;
  state.notes = state.notes.filter(item => item.id !== note.id);
  if (activeNoteId === note.id) activeNoteId = state.notes[0].id;
  saveState('Note deleted'); renderNotes();
}
function newBlock() { return { id: crypto.randomUUID(), title: 'Text box', html: '', collapsed: false, width: 100, height: 180, fontFamily: 'Arial, sans-serif', fontSize: 18, customColors: [] }; }
function renderNotesListOnly() { [...$('#note-list').querySelectorAll('.note-list-item')].forEach((item, index) => { item.textContent = state.notes[index].title || 'Untitled note'; }); }
function createBlock(note, block, index, blockList) {
  const wrapper = document.createElement('div'); wrapper.className = 'editor-wrapper';
  wrapper.dataset.blockId = block.id;
  const drag = button('⠿', 'drag-handle'); drag.title = 'Move text box'; drag.setAttribute('aria-label', 'Move text box');
  const article = document.createElement('article'); article.className = `editor-card${block.collapsed ? ' is-collapsed' : ''}`; article.style.width = `${block.width || 100}%`;
  const toolbar = document.createElement('div'); toolbar.className = 'editor-toolbar';
  const blockTitle = document.createElement('input'); blockTitle.className = 'block-title'; blockTitle.value = block.title || 'Text box'; blockTitle.setAttribute('aria-label', 'Text box title'); blockTitle.addEventListener('input', () => { block.title = blockTitle.value; saveState(); });
  const fontFamily = document.createElement('select'); fontFamily.className = 'font-family'; fontFamily.setAttribute('aria-label', 'Font family'); populateFonts(fontFamily, block);
  fontFamily.addEventListener('change', () => { rememberFont(fontFamily.value); applyCommand('fontName', fontFamily.value); block.fontFamily = fontFamily.value; editor.style.fontFamily = fontFamily.value; saveState(); });
  const fontSize = document.createElement('input'); fontSize.className = 'font-size-input'; fontSize.type = 'number'; fontSize.min = '1'; fontSize.max = '200'; fontSize.step = '1'; fontSize.value = block.fontSize || 18; fontSize.setAttribute('aria-label', 'Font size in pixels'); fontSize.title = 'Font size in pixels';
  const decreaseFontSize = button('−', 'format-button font-size-button'); decreaseFontSize.title = 'Decrease font size'; decreaseFontSize.setAttribute('aria-label', 'Decrease font size');
  const increaseFontSize = button('+', 'format-button font-size-button'); increaseFontSize.title = 'Increase font size'; increaseFontSize.setAttribute('aria-label', 'Increase font size');
  [decreaseFontSize, increaseFontSize].forEach(item => item.addEventListener('mousedown', event => event.preventDefault()));
  decreaseFontSize.addEventListener('click', () => changeFontSize(block, fontSize, -1));
  increaseFontSize.addEventListener('click', () => changeFontSize(block, fontSize, 1));
  fontSize.addEventListener('change', () => setFontSize(block, fontSize));
  const color = colorPicker(block, 'Text color', 'foreColor');
  const highlight = colorPicker(block, 'Highlight color', 'hiliteColor', state.settings.highlightColor);
  const collapse = button(block.collapsed ? 'Expand' : 'Collapse', 'icon'); collapse.addEventListener('click', () => { block.collapsed = !block.collapsed; saveState(); renderNotes(); });
  const remove = button('Delete', 'danger'); remove.addEventListener('click', () => { note.blocks = note.blocks.filter(item => item.id !== block.id); saveState(); renderNotes(); });
  toolbar.append(blockTitle, formatButton('B', 'Bold', 'bold'), formatButton('I', 'Italic', 'italic'), formatButton('U', 'Underline', 'underline'), formatButton('•', 'Bulleted list', 'insertUnorderedList'), formatButton('1.', 'Numbered list', 'insertOrderedList'), fontFamily, decreaseFontSize, fontSize, increaseFontSize, color, highlight, collapse, remove);
  const editor = document.createElement('div'); editor.className = 'wysiwyg'; editor.contentEditable = 'true'; editor.innerHTML = block.html || ''; editor.dataset.placeholder = 'Start typing...'; editor.style.fontFamily = block.fontFamily || 'Arial, sans-serif'; editor.style.fontSize = `${block.fontSize || 18}px`; editor.style.minHeight = `${block.height || 180}px`;
  editor.addEventListener('focus', () => { activeEditor = editor; });
  editor.addEventListener('keyup', () => syncToolbar(editor, fontFamily, fontSize)); editor.addEventListener('mouseup', () => syncToolbar(editor, fontFamily, fontSize));
  editor.addEventListener('input', () => { applyTypingShortcut(editor); block.html = editor.innerHTML; block.fontFamily = window.getComputedStyle(editor).fontFamily || block.fontFamily; block.height = editor.scrollHeight; block.customColors = (block.customColors || []).filter(colorValue => block.html.toLowerCase().includes(colorValue.toLowerCase())); saveState(); });
  editor.addEventListener('blur', () => { block.html = editor.innerHTML; activeEditor = null; saveState(); });
  if (block.collapsed) editor.hidden = true; article.append(toolbar, editor); wrapper.append(drag, article); enableBlockDragging(note, block, wrapper, drag, blockList); return wrapper;
}
function enableBlockDragging(note, block, wrapper, drag, blockList) {
  drag.addEventListener('pointerdown', event => {
    event.preventDefault();
    const rect = wrapper.getBoundingClientRect();
    const placeholder = document.createElement('div'); placeholder.className = 'editor-placeholder'; placeholder.style.height = `${rect.height}px`;
    blockList.insertBefore(placeholder, wrapper.nextSibling);
    wrapper.classList.add('is-dragging'); wrapper.style.width = `${rect.width}px`; wrapper.style.left = `${rect.left}px`; wrapper.style.top = `${rect.top}px`;
    document.body.appendChild(wrapper);
    const offsetY = event.clientY - rect.top;
    const move = moveEvent => {
      wrapper.style.top = `${moveEvent.clientY - offsetY}px`;
      [...blockList.children].filter(item => item !== wrapper && item !== placeholder).some(item => {
        const itemRect = item.getBoundingClientRect();
        if (moveEvent.clientY < itemRect.top + itemRect.height / 2) { blockList.insertBefore(placeholder, item); return true; }
        return false;
      }) || blockList.appendChild(placeholder);
    };
    const stop = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', stop);
      blockList.insertBefore(wrapper, placeholder);
      wrapper.classList.remove('is-dragging'); wrapper.style.width = ''; wrapper.style.left = ''; wrapper.style.top = '';
      placeholder.remove();
      const order = [...blockList.querySelectorAll('.editor-wrapper')].map(item => item.dataset.blockId);
      const reordered = order.map(id => note.blocks.find(item => item.id === id)).filter(Boolean);
      if (reordered.length === note.blocks.length) { note.blocks = reordered; saveState(); renderNotes(); }
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', stop, { once: true });
  });
}
function fontEntries(block) {
  const recent = Array.isArray(state.settings.recentFonts) ? state.settings.recentFonts : [];
  const values = [...recent, block.fontFamily || 'Arial, sans-serif', ...FONT_OPTIONS.map(item => item[1])].filter((value, index, list) => list.indexOf(value) === index);
  return values.map(value => FONT_OPTIONS.find(item => item[1] === value) || [value.split(',')[0].replaceAll('"', ''), value]);
}
function populateFonts(select, block) { select.replaceChildren(); fontEntries(block).forEach(([label, value], index) => { const option = new Option(label, value); option.style.fontFamily = value; option.selected = value === (block.fontFamily || 'Arial, sans-serif'); if (index === 0 && state.settings.recentFonts?.length) option.textContent = `Recently used: ${label}`; select.appendChild(option); }); }
function rememberFont(value) { state.settings.recentFonts = [value, ...(state.settings.recentFonts || []).filter(item => item !== value)].slice(0, 8); }
function applyCommand(command, value = null) { if (!activeEditor) return; activeEditor.focus(); document.execCommand(command, false, value); activeEditor.dispatchEvent(new Event('input')); }
function setFontSize(block, input) {
  const value = Math.max(1, Math.min(200, Number.parseInt(input.value, 10) || block.fontSize || 18));
  input.value = value;
  block.fontSize = value;
  if (!activeEditor) return saveState();
  activeEditor.focus();
  document.execCommand('fontSize', false, '7');
  activeEditor.querySelectorAll('font[size="7"]').forEach(item => { item.removeAttribute('size'); item.style.fontSize = `${value}px`; });
  activeEditor.style.fontSize = `${value}px`;
  activeEditor.dispatchEvent(new Event('input'));
}
function changeFontSize(block, input, delta) {
  input.value = Math.max(1, Math.min(200, (Number.parseInt(input.value, 10) || block.fontSize || 18) + delta));
  setFontSize(block, input);
}
function formatButton(label, title, command) { const item = button(label, 'format-button'); item.title = title; item.setAttribute('aria-label', title); item.addEventListener('mousedown', event => event.preventDefault()); item.addEventListener('click', () => applyCommand(command)); return item; }
function colorPicker(block, title, command, fallback = null) { const input = document.createElement('input'); input.type = 'color'; input.title = title; input.setAttribute('aria-label', title); input.value = fallback || block.color || state.settings.textColor; input.addEventListener('input', () => { block.color = input.value; block.customColors = [...new Set([...(block.customColors || []), input.value])]; applyCommand(command, input.value); saveState(); }); return input; }
function syncToolbar(editor, select, sizeInput) {
  const family = document.queryCommandValue('fontName');
  const option = [...select.options].find(item => item.value.toLowerCase().replaceAll('"', '') === family.toLowerCase().replaceAll('"', ''));
  if (option) select.value = option.value;
  if (sizeInput) {
    const selection = window.getSelection();
    const node = selection?.anchorNode;
    const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    const size = element && editor.contains(element) ? Number.parseFloat(window.getComputedStyle(element).fontSize) : Number.parseFloat(window.getComputedStyle(editor).fontSize);
    if (Number.isFinite(size)) sizeInput.value = Math.round(size);
  }
}
function applyTypingShortcut(editor) {
  const selection = window.getSelection(); if (!selection.rangeCount || !editor.contains(selection.anchorNode)) return;
  const text = selection.anchorNode.textContent || ''; const before = text.slice(0, selection.anchorOffset); const match = before.match(/(?:^|\n)(# |[*-] |1[.)] )$/); if (!match) return;
  const range = selection.getRangeAt(0); range.setStart(selection.anchorNode, selection.anchorOffset - match[1].length); range.deleteContents(); selection.removeAllRanges(); selection.addRange(range);
  if (match[1] === '# ') document.execCommand('formatBlock', false, 'h1'); else document.execCommand(match[1][0] === '1' ? 'insertOrderedList' : 'insertUnorderedList');
}

function dayBounds() { const start = new Date(); start.setHours(0, 0, 0, 0); return { start, end: new Date(start.getTime() + 86400000) }; }
function isFromPreviousDay(task) { const start = new Date(task.start); if (!isValidDate(start)) return false; const today = new Date(); today.setHours(0, 0, 0, 0); return start < today; }
function taskDisplayEnd(task) { return task.status === 'extended' ? Math.min(now(), new Date(task.start).setHours(23, 59, 59, 999)) : new Date(task.end).getTime(); }
function renderTasks() {
  const taskCountBeforeCleanup = state.tasks.length; state.tasks = state.tasks.filter(task => !isFromPreviousDay(task)); if (state.tasks.length !== taskCountBeforeCleanup) saveState('Previous-day tasks removed');
  syncExtendedTasks(); const calendar = $('#day-calendar'); const existingBody = calendar.querySelector('.calendar-day-body'); if (existingBody) calendarScrollTop = existingBody.scrollTop; calendar.replaceChildren(); renderTaskColorChart(); const day = dayBounds(); const configuredStart = state.calendar.visibleStartUserSet ? state.calendar.visibleStart : defaultCalendarStart(state.tasks); const startMinutes = Math.max(0, Math.min(1439, configuredStart)); const endMinutes = 1440; const range = endMinutes - startMinutes;
  const header = document.createElement('div'); header.className = 'calendar-day-header';
  const dayLabel = document.createElement('strong'); dayLabel.textContent = day.start.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  header.append(dayLabel, createVisibleTimeEditor(startMinutes)); calendar.appendChild(header);
  if (startMinutes >= 1439) return;
  const body = document.createElement('div'); body.className = 'calendar-day-body';
  const timeline = document.createElement('div'); timeline.className = 'calendar-timeline'; timeline.style.height = `${range * CALENDAR_PIXELS_PER_MINUTE}px`;
  const axis = document.createElement('div'); axis.className = 'calendar-axis';
  for (let minute = startMinutes; minute <= endMinutes; minute += 30) { const label = document.createElement('span'); label.textContent = minute === 1440 ? '11:59 PM' : formatMinutes(minute); label.style.top = `${calendarMinuteOffset(minute, startMinutes)}px`; axis.appendChild(label); }
  const grid = document.createElement('div'); grid.className = 'calendar-grid'; for (let minute = startMinutes; minute <= endMinutes; minute += 30) { const line = document.createElement('i'); line.style.top = `${calendarMinuteOffset(minute, startMinutes)}px`; grid.appendChild(line); }
  const events = document.createElement('div'); events.className = 'calendar-events';
  state.tasks.filter(task => isValidDate(task.start) && isValidDate(task.end) && sameLocalDay(new Date(task.start), new Date(task.end)) && sameLocalDay(new Date(task.start), day.start) && new Date(task.start) < day.end && taskDisplayEnd(task) > day.start.getTime() + startMinutes * 60000 && new Date(task.start).getTime() < day.start.getTime() + endMinutes * 60000).forEach(task => renderTaskEvent(events, task, day.start, startMinutes, endMinutes));
  const marker = document.createElement('b'); marker.className = 'current-time-marker'; marker.style.top = `${calendarMinuteOffset((now() - day.start.getTime()) / 60000, startMinutes)}px`;
  timeline.append(axis, grid, events, marker); body.appendChild(timeline); calendar.appendChild(body); body.scrollTop = calendarScrollTop; body.addEventListener('scroll', () => { calendarScrollTop = body.scrollTop; });
}
function renderTaskColorChart() {
  const chart = $('#task-color-chart'); chart.replaceChildren();
  const totals = new Map();
  const taskNames = new Map();
  state.tasks.forEach(task => {
    const start = new Date(task.start).getTime(); const end = new Date(task.end).getTime(); const duration = end - start;
    if (!Number.isFinite(start) || !Number.isFinite(end) || duration <= 0) return;
    const color = /^#[0-9a-f]{6}$/i.test(task.color || '') ? task.color.toLowerCase() : '#2f6fae';
    totals.set(color, (totals.get(color) || 0) + duration);
    if (!STANDARD_COLORS.some(([, value]) => value.toLowerCase() === color)) {
      const names = taskNames.get(color) || new Set();
      names.add(task.title?.trim() || 'Untitled task');
      taskNames.set(color, names);
    }
  });
  const entries = [...totals.entries()].sort((first, second) => second[1] - first[1]);
  const totalDuration = entries.reduce((sum, entry) => sum + entry[1], 0);
  const heading = document.createElement('h3'); heading.textContent = 'Time by Category'; chart.appendChild(heading);
  if (!totalDuration) {
    const pie = document.createElement('div'); pie.className = 'task-color-pie task-color-pie-empty'; pie.setAttribute('role', 'img'); pie.setAttribute('aria-label', 'No day breakdown to display');
    const message = document.createElement('span'); message.textContent = 'No day breakdown to display'; pie.appendChild(message); chart.appendChild(pie);
    return;
  }
  let angle = 0; const stops = [];
  entries.forEach(([color, duration]) => { const percentage = duration / totalDuration * 100; stops.push(`${color} ${angle}deg ${angle + percentage * 3.6}deg`); angle += percentage * 3.6; });
  const pie = document.createElement('div'); pie.className = 'task-color-pie'; pie.style.background = `conic-gradient(${stops.join(', ')})`; pie.setAttribute('role', 'img'); pie.setAttribute('aria-label', 'Task time distribution by color'); chart.appendChild(pie);
  const legend = document.createElement('ul'); legend.className = 'task-color-legend';
  entries.forEach(([color, duration]) => { const item = document.createElement('li'); const swatch = document.createElement('span'); swatch.className = 'task-color-legend-swatch'; swatch.style.backgroundColor = color; const label = document.createElement('span'); const colorName = STANDARD_COLORS.find(([, value]) => value.toLowerCase() === color)?.[0] || [...(taskNames.get(color) || ['Miscellaneous'])].join(', '); label.textContent = `${colorName} · ${(duration / totalDuration * 100).toFixed(1)}%`; item.append(swatch, label); legend.appendChild(item); });
  chart.appendChild(legend);
}
function calendarMinuteOffset(minute, visibleStart) { return Math.max(0, minute - visibleStart) * CALENDAR_PIXELS_PER_MINUTE; }
function sameLocalDay(first, second) { return first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth() && first.getDate() === second.getDate(); }
function createVisibleTimeEditor(startMinutes) {
  const editor = document.createElement('div');
  editor.className = 'visible-time-editor';
  editor.setAttribute('aria-label', 'Calendar visible time range');
  const label = document.createElement('span');
  label.className = 'visible-time-label';
  label.textContent = 'Day start';
  const start = createClockEditor('Calendar start time', startMinutes);
  const apply = () => {
    const nextStart = parseClockEditor(start);
    if (nextStart === null) {
      setStatus('Enter each calendar time in h:mm format.');
      return;
    }
    state.calendar.visibleStart = nextStart;
    state.calendar.visibleEnd = 1440;
    state.calendar.visibleStartUserSet = true;
    saveState();
    renderTasks();
  };
  [start.input, start.period].forEach(control => {
    control.addEventListener('change', apply);
    control.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        apply();
      }
    });
  });
  editor.append(label, start.input, start.period);
  return editor;
}
function createClockEditor(label, minutes) {
  const hour = Math.floor(minutes / 60) % 12 || 12;
  const minute = minutes % 60;
  const input = document.createElement('input');
  input.type = 'text';
  input.inputMode = 'numeric';
  input.className = 'visible-time-input';
  input.value = `${hour}:${String(minute).padStart(2, '0')}`;
  input.setAttribute('aria-label', label);
  const period = document.createElement('select');
  period.className = 'visible-time-period';
  period.setAttribute('aria-label', `${label} AM or PM`);
  ['AM', 'PM'].forEach(value => period.appendChild(new Option(value, value)));
  period.value = Math.floor(minutes / 60) >= 12 ? 'PM' : 'AM';
  return { input, period };
}
function parseClockEditor(editor) {
  const match = editor.input.value.trim().match(/^(\d{1,2}):([0-5]\d)$/);
  if (!match) return null;
  const hour = Number(match[1]);
  if (hour < 1 || hour > 12) return null;
  return ((hour % 12) + (editor.period.value === 'PM' ? 12 : 0)) * 60 + Number(match[2]);
}
function renderTaskEvent(events, task, dayStart, visibleStart, visibleEnd) {
  const start = Math.max(new Date(task.start).getTime(), dayStart.getTime() + visibleStart * 60000); const end = Math.min(taskDisplayEnd(task), dayStart.getTime() + visibleEnd * 60000); if (end <= start) return;
  const event = document.createElement('article'); event.className = `calendar-event task-${task.status || 'scheduled'}${task.status === 'extended' ? ' is-extended' : ''}`; event.style.setProperty('--task-color', task.color || '#234f7d'); event.style.top = `${calendarMinuteOffset((start - dayStart.getTime()) / 60000, visibleStart)}px`; event.style.height = `${(end - start) / 60000 * CALENDAR_PIXELS_PER_MINUTE}px`; event.innerHTML = `<strong>${escapeHtml(task.title)}</strong><span>${formatClock(new Date(start))} - ${formatClock(new Date(end))}</span>`; event.title = task.description || task.title; event.tabIndex = 0; event.addEventListener('click', () => editTask(task)); event.addEventListener('keydown', keyboardEvent => { if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') { keyboardEvent.preventDefault(); editTask(task); } }); events.appendChild(event);
}
function syncExtendedTasks() {
  const current = now(); let changed = false;
  state.tasks.filter(task => task.status === 'extended').sort((a, b) => new Date(a.end) - new Date(b.end)).forEach(extended => {
    const taskDayEnd = new Date(extended.start); taskDayEnd.setHours(23, 59, 59, 999);
    if (current >= taskDayEnd.getTime()) { extended.status = 'completed'; extended.actualEnd = taskDayEnd.toISOString(); extended.completedAt = extended.actualEnd; changed = true; return; }
    const extensionEnd = current; const base = new Date(extended.end).getTime();
    state.tasks.filter(task => task.id !== extended.id && task.status !== 'completed' && new Date(task.start).getTime() >= base).forEach(task => {
      const duration = new Date(task.end).getTime() - new Date(task.start).getTime(); const desiredStart = new Date(task.originalStart || task.start).getTime() + Math.max(0, extensionEnd - base);
      if (new Date(task.start).getTime() !== desiredStart) { task.originalStart = task.originalStart || task.start; task.originalEnd = task.originalEnd || task.end; task.start = new Date(desiredStart).toISOString(); task.end = new Date(desiredStart + duration).toISOString(); changed = true; }
    });
  });
  if (changed) saveState();
}
function editTask(task) {
  taskBeingEdited = task; const form = $('#task-form'); form.hidden = false; form.elements.title.value = task.title || ''; form.elements.description.value = task.description || ''; form.elements.color.value = task.color || '#2f6fae'; syncTaskColorPicker(); setTimeFields(form, 'start', new Date(task.start)); setTimeFields(form, 'end', new Date(task.end));
  $('#task-meta').textContent = task.actualEnd ? `Scheduled: ${formatDate(new Date(task.end))} · Actual end: ${formatDate(new Date(task.actualEnd))}` : `Scheduled: ${formatDate(new Date(task.start))} - ${formatDate(new Date(task.end))}`;
  const actions = form.querySelector('.form-actions'); actions.querySelectorAll('.task-action').forEach(item => item.remove()); if (task.status !== 'completed') { const end = button('Finish Task', 'success task-action'); end.addEventListener('click', () => finishTask(task)); actions.prepend(end); } const remove = button('🗑️', 'note-delete-button task-action'); remove.title = 'Delete task'; remove.setAttribute('aria-label', `Delete ${task.title || 'untitled task'}`); remove.addEventListener('click', () => deleteTask(task)); actions.prepend(remove); document.querySelector('[data-view="calendar-view"]').click(); window.scrollTo({ top: 0, behavior: 'smooth' });
}
function finishTask(task) { const endedAt = new Date().toISOString(); task.status = 'completed'; task.end = endedAt; task.completedAt = endedAt; task.actualEnd = endedAt; saveState('Task ended'); renderTasks(); editTask(task); }
function deleteTask(task) { if (!confirm(`Delete "${task.title}"?`)) return; state.tasks = state.tasks.filter(item => item.id !== task.id); taskBeingEdited = null; $('#task-form').hidden = true; saveState('Task deleted'); renderTasks(); }
function syncTaskColorPicker() { const picker = $('.task-color-picker'); const input = document.querySelector('#task-form [name="color"]'); if (!picker || !input) return; picker.querySelectorAll('.standard-color').forEach(button => button.classList.toggle('is-selected', button.dataset.color.toLowerCase() === input.value.toLowerCase())); }
function setupTaskColorPicker() { const picker = $('.task-color-picker'); const input = document.querySelector('#task-form [name="color"]'); if (!picker || !input) return; const colors = picker.querySelector('.standard-colors'); STANDARD_COLORS.forEach(([name, value]) => { const swatch = button('', 'standard-color'); swatch.dataset.color = value; swatch.title = name; swatch.setAttribute('aria-label', name); swatch.style.backgroundColor = value; swatch.addEventListener('click', () => { input.value = value; syncTaskColorPicker(); }); colors.appendChild(swatch); }); picker.querySelector('.custom-color-button').addEventListener('click', () => input.click()); input.addEventListener('input', syncTaskColorPicker); syncTaskColorPicker(); }
function formatMinutes(minutes) { const dayOffset = Math.floor(minutes / 1440); const value = minutes % 1440; const hour = Math.floor(value / 60); const minute = value % 60; const suffix = hour >= 12 ? 'PM' : 'AM'; return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${suffix}${dayOffset ? ` (+${dayOffset}d)` : ''}`; }
function formatDate(date) { return date.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }); }
function formatClock(date) { return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
function isValidDate(value) { const date = value instanceof Date ? value : new Date(value); return !Number.isNaN(date.getTime()); }
function localInputValue(date) { if (!isValidDate(date)) return ''; const offset = date.getTimezoneOffset() * 60000; return new Date(date.getTime() - offset).toISOString().slice(0, 16); }
function setTimeFields(form, prefix, date) { const value = localInputValue(date); const [hourText, minute] = value.slice(11).split(':'); const hour = Number(hourText); form.elements[`${prefix}Time`].value = `${hour % 12 || 12}:${minute}`; form.elements[`${prefix}Period`].value = hour >= 12 ? 'PM' : 'AM'; }
function parseTimeOnDate(date, timeValue, period) { const match = String(timeValue).trim().match(/^(\d{1,2}):([0-5]\d)$/); if (!match || Number(match[1]) < 1 || Number(match[1]) > 12) return null; const result = new Date(date); result.setHours((Number(match[1]) % 12) + (period === 'PM' ? 12 : 0), Number(match[2]), 0, 0); return isValidDate(result) ? result : null; }
function overlaps(start, end, excludeId = null) { return state.tasks.some(task => task.id !== excludeId && task.status !== 'completed' && new Date(task.start) < end && new Date(task.end) > start); }

function renderLaps() { $('#lap-list').replaceChildren(...state.stopwatch.laps.map((lap, index) => { const item = document.createElement('label'); item.className = 'lap-row'; item.innerHTML = `<span>Lap ${index + 1} · ${formatDuration(lap.elapsed)}</span>`; const input = document.createElement('input'); input.placeholder = 'Description'; input.value = lap.description || ''; input.addEventListener('input', () => { lap.description = input.value; saveState(); }); item.appendChild(input); return item; })); }
function formatDuration(milliseconds) { const seconds = Math.max(0, Math.floor(milliseconds / 1000)); return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(value => String(value).padStart(2, '0')).join(':'); }
function updateStopwatch() { const elapsed = state.stopwatch.elapsed + (state.stopwatch.startedAt ? now() - state.stopwatch.startedAt : 0); $('#stopwatch-display').textContent = formatDuration(elapsed); }
function updateCountdown() { const remaining = state.countdown.endsAt ? Math.max(0, state.countdown.endsAt - now()) : state.countdown.remaining; $('#countdown-display').textContent = formatDuration(remaining); }
function startClockLoops() { clearInterval(stopwatchInterval); clearInterval(countdownInterval); clearInterval(calendarInterval); stopwatchInterval = setInterval(updateStopwatch, 1000); countdownInterval = setInterval(updateCountdown, 1000); calendarInterval = setInterval(renderTasks, 30000); }

function wireEvents() {
  setupTaskColorPicker();
  $('#theme-toggle')?.addEventListener('click', () => {
    const nextTheme = state.settings.theme === 'light' ? 'dark' : 'light';
    state.settings.theme = nextTheme;
    applyTheme(nextTheme);
    saveState();
  });
  $('#theme-select')?.addEventListener('change', event => {
    const nextTheme = event.target.value === 'light' ? 'light' : 'dark';
    state.settings.theme = nextTheme;
    applyTheme(nextTheme);
    saveState();
  });
  const tabs = document.querySelector('.tabs');
  const tabIndicator = document.querySelector('.tab-indicator');
  const updateTabIndicator = tab => {
    if (!tabIndicator || !tab) return;
    tabIndicator.style.width = `${tab.offsetWidth}px`;
    tabIndicator.style.left = `${tab.offsetLeft}px`;
  };
  document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(item => item.classList.toggle('is-active', item === tab));
    document.querySelectorAll('.view').forEach(view => view.classList.toggle('is-visible', view.id === tab.dataset.view));
    updateTabIndicator(tab);
  }));
  updateTabIndicator(tabs?.querySelector('.tab.is-active'));
  window.addEventListener('resize', () => updateTabIndicator(tabs?.querySelector('.tab.is-active')));
  $('#new-task').addEventListener('click', () => { taskBeingEdited = null; const form = $('#task-form'); form.reset(); syncTaskColorPicker(); form.hidden = false; $('#task-meta').textContent = ''; const start = new Date(); setTimeFields(form, 'start', start); form.elements.endTime.value = ''; const currentPeriod = start.getHours() >= 12 ? 'PM' : 'AM'; form.elements.startPeriod.value = currentPeriod; form.elements.endPeriod.value = currentPeriod; form.querySelector('.form-actions').querySelectorAll('.task-action').forEach(item => item.remove()); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  $('#cancel-task').addEventListener('click', () => { taskBeingEdited = null; $('#task-form').hidden = true; });
  $('#task-form').addEventListener('submit', event => {
    event.preventDefault(); const form = event.currentTarget; const taskDate = taskBeingEdited ? new Date(taskBeingEdited.start) : new Date(); const enteredStart = parseTimeOnDate(taskDate, form.elements.startTime.value, form.elements.startPeriod.value); const endInput = form.elements.endTime.value.trim(); const end = endInput ? parseTimeOnDate(taskDate, endInput, form.elements.endPeriod.value) : enteredStart ? new Date(enteredStart.getTime() + 60 * 60000) : null; const current = new Date(); const startsNow = !taskBeingEdited && enteredStart && enteredStart.getHours() === current.getHours() && enteredStart.getMinutes() === current.getMinutes(); const start = startsNow ? current : enteredStart;
    if (!start || !end) return setStatus('Enter valid start and end time values.'); if (!sameLocalDay(start, end)) return setStatus('Tasks must start and end on the same day.'); if (end <= start) return setStatus('End time must be after the start time.'); if (end.getTime() - start.getTime() >= 86400000) return setStatus('Tasks cannot be longer than one day.'); if (overlaps(start, end, taskBeingEdited?.id)) return setStatus('Tasks cannot overlap.');
    const values = { title: form.elements.title.value.trim(), description: form.elements.description.value.trim(), color: form.elements.color.value, start: start.toISOString(), end: end.toISOString() }; if (!values.title) return setStatus('Enter a task title.');
    if (taskBeingEdited) Object.assign(taskBeingEdited, values); else state.tasks.push({ id: crypto.randomUUID(), ...values, status: startsNow ? 'active' : 'scheduled', completedAt: null });
    saveState('Task saved'); taskBeingEdited = null; form.reset(); form.hidden = true; renderTasks();
  });
  $('#stopwatch-toggle').addEventListener('click', () => { if (state.stopwatch.startedAt) { state.stopwatch.elapsed += now() - state.stopwatch.startedAt; state.stopwatch.startedAt = null; $('#stopwatch-toggle').textContent = 'Resume'; } else { state.stopwatch.startedAt = now(); $('#stopwatch-toggle').textContent = 'Pause'; } saveState(); });
  $('#stopwatch-reset').addEventListener('click', () => { state.stopwatch = { startedAt: null, elapsed: 0, laps: [] }; $('#stopwatch-toggle').textContent = 'Start'; saveState(); renderLaps(); updateStopwatch(); });
  $('#lap-button').addEventListener('click', () => { const elapsed = state.stopwatch.elapsed + (state.stopwatch.startedAt ? now() - state.stopwatch.startedAt : 0); state.stopwatch.laps.push({ elapsed, description: '' }); saveState(); renderLaps(); });
  $('#countdown-start').addEventListener('click', () => { if (state.countdown.endsAt) return; const hours = Number($('#countdown-hours').value || 0); const minutes = Number($('#countdown-minutes').value || 0); const seconds = Number($('#countdown-seconds').value || 0); const duration = (hours * 3600 + minutes * 60 + seconds) * 1000; if (duration <= 0) return setStatus('Enter a countdown duration.'); state.countdown = { endsAt: now() + duration, remaining: 0, alarmActive: false, occurrence: crypto.randomUUID(), dismissed: false }; chrome.runtime.sendMessage({ type: 'START_COUNTDOWN', endsAt: state.countdown.endsAt, occurrence: state.countdown.occurrence }); saveState(); });
  $('#countdown-reset').addEventListener('click', () => { state.countdown = { endsAt: null, remaining: 0, alarmActive: false, occurrence: null, dismissed: false }; chrome.runtime.sendMessage({ type: 'RESET_COUNTDOWN' }); saveState(); updateCountdown(); });
  wireImportExport();
}
function wireImportExport() {
  $('#export-all').addEventListener('click', () => downloadJson('offline-workspace-backup.json', state)); $('#export-notes').addEventListener('click', () => downloadJson('notes.json', { notes: state.notes })); $('#export-tasks').addEventListener('click', () => downloadJson('schedules.json', { tasks: state.tasks })); $('#export-settings').addEventListener('click', () => downloadJson('settings.json', { settings: state.settings })); $('#export-timers').addEventListener('click', () => downloadJson('timers.json', { stopwatch: state.stopwatch, countdown: state.countdown }));
  $('#import-all').addEventListener('change', importJson); $('#import-notes').addEventListener('change', event => importCategory(event, 'notes')); $('#import-tasks').addEventListener('change', event => importCategory(event, 'tasks')); $('#import-settings').addEventListener('change', event => importCategory(event, 'settings')); $('#import-timers').addEventListener('change', event => importCategory(event, 'timers'));
}
function downloadJson(name, data) { const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); link.download = name; link.click(); URL.revokeObjectURL(link.href); }
async function readJson(event) { const file = event.target.files[0]; event.target.value = ''; if (!file) return null; try { return JSON.parse(await file.text()); } catch { setStatus('Import failed: choose a valid JSON file.'); return null; } }
async function importJson(event) { const imported = await readJson(event); if (!imported || typeof imported !== 'object') return; state = { ...state, ...imported, settings: { ...state.settings, ...(imported.settings || {}) } }; applyTheme(state.settings.theme); applyBackgroundImage(state.settings.backgroundImageUrl); await saveState('Backup imported'); renderAll(); }
async function importCategory(event, category) { const imported = await readJson(event); if (!imported) return; if (category === 'settings') { state.settings = { ...state.settings, ...(imported.settings || {}) }; applyTheme(state.settings.theme); applyBackgroundImage(state.settings.backgroundImageUrl); } else if (category === 'timers') { state.stopwatch = imported.stopwatch || state.stopwatch; state.countdown = imported.countdown || state.countdown; } else if (Array.isArray(imported[category])) state[category] = imported[category]; else return setStatus(`Import failed: no ${category} data found.`); await saveState(`${category} imported`); renderAll(); }

wireEvents();
loadState();
chrome.storage.onChanged.addListener(changes => {
  const newValue = changes.todoState?.newValue;
  if (!newValue) return;
  const newJson = JSON.stringify(newValue);
  if (newJson === lastSavedStateJson) return;

  if (newValue.settings?.theme && newValue.settings.theme !== state?.settings?.theme) {
    applyTheme(newValue.settings.theme);
  }

  if (saving || activeEditor || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable) return;

  const contentChanged = !state ||
    JSON.stringify(state.notes) !== JSON.stringify(newValue.notes) ||
    JSON.stringify(state.tasks) !== JSON.stringify(newValue.tasks) ||
    JSON.stringify(state.stopwatch?.laps) !== JSON.stringify(newValue.stopwatch?.laps) ||
    state.calendar?.visibleStart !== newValue.calendar?.visibleStart ||
    state.settings?.backgroundImageUrl !== newValue.settings?.backgroundImageUrl;

  state = newValue;
  lastSavedStateJson = newJson;
  if (contentChanged) {
    renderAll();
  }
});
