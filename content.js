const OVERLAY_ID = 'todo-extension-overlay';
const CLOCK_ID = 'todo-extension-clock';

function isConfiguredPage(settings) {
  if (settings.clockAllPages) return true;
  const configured = (settings.configuredUrl || 'example.com').replace(/^https?:\/\//, '').split('/')[0].toLowerCase();
  return location.hostname.toLowerCase() === configured || location.hostname.toLowerCase().endsWith(`.${configured}`);
}

function removeElement(id) { document.getElementById(id)?.remove(); }

function showReminder(task) {
  removeElement(OVERLAY_ID);
  const overlay = document.createElement('aside');
  overlay.id = OVERLAY_ID;
  overlay.setAttribute('role', 'alertdialog');
  overlay.setAttribute('aria-live', 'assertive');
  overlay.innerHTML = `<span class="overlay-alarm" aria-hidden="true">⏰</span><h2>${escapeHtml(task.title)}</h2><p>${task.kind === 'end' ? 'This task has reached its scheduled end time.' : 'This task is scheduled to start now.'}</p><div class="overlay-actions"></div>`;
  const actions = overlay.querySelector('.overlay-actions');
  if (task.kind === 'end') {
    const complete = overlayButton('Mark complete', 'complete');
    const delayed = overlayButton('Mark delayed', 'delay');
    actions.append(complete, delayed);
    complete.addEventListener('click', () => respond(task.id, 'complete'));
    delayed.addEventListener('click', () => respond(task.id, 'delay'));
  }
  const dismiss = overlayButton('Dismiss', 'dismiss');
  actions.appendChild(dismiss);
  dismiss.addEventListener('click', () => overlay.remove());
  document.documentElement.appendChild(overlay);
}

function overlayButton(label, className) { const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.className = className; return button; }
function respond(taskId, action) { chrome.runtime.sendMessage({ type: 'TASK_ACTION', taskId, action }); removeElement(OVERLAY_ID); }
function escapeHtml(value) { const element = document.createElement('span'); element.textContent = value || ''; return element.innerHTML; }

function showClock() {
  removeElement(CLOCK_ID);
  const clock = document.createElement('aside'); clock.id = CLOCK_ID; clock.innerHTML = '<span>Local time</span><strong></strong>';
  document.documentElement.appendChild(clock);
  const tick = () => { const display = clock.querySelector('strong'); if (display) display.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
  tick(); setInterval(tick, 1000);
}

chrome.storage.local.get('todoState').then(({ todoState }) => {
  if (todoState?.settings?.enabled !== false && todoState.settings && isConfiguredPage(todoState.settings)) showClock();
});
chrome.runtime.onMessage.addListener(message => { if (message.type === 'REMINDER') showReminder(message.task); });
chrome.storage.onChanged.addListener(changes => {
  const settings = changes.todoState?.newValue?.settings;
  if (settings?.enabled === false) { removeElement(CLOCK_ID); removeElement(OVERLAY_ID); }
  if (settings?.enabled !== false && settings && isConfiguredPage(settings) && !document.getElementById(CLOCK_ID)) showClock();
});
