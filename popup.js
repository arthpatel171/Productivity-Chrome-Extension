const DEFAULT_SETTINGS = { enabled: true, configuredUrl: 'example.com' };
let state;
const $ = selector => document.querySelector(selector);

async function load() {
  const result = await chrome.storage.local.get('todoState');
  state = result.todoState || { settings: DEFAULT_SETTINGS };
  state.settings = { ...DEFAULT_SETTINGS, ...(state.settings || {}) };
  $('#enabled').checked = state.settings.enabled;
  $('#configured-url').value = state.settings.configuredUrl;
}
async function save() {
  await chrome.storage.local.set({ todoState: state });
  $('#popup-status').textContent = 'Saved';
}
$('#enabled').addEventListener('change', async event => { state.settings.enabled = event.target.checked; await save(); });
$('#configured-url').addEventListener('change', async event => { state.settings.configuredUrl = event.target.value.trim() || 'example.com'; await save(); });
$('#open-app').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('app.html') }));
load();
