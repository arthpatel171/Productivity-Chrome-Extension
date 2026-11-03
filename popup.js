const DEFAULT_SETTINGS = { silentNotifications: false, theme: 'dark' };
let state;
let lastSavedStateJson = '';
let statusInterval;
const $ = selector => document.querySelector(selector);

function applyTheme(theme, animate = true) {
  const current = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', current);
  const toggle = $('#theme-toggle');
  if (toggle) {
    toggle.textContent = current === 'light' ? '☀️' : '🌙';
    if (!animate) toggle.style.transition = 'none';
    toggle.style.transform = current === 'dark' ? 'rotateY(180deg)' : 'rotateY(0deg)';
    if (!animate) requestAnimationFrame(() => { toggle.style.transition = ''; });
    toggle.title = `Switch to ${current === 'light' ? 'dark' : 'light'} theme`;
    toggle.setAttribute('aria-label', `Switch to ${current === 'light' ? 'dark' : 'light'} theme`);
  }
}

async function load() {
  const result = await chrome.storage.local.get('todoState');
  state = result.todoState || { settings: DEFAULT_SETTINGS, tasks: [], countdown: { endsAt: null } };
  const storedSettings = state.settings || {};
  state.settings = { ...DEFAULT_SETTINGS, ...storedSettings, silentNotifications: storedSettings.silentNotifications ?? storedSettings.enabled === false };
  lastSavedStateJson = JSON.stringify(state);
  applyTheme(state.settings.theme, false);
  $('#silent-notifications').checked = state.settings.silentNotifications;
  renderStatus();
  clearInterval(statusInterval);
  statusInterval = setInterval(renderStatus, 1000);
}
async function save() {
  lastSavedStateJson = JSON.stringify(state);
  await chrome.storage.local.set({ todoState: state });
  $('#popup-status').textContent = 'Saved';
  renderStatus();
}
$('#silent-notifications').addEventListener('change', async event => { state.settings.silentNotifications = event.target.checked; await save(); });
$('#theme-toggle')?.addEventListener('click', async () => {
  state.settings.theme = state.settings.theme === 'light' ? 'dark' : 'light';
  applyTheme(state.settings.theme);
  await save();
});
$('#open-app').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('app.html') }));
function renderStatus() {
  const panel = $('#popup-status-panel'); panel.replaceChildren();
  const countdown = state.countdown?.endsAt ? Math.max(0, state.countdown.endsAt - Date.now()) : 0;
  const timer = document.createElement('p'); timer.textContent = `Timer: ${formatDuration(countdown)}`; panel.appendChild(timer);
  (state.tasks || []).filter(task => task.status !== 'completed').forEach(task => {
    const item = document.createElement('div'); const color = /^#[0-9a-f]{6}$/i.test(task.color || '') ? task.color : '#2f6fae'; item.style.backgroundColor = color; item.style.borderColor = color; item.className = 'popup-task';
    item.innerHTML = `<strong>${escapeHtml(task.title)}</strong><br>Start Time: ${formatDate(task.start)}<br><span class="${task.status === 'extended' || task.delayed ? 'late' : ''}">${task.status === 'extended' ? 'Task is still active.' : task.delayed ? 'Scheduled start time has passed.' : `Scheduled End Time: ${formatDate(task.end)}`}</span>`;
    if (task.status === 'active' || task.status === 'extended' || task.delayed) {
      const action = document.createElement('button'); action.type = 'button'; action.className = 'primary'; action.textContent = task.delayed ? 'Start' : 'Finish task'; action.addEventListener('click', async () => { await chrome.runtime.sendMessage({ type: 'TASK_ACTION', taskId: task.id, action: task.delayed ? 'start' : 'finish' }); await load(); }); item.appendChild(action);
    }
    panel.appendChild(item);
  });
}
function formatDuration(value) { const seconds = Math.floor(value / 1000); return `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
function formatDate(value) { return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
function escapeHtml(value) { const element = document.createElement('span'); element.textContent = value || ''; return element.innerHTML; }
chrome.storage.onChanged.addListener(changes => {
  const newValue = changes.todoState?.newValue;
  if (!newValue) return;
  if (JSON.stringify(newValue) === lastSavedStateJson) return;
  if (newValue.settings?.theme && newValue.settings.theme !== state?.settings?.theme) {
    applyTheme(newValue.settings.theme);
  }
  state = newValue;
  renderStatus();
});
load();
