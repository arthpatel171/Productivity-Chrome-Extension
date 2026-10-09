const START_ALARM = taskId => `task-start-${taskId}`;
const END_ALARM = taskId => `task-end-${taskId}`;
const COUNTDOWN_ALARM = 'countdown';

chrome.runtime.onInstalled.addListener(() => { scheduleAllTasks(); });
chrome.runtime.onStartup.addListener(() => { scheduleAllTasks(); checkMissedTasks(); });
chrome.storage.onChanged.addListener(changes => { if (changes.todoState) scheduleAllTasks(); });

async function getState() { const result = await chrome.storage.local.get('todoState'); return result.todoState || { tasks: [], settings: { enabled: true } }; }
async function scheduleAllTasks() {
  const state = await getState();
  const alarms = await chrome.alarms.getAll();
  await Promise.all(alarms.filter(alarm => alarm.name.startsWith('task-start-') || alarm.name.startsWith('task-end-') || alarm.name === COUNTDOWN_ALARM).map(alarm => chrome.alarms.clear(alarm.name)));
  if (state.settings?.enabled === false) return;
  for (const task of state.tasks || []) {
    if (task.status === 'completed') continue;
    const start = new Date(task.start).getTime(); const end = new Date(task.end).getTime();
    if (start > Date.now()) await chrome.alarms.create(START_ALARM(task.id), { when: start });
    if (end > Date.now()) await chrome.alarms.create(END_ALARM(task.id), { when: end });
  }
  if (state.countdown?.endsAt > Date.now()) await chrome.alarms.create(COUNTDOWN_ALARM, { when: state.countdown.endsAt });
}

chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name === COUNTDOWN_ALARM) {
    const state = await getState();
    state.countdown = { endsAt: null, remaining: 0, alarmActive: true };
    await chrome.storage.local.set({ todoState: state });
    broadcast({ type: 'COUNTDOWN_ALARM', task: { kind: 'countdown' } });
    return;
  }
  const match = alarm.name.match(/^task-(start|end)-(.+)$/); if (!match) return;
  const state = await getState(); const task = (state.tasks || []).find(item => item.id === match[2]); if (!task || task.status === 'completed') return;
  task.reminded = task.reminded || {}; task.reminded[match[1]] = true;
  await chrome.storage.local.set({ todoState: state });
  broadcast({ type: 'REMINDER', task: { ...task, kind: match[1] } });
});

async function checkMissedTasks() {
  const state = await getState(); if (state.settings?.enabled === false) return;
  const current = Date.now();
  for (const task of state.tasks || []) {
    if (task.status === 'completed') continue;
    if (new Date(task.end).getTime() <= current && !task.reminded?.end) { task.reminded = { ...(task.reminded || {}), end: true }; broadcast({ type: 'REMINDER', task: { ...task, kind: 'end' } }); }
  }
  await chrome.storage.local.set({ todoState: state });
}

function broadcast(message) { chrome.tabs.query({}).then(tabs => tabs.forEach(tab => { if (tab.id) chrome.tabs.sendMessage(tab.id, message).catch(() => {}); })); }

chrome.runtime.onMessage.addListener(async message => {
  if (message.type === 'GET_ACTIVE_ALARMS') {
    const state = await getState();
    if (state.countdown?.alarmActive) broadcast({ type: 'COUNTDOWN_ALARM', task: { kind: 'countdown' } });
    return;
  }
  if (message.type === 'START_COUNTDOWN') {
    await chrome.alarms.clear(COUNTDOWN_ALARM);
    await chrome.alarms.create(COUNTDOWN_ALARM, { when: message.endsAt });
    const state = await getState();
    state.countdown = { ...(state.countdown || {}), alarmActive: false };
    await chrome.storage.local.set({ todoState: state });
  }
  if (message.type === 'RESET_COUNTDOWN') {
    await chrome.alarms.clear(COUNTDOWN_ALARM);
    const state = await getState();
    state.countdown = { ...(state.countdown || {}), alarmActive: false };
    await chrome.storage.local.set({ todoState: state });
  }
  if (message.type === 'DISMISS_COUNTDOWN') {
    const state = await getState();
    state.countdown = { ...(state.countdown || {}), alarmActive: false };
    await chrome.storage.local.set({ todoState: state });
    broadcast({ type: 'DISMISS_COUNTDOWN' });
  }
  if (message.type === 'TASK_ACTION') {
    const state = await getState(); const task = (state.tasks || []).find(item => item.id === message.taskId); if (!task) return;
    if (message.action === 'complete') { task.status = 'completed'; task.completedAt = new Date().toISOString(); }
    if (message.action === 'delay') task.status = 'delayed';
    await chrome.storage.local.set({ todoState: state }); scheduleAllTasks();
  }
});
