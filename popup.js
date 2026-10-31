const DEFAULT_SETTINGS = { enabled: true, theme: 'dark' };
let state;
let lastSavedStateJson = '';
const $ = selector => document.querySelector(selector);

function applyTheme(theme) {
  const current = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', current);
  const toggle = $('#theme-toggle');
  if (toggle) {
    toggle.textContent = current === 'light' ? '🌙' : '☀️';
    toggle.title = `Switch to ${current === 'light' ? 'dark' : 'light'} theme`;
    toggle.setAttribute('aria-label', `Switch to ${current === 'light' ? 'dark' : 'light'} theme`);
  }
}

async function load() {
  const result = await chrome.storage.local.get('todoState');
  state = result.todoState || { settings: DEFAULT_SETTINGS, tasks: [], countdown: { endsAt: null } };
  state.settings = { ...DEFAULT_SETTINGS, ...(state.settings || {}) };
  lastSavedStateJson = JSON.stringify(state);
  applyTheme(state.settings.theme);
  $('#enabled').checked = state.settings.enabled;
  renderStatus();
}
async function save() {
  lastSavedStateJson = JSON.stringify(state);
  await chrome.storage.local.set({ todoState: state });
  $('#popup-status').textContent = 'Saved';
  renderStatus();
}
$('#enabled').addEventListener('change', async event => { state.settings.enabled = event.target.checked; await save(); });
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
  (state.tasks || []).filter(task => task.status !== 'completed').forEach(task => { const item = document.createElement('p'); const color = /^#[0-9a-f]{6}$/i.test(task.color || '') ? task.color : '#2f6fae'; item.style.backgroundColor = color; item.style.borderColor = color; item.className = 'popup-task'; item.innerHTML = `<strong>${escapeHtml(task.title)}</strong><br>Start Time: ${formatDate(task.start)}<br><span class="${task.status === 'extended' ? 'late' : ''}">Scheduled End Time: ${formatDate(task.end)}</span>`; panel.appendChild(item); });
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
