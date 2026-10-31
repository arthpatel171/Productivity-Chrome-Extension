# Offline Workspace Requirements

This document describes the functionality currently implemented by the extension as of
October 31, 2026. It is a current-state specification, not a list of planned features.

## 1. Product and platform

- The product name is **Offline Workspace**.
- The extension is a Manifest V3 Chrome/Edge desktop extension.
- The bundled workspace is opened from `app.html` through the extension popup.
- User data is stored globally in `chrome.storage.local`; it is not separated by website.
- The extension does not require an external server for notes, tasks, timers, or settings.
- Content scripts are excluded from `example.com` and `www.example.com`.

## 2. Workspace areas

The workspace has three tabs:

1. **Calendar**
2. **Notes**
3. **Time tools**

The workspace opens to the Calendar tab when loaded. The current tab is selected in the workspace UI. Notes, tasks, stopwatch data,
countdown data, and settings are stored together in the persisted workspace state.

## 3. Notes

- Users can create multiple notes.
- Each note has an editable title.
- Notes can be selected and deleted. Deleting a note requires confirmation, and the
  final remaining note cannot be deleted.
- Each note can contain multiple text boxes.
- The Notes page is labeled “Write freely” and “Notes.”
- The Notes sidebar has a transparent background and no divider line, with a
  “+ New Note” button, note selection buttons, and a red trash button for each
  note.
- The active note editor shows the note title and an “+ Add Text Box” button in
  its top bar.
- Text boxes have editable titles and can be deleted.
- Text boxes can be reordered vertically using their drag handle.
- Text boxes can be collapsed and expanded.
- Text boxes save their content, order, width, height, collapsed state, font, and
  color-related settings.
- Text boxes use a content-editable WYSIWYG editor.
- Text boxes use saved width and height values and grow their saved height with
  their content.
- Typing `# ` at the beginning of a line converts the line to an H1.
- Typing `* ` or `- ` starts a bulleted list.
- Typing `1) ` or `1. ` starts a numbered list.

## 4. Editor and formatting

The editor toolbar currently provides:

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

Font behavior:

- The font list includes common system fonts and additional named fonts.
- Each font option is previewed using that font.
- Up to eight recently used fonts are persisted and placed before the remaining
  font options without duplicates.
- Selecting text or placing the caret in formatted text synchronizes the font
  dropdown when the browser exposes the selected font.
- New text boxes default to Arial.

Color behavior:

- Text and highlight colors use color inputs.
- The default text color comes from the workspace settings.
- The default highlight color is dark blue.
- User-selected colors are retained for the text box when they are used.
- Invalid custom hexadecimal text entry is not separately supported because the current
  controls use the browser's native color input.

## 5. Stopwatch and laps

- The stopwatch supports start, pause, resume, reset, and lap.
- Each lap records its elapsed time.
- Each lap has an editable description.
- Stopwatch state and lap data are persisted.
- Stopwatch display updates while the workspace is open.

## 6. Countdown

- The countdown has separate hour, minute, and second inputs.
- The inputs default to zero.
- The countdown supports start and reset.
- The countdown display uses `HH:MM:SS` format and starts at `00:00:00`.
- Countdown state is persisted using timestamps.
- The countdown continues through the background service worker when the workspace page
  is not open.
- When the countdown reaches zero, the background service worker sends an alert to the
  active tab.
- The active-tab alert is an alarm emoji overlay. Clicking it dismisses the overlay
  and records dismissal for that countdown occurrence.
- The extension popup displays the remaining countdown time.

## 7. Tasks and calendar

Each task can contain:

- Title
- Optional description
- Color
- Start date and time
- End date and time
- Status
- Actual completion time when finished

Task creation and editing:

- The end-time field is optional. Its placeholder shows one hour after the
  current time, and leaving it blank sets the end time to one hour after the
  entered start time.
- Task colors offer standard color swatches and a custom color picker button.
- Start and end times are entered as clock text with a separate AM/PM selector.
- New tasks use the current local day; the start and end date fields are not
  shown.
- If the entered start time is the current minute, the task starts immediately.
  If it is later than the current time, the task is scheduled for later.
- Start time defaults to the current local time when the new-task flow is opened.
- The end time must be after the start time.
- Tasks must begin on or after the current time when scheduled.
- Tasks cannot cross local midnight.
- Tasks with invalid dates, an end before the start, or a duration of one day or
  longer are rejected with a status message.
- Existing tasks can be opened from the calendar and edited.
- A task can be finished manually from its task details.
- A task can be deleted from its task details after confirmation.

Calendar display:

- The Calendar tab displays the current local day.
- A pie chart appears below the calendar while the Calendar tab is open when
  tasks exist. It groups all valid tasks, whether scheduled, active, extended,
  or completed, by task color and assigns each color a percentage based on the
  task's scheduled duration. For example, three hours of red tasks and one
  hour of blue tasks produce a 75% red and 25% blue chart. The chart legend uses
  the standard color names from the task form, and labels non-standard colors as
  custom colors.
- The calendar has a vertical time axis and 30-minute grid intervals.
- The current time is shown with a current-time marker.
- The timeline uses 2 pixels per minute, or 60 pixels per 30-minute interval.
- Task positions and heights use exact minute values rather than rounding to grid
  lines.
- Tasks are clipped to the configured visible start and the end of the day for
  display; clipping does not modify task data.
- The calendar body is vertically scrollable.
- The visible start defaults to the current local time rounded down to the
  preceding 30-minute boundary when it is earlier than 8:00 AM; otherwise it
  defaults to 8:00 AM. For example, 12:41 AM displays a 12:30 AM start. It can
  be changed with a time textbox and
  AM/PM selector in the calendar header.
- The visible end is fixed at 11:59 PM; there is no end-time textbox or draggable
  boundary control.
- If the visible start is 11:59 PM, the calendar body is omitted rather than showing
  an invalid end-time error.

Task timing and reminders:

- Scheduled tasks use persisted timestamps and browser alarms.
- A task remains active after its scheduled end until the user chooses an action.
- One minute after a scheduled end is reached, the active tab receives a reminder
  overlay with **Finish** and **Extend** actions, and the task enters extended
  status if it is not finished.
- When a scheduled task starts, the active tab receives a reminder overlay with a
  **Dismiss** action. Dismissing this start reminder removes the overlay without
  changing the task's status or schedule.
- Finish marks the task completed and records the actual end time.
- Extend marks the task extended. An extended task continues to grow toward the
  current time while the workspace is rendered.
- Ending an extended task records its actual completion time.
- Extended tasks cause later task times to be shifted and persisted to avoid overlap,
  while preserving later task durations.
- Tasks and their stored times remain persisted when the workspace is closed or
  reloaded.
- Tasks whose start date is before the current local day are automatically
  deleted from persisted workspace state, calendar views, popup data, exports,
  and background scheduling.

## 8. Extension popup

The popup currently provides:

- Offline Workspace branding.
- An enable/disable checkbox.
- An **Open workspace** button.
- A status section showing countdown remaining time.
- A status section showing each non-completed task's title, start time, and scheduled
  end time.
- Extended-task scheduled end times are styled as late.
- A hover/focus tooltip next to the enable checkbox explaining active-page alerts.

The enabled setting is persisted. The popup does not include a configurable website
field or a separate settings page.

## 9. Background alerts and content overlays

- The service worker schedules task start, task end, extended-task tick, and countdown
  alarms.
- Reminder overlays are sent only to the active tab in the last-focused browser
  window.
- Task overlays include the task title and action buttons.
- Countdown overlays can be dismissed by clicking the alarm emoji.
- The content script uses an isolated extension overlay container and does not replace
  the host page's existing content.
- The extension avoids creating duplicate overlay elements in the same page.

## 10. Settings and appearance

- The workspace includes an Import/Export dropdown and a header theme toggle.
- Users can choose between a Dark theme and a Light theme using the header toggle
  button.
- The extension popup also provides a theme toggle button and synchronizes theme changes.
- Theme preferences are saved to extension storage and persist across sessions.
- Theme changes transition smoothly with animated color and background transitions without layout shifts or content re-rendering.
- Users can enter a background image URL.
- Applying a URL stores it in workspace settings and applies it to the whole workspace.
- The background image is centered, non-repeating, fixed, and scaled with `cover`.
- Users can clear the saved background image.
- Background-image status messages are displayed in the workspace status area.

## 11. Import and export

The Import/Export dropdown contains separate controls for:

- Combined backup
- Notes
- Schedules/tasks
- Settings
- Timers

Exports are JSON files. Imports read JSON files, update the corresponding stored
category, and report invalid JSON or missing category data through the workspace
status message.

## 12. Persistence and live updates

- Notes, tasks, timers, settings, recent fonts, text-box state, and calendar start
  time are saved to `chrome.storage.local`.
- The workspace listens for storage changes and refreshes when another extension
  surface changes the shared state.
- The open workspace refreshes stopwatch and countdown displays every second.
- The calendar refreshes periodically while open.
- Background alarms are recreated on installation, startup, and state changes.

## 13. Current limitations

The following are not current requirements because they are not implemented in the
current extension:

- Dragging calendar boundaries.
- A user-editable calendar end time.
- Cross-midnight tasks.
- A cross-midnight divider.
- Multiple simultaneous countdowns.
- A configurable per-website workspace.
- External synchronization or cloud storage.
- Native browser notifications as a replacement for the active-tab overlay.
- Merge-based import; imports update the selected category rather than presenting a
  replace/merge choice.

## Definition of done for the current implementation

- The extension loads as Offline Workspace in Chrome or Edge desktop.
- The popup can enable or disable the extension and open the bundled workspace.
- Notes and text boxes can be created, edited, formatted, reordered, collapsed, and
  deleted, with state persisted locally.
- The calendar can create, edit, finish, extend, delete, and display same-day tasks.
- Calendar tasks use exact times and a scrollable 30-minute grid.
- Stopwatch, laps, and countdown operate and persist through workspace reloads.
- Background alarms deliver task and countdown overlays to the active tab.
- Background images can be applied and cleared.
- Notes, tasks, settings, and timers can be imported and exported as JSON.
- The extension does not intentionally rewrite host-page content outside its own
  overlay.
