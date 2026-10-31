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
  - `content.js` and `overlay.css` for active-page reminder overlays.
- User data is stored in the browser's `chrome.storage.local` area.
- Data is global to the extension and is not separated by website, tab, or
  browser origin.
- Notes, tasks, timers, theme settings, recent fonts, and calendar settings do
  not require an external server or cloud account.
- The content script is injected on all URLs except `example.com` and
  `www.example.com`.
- The extension requests storage, alarms, tabs, and notifications permissions.
- The extension's own workspace and popup do not rewrite host-page content.

## 2. Workspace shell and navigation

The full workspace is opened from the browser popup and contains three tabs:

1. **Calendar**
2. **Notes**
3. **Time tools**

- The Calendar tab is active and visible when the workspace first loads.
- The selected tab controls which workspace section is visible.
- The Calendar page uses the motto **Plan the day** and the title
  **Calendar and tasks**.
- The Notes page uses the motto **Write freely** and the title **Notes**.
- The Time tools page uses the motto **Keep momentum** and the title
  **Time tools**.
- The workspace header displays Offline Workspace branding, a theme toggle,
  and an Import/Export menu.
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
  and sends a countdown alert to the active tab in the last-focused window.
- The active-page countdown alert is a floating alarm emoji.
- Clicking the alarm emoji dismisses the overlay and records the dismissal for
  that countdown occurrence.
- The popup displays the remaining countdown time in `HH:MM:SS` format.
- Invalid or zero-duration countdowns are rejected with a workspace status
  message.

## 6. Tasks and task form

### 6.1 Task data

Each task stores:

- A unique identifier
- Title
- Optional description
- Color
- Local start timestamp
- Local scheduled end timestamp
- Status
- Optional actual completion timestamp
- Optional reminder state
- Optional original timestamps used when later tasks are shifted around an
  extended task

Task statuses include:

- `scheduled`
- `active`
- `extended`
- `completed`

### 6.2 Creating and editing tasks

- The Calendar page has a **+ New task** button.
- The task form contains:
  - Title
  - Color
  - Optional description
  - Start time
  - End time
  - Save task
  - Cancel
- The form does not show start-date or end-date fields.
- The form does not show Start now or Schedule later radio options.
- New tasks use the current local day automatically.
- Start and end times are entered as clock text with separate AM/PM selectors.
- The start-time field is required.
- When the new-task form opens, the start time defaults to the current local
  time.
- The end-time field is optional.
- The end-time placeholder is dynamically set to one hour after the current
  time when the new-task form opens.
- If the end-time field is blank, the task end is automatically set to one hour
  after the entered start time.
- The end-time AM/PM selector is set to match the one-hour placeholder.
- If the entered start time is the current local minute, the new task is
  created as active and starts immediately.
- If the entered start time is later than the current local time, the new task
  is created as scheduled.
- New tasks whose start time is earlier than the current time are rejected.
- Existing tasks can be opened by clicking their calendar event.
- Editing an existing task uses the task's stored local day and populates its
  stored start and end times.
- Editing does not expose date fields.
- Saving an edit updates the task's title, description, color, start, and end
  values while preserving its existing task identity.
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
- Popup task cards use the stored task color as their background color.
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
- Clicking **Delete task** asks for confirmation before removing the task.
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
- A manually selected start time is persisted and takes precedence over the
  automatic calculation.
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
- Clicking or keyboard-activating a task event opens its task details.

### 7.4 Extended tasks and later tasks

- One minute after a task's scheduled end, if it has not been finished, the
  task receives the end reminder and enters extended status.
- The one-minute grace period means the red extended styling does not appear at
  the exact scheduled end time.
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

- A task-color pie chart is placed below the calendar.
- It is populated while the Calendar view is rendered and is not shown in the
  Notes or Time tools sections.
- The chart is empty when there are no valid task durations.
- The chart includes valid current-state tasks regardless of whether they are
  scheduled, active, extended, or completed.
- Each task contributes its scheduled duration, calculated from its stored start
  and scheduled end timestamps.
- Tasks are grouped by their stored color.
- Each color's percentage is its total scheduled duration divided by the total
  scheduled duration of all included tasks.
- For example, three hours of red tasks and one hour of blue tasks produce a
  75% red and 25% blue chart.
- The legend uses the standard color names from the task form.
- A non-standard color is labeled as a custom color and includes its hex value.
- The chart includes a colored legend marker and percentage for each color.

### 7.6 Previous-day cleanup

- Tasks whose start date is before the current local day are automatically
  deleted rather than merely hidden.
- Cleanup occurs when the workspace state loads.
- Cleanup also occurs before calendar rendering.
- The service worker performs the same cleanup before recreating alarms.
- Removed previous-day tasks no longer appear in persisted state, the calendar,
  popup, pie chart, exports, or background scheduling.
- Tasks with invalid start dates are not removed by this date cleanup alone.

## 8. Reminders and active-page overlays

### 8.1 Task reminders

- The service worker schedules task-start and delayed task-end alarms.
- Task-start reminders are delivered only to the active tab in the
  last-focused browser window.
- A start reminder shows the task title, an alarm icon, and a Dismiss button.
- Dismissing a start reminder removes the overlay without changing the task's
  status or schedule.
- One minute after a scheduled end, the end reminder shows the task title and
  Finish and Extend buttons.
- Finish from an overlay ends the task at the current time.
- Extend from an overlay changes the task to extended status and starts the
  extension behavior.
- The overlay is removed after an action is selected.

### 8.2 Countdown overlay

- Countdown completion is delivered only to the active tab in the last-focused
  browser window.
- The countdown completion overlay is an alarm emoji button.
- Clicking it dismisses the overlay and records the dismissal for the current
  countdown occurrence.
- The content script uses a dedicated extension overlay container.
- Existing host-page content is not replaced.
- Duplicate overlay elements are avoided on the same page.
- Pages excluded by the manifest do not receive the content script.

## 9. Browser popup

The browser action popup provides:

- Offline Workspace branding.
- A theme toggle.
- An Enable Extension checkbox.
- An **Open workspace** button.
- A countdown status line using `HH:MM:SS`.
- A task status section for non-completed tasks.

Popup task status:

- Each non-completed task shows its title.
- Each task shows its start time.
- Each task shows its scheduled end time.
- Each task card uses the task's stored color as its background color.
- Extended task end text is marked with the late styling.
- The popup has an informational tooltip explaining active-page alerts.
- The enabled setting is persisted.
- Popup theme changes are synchronized through shared storage.

## 10. Theme and appearance

- The extension supports Dark and Light themes.
- The workspace header has a theme toggle.
- The popup has a theme toggle.
- Theme state is stored in `chrome.storage.local`.
- Theme state is synchronized between the popup and workspace through storage
  changes.
- The light theme background is `#f2f2d4`.
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

## 11. Import and export

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

## 12. Persistence and live synchronization

- Workspace state is persisted in one `todoState` object in
  `chrome.storage.local`.
- Persisted state includes notes, tasks, stopwatch data, countdown data,
  settings, recent fonts, custom text-box colors, and calendar start settings.
- The workspace listens for storage changes from the popup and service worker.
- External state changes refresh the workspace when the user is not actively
  editing a text field or contenteditable editor.
- Theme changes are applied when synchronized state changes.
- The popup listens for workspace state changes and refreshes its status panel.
- Stopwatch and countdown displays update every second while the workspace is
  open.
- The calendar refreshes periodically while open.
- The service worker recreates relevant alarms after installation, startup, and
  state changes.

## 13. Background service-worker behavior

- Installation schedules persisted tasks and countdowns.
- Browser startup schedules persisted tasks and countdowns and checks for missed
  reminders.
- Storage changes cause task and countdown alarms to be rebuilt.
- Existing task-start, task-end, task-extension, and countdown alarms are
  cleared before rebuilding.
- Completed tasks do not receive future task alarms.
- Disabled extension state prevents task and reminder scheduling.
- Extended tasks receive a periodic extension tick.
- Countdown alarms clear or recreate correctly when a countdown starts or resets.
- Background task actions update shared storage and reschedule affected alarms.
- Background failures are logged to the service worker console.

## 14. Current limitations and intentionally unsupported behavior

The following are not implemented:

- Dragging calendar start or end boundaries.
- A user-editable calendar end time.
- Cross-midnight tasks.
- A cross-midnight divider or after-midnight calendar section.
- Multiple simultaneous countdowns.
- A per-website workspace.
- External synchronization or cloud storage.
- Native browser notifications as a replacement for active-tab overlays.
- A workspace Settings menu.
- A visible workspace control for entering a background-image URL.
- Replace-versus-merge import selection.
- Automatic task deletion based on end date alone; cleanup is based on the
  task's start date being before the current local day.
- A task-overlap display mode; task validation rejects overlaps for new and
  edited tasks.

## Definition of done for the current implementation

- The extension loads as Offline Workspace in desktop Chrome or Edge.
- The popup can enable or disable active-page functionality and open the
  workspace.
- The workspace opens on Calendar and provides Calendar, Notes, and Time tools
  tabs.
- Notes can be created, selected, titled, formatted, reordered, collapsed, and
  deleted with state persisted locally.
- Font selection includes previews and persisted recently used fonts.
- Tasks can be created with title, description, color, start time, and optional
  end time.
- Task start time determines immediate versus scheduled status.
- Tasks can be edited, finished at the current time, and deleted.
- The calendar displays exact-time task boxes on a scrollable 30-minute grid.
- Calendar automatic start calculation keeps every current-day task visible.
- Extended tasks retain their fill color and use a solid red side bar after the
  one-minute grace period.
- Later tasks shift forward while an extended task grows.
- Previous-day tasks are removed from stored state and all extension surfaces.
- The task-color pie chart reflects current-day task duration by color.
- The stopwatch, laps, and countdown operate and persist through reloads.
- Background alarms deliver task and countdown overlays to the active tab.
- Popup task cards use their stored task colors.
- Dark and Light themes synchronize between popup and workspace.
- Notes, tasks, settings, and timers can be imported and exported as JSON.
- The extension does not intentionally rewrite host-page content outside its own
  isolated overlay.
