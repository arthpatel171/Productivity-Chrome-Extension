const DEFAULT_SETTINGS = { enabled: true };
let state;
const $ = selector => document.querySelector(selector);

async function load() {
  const result = await chrome.storage.local.get('todoState');
  state = result.todoState || { settings: DEFAULT_SETTINGS, tasks: [], countdown: { endsAt: null } };
  state.settings = { ...DEFAULT_SETTINGS, ...(state.settings || {}) };
  $('#enabled').checked = state.settings.enabled;
  renderStatus();
}
async function save() {
  await chrome.storage.local.set({ todoState: state });
  $('#popup-status').textContent = 'Saved';
  renderStatus();
}
$('#enabled').addEventListener('change', async event => { state.settings.enabled = event.target.checked; await save(); });
$('#open-app').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('app.html') }));
function renderStatus() {
  const panel = $('#popup-status-panel'); panel.replaceChildren();
  const countdown = state.countdown?.endsAt ? Math.max(0, state.countdown.endsAt - Date.now()) : 0;
  const timer = document.createElement('p'); timer.textContent = `Timer: ${formatDuration(countdown)}`; panel.appendChild(timer);
  (state.tasks || []).filter(task => task.status !== 'completed').forEach(task => { const item = document.createElement('p'); item.innerHTML = `<strong>${escapeHtml(task.title)}</strong><br>Start Time: ${formatDate(task.start)}<br><span class="${task.status === 'extended' ? 'late' : ''}">Scheduled End Time: ${formatDate(task.end)}</span>`; panel.appendChild(item); });
}
function formatDuration(value) { const seconds = Math.floor(value / 1000); return `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
function formatDate(value) { return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
function escapeHtml(value) { const element = document.createElement('span'); element.textContent = value || ''; return element.innerHTML; }
load();
