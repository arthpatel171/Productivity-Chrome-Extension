const START_ALARM = taskId => `task-start-${taskId}`;
const END_ALARM = taskId => `task-end-${taskId}`;
const BREAK_START_ALARM = (taskId, breakTime) => `task-break-start-${taskId}-${breakTime}`;
const BREAK_END_ALARM = (taskId, breakTime) => `task-break-end-${taskId}-${breakTime}`;
const BREAK_SNOOZE_ALARM = (taskId, breakTime) => `task-break-snooze-${taskId}-${breakTime}`;
const COUNTDOWN_ALARM = 'countdown';
const TASK_TICK = 'task-extension-tick';
const MIDNIGHT_CLEANUP = 'midnight-task-cleanup';
const COUNTDOWN_NOTIFICATION = 'offline-workspace-countdown';
const TASK_NOTIFICATION = (taskId, kind) => `offline-workspace-task-${kind}-${taskId}`;
const BREAK_NOTIFICATION = (taskId, breakTime, kind) => `offline-workspace-task-break-${kind}-${taskId}-${breakTime}`;
const ICON_URL = 'icon-128.png';

chrome.runtime.onInstalled.addListener(() => {
  scheduleAllTasks().catch(reportBackgroundError);
  checkMissedTasks().catch(reportBackgroundError);
});
chrome.runtime.onStartup.addListener(() => {
  scheduleAllTasks().catch(reportBackgroundError);
  checkMissedTasks().catch(reportBackgroundError);
});
chrome.storage.onChanged.addListener(changes => {
  if (changes.tasks || changes.settings || changes.countdown || changes.todoState) {
    scheduleAllTasks().catch(reportBackgroundError);
  }
});

function reportBackgroundError(error) {
  console.error('Offline Workspace background error:', error);
}

async function getState() {
  const result = await chrome.storage.local.get(['tasks', 'settings', 'countdown', 'todoState']);
  let tasks = result.tasks;
  let settings = result.settings;
  let countdown = result.countdown;
  if (!tasks && result.todoState) {
    tasks = result.todoState.tasks;
    settings = result.todoState.settings;
    countdown = result.todoState.countdown;
  }
  tasks = Array.isArray(tasks) ? tasks : [];
  settings = settings || {};
  settings = { ...settings, silentNotifications: settings.silentNotifications ?? settings.enabled === false };
  countdown = countdown || { endsAt: null };
  return { tasks, settings, countdown };
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
    await chrome.storage.local.set({ tasks: state.tasks });
    await Promise.all(removedTasks.flatMap(task => [
      chrome.notifications.clear(TASK_NOTIFICATION(task.id, 'start')),
      chrome.notifications.clear(TASK_NOTIFICATION(task.id, 'end')),
      clearTaskBreakNotifications(task.id)
    ]));
  }
  const alarms = await chrome.alarms.getAll();
  await Promise.all(alarms.filter(alarm =>
    alarm.name.startsWith('task-start-') ||
    alarm.name.startsWith('task-end-') ||
    alarm.name.startsWith('task-break-start-') ||
    alarm.name.startsWith('task-break-end-') ||
    alarm.name === COUNTDOWN_ALARM ||
    alarm.name === TASK_TICK ||
    alarm.name === MIDNIGHT_CLEANUP
  ).map(alarm => chrome.alarms.clear(alarm.name)));

  for (const alarm of alarms.filter(a => a.name.startsWith('task-break-snooze-'))) {
    const match = alarm.name.match(/^task-break-snooze-(.+)-(\d+)$/);
    if (match) {
      const t = (state.tasks || []).find(item => item.id === match[1]);
      if (!t || t.status === 'completed' || t.status !== 'paused') {
        await chrome.alarms.clear(alarm.name);
      }
    }
  }

  await chrome.alarms.create(MIDNIGHT_CLEANUP, { when: nextLocalMidnight() });
  if (state.settings?.silentNotifications === true) {
    await chrome.notifications.clear(COUNTDOWN_NOTIFICATION);
    await Promise.all((state.tasks || []).flatMap(task => [
      chrome.notifications.clear(TASK_NOTIFICATION(task.id, 'start')),
      chrome.notifications.clear(TASK_NOTIFICATION(task.id, 'end')),
      clearTaskBreakNotifications(task.id)
    ]));
    return;
  }
  for (const task of state.tasks || []) {
    if (task.status === 'completed') continue;
    const start = new Date(task.start).getTime();
    const end = new Date(task.end).getTime();
    if (start > Date.now()) await chrome.alarms.create(START_ALARM(task.id), { when: start });
    if (!['extended', 'paused'].includes(task.status) && !task.delayed && end > Date.now()) await chrome.alarms.create(END_ALARM(task.id), { when: end });

    for (const b of task.breaks || []) {
      const bStart = new Date(b.start).getTime();
      const bEnd = new Date(b.end).getTime();
      if (!Number.isNaN(bStart) && bStart > Date.now()) {
        await chrome.alarms.create(BREAK_START_ALARM(task.id, bStart), { when: bStart });
      }
      if (!Number.isNaN(bEnd) && bEnd > Date.now()) {
        await chrome.alarms.create(BREAK_END_ALARM(task.id, bStart), { when: bEnd });
      }
    }
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
    if (shiftExtendedTasks(state)) await chrome.storage.local.set({ tasks: state.tasks });
    return;
  }

  if (alarm.name === COUNTDOWN_ALARM) {
    const state = await getState();
    state.countdown = { ...(state.countdown || {}), endsAt: null, remaining: 0, alarmActive: true, dismissed: false };
    await chrome.storage.local.set({ countdown: state.countdown });
    await showCountdownNotification();
    return;
  }

  const breakMatch = alarm.name.match(/^task-break-(start|end|snooze)-(.+)-(\d+)$/);
  if (breakMatch) {
    const kind = breakMatch[1];
    const taskId = breakMatch[2];
    const breakTime = Number(breakMatch[3]);
    const state = await getState();
    const task = (state.tasks || []).find(item => item.id === taskId);
    if (!task || task.status === 'completed') return;

    if (kind === 'start') {
      if (['active', 'extended'].includes(task.status) && !task.delayed) {
        await showBreakNotification(task, breakTime, 'start');
      }
      return;
    }

    if (kind === 'end' || kind === 'snooze') {
      // Notification only appears if the task is active
      if (['active', 'extended', 'paused'].includes(task.status) && !task.delayed) {
        await showBreakNotification(task, breakTime, 'end');
      }
      return;
    }
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
  await chrome.storage.local.set({ tasks: state.tasks });
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
    for (const b of task.breaks || []) {
      const bStart = new Date(b.start).getTime();
      const bEnd = new Date(b.end).getTime();
      const bKey = `break-start-${bStart}`;
      if (['active', 'extended'].includes(task.status) && !task.delayed && bStart <= current && bEnd > current && !task.reminded?.[bKey]) {
        task.reminded = { ...(task.reminded || {}), [bKey]: true };
        await showBreakNotification(task, bStart, 'start');
      }
    }
  }
  await chrome.storage.local.set({ tasks: state.tasks });
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

async function showBreakNotification(task, breakTime, kind) {
  const state = await getState();
  if (state.settings?.silentNotifications === true) {
    await chrome.notifications.clear(BREAK_NOTIFICATION(task.id, breakTime, kind));
    return;
  }
  const notifId = BREAK_NOTIFICATION(task.id, breakTime, kind);
  const options = kind === 'start'
    ? {
        type: 'basic',
        iconUrl: ICON_URL,
        title: task.title || 'Break time',
        message: "It's time to take a break",
        priority: 2,
        requireInteraction: true,
        buttons: [{ title: 'Begin' }, { title: 'Cancel' }]
      }
    : {
        type: 'basic',
        iconUrl: ICON_URL,
        title: 'Time to resume ' + (task.title || 'task'),
        message: 'Your scheduled break has ended.',
        priority: 2,
        requireInteraction: true,
        buttons: [{ title: 'Resume' }, { title: 'Snooze' }]
      };
  await chrome.notifications.create(notifId, options);
}

async function clearTaskBreakNotifications(taskId) {
  const notifs = await chrome.notifications.getAll();
  for (const notifId of Object.keys(notifs || {})) {
    if (notifId.startsWith('offline-workspace-task-break-') && notifId.includes(`-${taskId}-`)) {
      await chrome.notifications.clear(notifId);
    }
  }
}

async function clearTaskNotifications(taskId) {
  await Promise.all([
    chrome.notifications.clear(TASK_NOTIFICATION(taskId, 'start')),
    chrome.notifications.clear(TASK_NOTIFICATION(taskId, 'end')),
    clearTaskBreakNotifications(taskId)
  ]);
  const alarms = await chrome.alarms.getAll();
  await Promise.all(alarms
    .filter(a => a.name.startsWith(`task-break-start-${taskId}-`) ||
                 a.name.startsWith(`task-break-end-${taskId}-`) ||
                 a.name.startsWith(`task-break-snooze-${taskId}-`))
    .map(a => chrome.alarms.clear(a.name)));
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
    await chrome.storage.local.set({ countdown: state.countdown });
    await chrome.notifications.clear(COUNTDOWN_NOTIFICATION);
  }
  if (message.type === 'TASK_ACTION') {
    const state = await getState();
    const task = (state.tasks || []).find(item => item.id === message.taskId);
    if (!task) return;
    if (message.action === 'break-begin') {
      task.status = 'paused';
      task.pausedAt = new Date().toISOString();
      await chrome.notifications.clear(BREAK_NOTIFICATION(task.id, message.breakTime, 'start'));
      await chrome.storage.local.set({ tasks: state.tasks });
      await scheduleAllTasks();
      return;
    }
    if (message.action === 'break-cancel') {
      const bTime = Number(message.breakTime);
      task.breaks = (task.breaks || []).filter(b => new Date(b.start).getTime() !== bTime);
      await chrome.notifications.clear(BREAK_NOTIFICATION(task.id, message.breakTime, 'start'));
      await chrome.alarms.clear(BREAK_START_ALARM(task.id, message.breakTime));
      await chrome.alarms.clear(BREAK_END_ALARM(task.id, message.breakTime));
      await chrome.alarms.clear(BREAK_SNOOZE_ALARM(task.id, message.breakTime));
      await chrome.storage.local.set({ tasks: state.tasks });
      await scheduleAllTasks();
      return;
    }
    if (message.action === 'break-resume') {
      const resumedAt = new Date().toISOString();
      if (task.status === 'paused') {
        if (task.pausedAt) task.breaks = [...(task.breaks || []), { start: task.pausedAt, end: resumedAt }];
        task.pausedAt = null;
        task.status = new Date(task.end).getTime() <= Date.now() ? 'extended' : 'active';
      }
      await chrome.alarms.clear(BREAK_SNOOZE_ALARM(task.id, message.breakTime));
      await chrome.notifications.clear(BREAK_NOTIFICATION(task.id, message.breakTime, 'end'));
      await chrome.storage.local.set({ tasks: state.tasks });
      await scheduleAllTasks();
      return;
    }
    if (message.action === 'break-snooze') {
      if (['active', 'extended'].includes(task.status)) {
        task.status = 'paused';
        task.pausedAt = task.pausedAt || new Date().toISOString();
      }
      await chrome.alarms.create(BREAK_SNOOZE_ALARM(task.id, message.breakTime), {
        when: Date.now() + 5 * 60 * 1000,
        periodInMinutes: 5
      });
      await chrome.notifications.clear(BREAK_NOTIFICATION(task.id, message.breakTime, 'end'));
      await chrome.storage.local.set({ tasks: state.tasks });
      await scheduleAllTasks();
      return;
    }
    if (message.action === 'finish') {
      const endedAt = new Date().toISOString();
      if (task.status === 'paused' && task.pausedAt) {
        task.breaks = [...(task.breaks || []), { start: task.pausedAt, end: endedAt }];
        task.pausedAt = null;
      }
      task.status = 'completed'; task.end = endedAt; task.actualEnd = task.end; task.completedAt = task.end;
      const allAlarms = await chrome.alarms.getAll();
      await Promise.all(allAlarms
        .filter(a => a.name.startsWith(`task-break-snooze-${task.id}-`))
        .map(a => chrome.alarms.clear(a.name)));
      await clearTaskBreakNotifications(task.id);
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
      const allAlarms = await chrome.alarms.getAll();
      await Promise.all(allAlarms
        .filter(a => a.name.startsWith(`task-break-snooze-${task.id}-`))
        .map(a => chrome.alarms.clear(a.name)));
      await clearTaskBreakNotifications(task.id);
    }
    if (message.action === 'delay') { task.delayed = true; task.reminded = { ...(task.reminded || {}), start: true }; }
    if (message.action === 'extend') shiftExtendedTasks(state);
    await chrome.storage.local.set({ tasks: state.tasks });
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
  const breakMatch = notificationId.match(/^offline-workspace-task-break-(start|end)-(.+)-(\d+)$/);
  if (breakMatch) {
    const kind = breakMatch[1];
    const taskId = breakMatch[2];
    const breakTime = Number(breakMatch[3]);
    const action = kind === 'start'
      ? (buttonIndex === 0 ? 'break-begin' : 'break-cancel')
      : (buttonIndex === 0 ? 'break-resume' : 'break-snooze');
    await handleMessage({ type: 'TASK_ACTION', taskId, breakTime, action });
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
  const breakMatch = notificationId.match(/^offline-workspace-task-break-(start|end)-(.+)-(\d+)$/);
  if (!match && !breakMatch) return;
  await chrome.tabs.create({ url: chrome.runtime.getURL('app.html') });
}

async function dismissCountdown() {
  const state = await getState();
  state.countdown = { ...(state.countdown || {}), alarmActive: false, dismissed: true };
  await chrome.storage.local.set({ countdown: state.countdown });
  await chrome.notifications.clear(COUNTDOWN_NOTIFICATION);
}
