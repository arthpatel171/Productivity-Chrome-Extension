const OVERLAY_ID = 'todo-extension-overlay';
function removeElement(id) { document.getElementById(id)?.remove(); }

function showReminder(task) {
  removeElement(OVERLAY_ID);
  if (task.kind === 'countdown') {
    const alarm = document.createElement('button');
    alarm.id = OVERLAY_ID;
    alarm.type = 'button';
    alarm.className = 'countdown-alarm';
    alarm.setAttribute('aria-label', 'Dismiss countdown alarm');
    alarm.textContent = '⏰';
    alarm.addEventListener('click', () => { chrome.runtime.sendMessage({ type: 'DISMISS_COUNTDOWN' }); removeElement(OVERLAY_ID); });
    document.documentElement.appendChild(alarm);
    return;
  }
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

chrome.runtime.onMessage.addListener(message => {
  if (message.type === 'REMINDER' || message.type === 'COUNTDOWN_ALARM') showReminder(message.task || { kind: 'countdown' });
  if (message.type === 'DISMISS_COUNTDOWN') removeElement(OVERLAY_ID);
});

chrome.runtime.sendMessage({ type: 'GET_ACTIVE_ALARMS' }).catch(() => {});
