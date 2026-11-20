# Offline Workspace Requirements

This document describes the functionality implemented by **Offline Workspace**
as of October 31, 2026. It is a current-state specification of the extension,
not a list of planned features.

## 1. Product and platform

- The product name is **Offline Workspace**.
- The extension uses Manifest V3 and is intended for desktop Chrome and Edge.
- The extension contains:
  - `popup.html` and `popup.js` for the browser action popup.
  - `app.html`, `app.js`, and `styles.css` for the full workspace.
  - `background.js` as the Manifest V3 service worker.
- User data is stored in the browser's `chrome.storage.local` area.
- Data is global to the extension and is not separated by website, tab, or
  browser origin.
- Notes, tasks, timers, theme settings, recent fonts, and calendar settings do
  not require an external server or cloud account.
- The extension requests storage, alarms, and notifications permissions only.
- The extension does not require access to or rewrite host-page content.
- Users can silence browser notifications without disabling timers, task alarms,
  or task scheduling.

## 2. Workspace shell and navigation

The full workspace is opened from the browser popup and contains three tabs:

1. **Calendar**
2. **Notes**
3. **Time tools**

- The Calendar tab is active and visible when the workspace first loads.
- The selected tab controls which workspace section is visible.
- Switching between Calendar, Notes, and Time tools uses a brief fade-and-rise
  transition, and the active tab indicator transitions smoothly.
- The Calendar page uses the motto **Plan the day** and the title
  **Calendar and tasks**.
- The Notes page uses the motto **Write freely** and the title **Notes**.
- The Time tools page uses the motto **Keep momentum** and the title
  **Time tools**.
- The workspace header displays Offline Workspace branding, a theme toggle,
  and an Import/Export menu.
- The Offline Workspace title uses a bold, clean sans-serif display treatment
  in the workspace and browser popup.
- The workspace Settings button/menu has been removed.
- The workspace uses the current theme and persisted state when it loads.
- Status messages appear in the workspace status region when an operation
  reports a result or validation error.

## 3. Notes

### 3.1 Note management

- Users can create multiple notes with the **+ New Note** button.
- Every note has an editable title.
- The sidebar lists all notes.
- Selecting a note displays that note's text boxes in the editor area.
- The selected note is visually distinguished from unselected notes.
- Each note row includes a red trash button.
- Deleting a note requires confirmation.
- The final remaining note cannot be deleted; an explanatory status message is
  shown instead.
- Notes, titles, text boxes, ordering, and formatting are persisted in
  `chrome.storage.local`.

### 3.2 Text boxes

- A note can contain multiple text boxes.
- The active note's top bar contains the note title and an **+ Add Text Box**
  button.
- Each text box has an editable title.
- Each text box has a content-editable WYSIWYG editor.
- Pasting text into a text box inserts plain text without clipboard formatting.
- Pasting an image file, screenshot, or copied web image into a text box
  inserts it as a resizable image.
- Pasted images can be selected to show eight resize handles and resized
  horizontally or vertically within the text box. Their resized dimensions are
  persisted with the text-box content.
- Pressing Backspace or Delete while a pasted image is selected removes it.
- Text boxes can be deleted from their toolbar.
- Text boxes can be collapsed and expanded.
- Text boxes can be reordered vertically by dragging their six-dot drag handle.
- Dragging displays a dashed insertion placeholder.
- Dragging preserves the stored block identifiers and saves the resulting order.
- Text-box content, title, order, width, height, collapsed state, font, and
  color-related settings are persisted.
- Text boxes use saved width values and a saved minimum height.
- Typing content updates the saved height based on the editor's scroll height.
- New text boxes start with an empty editor, the title **Text box**, Arial font,
  and the default saved dimensions.
- The editor displays **Start typing...** when empty.

### 3.3 Editor shortcuts and toolbar

The WYSIWYG toolbar provides:

- Bold
- Italic
- Underline
- Bulleted list
- Numbered list
- Font family
- Font size
- Text color
- Highlight color
- Collapse/expand
- Delete text box

Typing shortcuts are supported:

- `# ` at the start of a line converts the line to an H1.
- `* ` or `- ` at the start of a line starts a bulleted list.
- `1) ` or `1. ` at the start of a line starts a numbered list.

### 3.4 Fonts

- The font selector includes common system fonts and additional named fonts.
- Font options are displayed using their own font where the browser supports
  that preview.
- The font selector includes Arial, Calibri, Cambria, Candara, Comic Sans MS,
  Consolas, Courier New, Georgia, Helvetica, Impact, Inter, Lucida Console,
  Lucida Sans, Merriweather, Monaco, Montserrat, Nunito, Palatino, Roboto,
  Segoe UI, Tahoma, Times New Roman, Trebuchet MS, Verdana, and Handlee.
- Up to eight recently used fonts are persisted.
- Recently used fonts are placed before the remaining font options without
  duplicates.
- Choosing a font records it as recently used.
- Selecting text or placing the caret in formatted text attempts to synchronize
  the font selector with the browser's reported font name.
- Font behavior depends on browser support for `document.execCommand` and
  `queryCommandValue`.

### 3.5 Editor colors

- Text color and highlight color use native browser color inputs.
- The default text color comes from workspace settings.
- The default highlight color is dark blue.
- User-selected text colors are retained for the text box when they are used.
- Custom text colors are tracked only while they are still represented in the
  saved HTML.

## 4. Stopwatch and laps

- The Stopwatch appears in the Time tools tab.
- The stopwatch starts at `00:00:00`.
- It supports Start, Pause, Resume, and Reset.
- The display uses `HH:MM:SS` format.
- A Lap button records the elapsed time at that moment.
- Every lap has an editable description.
- Reset clears the elapsed time and all lap records.
- Stopwatch elapsed time, running state, and lap descriptions are persisted.
- The display updates once per second while the workspace is open.
- Stopwatch state remains stored when the workspace is closed or reloaded.

## 5. Countdown

- The Countdown appears in the Time tools tab.
- It has separate numeric inputs for hours, minutes, and seconds.
- The inputs default to zero.
- Minutes and seconds are entered as non-negative values, with seconds limited
  to 0 through 59.
- The Countdown display starts at `00:00:00`.
- The display uses `HH:MM:SS` format.
- Start begins a single countdown when the entered duration is greater than zero.
- Reset clears the active countdown and its alarm state.
- A second countdown cannot be started while one is already active.
- Countdown state is persisted using an end timestamp.
- The service worker schedules the countdown alarm so the countdown can finish
  when the workspace page is closed.
- When the countdown reaches zero, the service worker marks it as alarm-active
  and processes the corresponding alert according to
  [`popuprequirements.md`](./popuprequirements.md).
- Invalid or zero-duration countdowns are rejected with a workspace status
  message.

## 6. Tasks and task form

### 6.1 Task data

Each task stores:

- A unique identifier
- Title
- Color
- Local start timestamp
- Local scheduled end timestamp
- Status
- Optional actual completion timestamp
- Optional reminder state
- Optional original timestamps used when later tasks are shifted around an
  extended task
- Optional pause state and an ordered list of pause intervals, each with a
  start and end timestamp

Task statuses include:

- `scheduled`
- `active`
- `paused`
- `extended`
- `completed`

### 6.2 Creating and editing tasks

- The Calendar page has a **+ New task** button.
- The task form contains:
  - Title
  - Color
  - Start time
  - End time (required for tasks that start immediately)
  - Save task
  - Cancel
- The form does not show start-date or end-date fields.
- The form does not show Start now or Schedule later radio options.
- New tasks use the current local day automatically.
- Start and end times are entered as clock text with compact, vertically stacked
  AM/PM radio buttons.
- The start-time field is required.
- When the new-task form opens, the start time defaults to the current local
  time.
- The end-time field is required when the task starts immediately and optional
  for a task scheduled to start later.
- The end-time field has no placeholder or prefilled time when the new-task form
  opens.
- If the end-time field is blank for a later-scheduled task, the task end is
  automatically set to one hour after the entered start time.
- When a new-task form opens, both AM/PM radio groups default to the current
  local period: AM in the morning and PM in the afternoon or evening.
- If the entered start time is the current local minute, the new task is
  created as active and starts immediately.
- If the entered start time is later than the current local time, the new task
  is created as scheduled.
- New tasks may have a start time earlier than, equal to, or later than the
  current time.
- Existing tasks can be opened by clicking their calendar event.
- Task details use a modal-style editor layout with a colored task badge,
  grouped title/color controls, a schedule card, a scheduled-breaks section,
  and a separate action footer.
- The task editor matches the dark reference layout: compact header with close
  control, uppercase field labels, rounded dark inputs, a schedule summary pill,
  compact break rows, and colored footer actions.
- The task-details action footer places Delete Task on the left and Cancel,
  pause/resume, finish, and Save Task controls on the right.
- Editing an existing task uses the task's stored local day and populates its
  stored start and end times.
- Editing does not expose date fields.
- Saving an edit updates the task's title, color, start, and end values while
  preserving its existing task identity.
- Task details allow adding, editing, and removing break intervals.
- A break interval must have an end after its start, must remain within the
  task's scheduled start and end, and cannot overlap another break. If an
  unfinished task has passed its scheduled end, the current time is the
  allowed upper bound instead.
- Break intervals are persisted with the task and do not change its scheduled
  start or end.
- When a scheduled break start time arrives for an active task, a browser
  notification appears with "It's time to take a break" and Begin / Cancel
  buttons. Begin starts the break as scheduled (pausing the task), while Cancel
  does not start the break and removes that break from the task schedule.
- When a scheduled break end time arrives, a browser notification appears displaying
  "Time to resume [Task Name]" with Resume / Snooze buttons provided the task is active.
  Resume returns the task to active work; Snooze continues the break and triggers the
  notification again every 5 minutes until the user clicks resume.
- The title is required.
- Invalid time text, invalid AM/PM combinations, or missing required values
  produce a status message.
- The end time must be after the start time.
- Tasks cannot cross local midnight.
- Tasks cannot have a duration of one day or longer.
- Tasks cannot overlap another non-completed task.
- Task validation errors prevent saving.

### 6.3 Task colors

- The task form provides standard color swatches:
  - Dark Red
  - Red
  - Orange
  - Yellow
  - Light Green
  - Green
  - Teal
  - Blue
  - Dark Blue
  - Purple
- The selected standard color is visibly highlighted.
- A **Choose custom color** button opens the browser's native color picker.
- Standard and custom colors are stored in the task's `color` field.
- Task events use the stored task color.
- Invalid stored task colors fall back to the default blue task color.

### 6.4 Completing and deleting tasks

- Clicking a task opens its details at the top of the Calendar page.
- Task details display the scheduled time and, when available, the actual end
  time.
- An unfinished task always has a **Finish Task** button.
- Clicking **Finish Task** ends the task at the exact current time, regardless
  of the scheduled end time shown in the form.
- Finishing a task changes its status to completed, updates its effective end
  time, and stores its actual completion time.
- A completed task no longer shows the Finish Task button.
- An active or extended task can be paused from the browser popup or task
  details. Pausing records the exact pause timestamp and does not complete the
  task.
- A paused task can be resumed from the browser popup or task details.
- Resuming records the pause interval's exact end timestamp. A paused task
  remains unfinished until the user finishes it.
- Clicking **Delete task** asks for confirmation before removing the task.
- The task delete control uses the same compact red trash button as note
  deletion.
- Deleted tasks are removed from persisted state and subsequent calendar,
  popup, chart, and export output.

## 7. Calendar

### 7.1 Calendar view

- The Calendar tab displays the current local day.
- The calendar has a vertical time axis.
- Grid lines and labels use 30-minute intervals.
- The calendar scale is 2 pixels per minute, or 60 pixels per 30 minutes.
- Task positions and heights use exact minute values rather than rounding task
  boxes to grid lines.
- The current time is shown with a current-time marker.
- The calendar body is vertically scrollable.
- Calendar scroll position is preserved when the calendar rerenders.
- The calendar rerenders periodically while open.

### 7.2 Automatic visible start

- The visible end of the calendar is fixed at 11:59 PM.
- There is no visible-end textbox and no draggable calendar boundary.
- The automatic visible start is calculated from the current local time rounded
  down to the preceding 30-minute boundary, capped at 8:00 AM.
- The earliest valid task start on the current local day is also rounded down to
  its preceding 30-minute boundary.
- The calendar chooses the earlier of the current-time boundary, the earliest
  current-day task boundary, and 8:00 AM.
- For example, at 7:28 AM with a task starting at 6:01 AM, the calendar starts
  at 6:00 AM rather than 7:00 AM so the task is visible.
- At 12:41 AM without an earlier task, the automatic start is 12:30 AM.
- At 12:59 AM without an earlier task, the automatic start is 12:30 AM.
- At 12:01 AM without an earlier task, the automatic start is 12:00 AM.
- The Day start control in the calendar header allows the user to enter a
  different start time with a clock textbox and AM/PM selector.
- A manually selected start time takes precedence over the automatic
  calculation during the current extension session. The automatic start is
  calculated in memory when the extension is first opened for the day and is
  not stored as a day-specific value.
- If the visible start is 11:59 PM, the calendar body is omitted rather than
  rendering an invalid range.

### 7.3 Task event display

- Tasks are clipped to the configured visible start and 11:59 PM for display.
- Clipping does not modify task data.
- Tasks outside the current local day are not displayed in that day's calendar.
- Scheduled task events use the task's selected color for their fill and side
  accent.
- Completed task events use a green side accent.
- Extended task events retain the original user-selected fill color.
- Extended task events replace only the left side accent with a solid red bar.
- Extended task events do not use a dashed border.
- Task event labels show the task title and displayed start/end times.
- Worked portions of a task use the task color as a solid fill.
- Pause portions use transparent space with diagonal light-grey lines, from
  the exact pause timestamp through the exact resume timestamp (or through
  the current time while still paused).
- Clicking or keyboard-activating a task event opens its task details.

### 7.4 Extended tasks and later tasks

- At a task's scheduled end, if it has not been finished, the task enters
  extended status.
- The red extended styling appears when the task enters extended status.
- An extended task grows toward the current time while the workspace is
  rendered.
- The extended task continues until the user clicks its task event and clicks
  Finish Task.
- While an extended task grows, later non-completed tasks are shifted forward
  by the amount of overtime so they do not overlap the extended task.
- Later task durations are preserved when their start and end timestamps shift.
- Original later-task timestamps are retained for the shifting calculation.
- Extended tasks stop at the end of their local day; an extended task that
  reaches the end of the day is completed at 11:59:59 PM.
- The service worker performs the same extension and shifting logic on its
  periodic task-extension tick.

### 7.5 Task color pie chart

- An **Activity Breakdown** donut chart is placed below the calendar.
- The chart header displays today's total tracked time and a Live Sync indicator.
- The donut center displays the total tracked duration and the label
  **Total tracked**.
- Donut slices are separated by dark rounded gaps and grow slightly on hover.
- Hovering a slice replaces the center content with that slice's elapsed time,
  category name, and percentage; moving away restores the total tracked view.
- It is populated while the Calendar view is rendered and is not shown in the
  Notes or Time tools sections.
- The chart is empty when there are no valid task durations.
- When there are no valid task durations, the chart displays a grey pie with
  horizontal white text reading **No day breakdown to display** and a white
  border. Populated donuts do not have an outer border.
- The chart includes elapsed time from active, paused, extended, completed, and
  scheduled tasks whose start time has arrived. Future scheduled tasks and
  explicitly delayed tasks that have not started do not appear.
- Each task contributes its elapsed task window, ending at its actual completion
  time or the current time while active, paused, extended, or scheduled after
  its start time has arrived.
- Each task's recorded pause minutes are removed from its color contribution.
- If any task has a pause, the chart adds a **Break** category containing the
  total pause minutes for the day. Its pie area is transparent with diagonal
  light-grey lines.
- Each color's percentage is its total worked duration divided by the total
  worked and break duration of all included tasks.
- The Break legend entry displays the total break share using the same
  percentage format as color entries.
- For example, three hours of red tasks and one hour of blue tasks produce a
  75% red and 25% blue chart.
- The legend uses the standard color names from the task form.
- A non-standard color is labeled with the associated task name or names.
- The chart includes a colored legend marker and percentage for each color.
- The chart's current-day time window begins at the starting time of the first
  included task and ends at the current time. It represents time that has
  already occurred, not the full planned duration of future tasks. For
  example, a task scheduled from 4:00 PM to 9:00 PM contributes only about
  one minute when the current time is 4:01 PM.
- The chart legend displays each task's elapsed worked time in hours and
  minutes. Total break time is also displayed when breaks exist.
- The legend uses one bordered row per task, showing its color, title,
  percentage, and elapsed duration. Breaks use a diagonal stripe swatch and
  are shown as **Breaks**.

### 7.6 Previous-day cleanup

- Tasks whose start date is before the current local day are automatically
  deleted rather than merely hidden.
- A background alarm runs at each local midnight so previous-day tasks are
  deleted even when the workspace is closed.
- Cleanup occurs when the workspace state loads.
- Cleanup also occurs before calendar rendering.
- The service worker performs the same cleanup before recreating alarms.
- Removed previous-day tasks are deleted from persisted Chrome storage and no
  longer appear in the calendar, popup, pie chart, exports, notifications, or
  background scheduling.
- Tasks with invalid start dates are not removed by this date cleanup alone.

## 8. Popup and notification behavior

All popup triggers, popup destinations, popup content, popup controls, and
popup-specific task status are defined in
[`popuprequirements.md`](./popuprequirements.md). This document intentionally
does not repeat those requirements or define an alternative popup behavior.

The browser action popup provides a **Finish task** button for active tasks,
allowing them to be completed without opening the workspace.

The remaining requirements in this document describe workspace, persistence,
calendar, and background implementation behavior independently of popup
presentation.

## 9. Theme and appearance

- The extension supports Dark and Light themes.
- The workspace header has a theme toggle.
- Theme state is stored in `chrome.storage.local`.
- The light theme background is `#f7f6f2`.
- The dark theme background is `#020011`.
- Theme-sensitive colors transition over 0.3 seconds.
- Theme transitions do not intentionally re-render the workspace layout.
- The workspace uses rounded buttons with a lower visual shadow and pressed
  movement where appropriate.
- WYSIWYG toolbar buttons are flat and do not have a shadow.
- Specialized controls such as tabs, drag handles, note trash buttons, color
  swatches, and custom color controls suppress the general button shadow where
  appropriate.
- The Notes sidebar has a transparent background and no vertical divider.
- The light workspace header spans the viewport width and has the configured
  light-theme header treatment.
- A saved background image URL can still be applied when present in imported
  settings or persisted state.
- Applied background images are centered, non-repeating, fixed, and scaled
  with `cover`.
- The current workspace UI does not provide a visible Settings menu or
  background-image entry form.

## 10. Import and export

The Import/Export menu provides separate controls for:

- Combined backup
- Notes
- Schedules/tasks
- Settings
- Timers

Export behavior:

- Exports are JSON downloads.
- A combined backup contains the current workspace state.
- Notes export contains the notes collection.
- Schedules export contains the tasks collection.
- Settings export contains settings data.
- Timers export contains stopwatch and countdown data.

Import behavior:

- Imports read a selected JSON file.
- Invalid JSON is rejected with a status message.
- Combined imports merge the imported top-level state with the current state and
  merge imported settings with current settings.
- Category imports update the selected category.
- Settings imports apply the imported theme and background-image state.
- Timer imports replace the stopwatch/countdown values when present.
- Missing category data is reported as an import error.
- Imports are persisted to `chrome.storage.local` and trigger a workspace
  rerender.
- Imports do not provide a replace-versus-merge choice.

## 11. Persistence and live synchronization

- Workspace state is persisted using granular keys in `chrome.storage.local`:
  `notes`, `tasks`, `stopwatch`, `countdown`, `settings`, and `calendar`.
- Persisted state includes notes, tasks, stopwatch data, countdown data,
  settings, recent fonts, custom text-box colors, and calendar start settings.
- The workspace listens for storage changes across open tabs, the popup, and the
  service worker.
- External state changes update in-memory state and refresh the workspace so
  that multiple open tabs always display current data.
- Theme changes are applied when synchronized state changes.
- Stopwatch and countdown displays update every second while the workspace is
  open.
- The calendar refreshes periodically while open.
- The service worker recreates relevant alarms after installation, startup, and
  state changes.

## 12. Background service-worker behavior

- Installation schedules persisted tasks, breaks, and countdowns.
- Browser startup schedules persisted tasks, breaks, and countdowns and checks for missed
  reminders.
- Storage changes cause task, break, and countdown alarms to be rebuilt.
- Existing task-start, task-end, task-break-start, task-break-end, task-extension, and countdown alarms are
  cleared before rebuilding.
- Completed tasks do not receive future task or break alarms.
- Disabled extension state prevents task, break, and reminder scheduling.
- Extended tasks receive a periodic extension tick.
- Active break snoozes repeat every 5 minutes until the task is resumed.
- Countdown alarms clear or recreate correctly when a countdown starts or resets.
- Background task actions update shared storage and reschedule affected alarms.
- Timer, break, and task alerts use browser system notifications and do not require
  website host permissions or injected content scripts.
- Background failures are logged to the service worker console.

## 13. Current limitations and intentionally unsupported behavior

The following are not implemented:

- Dragging calendar start or end boundaries.
- A user-editable calendar end time.
- Cross-midnight tasks.
- A cross-midnight divider or after-midnight calendar section.
- Multiple simultaneous countdowns.
- A per-website workspace.
- External synchronization or cloud storage.
- Access to all websites or injected active-page reminder overlays.
- A workspace Settings menu.
- A visible workspace control for entering a background-image URL.
- Replace-versus-merge import selection.
- Automatic task deletion based on end date alone; cleanup is based on the
  task's start date being before the current local day.
- A task-overlap display mode; task validation rejects overlaps for new and
  edited tasks.

## 14. Definition of done for the current implementation

- The extension loads as Offline Workspace in desktop Chrome or Edge.
- The extension can enable or disable notifications and open the
  workspace.
- The workspace opens on Calendar and provides Calendar, Notes, and Time tools
  tabs.
- Notes can be created, selected, titled, formatted, reordered, collapsed, and
  deleted with state persisted locally.
- Font selection includes previews and persisted recently used fonts.
- Tasks can be created with title, color, start time, and optional end time.
- A task entered for the current local minute is created as active; other task
  start times are created as scheduled, including start times in the past.
- Tasks can be edited, finished at the current time, and deleted.
- The calendar displays exact-time task boxes on a scrollable 30-minute grid.
- Calendar automatic start calculation keeps every current-day task visible.
- Extended tasks retain their fill color and use a solid red side bar.
- Later tasks shift forward while an extended task grows.
- Previous-day tasks are removed from stored state and all extension surfaces.
- The task-color pie chart reflects current-day task duration by color.
- The stopwatch, laps, and countdown operate and persist through reloads.
- Dark and Light themes synchronize across the extension.
- Notes, tasks, settings, and timers can be imported and exported as JSON.
- The extension does not require or intentionally rewrite host-page content.
