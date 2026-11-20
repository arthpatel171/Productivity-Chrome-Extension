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
const STANDARD_COLORS = [
  ['Dark Red', '#B71C1C'],
  ['Red', '#E53935'],
  ['Orange', '#FF9800'],
  ['Yellow', '#FDD835'],
  ['Light Green', '#A7F3D0'],
  ['Green', '#4CAF50'],
  ['Teal', '#00BCD4'],
  ['Blue', '#2196F3'],
  ['Dark Blue', '#1565C0'],
  ['Purple', '#A855F7']
];
const LEGACY_COLORS = new Map([
  ['#8b0000', 'Dark Red'],
  ['#dc2626', 'Red'],
  ['#f97316', 'Orange'],
  ['#facc15', 'Yellow'],
  ['#86efac', 'Light Green'],
  ['#16a34a', 'Green'],
  ['#14b8a6', 'Teal'],
  ['#2563eb', 'Blue'],
  ['#123b66', 'Dark Blue'],
  ['#8b5cf6', 'Purple']
]);
const CALENDAR_PIXELS_PER_MINUTE = 2;
function localDayKey(date = new Date()) { return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`; }
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
let chartInterval;
let taskBeingEdited;
const STORAGE_KEYS = ['notes', 'tasks', 'stopwatch', 'countdown', 'settings', 'calendar'];
let calendarScrollTop = 0;
let calendarDay;
let saving = false;
const lastSavedJson = {
  notes: '',
  tasks: '',
  stopwatch: '',
  countdown: '',
  settings: '',
  calendar: ''
};
let selectedEditorImage = null;
let resizingEditorImage = false;
let resizeData = null;
const $ = selector => document.querySelector(selector);
const now = () => Date.now();
const clone = value => JSON.parse(JSON.stringify(value));

async function loadState() {
  const stored = await chrome.storage.local.get([...STORAGE_KEYS, 'todoState']);
  if (!stored.tasks && stored.todoState) {
    const legacy = stored.todoState;
    stored.notes = legacy.notes;
    stored.tasks = legacy.tasks;
    stored.stopwatch = legacy.stopwatch;
    stored.countdown = legacy.countdown;
    stored.settings = legacy.settings;
    stored.calendar = legacy.calendar;
    await chrome.storage.local.set({
      notes: stored.notes || clone(DEFAULT_STATE.notes),
      tasks: stored.tasks || clone(DEFAULT_STATE.tasks),
      stopwatch: stored.stopwatch || clone(DEFAULT_STATE.stopwatch),
      countdown: stored.countdown || clone(DEFAULT_STATE.countdown),
      settings: stored.settings || clone(DEFAULT_STATE.settings),
      calendar: stored.calendar || clone(DEFAULT_STATE.calendar)
    });
  }

  state = {
    notes: Array.isArray(stored.notes) && stored.notes.length ? stored.notes : clone(DEFAULT_STATE.notes),
    tasks: Array.isArray(stored.tasks) ? stored.tasks : [],
    stopwatch: stored.stopwatch || clone(DEFAULT_STATE.stopwatch),
    countdown: stored.countdown || clone(DEFAULT_STATE.countdown),
    settings: { ...clone(DEFAULT_STATE.settings), ...(stored.settings || {}) },
    calendar: { ...clone(DEFAULT_STATE.calendar), ...(stored.calendar || {}) }
  };

  const taskCountBeforeCleanup = state.tasks.length;
  state.tasks = state.tasks.filter(task => !isFromPreviousDay(task));
  const removedPreviousDayTasks = state.tasks.length !== taskCountBeforeCleanup;

  applyTheme(state.settings.theme, false);
  applyBackgroundImage(state.settings.backgroundImageUrl);

  const storedCalendar = stored.calendar || {};
  const hasPersistedCalendarDay = Object.prototype.hasOwnProperty.call(storedCalendar, 'visibleStartDay');
  calendarDay = localDayKey();
  state.calendar = { ...clone(DEFAULT_STATE.calendar), visibleStart: defaultCalendarStart(state.tasks), visibleEnd: 1440, visibleStartUserSet: false };

  activeNoteId = state.notes[0]?.id || null;

  for (const key of STORAGE_KEYS) {
    lastSavedJson[key] = JSON.stringify(state[key]);
  }

  if (removedPreviousDayTasks) await saveSlice('tasks');
  if (hasPersistedCalendarDay) await saveSlice('calendar');

  if (taskBeingEdited) {
    const updated = state.tasks.find(t => t.id === taskBeingEdited.id);
    if (!updated) {
      taskBeingEdited = null;
      $('#task-form').hidden = true;
    } else {
      taskBeingEdited = updated;
      syncTaskFormWithTask(updated);
    }
  }

  renderAll();
  startClockLoops();
}

async function saveSlice(key, message) {
  if (!state || !key) return;
  saving = true;
  lastSavedJson[key] = JSON.stringify(state[key]);
  await chrome.storage.local.set({ [key]: state[key] });
  saving = false;
  if (message) setStatus(message);
}

async function saveSlices(keys, message) {
  if (!state || !Array.isArray(keys)) return;
  saving = true;
  const payload = {};
  for (const key of keys) {
    lastSavedJson[key] = JSON.stringify(state[key]);
    payload[key] = state[key];
  }
  await chrome.storage.local.set(payload);
  saving = false;
  if (message) setStatus(message);
}

async function saveState(message) {
  await saveSlices(STORAGE_KEYS, message);
}

const saveNotes = msg => saveSlice('notes', msg);
const saveTasks = msg => saveSlice('tasks', msg);
const saveSettings = msg => saveSlice('settings', msg);
const saveStopwatch = msg => saveSlice('stopwatch', msg);
const saveCountdown = msg => saveSlice('countdown', msg);
const saveCalendar = msg => saveSlice('calendar', msg);

function getCaretCharacterOffsetWithin(element) {
  let caretOffset = 0;
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    caretOffset = preCaretRange.toString().length;
  }
  return caretOffset;
}

function setCaretCharacterOffsetWithin(element, offset) {
  const createRange = (node, chars, range) => {
    if (!range) {
      range = document.createRange();
      range.selectNode(node);
      range.setStart(node, 0);
    }
    if (chars.count === 0) {
      range.setEnd(node, chars.count);
    } else if (node && chars.count > 0) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.textContent.length < chars.count) {
          chars.count -= node.textContent.length;
        } else {
          range.setEnd(node, chars.count);
          chars.count = 0;
        }
      } else {
        for (let lp = 0; lp < node.childNodes.length; lp++) {
          range = createRange(node.childNodes[lp], chars, range);
          if (chars.count === 0) break;
        }
      }
    }
    return range;
  };

  try {
    const sel = window.getSelection();
    if (offset >= 0 && element) {
      const range = createRange(element, { count: offset });
      if (range) {
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  } catch {
    // Graceful fallback if selection restoration is not supported
  }
}
let toastTimeout;
function showToast(message, dotColor) {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toastMsg');
  const dotEl = document.getElementById('toastDot');
  if (!toast || !msgEl) return;
  msgEl.textContent = message;
  if (dotEl) {
    if (dotColor) {
      dotEl.style.backgroundColor = dotColor;
    } else if (/fail|error|cannot|must|invalid|delete/i.test(message)) {
      dotEl.style.backgroundColor = '#EF4444';
    } else if (/saved|finish|complete/i.test(message)) {
      dotEl.style.backgroundColor = '#10B981';
    } else if (/pause/i.test(message)) {
      dotEl.style.backgroundColor = '#F59E0B';
    } else {
      dotEl.style.backgroundColor = '#60A5FA';
    }
  }
  toast.classList.add('is-visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('is-visible');
  }, 2500);
}
function setStatus(message) {
  const status = $('#app-status');
  if (status) status.textContent = message;
  if (message) showToast(message);
}
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
  const title = document.createElement('input'); title.className = 'note-title'; title.value = note.title; title.setAttribute('aria-label', 'Note title'); title.addEventListener('input', () => { note.title = title.value; renderNotesListOnly(); saveNotes(); });
  const add = button('+ Add Text Box', 'primary add-box-button'); add.addEventListener('click', () => { note.blocks.push(newBlock()); saveNotes(); renderNotes(); }); heading.append(title, add); panel.appendChild(heading);
  const blockList = document.createElement('div'); blockList.className = 'note-block-list';
  note.blocks.forEach((block, index) => blockList.appendChild(createBlock(note, block, index, blockList)));
  panel.appendChild(blockList);
}
function addNote() {
  const note = { id: crypto.randomUUID(), title: 'New note', blocks: [newBlock()] };
  state.notes.push(note); activeNoteId = note.id; saveNotes(); renderNotes();
}
function deleteNote(note) {
  if (state.notes.length === 1) return setStatus('At least one note must remain.');
  if (!confirm(`Delete "${note.title || 'Untitled note'}"?`)) return;
  state.notes = state.notes.filter(item => item.id !== note.id);
  if (activeNoteId === note.id) activeNoteId = state.notes[0].id;
  saveNotes('Note deleted'); renderNotes();
}
function newBlock() { return { id: crypto.randomUUID(), title: 'Text box', html: '', collapsed: false, width: 100, height: 180, fontFamily: 'Arial, sans-serif', fontSize: 18, customColors: [] }; }
function renderNotesListOnly() {
  const items = $('#note-list').querySelectorAll('.note-list-item');
  state.notes.forEach((note, index) => {
    if (items[index]) {
      items[index].textContent = note.title || 'Untitled note';
      items[index].classList.toggle('is-active', note.id === activeNoteId);
    }
  });
}
function createBlock(note, block, index, blockList) {
  const wrapper = document.createElement('div'); wrapper.className = 'editor-wrapper';
  wrapper.dataset.blockId = block.id;
  const drag = button('⠿', 'drag-handle'); drag.title = 'Move text box'; drag.setAttribute('aria-label', 'Move text box');
  const article = document.createElement('article'); article.className = `editor-card${block.collapsed ? ' is-collapsed' : ''}`; article.style.width = `${block.width || 100}%`;
  const toolbar = document.createElement('div'); toolbar.className = 'editor-toolbar';
  const blockTitle = document.createElement('input'); blockTitle.className = 'block-title'; blockTitle.value = block.title || 'Text box'; blockTitle.setAttribute('aria-label', 'Text box title'); blockTitle.addEventListener('input', () => { block.title = blockTitle.value; saveNotes(); });
  const fontFamily = document.createElement('select'); fontFamily.className = 'font-family'; fontFamily.setAttribute('aria-label', 'Font family'); populateFonts(fontFamily, block);
  fontFamily.addEventListener('change', () => { rememberFont(fontFamily.value); applyCommand('fontName', fontFamily.value); block.fontFamily = fontFamily.value; editor.style.fontFamily = fontFamily.value; saveSlices(['notes', 'settings']); });
  const fontSize = document.createElement('input'); fontSize.className = 'font-size-input'; fontSize.type = 'number'; fontSize.min = '1'; fontSize.max = '200'; fontSize.step = '1'; fontSize.value = block.fontSize || 18; fontSize.setAttribute('aria-label', 'Font size in pixels'); fontSize.title = 'Font size in pixels';
  const decreaseFontSize = button('−', 'format-button font-size-button'); decreaseFontSize.title = 'Decrease font size'; decreaseFontSize.setAttribute('aria-label', 'Decrease font size');
  const increaseFontSize = button('+', 'format-button font-size-button'); increaseFontSize.title = 'Increase font size'; increaseFontSize.setAttribute('aria-label', 'Increase font size');
  [decreaseFontSize, increaseFontSize].forEach(item => item.addEventListener('mousedown', event => event.preventDefault()));
  decreaseFontSize.addEventListener('click', () => changeFontSize(block, fontSize, -1));
  increaseFontSize.addEventListener('click', () => changeFontSize(block, fontSize, 1));
  fontSize.addEventListener('change', () => setFontSize(block, fontSize));
  const color = colorPicker(block, 'Text color', 'foreColor');
  const highlight = colorPicker(block, 'Highlight color', 'hiliteColor', state.settings.highlightColor);
  const collapse = button(block.collapsed ? 'Expand' : 'Collapse', 'icon'); collapse.addEventListener('click', () => { block.collapsed = !block.collapsed; saveNotes(); renderNotes(); });
  const remove = button('Delete', 'danger'); remove.addEventListener('click', () => { note.blocks = note.blocks.filter(item => item.id !== block.id); saveNotes(); renderNotes(); });
  toolbar.append(blockTitle, formatButton('B', 'Bold', 'bold'), formatButton('I', 'Italic', 'italic'), formatButton('U', 'Underline', 'underline'), formatButton('•', 'Bulleted list', 'insertUnorderedList'), formatButton('1.', 'Numbered list', 'insertOrderedList'), fontFamily, decreaseFontSize, fontSize, increaseFontSize, color, highlight, collapse, remove);
  const editor = document.createElement('div'); editor.className = 'wysiwyg'; editor.contentEditable = 'true'; editor.innerHTML = block.html || ''; editor.dataset.placeholder = 'Start typing...'; editor.style.fontFamily = block.fontFamily || 'Arial, sans-serif'; editor.style.fontSize = `${block.fontSize || 18}px`; editor.style.minHeight = `${block.height || 180}px`;
  prepareEditorImages(editor, block);
  editor.addEventListener('focus', () => { activeEditor = editor; });
  editor.addEventListener('keyup', () => syncToolbar(editor, fontFamily, fontSize)); editor.addEventListener('mouseup', () => syncToolbar(editor, fontFamily, fontSize));
  editor.addEventListener('paste', event => handleEditorPaste(event, editor, block));
  editor.addEventListener('click', event => {
    const image = event.target.closest('.resizable-image');
    if (image && editor.contains(image)) selectEditorImage(image);
    else deselectEditorImage();
  });
  editor.addEventListener('keydown', event => {
    if (selectedEditorImage && editor.contains(selectedEditorImage) && (event.key === 'Backspace' || event.key === 'Delete')) {
      event.preventDefault();
      selectedEditorImage.remove();
      deselectEditorImage();
      block.html = editorHtml(editor);
      saveNotes();
    }
  });
  editor.addEventListener('input', () => { applyTypingShortcut(editor); block.html = editorHtml(editor); block.fontFamily = window.getComputedStyle(editor).fontFamily || block.fontFamily; block.height = editor.scrollHeight; block.customColors = (block.customColors || []).filter(colorValue => block.html.toLowerCase().includes(colorValue.toLowerCase())); saveNotes(); });
  editor.addEventListener('blur', () => { block.html = editorHtml(editor); activeEditor = null; saveNotes(); });
  if (block.collapsed) editor.hidden = true; article.append(toolbar, editor); wrapper.append(drag, article); enableBlockDragging(note, block, wrapper, drag, blockList); return wrapper;
}
function prepareEditorImages(editor, block) {
  [...editor.querySelectorAll('img')].forEach(image => {
    const existing = image.parentElement?.classList.contains('resizable-image') ? image.parentElement : null;
    if (existing) {
      if (!existing.querySelector('.image-resize-handle')) addImageResizeHandles(existing, editor, block);
      return;
    }
    wrapImage(editor, image, block);
  });
}
function wrapImage(editor, image, block) {
  const wrapper = document.createElement('span');
  wrapper.className = 'resizable-image';
  wrapper.contentEditable = 'false';
  wrapper.setAttribute('role', 'img');
  wrapper.setAttribute('aria-label', 'Resizable pasted image');
  image.draggable = false;
  image.removeAttribute('width');
  image.removeAttribute('height');
  image.replaceWith(wrapper);
  wrapper.appendChild(image);
  addImageResizeHandles(wrapper, editor, block);
  return wrapper;
}
function addImageResizeHandles(wrapper, editor, block) {
  ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'].forEach(position => {
    const handle = document.createElement('span');
    handle.className = `image-resize-handle ${position}`;
    handle.addEventListener('pointerdown', event => startImageResize(event, wrapper, position, editor, block));
    wrapper.appendChild(handle);
  });
}
function selectEditorImage(wrapper) {
  deselectEditorImage();
  selectedEditorImage = wrapper;
  wrapper.classList.add('selected');
}
function deselectEditorImage() {
  selectedEditorImage?.classList.remove('selected');
  selectedEditorImage = null;
}
function startImageResize(event, wrapper, position, editor, block) {
  event.preventDefault();
  event.stopPropagation();
  selectEditorImage(wrapper);
  resizingEditorImage = true;
  const rect = wrapper.getBoundingClientRect();
  resizeData = { startX: event.clientX, startY: event.clientY, width: rect.width, height: rect.height, position, editor, block };
  document.addEventListener('pointermove', resizeImage);
  document.addEventListener('pointerup', stopImageResize);
  document.addEventListener('pointercancel', stopImageResize);
}
function resizeImage(event) {
  if (!resizingEditorImage || !resizeData || !selectedEditorImage) return;
  const { startX, startY, width: startWidth, height: startHeight, position, editor, block } = resizeData;
  const dx = event.clientX - startX;
  const dy = event.clientY - startY;
  const width = Math.max(50, startWidth + (position.includes('e') ? dx : position.includes('w') ? -dx : 0));
  const height = Math.max(50, startHeight + (position.includes('s') ? dy : position.includes('n') ? -dy : 0));
  selectedEditorImage.style.width = `${width}px`;
  selectedEditorImage.style.height = `${height}px`;
}
function stopImageResize() {
  if (resizeData) {
    resizeData.block.html = editorHtml(resizeData.editor);
    saveNotes();
  }
  resizingEditorImage = false;
  resizeData = null;
  document.removeEventListener('pointermove', resizeImage);
  document.removeEventListener('pointerup', stopImageResize);
  document.removeEventListener('pointercancel', stopImageResize);
}
function editorHtml(editor) {
  const copy = editor.cloneNode(true);
  copy.querySelectorAll('.image-resize-handle').forEach(handle => handle.remove());
  return copy.innerHTML;
}
function handleEditorPaste(event, editor, block) {
  const clipboard = event.clipboardData;
  const imageItem = [...(clipboard?.items || [])].find(item => item.type.startsWith('image/'));
  const file = imageItem?.getAsFile() || [...(clipboard?.files || [])].find(item => item.type.startsWith('image/'));
  const html = clipboard?.getData('text/html') || '';
  const htmlImage = html ? new DOMParser().parseFromString(html, 'text/html').querySelector('img') : null;
  const imageSource = htmlImage?.getAttribute('src');
  if (!file && !imageSource) {
    event.preventDefault();
    document.execCommand('insertText', false, clipboard?.getData('text/plain') || '');
    return;
  }
  event.preventDefault();
  const insertImage = source => {
    const image = document.createElement('img');
    image.src = source;
    image.alt = htmlImage?.getAttribute('alt') || 'Pasted image';
    const range = window.getSelection()?.rangeCount ? window.getSelection().getRangeAt(0) : null;
    const wrapper = wrapImage(editor, image, block);
    if (!range || !editor.contains(range.commonAncestorContainer)) {
      editor.append(document.createElement('br'), wrapper);
    } else {
      range.deleteContents();
      range.insertNode(wrapper);
      range.setStartAfter(wrapper);
      range.collapse(true);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
    block.html = editorHtml(editor);
    saveNotes();
  };
  if (!file) {
    insertImage(imageSource);
    return;
  }
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    if (typeof reader.result === 'string') insertImage(reader.result);
  });
  reader.readAsDataURL(file);
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
      if (reordered.length === note.blocks.length) { note.blocks = reordered; saveNotes(); renderNotes(); }
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
  if (!activeEditor) return saveNotes();
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
function colorPicker(block, title, command, fallback = null) { const input = document.createElement('input'); input.type = 'color'; input.title = title; input.setAttribute('aria-label', title); input.value = fallback || block.color || state.settings.textColor; input.addEventListener('input', () => { block.color = input.value; block.customColors = [...new Set([...(block.customColors || []), input.value])]; applyCommand(command, input.value); saveNotes(); }); return input; }
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
function taskDisplayEnd(task) {
  if (task.status === 'active') return new Date(task.end).getTime();
  if (task.status === 'paused') return now();
  return task.status === 'extended' ? Math.min(now(), new Date(task.start).setHours(23, 59, 59, 999)) : new Date(task.end).getTime();
}
function taskElapsedEnd(task) {
  if (['active', 'paused'].includes(task.status)) return now();
  return taskDisplayEnd(task);
}
function taskElapsedWindow(task) {
  const start = new Date(task.start).getTime();
  const current = now();
  if (!Number.isFinite(start) || start > current || task.delayed) return null;
  const end = ['active', 'paused', 'extended', 'running', 'in-progress', 'scheduled'].includes(task.status)
    ? current
    : Math.min(current, new Date(task.actualEnd || task.end).getTime());
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? { start, end } : null;
}
function taskBreaks(task, end) {
  const breaks = (task.breaks || []).map(item => ({ start: new Date(item.start).getTime(), end: new Date(item.end).getTime() }))
    .filter(item => Number.isFinite(item.start) && Number.isFinite(item.end) && item.end > item.start);
  if (task.status === 'paused' && task.pausedAt) {
    const start = new Date(task.pausedAt).getTime();
    if (Number.isFinite(start) && end > start) breaks.push({ start, end });
  }
  return breaks;
}
function renderTasks() {
  const taskCountBeforeCleanup = state.tasks.length; state.tasks = state.tasks.filter(task => !isFromPreviousDay(task)); if (state.tasks.length !== taskCountBeforeCleanup) saveTasks('Previous-day tasks removed');
  const todayKey = localDayKey();
  if (calendarDay !== todayKey) {
    state.calendar.visibleStart = defaultCalendarStart(state.tasks);
    state.calendar.visibleStartUserSet = false;
    calendarDay = todayKey;
    saveCalendar('Calendar start updated');
  }
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
  const taskDurations = [];
  const categoryLabels = new Map();
  let breakTotal = 0;
  state.tasks.forEach(task => {
    const window = taskElapsedWindow(task);
    if (!window) return;
    const { start, end } = window; const duration = end - start;
    const color = /^#[0-9a-f]{6}$/i.test(task.color || '') ? task.color.toLowerCase() : '#2f6fae';
    if (!categoryLabels.has(color)) categoryLabels.set(color, STANDARD_COLORS.find(([, value]) => value.toLowerCase() === color)?.[0] || LEGACY_COLORS.get(color) || task.title?.trim() || 'Miscellaneous');
    const breaks = taskBreaks(task, end);
    const pausedDuration = breaks.reduce((total, item) => total + Math.max(0, Math.min(end, item.end) - Math.max(start, item.start)), 0);
    const workedDuration = Math.max(0, duration - pausedDuration);
    if (workedDuration) totals.set(color, (totals.get(color) || 0) + workedDuration);
    if (workedDuration) taskDurations.push({ title: task.title?.trim() || 'Untitled task', color, duration: workedDuration });
    breakTotal += pausedDuration;
  });
  const entries = [...totals.entries()].sort((first, second) => second[1] - first[1]);
  if (breakTotal) entries.push(['break', breakTotal]);
  const totalDuration = entries.reduce((sum, entry) => sum + entry[1], 0);
  const header = document.createElement('div'); header.className = 'task-chart-header';
  const headingGroup = document.createElement('div');
  const heading = document.createElement('h3'); heading.textContent = 'Activity Breakdown';
  const total = document.createElement('p'); total.className = 'task-chart-total'; total.textContent = `Today's Total: ${formatElapsedDuration(totalDuration)}`;
  headingGroup.append(heading, total);
  const live = document.createElement('span'); live.className = 'task-chart-live'; live.innerHTML = '<span></span>Live Sync';
  header.append(headingGroup, live); chart.appendChild(header);
  if (!totalDuration) {
    const pie = document.createElement('div'); pie.className = 'task-color-pie task-color-pie-empty'; pie.setAttribute('role', 'img'); pie.setAttribute('aria-label', 'No day breakdown to display');
    const message = document.createElement('span'); message.textContent = 'No day breakdown to display'; pie.appendChild(message); chart.appendChild(pie);
    return;
  }
  const pie = document.createElement('div'); pie.className = 'task-color-pie'; pie.setAttribute('role', 'img'); pie.setAttribute('aria-label', 'Task time distribution by color and breaks');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 220 220'); svg.classList.add('task-chart-svg');
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern'); pattern.id = 'break-pattern'; pattern.setAttribute('width', '12'); pattern.setAttribute('height', '12'); pattern.setAttribute('patternTransform', 'rotate(45)'); pattern.setAttribute('patternUnits', 'userSpaceOnUse');
  const stripe = document.createElementNS('http://www.w3.org/2000/svg', 'rect'); stripe.setAttribute('width', '6'); stripe.setAttribute('height', '12'); stripe.setAttribute('fill', '#475569'); pattern.appendChild(stripe); defs.appendChild(pattern); svg.appendChild(defs);
  const centerValue = document.createElement('strong'); centerValue.textContent = formatElapsedDuration(totalDuration);
  const centerLabel = document.createElement('span'); centerLabel.textContent = 'Total tracked';
  const center = document.createElement('div'); center.className = 'task-chart-center'; center.append(centerValue, centerLabel);
  const polar = (radius, degrees) => { const radians = (degrees - 90) * Math.PI / 180; return [110 + radius * Math.cos(radians), 110 + radius * Math.sin(radians)]; };
  const donutPath = (startAngle, endAngle) => { const outerStart = polar(103, startAngle); const outerEnd = polar(103, endAngle); const innerStart = polar(64, endAngle); const innerEnd = polar(64, startAngle); const large = endAngle - startAngle > 180 ? 1 : 0; return `M ${outerStart[0]} ${outerStart[1]} A 103 103 0 ${large} 1 ${outerEnd[0]} ${outerEnd[1]} L ${innerStart[0]} ${innerStart[1]} A 64 64 0 ${large} 0 ${innerEnd[0]} ${innerEnd[1]} Z`; };
  let angle = 0;
  entries.forEach(([color, duration], index) => {
    const span = duration / totalDuration * 360;
    const gap = Math.min(3, span / 4);
    const startAngle = angle + gap; const endAngle = angle + span - gap;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', donutPath(startAngle, endAngle)); path.setAttribute('fill', color === 'break' ? 'url(#break-pattern)' : color); path.classList.add('task-chart-slice');
    const label = color === 'break' ? 'Breaks' : categoryLabels.get(color) || 'Miscellaneous';
    path.addEventListener('mouseenter', () => { centerValue.textContent = formatElapsedDuration(duration); centerValue.style.color = color === 'break' ? 'var(--muted)' : color; centerLabel.textContent = `${label} (${(duration / totalDuration * 100).toFixed(1)}%)`; path.classList.add('is-hovered'); });
    path.addEventListener('mouseleave', () => { centerValue.textContent = formatElapsedDuration(totalDuration); centerValue.style.color = ''; centerLabel.textContent = 'Total tracked'; path.classList.remove('is-hovered'); });
    svg.appendChild(path); angle += span;
  });
  pie.append(svg, center);
  const donut = document.createElement('div'); donut.className = 'task-chart-donut';
  donut.append(pie); chart.appendChild(donut);
  const legend = document.createElement('ul'); legend.className = 'task-color-legend';
  taskDurations.forEach(task => {
    const item = document.createElement('li'); item.className = 'task-chart-legend-item';
    const swatch = document.createElement('span'); swatch.className = 'task-color-legend-swatch'; swatch.style.backgroundColor = task.color || '#2f6fae';
    const details = document.createElement('span'); details.className = 'task-chart-legend-details';
    const label = document.createElement('span'); label.textContent = task.title;
    const percentage = document.createElement('small'); percentage.textContent = `${(task.duration / totalDuration * 100).toFixed(1)}%`;
    details.append(label, percentage);
    const duration = document.createElement('strong'); duration.textContent = formatElapsedDuration(task.duration);
    item.append(swatch, details, duration); legend.appendChild(item);
  });
  if (breakTotal) {
    const item = document.createElement('li'); item.className = 'task-chart-legend-item';
    const swatch = document.createElement('span'); swatch.className = 'task-color-legend-swatch break';
    const details = document.createElement('span'); details.className = 'task-chart-legend-details';
    const label = document.createElement('span'); label.textContent = 'Breaks';
    const percentage = document.createElement('small'); percentage.textContent = `${(breakTotal / totalDuration * 100).toFixed(1)}%`;
    details.append(label, percentage);
    const duration = document.createElement('strong'); duration.textContent = formatElapsedDuration(breakTotal);
    item.append(swatch, details, duration); legend.appendChild(item);
  }
  chart.appendChild(legend);
}
function formatElapsedDuration(value) { const minutes = Math.round(value / 60000); const hours = Math.floor(minutes / 60); const remainder = minutes % 60; if (!hours) return `${remainder}m`; if (!remainder) return `${hours}h`; return `${hours}h ${remainder}m`; }
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
    saveCalendar();
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
  const event = document.createElement('article'); event.className = `calendar-event task-${task.status || 'scheduled'}${task.status === 'extended' ? ' is-extended' : ''}`; event.style.setProperty('--task-color', task.color || '#234f7d'); event.style.top = `${calendarMinuteOffset((start - dayStart.getTime()) / 60000, visibleStart)}px`; event.style.height = `${(end - start) / 60000 * CALENDAR_PIXELS_PER_MINUTE}px`;
  const breaks = taskBreaks(task, end).map(item => ({ start: Math.max(start, item.start), end: Math.min(end, item.end) })).filter(item => item.end > item.start);
  const segments = []; let cursor = start;
  breaks.sort((first, second) => first.start - second.start).forEach(item => {
    if (item.start > cursor) segments.push({ start: cursor, end: item.start, type: 'work' });
    segments.push({ start: Math.max(cursor, item.start), end: item.end, type: 'break' });
    cursor = Math.max(cursor, item.end);
  });
  if (cursor < end) segments.push({ start: cursor, end, type: 'work' });
  segments.forEach(segment => { const part = document.createElement('div'); part.className = `calendar-event-segment ${segment.type}`; part.style.top = `${(segment.start - start) / 60000 * CALENDAR_PIXELS_PER_MINUTE}px`; part.style.height = `${(segment.end - segment.start) / 60000 * CALENDAR_PIXELS_PER_MINUTE}px`; event.appendChild(part); });
  const label = document.createElement('div'); label.className = 'calendar-event-label'; label.innerHTML = `<strong>${escapeHtml(task.title)}</strong><span>${formatClock(new Date(start))} - ${formatClock(new Date(end))}</span>`; event.appendChild(label);
  event.title = task.title; event.tabIndex = 0; event.addEventListener('click', () => editTask(task)); event.addEventListener('keydown', keyboardEvent => { if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') { keyboardEvent.preventDefault(); editTask(task); } }); events.appendChild(event);
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
  if (changed) saveTasks();
}
function setTaskAmPm(type, period) {
  const form = $('#task-form');
  if (!form) return;
  if (type === 'start') {
    form.elements.startPeriod.value = period;
    $('#start-am-btn')?.classList.toggle('is-active', period === 'AM');
    $('#start-pm-btn')?.classList.toggle('is-active', period === 'PM');
  } else {
    form.elements.endPeriod.value = period;
    $('#end-am-btn')?.classList.toggle('is-active', period === 'AM');
    $('#end-pm-btn')?.classList.toggle('is-active', period === 'PM');
  }
  updateTaskEditorSummary(taskBeingEdited ? new Date(taskBeingEdited.start) : new Date());
}
function editTask(task) {
  taskBeingEdited = task;
  const form = $('#task-form');
  form.hidden = false;
  form.elements.title.value = task.title || '';

  form.elements.color.value = task.color || '#A855F7';
  syncTaskColorPicker();
  setTimeFields(form, 'start', new Date(task.start));
  setTimeFields(form, 'end', new Date(task.end));
  $('#task-form-heading').textContent = 'Edit Task';
  $('#delete-task').style.display = 'inline-flex';
  updateTaskEditorSummary(new Date(task.start));
  renderBreakEditor(task);
  $('#task-meta').textContent = task.actualEnd
    ? `Scheduled: ${formatDate(new Date(task.end))} · Actual end: ${formatDate(new Date(task.actualEnd))}`
    : `Scheduled: ${formatDate(new Date(task.start))} - ${formatDate(new Date(task.end))}`;
  const dynamicActions = $('#task-dynamic-actions');
  dynamicActions.replaceChildren();
  if (task.status !== 'completed') {
    if (['active', 'extended', 'paused'].includes(task.status)) {
      const pauseBtn = button(task.status === 'paused' ? 'Resume Task' : 'Pause Task', 'task-pause-btn');
      pauseBtn.addEventListener('click', () => toggleTaskPause(task));
      dynamicActions.appendChild(pauseBtn);
    }
    const finishBtn = button('Finish Task', 'task-finish-btn');
    finishBtn.addEventListener('click', () => finishTask(task));
    dynamicActions.appendChild(finishBtn);
  }
  document.querySelector('[data-view="calendar-view"]').click();
  scrollTaskFormIntoView(form);
}
function scrollTaskFormIntoView(form) {
  requestAnimationFrame(() => form.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' }));
}
function renderBreakEditor(task) {
  const editor = $('#task-break-editor');
  const list = $('#task-break-list');
  list.replaceChildren();
  editor.hidden = false;
  const taskDate = new Date(task.start);
  (task.breaks || []).forEach(breakInterval => appendBreakRow(list, breakInterval, taskDate));
  updateBreakCount();
  $('#add-task-break').onclick = () => {
    appendBreakRow(list, null, taskDate);
    showToast('New break added');
  };
}
function setupNewTaskBreakEditor(taskDate) {
  const editor = $('#task-break-editor');
  const list = $('#task-break-list');
  editor.hidden = false;
  list.replaceChildren();
  updateBreakCount();
  $('#add-task-break').onclick = () => {
    appendBreakRow(list, null, taskDate);
    showToast('New break added');
  };
}
function updateBreakCount() {
  const list = $('#task-break-list');
  const rows = list.querySelectorAll('.task-break-row');
  const count = rows.length;
  $('#task-break-count').textContent = `${count} ${count === 1 ? 'break' : 'breaks'}`;
  let empty = list.querySelector('.breaks-empty-state');
  if (count === 0) {
    if (!empty) {
      empty = document.createElement('div');
      empty.className = 'breaks-empty-state';
      empty.textContent = 'No breaks added. Click "+ Add Break" above to insert a rest interval.';
      list.appendChild(empty);
    }
  } else if (empty) {
    empty.remove();
  }
  rows.forEach((row, index) => {
    const title = row.querySelector('.break-title');
    if (title) title.textContent = `Break ${index + 1}`;
  });
}
function appendBreakRow(list, breakInterval, taskDate) {
  list.querySelector('.breaks-empty-state')?.remove();
  const row = document.createElement('div');
  row.className = 'task-break-row';

  const rowHeader = document.createElement('div');
  rowHeader.className = 'break-row-header';
  const dot = document.createElement('span');
  dot.className = 'break-dot';
  const title = document.createElement('span');
  title.className = 'break-title';
  title.textContent = `Break ${list.querySelectorAll('.task-break-row').length + 1}`;
  rowHeader.append(dot, title);

  const inputs = document.createElement('div');
  inputs.className = 'break-time-inputs';

  const startBox = document.createElement('div');
  startBox.className = 'custom-input break-time-box';
  const startInput = document.createElement('input');
  startInput.type = 'text';
  startInput.inputMode = 'numeric';
  startInput.className = 'break-time-input';
  startInput.dataset.breakField = 'start';
  const startAmPm = document.createElement('button');
  startAmPm.type = 'button';
  startAmPm.className = 'break-ampm-btn';
  startAmPm.dataset.breakField = 'startPeriod';
  startAmPm.textContent = 'PM';
  startAmPm.addEventListener('click', () => {
    startAmPm.textContent = startAmPm.textContent === 'AM' ? 'PM' : 'AM';
    updateRowDuration();
  });
  startBox.append(startInput, startAmPm);

  const toSpan = document.createElement('span');
  toSpan.className = 'break-to-text';
  toSpan.textContent = 'to';

  const endBox = document.createElement('div');
  endBox.className = 'custom-input break-time-box';
  const endInput = document.createElement('input');
  endInput.type = 'text';
  endInput.inputMode = 'numeric';
  endInput.className = 'break-time-input';
  endInput.dataset.breakField = 'end';
  const endAmPm = document.createElement('button');
  endAmPm.type = 'button';
  endAmPm.className = 'break-ampm-btn';
  endAmPm.dataset.breakField = 'endPeriod';
  endAmPm.textContent = 'PM';
  endAmPm.addEventListener('click', () => {
    endAmPm.textContent = endAmPm.textContent === 'AM' ? 'PM' : 'AM';
    updateRowDuration();
  });
  endBox.append(endInput, endAmPm);

  const durationBadge = document.createElement('span');
  durationBadge.className = 'break-duration-pill';
  durationBadge.textContent = '15m';

  function updateRowDuration() {
    const s = parseTimeOnDate(taskDate, startInput.value, startAmPm.textContent);
    const e = parseTimeOnDate(taskDate, endInput.value, endAmPm.textContent);
    if (s && e && e > s) {
      durationBadge.textContent = formatElapsedDuration(e - s);
    } else {
      durationBadge.textContent = '--';
    }
  }

  startInput.addEventListener('input', updateRowDuration);
  endInput.addEventListener('input', updateRowDuration);

  inputs.append(startBox, toSpan, endBox, durationBadge);

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'task-break-remove';
  removeBtn.title = 'Remove break';
  removeBtn.setAttribute('aria-label', 'Remove break');
  removeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>';
  removeBtn.addEventListener('click', () => {
    row.remove();
    updateBreakCount();
    showToast('Break removed');
  });

  if (breakInterval) {
    setBreakField(startInput, startAmPm, new Date(breakInterval.start));
    setBreakField(endInput, endAmPm, new Date(breakInterval.end));
    updateRowDuration();
  } else {
    updateRowDuration();
  }

  row.append(rowHeader, inputs, removeBtn);
  list.appendChild(row);
  updateBreakCount();
}
function setBreakField(input, amPmBtn, date) {
  const value = localInputValue(date);
  const [hourText, minute] = value.slice(11).split(':');
  const hour = Number(hourText);
  input.value = `${hour % 12 || 12}:${minute}`;
  amPmBtn.textContent = hour >= 12 ? 'PM' : 'AM';
}
function updateTaskEditorSummary(taskDate = new Date()) {
  const form = $('#task-form');
  const start = parseTimeOnDate(taskDate, form.elements.startTime.value, form.elements.startPeriod.value);
  const endInput = form.elements.endTime.value.trim();
  const end = endInput ? parseTimeOnDate(taskDate, endInput, form.elements.endPeriod.value) : null;
  if (!start || !end || end <= start) {
    $('#schedule-summary-text').textContent = start ? `Today, ${formatClock(start)}` : 'Today';
    $('#schedule-duration').textContent = '--';
    return;
  }
  $('#schedule-summary-text').textContent = `Today, ${formatClock(start)} – ${formatClock(end)}`;
  $('#schedule-duration').textContent = formatElapsedDuration(end.getTime() - start.getTime());
}
function readBreaks(form, taskDate, taskStart, taskEnd) {
  const rows = [...form.querySelectorAll('.task-break-row')];
  const intervals = [];
  for (const row of rows) {
    const startVal = row.querySelector('[data-break-field="start"]')?.value || '';
    const startPeriod = row.querySelector('[data-break-field="startPeriod"]')?.textContent || 'PM';
    const endVal = row.querySelector('[data-break-field="end"]')?.value || '';
    const endPeriod = row.querySelector('[data-break-field="endPeriod"]')?.textContent || 'PM';
    const start = parseTimeOnDate(taskDate, startVal, startPeriod);
    const end = parseTimeOnDate(taskDate, endVal, endPeriod);
    if (!start || !end || end <= start) return { error: 'Break end time must be after its start time.' };
    if (start < taskStart || end > taskEnd) return { error: 'Breaks must stay within the scheduled task time.' };
    intervals.push({ start: start.getTime(), end: end.getTime() });
  }
  intervals.sort((first, second) => first.start - second.start);
  if (intervals.some((interval, index) => index > 0 && interval.start < intervals[index - 1].end)) {
    return { error: 'Breaks cannot overlap.' };
  }
  return { intervals: intervals.map(interval => ({ start: new Date(interval.start).toISOString(), end: new Date(interval.end).toISOString() })) };
}
function breakWindowEnd(task, scheduledEnd) {
  if (task.status !== 'completed' && now() > scheduledEnd.getTime()) return new Date();
  return scheduledEnd;
}
function toggleTaskPause(task) {
  const timestamp = new Date().toISOString();
  if (task.status === 'paused') {
    if (task.pausedAt) task.breaks = [...(task.breaks || []), { start: task.pausedAt, end: timestamp }];
    task.pausedAt = null;
    task.status = new Date(task.end).getTime() <= now() ? 'extended' : 'active';
    saveTasks('Task resumed');
  } else if (['active', 'extended'].includes(task.status)) {
    task.status = 'paused';
    task.pausedAt = timestamp;
    saveTasks('Task Paused');
  }
  renderTasks();
  editTask(task);
}
function finishTask(task) {
  const endedAt = new Date().toISOString();
  if (task.status === 'paused' && task.pausedAt) {
    task.breaks = [...(task.breaks || []), { start: task.pausedAt, end: endedAt }];
    task.pausedAt = null;
  }
  task.status = 'completed';
  task.end = endedAt;
  task.completedAt = endedAt;
  task.actualEnd = endedAt;
  saveTasks('Task Finished');
  renderTasks();
  editTask(task);
}
function deleteTask(task) {
  if (!confirm(`Delete "${task.title}"?`)) return;
  state.tasks = state.tasks.filter(item => item.id !== task.id);
  taskBeingEdited = null;
  $('#task-form').hidden = true;
  saveTasks('Task Deleted');
  renderTasks();
}
function syncTaskColorPicker() {
  const input = document.querySelector('#task-form [name="color"]');
  if (!input) return;
  const currentHex = (input.value || '#A855F7').toLowerCase();
  const matched = STANDARD_COLORS.find(([, hex]) => hex.toLowerCase() === currentHex);
  const swatches = document.querySelectorAll('#task-form .swatch-btn');
  swatches.forEach(btn => {
    const isMatch = (btn.dataset.color || '').toLowerCase() === currentHex;
    btn.classList.toggle('is-active', isMatch);
    btn.classList.toggle('active', isMatch);
  });
  const labelText = document.getElementById('selected-task-color');
  const customLabel = document.getElementById('custom-color-label');
  const customPreview = document.getElementById('custom-color-preview');
  const headerBadge = document.getElementById('task-header-color');

  if (matched) {
    if (labelText) labelText.textContent = `${matched[0]} (${matched[1]})`;
    if (customLabel) customLabel.classList.remove('is-active');
    if (customPreview) customPreview.style.background = 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)';
  } else {
    if (labelText) labelText.textContent = `Custom (${input.value.toUpperCase()})`;
    if (customLabel) customLabel.classList.add('is-active');
    if (customPreview) customPreview.style.background = input.value;
  }
  if (headerBadge) {
    headerBadge.style.backgroundColor = input.value;
    headerBadge.style.boxShadow = `0 0 12px ${input.value}80`;
  }
}
function setupTaskColorPicker() {
  const container = document.getElementById('standard-colors');
  const input = document.querySelector('#task-form [name="color"]');
  if (!container || !input) return;
  container.replaceChildren();
  STANDARD_COLORS.forEach(([name, hex]) => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'swatch-btn';
    swatch.dataset.color = hex;
    swatch.title = name;
    swatch.setAttribute('aria-label', name);
    swatch.style.backgroundColor = hex;
    swatch.style.setProperty('--swatch-color', hex);
    swatch.addEventListener('click', () => {
      input.value = hex;
      syncTaskColorPicker();
    });
    container.appendChild(swatch);
  });
  input.addEventListener('input', syncTaskColorPicker);
  input.addEventListener('change', syncTaskColorPicker);
  syncTaskColorPicker();
}
function formatMinutes(minutes) { const dayOffset = Math.floor(minutes / 1440); const value = minutes % 1440; const hour = Math.floor(value / 60); const minute = value % 60; const suffix = hour >= 12 ? 'PM' : 'AM'; return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${suffix}${dayOffset ? ` (+${dayOffset}d)` : ''}`; }
function formatDate(date) { return date.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }); }
function formatClock(date) { return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
function isValidDate(value) { const date = value instanceof Date ? value : new Date(value); return !Number.isNaN(date.getTime()); }
function localInputValue(date) { if (!isValidDate(date)) return ''; const offset = date.getTimezoneOffset() * 60000; return new Date(date.getTime() - offset).toISOString().slice(0, 16); }
function setTimeFields(form, prefix, date) {
  const value = localInputValue(date);
  if (!value) return;
  const [hourText, minute] = value.slice(11).split(':');
  const hour = Number(hourText);
  const period = hour >= 12 ? 'PM' : 'AM';
  form.elements[`${prefix}Time`].value = `${hour % 12 || 12}:${minute}`;
  form.elements[`${prefix}Period`].value = period;
  $(`#${prefix}-am-btn`)?.classList.toggle('is-active', period === 'AM');
  $(`#${prefix}-pm-btn`)?.classList.toggle('is-active', period === 'PM');
}
function parseTimeOnDate(date, timeValue, period) { const match = String(timeValue).trim().match(/^(\d{1,2}):([0-5]\d)$/); if (!match || Number(match[1]) < 1 || Number(match[1]) > 12) return null; const result = new Date(date); result.setHours((Number(match[1]) % 12) + (period === 'PM' ? 12 : 0), Number(match[2]), 0, 0); return isValidDate(result) ? result : null; }
function overlaps(start, end, excludeId = null) { return state.tasks.some(task => task.id !== excludeId && task.status !== 'completed' && new Date(task.start) < end && new Date(task.end) > start); }

function renderLaps() { $('#lap-list').replaceChildren(...state.stopwatch.laps.map((lap, index) => { const item = document.createElement('label'); item.className = 'lap-row'; item.innerHTML = `<span>Lap ${index + 1} · ${formatDuration(lap.elapsed)}</span>`; const input = document.createElement('input'); input.placeholder = 'Description'; input.value = lap.description || ''; input.addEventListener('input', () => { lap.description = input.value; saveStopwatch(); }); item.appendChild(input); return item; })); }
function formatDuration(milliseconds) { const seconds = Math.max(0, Math.floor(milliseconds / 1000)); return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(value => String(value).padStart(2, '0')).join(':'); }
function updateStopwatch() { const elapsed = state.stopwatch.elapsed + (state.stopwatch.startedAt ? now() - state.stopwatch.startedAt : 0); $('#stopwatch-display').textContent = formatDuration(elapsed); }
function updateCountdown() { const remaining = state.countdown.endsAt ? Math.max(0, state.countdown.endsAt - now()) : state.countdown.remaining; $('#countdown-display').textContent = formatDuration(remaining); }
function startClockLoops() {
  clearInterval(stopwatchInterval);
  clearInterval(countdownInterval);
  clearInterval(calendarInterval);
  clearInterval(chartInterval);
  stopwatchInterval = setInterval(updateStopwatch, 1000);
  countdownInterval = setInterval(updateCountdown, 1000);
  chartInterval = setInterval(renderTaskColorChart, 1000);
  calendarInterval = setInterval(renderTasks, 30000);
}

function wireEvents() {
  setupTaskColorPicker();
  $('#theme-toggle')?.addEventListener('click', () => {
    const nextTheme = state.settings.theme === 'light' ? 'dark' : 'light';
    state.settings.theme = nextTheme;
    applyTheme(nextTheme);
    saveSettings();
  });
  $('#theme-select')?.addEventListener('change', event => {
    const nextTheme = event.target.value === 'light' ? 'light' : 'dark';
    state.settings.theme = nextTheme;
    applyTheme(nextTheme);
    saveSettings();
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
  $('#start-am-btn')?.addEventListener('click', () => setTaskAmPm('start', 'AM'));
  $('#start-pm-btn')?.addEventListener('click', () => setTaskAmPm('start', 'PM'));
  $('#end-am-btn')?.addEventListener('click', () => setTaskAmPm('end', 'AM'));
  $('#end-pm-btn')?.addEventListener('click', () => setTaskAmPm('end', 'PM'));

  $('#new-task').addEventListener('click', () => {
    taskBeingEdited = null;
    const form = $('#task-form');
    form.reset();
    form.elements.color.value = '#A855F7';
    syncTaskColorPicker();
    form.hidden = false;
    $('#task-meta').textContent = '';
    const start = new Date();
    setTimeFields(form, 'start', start);
    form.elements.endTime.value = '';
    const currentPeriod = start.getHours() >= 12 ? 'PM' : 'AM';
    form.elements.startPeriod.value = currentPeriod;
    form.elements.endPeriod.value = currentPeriod;
    $('#start-am-btn')?.classList.toggle('is-active', currentPeriod === 'AM');
    $('#start-pm-btn')?.classList.toggle('is-active', currentPeriod === 'PM');
    $('#end-am-btn')?.classList.toggle('is-active', currentPeriod === 'AM');
    $('#end-pm-btn')?.classList.toggle('is-active', currentPeriod === 'PM');
    setupNewTaskBreakEditor(start);
    $('#task-dynamic-actions').replaceChildren();
    $('#task-form-heading').textContent = 'New Task';
    $('#delete-task').style.display = 'none';
    updateTaskEditorSummary(start);
    scrollTaskFormIntoView(form);
  });

  const closeTaskModal = () => {
    taskBeingEdited = null;
    $('#task-form').hidden = true;
  };
  $('#cancel-task').addEventListener('click', () => {
    closeTaskModal();
    showToast('Cancelled');
  });
  $('#close-task').addEventListener('click', closeTaskModal);
  $('#task-form').addEventListener('click', event => {
    if (event.target === $('#task-form')) {
      closeTaskModal();
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !$('#task-form').hidden) {
      closeTaskModal();
    }
  });
  $('#delete-task').addEventListener('click', () => {
    if (taskBeingEdited) deleteTask(taskBeingEdited);
  });

  ['startTime', 'endTime', 'startPeriod', 'endPeriod'].forEach(name => {
    const formControl = document.querySelector(`#task-form [name="${name}"]`);
    formControl?.addEventListener('input', () => updateTaskEditorSummary(taskBeingEdited ? new Date(taskBeingEdited.start) : new Date()));
    formControl?.addEventListener('change', () => updateTaskEditorSummary(taskBeingEdited ? new Date(taskBeingEdited.start) : new Date()));
  });

  $('#task-form').addEventListener('submit', event => {
    event.preventDefault();
    const form = event.currentTarget;
    const taskDate = taskBeingEdited ? new Date(taskBeingEdited.start) : new Date();
    const enteredStart = parseTimeOnDate(taskDate, form.elements.startTime.value, form.elements.startPeriod.value);
    const endInput = form.elements.endTime.value.trim();
    if (!endInput) return setStatus('Enter an end time.');
    const end = parseTimeOnDate(taskDate, endInput, form.elements.endPeriod.value);
    const current = new Date();
    const startsNow = !taskBeingEdited && enteredStart && enteredStart.getHours() === current.getHours() && enteredStart.getMinutes() === current.getMinutes();
    const start = startsNow ? current : enteredStart;

    if (!start || !end) return setStatus('Enter valid start and end time values.');
    if (!sameLocalDay(start, end)) return setStatus('Tasks must start and end on the same day.');
    if (end <= start) return setStatus('End time must be after the start time.');
    if (end.getTime() - start.getTime() >= 86400000) return setStatus('Tasks cannot be longer than one day.');
    if (overlaps(start, end, taskBeingEdited?.id)) return setStatus('Tasks cannot overlap.');

    const values = {
      title: form.elements.title.value.trim(),
      color: form.elements.color.value,
      start: start.toISOString(),
      end: end.toISOString()
    };
    if (!values.title) return setStatus('Enter a task title.');

    if (taskBeingEdited) {
      const breaks = readBreaks(form, taskDate, start, breakWindowEnd(taskBeingEdited, end));
      if (breaks.error) return setStatus(breaks.error);
      values.breaks = breaks.intervals;
    } else {
      const breaks = readBreaks(form, taskDate, start, end);
      if (breaks.error) return setStatus(breaks.error);
      values.breaks = breaks.intervals;
    }

    if (taskBeingEdited) {
      Object.assign(taskBeingEdited, values);
    } else {
      state.tasks.push({
        id: crypto.randomUUID(),
        ...values,
        status: startsNow ? 'active' : 'scheduled',
        completedAt: null,
        breaks: values.breaks || [],
        pausedAt: null
      });
    }

    saveTasks('Changes Saved!');
    taskBeingEdited = null;
    $('#task-break-editor').hidden = true;
    form.reset();
    form.hidden = true;
    renderTasks();
  });
  $('#stopwatch-toggle').addEventListener('click', () => { if (state.stopwatch.startedAt) { state.stopwatch.elapsed += now() - state.stopwatch.startedAt; state.stopwatch.startedAt = null; $('#stopwatch-toggle').textContent = 'Resume'; } else { state.stopwatch.startedAt = now(); $('#stopwatch-toggle').textContent = 'Pause'; } saveStopwatch(); });
  $('#stopwatch-reset').addEventListener('click', () => { state.stopwatch = { startedAt: null, elapsed: 0, laps: [] }; $('#stopwatch-toggle').textContent = 'Start'; saveStopwatch(); renderLaps(); updateStopwatch(); });
  $('#lap-button').addEventListener('click', () => { const elapsed = state.stopwatch.elapsed + (state.stopwatch.startedAt ? now() - state.stopwatch.startedAt : 0); state.stopwatch.laps.push({ elapsed, description: '' }); saveStopwatch(); renderLaps(); });
  $('#countdown-start').addEventListener('click', () => { if (state.countdown.endsAt) return; const hours = Number($('#countdown-hours').value || 0); const minutes = Number($('#countdown-minutes').value || 0); const seconds = Number($('#countdown-seconds').value || 0); const duration = (hours * 3600 + minutes * 60 + seconds) * 1000; if (duration <= 0) return setStatus('Enter a countdown duration.'); state.countdown = { endsAt: now() + duration, remaining: 0, alarmActive: false, occurrence: crypto.randomUUID(), dismissed: false }; chrome.runtime.sendMessage({ type: 'START_COUNTDOWN', endsAt: state.countdown.endsAt, occurrence: state.countdown.occurrence }); saveCountdown(); });
  $('#countdown-reset').addEventListener('click', () => { state.countdown = { endsAt: null, remaining: 0, alarmActive: false, occurrence: null, dismissed: false }; chrome.runtime.sendMessage({ type: 'RESET_COUNTDOWN' }); saveCountdown(); updateCountdown(); });
  wireImportExport();
}
function wireImportExport() {
  $('#export-all').addEventListener('click', () => downloadJson('offline-workspace-backup.json', state)); $('#export-notes').addEventListener('click', () => downloadJson('notes.json', { notes: state.notes })); $('#export-tasks').addEventListener('click', () => downloadJson('schedules.json', { tasks: state.tasks })); $('#export-settings').addEventListener('click', () => downloadJson('settings.json', { settings: state.settings })); $('#export-timers').addEventListener('click', () => downloadJson('timers.json', { stopwatch: state.stopwatch, countdown: state.countdown }));
  $('#import-all').addEventListener('change', importJson); $('#import-notes').addEventListener('change', event => importCategory(event, 'notes')); $('#import-tasks').addEventListener('change', event => importCategory(event, 'tasks')); $('#import-settings').addEventListener('change', event => importCategory(event, 'settings')); $('#import-timers').addEventListener('change', event => importCategory(event, 'timers'));
}
function downloadJson(name, data) { const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); link.download = name; link.click(); URL.revokeObjectURL(link.href); }
async function readJson(event) { const file = event.target.files[0]; event.target.value = ''; if (!file) return null; try { return JSON.parse(await file.text()); } catch { setStatus('Import failed: choose a valid JSON file.'); return null; } }
async function importJson(event) { const imported = await readJson(event); if (!imported || typeof imported !== 'object') return; state = { ...state, ...imported, settings: { ...state.settings, ...(imported.settings || {}) } }; applyTheme(state.settings.theme); applyBackgroundImage(state.settings.backgroundImageUrl); await saveState('Backup imported'); renderAll(); }
async function importCategory(event, category) {
  const imported = await readJson(event);
  if (!imported) return;
  if (category === 'settings') {
    state.settings = { ...state.settings, ...(imported.settings || {}) };
    applyTheme(state.settings.theme);
    applyBackgroundImage(state.settings.backgroundImageUrl);
    await saveSettings('Settings imported');
  } else if (category === 'timers') {
    state.stopwatch = imported.stopwatch || state.stopwatch;
    state.countdown = imported.countdown || state.countdown;
    await saveSlices(['stopwatch', 'countdown'], 'Timers imported');
  } else if (category === 'notes') {
    if (Array.isArray(imported.notes)) {
      state.notes = imported.notes;
      activeNoteId = state.notes[0]?.id || null;
      await saveNotes('Notes imported');
    } else return setStatus('Import failed: no notes data found.');
  } else if (category === 'tasks') {
    if (Array.isArray(imported.tasks)) {
      state.tasks = imported.tasks;
      await saveTasks('Tasks imported');
    } else return setStatus('Import failed: no tasks data found.');
  } else if (Array.isArray(imported[category])) {
    state[category] = imported[category];
    await saveSlice(category, `${category} imported`);
  } else {
    return setStatus(`Import failed: no ${category} data found.`);
  }
  renderAll();
}

function syncTaskFormWithTask(task) {
  const form = $('#task-form');
  if (!form || form.hidden) return;
  form.elements.title.value = task.title || '';
  form.elements.color.value = task.color || '#A855F7';
  syncTaskColorPicker();
  setTimeFields(form, 'start', new Date(task.start));
  setTimeFields(form, 'end', new Date(task.end));
  renderBreakEditor(task);
  updateTaskEditorSummary(new Date(task.start));
  $('#task-meta').textContent = task.actualEnd
    ? `Scheduled: ${formatDate(new Date(task.end))} · Actual end: ${formatDate(new Date(task.actualEnd))}`
    : `Scheduled: ${formatDate(new Date(task.start))} - ${formatDate(new Date(task.end))}`;
  const dynamicActions = $('#task-dynamic-actions');
  dynamicActions.replaceChildren();
  if (task.status !== 'completed') {
    if (['active', 'extended', 'paused'].includes(task.status)) {
      const pauseBtn = button(task.status === 'paused' ? 'Resume Task' : 'Pause Task', 'task-pause-btn');
      pauseBtn.addEventListener('click', () => toggleTaskPause(task));
      dynamicActions.appendChild(pauseBtn);
    }
    const finishBtn = button('Finish Task', 'task-finish-btn');
    finishBtn.addEventListener('click', () => finishTask(task));
    dynamicActions.appendChild(finishBtn);
  }
}

function syncNotesUI() {
  const noteList = $('#note-list');
  const panel = $('#note-editor-panel');
  if (!noteList || !panel) return;

  const currentNote = state.notes.find(item => item.id === activeNoteId) || state.notes[0];
  if (!currentNote) {
    renderNotes();
    return;
  }
  activeNoteId = currentNote.id;

  const renderedItems = noteList.querySelectorAll('.note-list-row');
  const countChanged = renderedItems.length !== state.notes.length;
  let idsChanged = countChanged;
  if (!idsChanged) {
    const renderedButtons = noteList.querySelectorAll('.note-list-item');
    state.notes.forEach((note, index) => {
      if (renderedButtons[index]?.textContent !== (note.title || 'Untitled note')) {
        idsChanged = true;
      }
    });
  }

  if (countChanged) {
    renderNotes();
    return;
  }
  renderNotesListOnly();

  const titleInput = panel.querySelector('.note-title');
  if (titleInput && titleInput.value !== currentNote.title) {
    if (document.activeElement !== titleInput) {
      titleInput.value = currentNote.title || '';
    }
  }

  const blockList = panel.querySelector('.note-block-list');
  if (!blockList) {
    renderNotes();
    return;
  }

  const renderedBlocks = [...blockList.querySelectorAll('.editor-wrapper')];
  const blockIds = currentNote.blocks.map(b => b.id);
  const renderedIds = renderedBlocks.map(w => w.dataset.blockId);

  if (blockIds.length !== renderedIds.length || blockIds.some((id, idx) => id !== renderedIds[idx])) {
    const focusedBlockId = document.activeElement?.closest('.editor-wrapper')?.dataset.blockId;
    const isWysiwyg = document.activeElement?.classList.contains('wysiwyg');
    const isBlockTitle = document.activeElement?.classList.contains('block-title');

    renderNotes();

    if (focusedBlockId) {
      const restoredWrapper = blockList.querySelector(`.editor-wrapper[data-block-id="${focusedBlockId}"]`);
      if (restoredWrapper) {
        if (isBlockTitle) restoredWrapper.querySelector('.block-title')?.focus();
        else if (isWysiwyg) restoredWrapper.querySelector('.wysiwyg')?.focus();
      }
    }
    return;
  }

  currentNote.blocks.forEach((block, index) => {
    const wrapper = renderedBlocks[index];
    if (!wrapper) return;

    const bTitle = wrapper.querySelector('.block-title');
    if (bTitle && bTitle.value !== (block.title || 'Text box')) {
      if (document.activeElement !== bTitle) {
        bTitle.value = block.title || 'Text box';
      }
    }

    const card = wrapper.querySelector('.editor-card');
    const collapseBtn = wrapper.querySelector('.editor-toolbar button.icon');
    const editor = wrapper.querySelector('.wysiwyg');
    if (card && editor && collapseBtn) {
      const isCollapsed = card.classList.contains('is-collapsed');
      if (isCollapsed !== !!block.collapsed) {
        card.classList.toggle('is-collapsed', !!block.collapsed);
        editor.hidden = !!block.collapsed;
        collapseBtn.textContent = block.collapsed ? 'Expand' : 'Collapse';
      }
    }

    if (card) card.style.width = `${block.width || 100}%`;
    if (editor) {
      editor.style.fontFamily = block.fontFamily || 'Arial, sans-serif';
      editor.style.fontSize = `${block.fontSize || 18}px`;
      editor.style.minHeight = `${block.height || 180}px`;

      const currentHtml = editorHtml(editor);
      if (currentHtml !== (block.html || '')) {
        if (document.activeElement !== editor) {
          editor.innerHTML = block.html || '';
          prepareEditorImages(editor, block);
        } else {
          const offset = getCaretCharacterOffsetWithin(editor);
          editor.innerHTML = block.html || '';
          prepareEditorImages(editor, block);
          setCaretCharacterOffsetWithin(editor, offset);
        }
      }
    }
  });
}

function handleStorageChanges(changes) {
  if (changes.todoState?.newValue) {
    const legacy = changes.todoState.newValue;
    for (const key of STORAGE_KEYS) {
      if (legacy[key] !== undefined && !changes[key]) {
        changes[key] = { newValue: legacy[key] };
      }
    }
  }

  if (changes.settings?.newValue) {
    const newSettings = changes.settings.newValue;
    const newJson = JSON.stringify(newSettings);
    if (newJson !== lastSavedJson.settings) {
      lastSavedJson.settings = newJson;
      state.settings = { ...clone(DEFAULT_STATE.settings), ...newSettings };
      applyTheme(state.settings.theme);
      applyBackgroundImage(state.settings.backgroundImageUrl);
    }
  }

  if (changes.calendar?.newValue) {
    const newCalendar = changes.calendar.newValue;
    const newJson = JSON.stringify(newCalendar);
    if (newJson !== lastSavedJson.calendar) {
      lastSavedJson.calendar = newJson;
      state.calendar = { ...clone(DEFAULT_STATE.calendar), ...newCalendar };
      renderTasks();
    }
  }

  if (changes.stopwatch?.newValue) {
    const newStopwatch = changes.stopwatch.newValue;
    const newJson = JSON.stringify(newStopwatch);
    if (newJson !== lastSavedJson.stopwatch) {
      lastSavedJson.stopwatch = newJson;
      state.stopwatch = newStopwatch;
      updateStopwatch();
      renderLaps();
      const toggleBtn = $('#stopwatch-toggle');
      if (toggleBtn) {
        toggleBtn.textContent = state.stopwatch.startedAt ? 'Pause' : (state.stopwatch.elapsed ? 'Resume' : 'Start');
      }
    }
  }

  if (changes.countdown?.newValue) {
    const newCountdown = changes.countdown.newValue;
    const newJson = JSON.stringify(newCountdown);
    if (newJson !== lastSavedJson.countdown) {
      lastSavedJson.countdown = newJson;
      state.countdown = newCountdown;
      updateCountdown();
    }
  }

  if (changes.tasks?.newValue) {
    const newTasks = changes.tasks.newValue;
    const newJson = JSON.stringify(newTasks);
    if (newJson !== lastSavedJson.tasks) {
      lastSavedJson.tasks = newJson;
      state.tasks = Array.isArray(newTasks) ? newTasks : [];
      if (taskBeingEdited) {
        const updated = state.tasks.find(t => t.id === taskBeingEdited.id);
        if (!updated) {
          taskBeingEdited = null;
          $('#task-form').hidden = true;
          showToast('The task being edited was deleted in another tab.');
        } else {
          taskBeingEdited = updated;
          syncTaskFormWithTask(updated);
        }
      }
      renderTasks();
    }
  }

  if (changes.notes?.newValue) {
    const newNotes = changes.notes.newValue;
    const newJson = JSON.stringify(newNotes);
    if (resizingEditorImage) return;
    if (newJson !== lastSavedJson.notes) {
      lastSavedJson.notes = newJson;
      state.notes = Array.isArray(newNotes) && newNotes.length ? newNotes : clone(DEFAULT_STATE.notes);
      if (!state.notes.some(n => n.id === activeNoteId)) {
        activeNoteId = state.notes[0]?.id || null;
      }
      syncNotesUI();
    }
  }
}

wireEvents();
loadState();
chrome.storage.onChanged.addListener(handleStorageChanges);
window.addEventListener('focus', () => {
  loadState();
});
