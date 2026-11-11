const START_ALARM = taskId => `task-start-${taskId}`;
const END_ALARM = taskId => `task-end-${taskId}`;
const COUNTDOWN_ALARM = 'countdown';
const TASK_TICK = 'task-extension-tick';
const MIDNIGHT_CLEANUP = 'midnight-task-cleanup';
const COUNTDOWN_NOTIFICATION = 'offline-workspace-countdown';
const TASK_NOTIFICATION = (taskId, kind) => `offline-workspace-task-${kind}-${taskId}`;
const ICON_URL = 'icon-128.png';

chrome.runtime.onInstalled.addListener(() => {
  scheduleAllTasks().catch(reportBackgroundError);
  checkMissedTasks().catch(reportBackgroundError);
});
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
  const state = result.todoState || { tasks: [], settings: {}, countdown: { endsAt: null } };
  const settings = state.settings || {};
  state.settings = { ...settings, silentNotifications: settings.silentNotifications ?? settings.enabled === false };
  return state;
}
async function scheduleAllTasks() {
  const state = await getState();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const currentTasks = state.tasks || [];
  const removedTasks = currentTasks.filter(task => {
    const start = new Date(task.start);
    return !Number.isNaN(start.getTime()) && start < today;
  });
  state.tasks = currentTasks.filter(task => !removedTasks.includes(task));
  if (removedTasks.length) {
    await chrome.storage.local.set({ todoState: state });
    await Promise.all(removedTasks.flatMap(task => [
      chrome.notifications.clear(TASK_NOTIFICATION(task.id, 'start')),
      chrome.notifications.clear(TASK_NOTIFICATION(task.id, 'end'))
    ]));
  }
  const alarms = await chrome.alarms.getAll();
  await Promise.all(alarms.filter(alarm => alarm.name.startsWith('task-start-') || alarm.name.startsWith('task-end-') || alarm.name === COUNTDOWN_ALARM || alarm.name === TASK_TICK || alarm.name === MIDNIGHT_CLEANUP).map(alarm => chrome.alarms.clear(alarm.name)));
  await chrome.alarms.create(MIDNIGHT_CLEANUP, { when: nextLocalMidnight() });
  if (state.settings?.silentNotifications === true) {
    await chrome.notifications.clear(COUNTDOWN_NOTIFICATION);
    await Promise.all((state.tasks || []).flatMap(task => [
      chrome.notifications.clear(TASK_NOTIFICATION(task.id, 'start')),
      chrome.notifications.clear(TASK_NOTIFICATION(task.id, 'end'))
    ]));
    return;
  }
  for (const task of state.tasks || []) {
    if (task.status === 'completed') continue;
    const start = new Date(task.start).getTime();
    const end = new Date(task.end).getTime();
    if (start > Date.now()) await chrome.alarms.create(START_ALARM(task.id), { when: start });
    if (!['extended', 'paused'].includes(task.status) && !task.delayed && end > Date.now()) await chrome.alarms.create(END_ALARM(task.id), { when: end });
  }
  if (state.tasks?.some(task => task.status === 'extended')) await chrome.alarms.create(TASK_TICK, { periodInMinutes: 1 });
  if (state.countdown?.endsAt > Date.now()) await chrome.alarms.create(COUNTDOWN_ALARM, { when: state.countdown.endsAt });
}

chrome.alarms.onAlarm.addListener(alarm => {
  handleAlarm(alarm).catch(reportBackgroundError);
});
function nextLocalMidnight() {
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime();
}
async function handleAlarm(alarm) {
  if (alarm.name === MIDNIGHT_CLEANUP) {
    await scheduleAllTasks();
    return;
  }
  if (alarm.name === TASK_TICK) {
    const state = await getState();
    if (shiftExtendedTasks(state)) await chrome.storage.local.set({ todoState: state });
    return;
  }

  if (alarm.name === COUNTDOWN_ALARM) {
    const state = await getState();
    state.countdown = { ...(state.countdown || {}), endsAt: null, remaining: 0, alarmActive: true, dismissed: false };
    await chrome.storage.local.set({ todoState: state });
    await showCountdownNotification();
    return;
  }
  const match = alarm.name.match(/^task-(start|end)-(.+)$/);
  if (!match) return;
  const state = await getState();
  const task = (state.tasks || []).find(item => item.id === match[2]);
  if (!task || task.status === 'completed') return;
  if (match[1] === 'end' && task.status === 'paused') return;
  if (match[1] === 'end') task.status = 'extended';
  task.reminded = { ...(task.reminded || {}), [match[1]]: true };
  await chrome.storage.local.set({ todoState: state });
  await showTaskNotification(task, match[1]);
}

async function checkMissedTasks() {
  const state = await getState();
  const current = Date.now();
  for (const task of state.tasks || []) {
    if (task.status === 'completed') continue;
    const start = new Date(task.start).getTime();
    const end = new Date(task.end).getTime();
    if (task.status === 'scheduled' && !task.delayed && start <= current && !task.reminded?.start) {
      task.reminded = { ...(task.reminded || {}), start: true };
      await showTaskNotification(task, 'start');
    }
    if (!['extended', 'paused'].includes(task.status) && !task.delayed && end <= current && !task.reminded?.end) {
      task.status = 'extended';
      task.reminded = { ...(task.reminded || {}), end: true };
      await showTaskNotification(task, 'end');
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

async function showCountdownNotification() {
  const state = await getState();
  if (state.settings?.silentNotifications === true) {
    await chrome.notifications.clear(COUNTDOWN_NOTIFICATION);
    return;
  }
  await chrome.notifications.create(COUNTDOWN_NOTIFICATION, {
    type: 'basic',
    iconUrl: ICON_URL,
    title: 'Timer complete',
    message: 'Your countdown has reached zero.',
    priority: 2,
    requireInteraction: true,
    buttons: [{ title: 'Dismiss' }]
  });
}

async function showTaskNotification(task, kind) {
  const state = await getState();
  if (state.settings?.silentNotifications === true) {
    await chrome.notifications.clear(TASK_NOTIFICATION(task.id, kind));
    return;
  }
  const options = kind === 'start'
    ? {
        type: 'basic',
        iconUrl: ICON_URL,
        title: task.title || 'Task starting',
        message: 'This task is scheduled to start now.',
        priority: 2,
        requireInteraction: true,
        buttons: [{ title: 'Start now' }, { title: 'Delay' }]
      }
    : {
        type: 'basic',
        iconUrl: ICON_URL,
        title: task.title || 'Task finish time',
        message: 'The scheduled finish time has arrived.',
        priority: 2,
        requireInteraction: true,
        buttons: [{ title: 'Finish' }, { title: 'Extend' }]
      };
  await chrome.notifications.create(TASK_NOTIFICATION(task.id, kind), options);
}

async function clearTaskNotifications(taskId) {
  await Promise.all([
    chrome.notifications.clear(TASK_NOTIFICATION(taskId, 'start')),
    chrome.notifications.clear(TASK_NOTIFICATION(taskId, 'end'))
  ]);
}

chrome.runtime.onMessage.addListener(message => {
  handleMessage(message).catch(reportBackgroundError);
});
async function handleMessage(message) {
  if (message.type === 'START_COUNTDOWN') {
    await chrome.alarms.clear(COUNTDOWN_ALARM);
    await chrome.alarms.create(COUNTDOWN_ALARM, { when: message.endsAt });
  }
  if (message.type === 'RESET_COUNTDOWN') await chrome.alarms.clear(COUNTDOWN_ALARM);
  if (message.type === 'DISMISS_COUNTDOWN') {
    const state = await getState();
    state.countdown = { ...(state.countdown || {}), alarmActive: false, dismissed: true };
    await chrome.storage.local.set({ todoState: state });
    await chrome.notifications.clear(COUNTDOWN_NOTIFICATION);
  }
  if (message.type === 'TASK_ACTION') {
    const state = await getState();
    const task = (state.tasks || []).find(item => item.id === message.taskId);
    if (!task) return;
    if (message.action === 'finish') {
      const endedAt = new Date().toISOString();
      if (task.status === 'paused' && task.pausedAt) {
        task.breaks = [...(task.breaks || []), { start: task.pausedAt, end: endedAt }];
        task.pausedAt = null;
      }
      task.status = 'completed'; task.end = endedAt; task.actualEnd = task.end; task.completedAt = task.end;
    }
    if (message.action === 'extend') { task.status = 'extended'; task.delayed = false; }
    if (message.action === 'start') {
      if (new Date(task.end).getTime() <= Date.now()) {
        const duration = Math.max(60000, new Date(task.end).getTime() - new Date(task.start).getTime());
        task.start = new Date().toISOString();
        task.end = new Date(Date.now() + duration).toISOString();
      }
      task.status = 'active'; task.delayed = false; task.reminded = { ...(task.reminded || {}), start: true };
    }
    if (message.action === 'pause' && ['active', 'extended'].includes(task.status)) {
      task.status = 'paused';
      task.pausedAt = new Date().toISOString();
    }
    if (message.action === 'resume' && task.status === 'paused') {
      const resumedAt = new Date().toISOString();
      if (task.pausedAt) task.breaks = [...(task.breaks || []), { start: task.pausedAt, end: resumedAt }];
      task.pausedAt = null;
      task.status = new Date(task.end).getTime() <= Date.now() ? 'extended' : 'active';
    }
    if (message.action === 'delay') { task.delayed = true; task.reminded = { ...(task.reminded || {}), start: true }; }
    if (message.action === 'extend') shiftExtendedTasks(state);
    await chrome.storage.local.set({ todoState: state });
    await clearTaskNotifications(task.id);
    await scheduleAllTasks();
  }
}

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  handleNotificationAction(notificationId, buttonIndex).catch(reportBackgroundError);
});
chrome.notifications.onClicked.addListener(notificationId => {
  handleNotificationClick(notificationId).catch(reportBackgroundError);
});

async function handleNotificationAction(notificationId, buttonIndex) {
  if (notificationId === COUNTDOWN_NOTIFICATION) {
    await dismissCountdown();
    return;
  }
  const match = notificationId.match(/^offline-workspace-task-(start|end)-(.+)$/);
  if (!match) return;
  const action = match[1] === 'start'
    ? (buttonIndex === 0 ? 'start' : 'delay')
    : (buttonIndex === 0 ? 'finish' : 'extend');
  await handleMessage({ type: 'TASK_ACTION', taskId: match[2], action });
}

async function handleNotificationClick(notificationId) {
  if (notificationId === COUNTDOWN_NOTIFICATION) {
    await dismissCountdown();
    return;
  }
  const match = notificationId.match(/^offline-workspace-task-(start|end)-(.+)$/);
  if (!match) return;
  await chrome.tabs.create({ url: chrome.runtime.getURL('app.html') });
}

async function dismissCountdown() {
  const state = await getState();
  state.countdown = { ...(state.countdown || {}), alarmActive: false, dismissed: true };
  await chrome.storage.local.set({ todoState: state });
  await chrome.notifications.clear(COUNTDOWN_NOTIFICATION);
}
