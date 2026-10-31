const OVERLAY_ID = 'todo-extension-overlay';
const removeOverlay = () => document.getElementById(OVERLAY_ID)?.remove();
const escapeHtml = value => { const element = document.createElement('span'); element.textContent = value || ''; return element.innerHTML; };
function showReminder(task) {
  removeOverlay();
  if (task.kind === 'countdown') {
    const alarm = document.createElement('button'); alarm.id = OVERLAY_ID; alarm.type = 'button'; alarm.className = 'countdown-alarm'; alarm.setAttribute('aria-label', 'Dismiss countdown alarm'); alarm.textContent = '⏰';
    alarm.addEventListener('click', () => { chrome.runtime.sendMessage({ type: 'DISMISS_COUNTDOWN' }); removeOverlay(); }); document.documentElement.appendChild(alarm); return;
  }
  const overlay = document.createElement('aside'); overlay.id = OVERLAY_ID; overlay.setAttribute('role', 'alertdialog'); overlay.setAttribute('aria-live', 'assertive');
  overlay.innerHTML = `<span class="overlay-alarm" aria-hidden="true">⏰</span><h2>${escapeHtml(task.title)}</h2><p>${task.kind === 'end' ? 'The scheduled end time has arrived.' : 'This task is starting now.'}</p><div class="overlay-actions"></div>`;
  const actions = overlay.querySelector('.overlay-actions');
  if (task.kind === 'end') {
    const finish = overlayButton('Finish', 'finish'); const extend = overlayButton('Extend', 'extend'); actions.append(finish, extend);
    finish.addEventListener('click', () => respond(task.id, 'finish')); extend.addEventListener('click', () => respond(task.id, 'extend'));
  } else if (task.kind === 'start') {
    const dismiss = overlayButton('Dismiss', 'dismiss'); actions.append(dismiss);
    dismiss.addEventListener('click', removeOverlay);
  }
  document.documentElement.appendChild(overlay);
}
function overlayButton(label, className) { const item = document.createElement('button'); item.type = 'button'; item.textContent = label; item.className = className; return item; }
function respond(taskId, action) { chrome.runtime.sendMessage({ type: 'TASK_ACTION', taskId, action }); removeOverlay(); }
chrome.runtime.onMessage.addListener(message => { if (message.type === 'REMINDER' || message.type === 'COUNTDOWN_ALARM') showReminder(message.task || { kind: 'countdown' }); });
chrome.runtime.sendMessage({ type: 'GET_ACTIVE_ALARMS' }).catch(() => {});
