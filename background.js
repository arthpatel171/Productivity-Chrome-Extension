const START_ALARM = taskId => `task-start-${taskId}`;
const END_ALARM = taskId => `task-end-${taskId}`;
const COUNTDOWN_ALARM = 'countdown';
const TASK_TICK = 'task-extension-tick';

chrome.runtime.onInstalled.addListener(() => { scheduleAllTasks().catch(reportBackgroundError); });
chrome.runtime.onStartup.addListener(() => {
  scheduleAllTasks().catch(reportBackgroundError);
  checkMissedTasks().catch(reportBackgroundError);
});
chrome.storage.onChanged.addListener(changes => { if (changes.todoState) scheduleAllTasks().catch(reportBackgroundError); });

function reportBackgroundError(error) {
  console.error('Offline Workspace background error:', error);
}

async function getState() {
  const result = await chrome.storage.local.get('todoState');
  return result.todoState || { tasks: [], settings: { enabled: true }, countdown: { endsAt: null } };
}
async function scheduleAllTasks() {
  const state = await getState();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const currentTasks = state.tasks || [];
  state.tasks = currentTasks.filter(task => { const start = new Date(task.start); return Number.isNaN(start.getTime()) || start >= today; });
  if (state.tasks.length !== currentTasks.length) await chrome.storage.local.set({ todoState: state });
  const alarms = await chrome.alarms.getAll();
  await Promise.all(alarms.filter(alarm => alarm.name.startsWith('task-start-') || alarm.name.startsWith('task-end-') || alarm.name === COUNTDOWN_ALARM || alarm.name === TASK_TICK).map(alarm => chrome.alarms.clear(alarm.name)));
  if (state.settings?.enabled === false) return;
  for (const task of state.tasks || []) {
    if (task.status === 'completed') continue;
    const start = new Date(task.start).getTime();
    const end = new Date(task.end).getTime();
    if (start > Date.now()) await chrome.alarms.create(START_ALARM(task.id), { when: start });
    if (task.status !== 'extended' && end + 60000 > Date.now()) await chrome.alarms.create(END_ALARM(task.id), { when: end + 60000 });
  }
  if (state.tasks?.some(task => task.status === 'extended')) await chrome.alarms.create(TASK_TICK, { periodInMinutes: 1 });
  if (state.countdown?.endsAt > Date.now()) await chrome.alarms.create(COUNTDOWN_ALARM, { when: state.countdown.endsAt });
}

chrome.alarms.onAlarm.addListener(alarm => {
  handleAlarm(alarm).catch(reportBackgroundError);
});
async function handleAlarm(alarm) {
  if (alarm.name === TASK_TICK) {
    const state = await getState();
    if (shiftExtendedTasks(state)) await chrome.storage.local.set({ todoState: state });
    return;
  }
  if (alarm.name === COUNTDOWN_ALARM) {
    const state = await getState();
    state.countdown = { ...(state.countdown || {}), endsAt: null, remaining: 0, alarmActive: true, dismissed: false };
    await chrome.storage.local.set({ todoState: state });
    sendToActiveTab({ type: 'COUNTDOWN_ALARM', task: { kind: 'countdown', occurrence: state.countdown.occurrence } });
    return;
  }
  const match = alarm.name.match(/^task-(start|end)-(.+)$/);
  if (!match) return;
  const state = await getState();
  const task = (state.tasks || []).find(item => item.id === match[2]);
  if (!task || task.status === 'completed') return;
  if (match[1] === 'end') task.status = 'extended';
  task.reminded = { ...(task.reminded || {}), [match[1]]: true };
  await chrome.storage.local.set({ todoState: state });
  sendToActiveTab({ type: 'REMINDER', task: { ...task, kind: match[1] } });
}

async function checkMissedTasks() {
  const state = await getState();
  if (state.settings?.enabled === false) return;
  const current = Date.now();
  for (const task of state.tasks || []) {
    if (task.status === 'completed') continue;
    if (new Date(task.end).getTime() + 60000 <= current && !task.reminded?.end) {
      task.reminded = { ...(task.reminded || {}), end: true };
      sendToActiveTab({ type: 'REMINDER', task: { ...task, kind: 'end' } });
    }
  }
  await chrome.storage.local.set({ todoState: state });
}

function shiftExtendedTasks(state) {
  const extended = (state.tasks || []).filter(task => task.status === 'extended').sort((a, b) => new Date(a.end) - new Date(b.end));
  const current = Date.now();
  let changed = false;
  extended.forEach(source => {
    const sourceDayEnd = new Date(source.start);
    sourceDayEnd.setHours(23, 59, 59, 999);
    if (current >= sourceDayEnd.getTime()) {
      source.status = 'completed';
      source.actualEnd = sourceDayEnd.toISOString();
      source.completedAt = source.actualEnd;
      changed = true;
      return;
    }
    const sourceEnd = new Date(source.end).getTime();
    state.tasks.filter(task => task.id !== source.id && task.status !== 'completed' && new Date(task.start).getTime() >= sourceEnd).forEach(task => {
      const baseStart = new Date(task.originalStart || task.start).getTime();
      const baseEnd = new Date(task.originalEnd || task.end).getTime();
      const desiredStart = baseStart + Math.max(0, current - sourceEnd);
      if (new Date(task.start).getTime() !== desiredStart) {
        task.originalStart = task.originalStart || task.start;
        task.originalEnd = task.originalEnd || task.end;
        task.start = new Date(desiredStart).toISOString();
        task.end = new Date(desiredStart + (baseEnd - baseStart)).toISOString();
        changed = true;
      }
    });
  });
  return changed;
}

async function sendToActiveTab(message) {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const tab = tabs[0];
  if (tab?.id) chrome.tabs.sendMessage(tab.id, message).catch(() => {});
}

chrome.runtime.onMessage.addListener(message => {
  handleMessage(message).catch(reportBackgroundError);
});
async function handleMessage(message) {
  if (message.type === 'GET_ACTIVE_ALARMS') {
    const state = await getState();
    if (state.settings?.enabled === false) return;
    if (state.countdown?.alarmActive && !state.countdown?.dismissed) sendToActiveTab({ type: 'COUNTDOWN_ALARM', task: { kind: 'countdown', occurrence: state.countdown.occurrence } });
    for (const task of state.tasks || []) {
      if (task.status !== 'completed' && new Date(task.end).getTime() <= Date.now() && task.reminded?.end) sendToActiveTab({ type: 'REMINDER', task: { ...task, kind: 'end' } });
    }
    return;
  }
  if (message.type === 'START_COUNTDOWN') {
    await chrome.alarms.clear(COUNTDOWN_ALARM);
    await chrome.alarms.create(COUNTDOWN_ALARM, { when: message.endsAt });
  }
  if (message.type === 'RESET_COUNTDOWN') await chrome.alarms.clear(COUNTDOWN_ALARM);
  if (message.type === 'DISMISS_COUNTDOWN') {
    const state = await getState();
    state.countdown = { ...(state.countdown || {}), alarmActive: false, dismissed: true };
    await chrome.storage.local.set({ todoState: state });
  }
  if (message.type === 'TASK_ACTION') {
    const state = await getState();
    const task = (state.tasks || []).find(item => item.id === message.taskId);
    if (!task) return;
    if (message.action === 'finish') { task.status = 'completed'; task.end = new Date().toISOString(); task.actualEnd = task.end; task.completedAt = task.end; }
    if (message.action === 'extend') task.status = 'extended';
    if (message.action === 'extend') shiftExtendedTasks(state);
    await chrome.storage.local.set({ todoState: state });
    await scheduleAllTasks();
  }
}
