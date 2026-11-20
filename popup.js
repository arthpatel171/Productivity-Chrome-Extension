const DEFAULT_SETTINGS = { silentNotifications: false, theme: 'dark' };
let state;
let lastSavedStateJson = '';
let statusInterval;
const $ = selector => document.querySelector(selector);
function taskStatus(task) { return String(task?.status || '').toLowerCase().replaceAll('_', '-'); }
function isActiveTask(task) { return ['active', 'extended', 'paused', 'running', 'in-progress'].includes(taskStatus(task)); }
function applyPopupTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
}
function normalizeState(value) {
  const next = value || { settings: DEFAULT_SETTINGS, tasks: [], countdown: { endsAt: null } };
  const storedSettings = next.settings || {};
  next.settings = { ...DEFAULT_SETTINGS, ...storedSettings, silentNotifications: storedSettings.silentNotifications ?? storedSettings.enabled === false };
  return next;
}

async function load() {
  const result = await chrome.storage.local.get(['tasks', 'settings', 'countdown', 'todoState']);
  let tasks = result.tasks;
  let settings = result.settings;
  let countdown = result.countdown;
  if (!tasks && result.todoState) {
    tasks = result.todoState.tasks;
    settings = result.todoState.settings;
    countdown = result.todoState.countdown;
  }
  state = normalizeState({ tasks, settings, countdown });
  applyPopupTheme(state.settings.theme);
  lastSavedStateJson = JSON.stringify(state);
  $('#silent-notifications').checked = state.settings.silentNotifications;
  renderStatus();
  clearInterval(statusInterval);
  statusInterval = setInterval(renderStatus, 1000);
}
async function save() {
  lastSavedStateJson = JSON.stringify(state);
  await chrome.storage.local.set({ settings: state.settings, tasks: state.tasks, countdown: state.countdown });
  $('#popup-status').textContent = 'Saved';
  renderStatus();
}
$('#silent-notifications').addEventListener('change', async event => {
  state.settings.silentNotifications = event.target.checked;
  lastSavedStateJson = JSON.stringify(state);
  await chrome.storage.local.set({ settings: state.settings });
  $('#popup-status').textContent = 'Saved';
});
$('#task-toggle').addEventListener('click', async () => {
  const task = (state.tasks || []).find(isActiveTask);
  if (!task) return;
  await chrome.runtime.sendMessage({ type: 'TASK_ACTION', taskId: task.id, action: taskStatus(task) === 'paused' ? 'resume' : 'pause' });
  await load();
});
$('#open-app').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('app.html') }));
function renderStatus() {
  const panel = $('#popup-status-panel'); panel.replaceChildren();
  const toggle = $('#task-toggle');
  const currentTask = (state.tasks || []).find(isActiveTask);
  if (currentTask) {
    const paused = taskStatus(currentTask) === 'paused';
    toggle.disabled = false;
    toggle.textContent = paused ? 'Resume' : 'Take a Break';
    toggle.classList.toggle('resumed', paused);
    toggle.title = `${paused ? 'Resume' : 'Pause'} ${currentTask.title || 'task'}`;
    toggle.setAttribute('aria-label', toggle.title);
  } else {
    toggle.disabled = true;
    toggle.textContent = 'No active task';
    toggle.classList.remove('resumed');
    toggle.title = 'No active task';
    toggle.setAttribute('aria-label', toggle.title);
  }
  const countdown = state.countdown?.endsAt ? Math.max(0, state.countdown.endsAt - Date.now()) : 0;
  const timer = document.createElement('p'); timer.textContent = `Timer: ${formatDuration(countdown)}`; panel.appendChild(timer);
  (state.tasks || []).filter(task => task.status !== 'completed').forEach(task => {
    const item = document.createElement('div'); const color = /^#[0-9a-f]{6}$/i.test(task.color || '') ? task.color : '#2f6fae'; item.style.backgroundColor = color; item.style.borderColor = color; item.className = 'popup-task';
    item.innerHTML = `<strong>${escapeHtml(task.title)}</strong><br>Start Time: ${formatDate(task.start)}<br><span class="${task.delayed ? 'late' : ''}">${task.status === 'paused' ? 'Task is paused.' : task.delayed ? 'Scheduled start time has passed.' : `Scheduled End Time: ${formatDate(task.end)}`}</span>`;
    if (isActiveTask(task) || task.delayed) {
      const action = document.createElement('button'); action.type = 'button'; action.className = 'primary'; action.textContent = task.delayed ? 'Start' : 'Finish task'; action.addEventListener('click', async () => { await chrome.runtime.sendMessage({ type: 'TASK_ACTION', taskId: task.id, action: task.delayed ? 'start' : 'finish' }); await load(); }); item.appendChild(action);
    }
    panel.appendChild(item);
  });
}
function formatDuration(value) { const seconds = Math.floor(value / 1000); return `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
function formatDate(value) { return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
function escapeHtml(value) { const element = document.createElement('span'); element.textContent = value || ''; return element.innerHTML; }
chrome.storage.onChanged.addListener(changes => {
  if (changes.tasks || changes.settings || changes.countdown || changes.todoState) {
    load();
  }
});
window.addEventListener('focus', load);
load();
