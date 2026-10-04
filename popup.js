const DEFAULT_SETTINGS = { enabled: true };
let state;
const $ = selector => document.querySelector(selector);

async function load() {
  const result = await chrome.storage.local.get('todoState');
  state = result.todoState || { settings: DEFAULT_SETTINGS };
  state.settings = { ...DEFAULT_SETTINGS, ...(state.settings || {}) };
  $('#enabled').checked = state.settings.enabled;
}
async function save() {
  await chrome.storage.local.set({ todoState: state });
  $('#popup-status').textContent = 'Saved';
}
$('#enabled').addEventListener('change', async event => { state.settings.enabled = event.target.checked; await save(); });
$('#open-app').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('app.html') }));
load();
