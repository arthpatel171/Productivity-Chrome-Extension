# Popup Requirements

Only the Time tools and Calendar sections can trigger system notifications.
Notifications are delivered by the browser and do not require access to any
website or injection into the active page. The browser action popup is a
separate surface that the user opens manually.

## Time tools

- A timer notification is triggered only when a countdown reaches `00:00:00`.
- Stopwatch state does not trigger a notification.
- The timer notification displays **Timer complete** and provides a **Dismiss**
  button.
- Dismissing the notification ends that timer alert occurrence.

No other Time tools condition can trigger a popup.

## Calendar task start

- A task scheduled for a later start time triggers a system notification when its scheduled
  start time arrives.
- The notification displays the task title.
- The notification provides **Start now** and **Delay** buttons.
- **Start now** changes the task to active.
- **Delay** does not start the task. The task remains scheduled, and its
  position in the day timeline continues to be pushed back until the user
  starts it manually.
- Delaying a task does not create a recurring popup at a fixed interval.

## Calendar task finish

- A task created to start immediately must have a finish time.
- When that finish time is reached and the task is unfinished, a system
  notification appears.
- The notification displays the task title.
- The notification provides **Extend** and **Finish** buttons.
- **Finish** completes the task.
- **Extend** leaves the task active, changes it to extended status, and allows
  the task to continue growing while later tasks are pushed back.
- Extending a task does not create recurring popups at a fixed interval.

## Scheduled task breaks

- When a scheduled break start time arrives for an active task, a system notification appears.
- The break start notification displays the text **It's time to take a break**.
- The break start notification provides **Begin** and **Cancel** buttons.
  - **Begin** starts the break as scheduled (pausing the task).
  - **Cancel** does not start the break and removes that break from the task schedule.
- When a scheduled break end time arrives, a system notification appears displaying **Time to resume [Task Name]**.
- The break end notification only appears if the task is active (in active, extended, or paused status, and not completed or delayed).
- The break end notification provides **Resume** and **Snooze** buttons.
  - **Resume** resumes the task as scheduled (returning it to active work).
  - **Snooze** continues the break. Every 5 minutes, the user receives the same notification again until the user clicks resume.

## Browser action popup status

When the user opens the extension's browser action popup:

- An extended task shows its scheduled end time in the same white text style as
  its start time.
- The extended-task status includes a **Finish task** button.
- An active task includes a **Finish task** button.
- An active or extended task includes a **Pause** control.
- A paused task includes a **Resume** control and remains unfinished.
- A scheduled task whose start time was delayed is shown with red text stating
  that its scheduled start time has passed.
- The delayed-task status includes a **Start** button.
- **Finish task** completes the extended task.
- **Finish task** also completes an active task.
- **Start** starts the delayed task and changes it to active.
- **Pause** records the exact break start without completing the task.
- **Resume** records the exact break end and returns the task to active work.

These browser action popup notices remain available until the corresponding task
action is taken or the task is finished from the workspace. The extension must
not use them as a recurring notification.

## Browser action popup interface

- The popup provides Offline Workspace branding, a pause/resume task control, a
  **Silent notifications** checkbox, and an **Open workspace** button.
- Checking **Silent notifications** suppresses browser notifications while
  timers, task alarms, and task scheduling continue to operate.
- The popup shows the countdown status in `HH:MM:SS` format.
- The countdown status refreshes at least once per second while the popup is
  open, using the stored end timestamp to show the current remaining time.
- The popup can show non-completed task status, including each task's title,
  start time, and scheduled end time.
- Task cards use the stored task color as their background color.
- Extended task end text uses the same white style as the start time.
- The popup includes an informational tooltip explaining browser notifications.
- The silent-notifications setting is persisted.
- The pause/resume control targets the current active, extended, or paused task
  and is disabled when no such task exists.
