## Todo Extension Requirements

### 1. Product Scope and App Page

- The extension shall provide a standalone app page bundled inside the extension and opened through a `chrome-extension://` URL. It must work without internet access or external hosting.
- The extension shall support Chrome and Microsoft Edge on desktop. Mobile browsers are out of scope.
- The app shall combine three separate areas: Notes, a calendar/schedule manager, and time-management tools.
- Notes shall be independent from calendar events and tasks.

### 2. Notes and Text Boxes

- Users shall be able to create, rename, switch between, and delete multiple independent notes.
- Each note shall have a user-editable title displayed in its header, replacing the current `NOTE` label.
- Each note shall support one or more text boxes. Text boxes shall be independently resizable using dimensions similar to the current implementation; resizing one must not resize neighboring boxes.
- Text boxes shall support collapsing and expanding. A collapsed text box shall show only its title/header, and expanding it shall restore its content and saved dimensions.
- Text boxes shall be reorderable vertically within a note using a dedicated drag handle. The order shall persist after refresh and browser restart.
- The extension shall remove unnecessary whitespace above the page-level `NOTES` heading while preserving readable spacing and alignment.
- Users shall be able to delete any note, including notes with no content. Deleting a note shall require confirmation or an undo option.

### 3. WYSIWYG Editor and Appearance

- The note editor shall use a proven WYSIWYG editing library rather than implementing rich-text editing from scratch. The selected library must work in a bundled Chrome/Edge extension page and support local/offline use.
- The editor toolbar shall support, at minimum, bold, italic, underline, font family, font size, text alignment, undo, redo, text color, and highlight color.
- Formatting shall behave like a word processor: when text is selected, it applies to the selection; with no selection, it applies at the cursor/current typing position.
- The default font for newly created text and text boxes shall be **Handlee**. Existing formatting must not be overwritten when the default changes.
- Text color shall use a standard color-picker UI with a visible preview and support hexadecimal `#RRGGBB` values. The chosen color shall apply to selected text or the current typing position.
- The default highlight color shall be dark blue and shall remain customizable through the color-picker UI.
- Invalid hexadecimal input shall show a clear validation state without replacing the last valid color.

### 4. Clock, Stopwatch, and Laps

- The clock panel shall be fixed on the left side of the configured web page while the user scrolls. The configured page defaults to `example.com` and shall be editable in the extension popup.
- The clock panel shall be movable and independently adjustable in height and width.
- The stopwatch shall provide start, pause, resume, reset, and lap controls.
- Each lap shall include a lap number, elapsed time, and editable user description.
- A setting shall control whether the clock panel appears only on the configured page or on all supported web pages.

### 5. Calendar, Tasks, and Reminders

- The extension shall provide a calendar/schedule management view with events and tasks that have a title, optional description, start date/time, end date/time, and customizable color.
- At task creation, users shall choose either **Start now** or **Schedule for later**. Scheduled tasks shall allow the user to define both start and end times.
- Multiple tasks may overlap and shall remain independently visible and editable.
- The schedule shall display a 30-minute time-axis for reference, while allowing exact times such as `5:47`.
- A task started immediately shall display from its actual start time. A task may be ended manually, which records the end time at the moment the user chooses **Finish task**.
- Active tasks shall display a box spanning from their start time to the current time. Completed tasks shall display from their start time to their recorded end time. Empty periods shall remain blank.
- Task completion shall be available through a context menu and an equivalent standard keyboard action. It shall also be usable on devices or contexts where right-click is unavailable.
- Users shall receive a reminder at the start time and another reminder at the end time of scheduled tasks.
- Reminders shall use an on-page overlay injected into supported web pages. The overlay shall not block normal page interaction and shall include an accessible text/state equivalent.
- The reminder overlay shall animate using an alarm-clock emoji that grows, vibrates, shrinks, and becomes invisible. Users shall be able to dismiss it.
- At the scheduled end time, the reminder overlay shall display the task and provide clearly labeled actions to **Mark complete** or **Mark delayed**.
- **Mark complete** shall change the task to completed and record the actual completion date and time. The completion time shall be displayed in the task details and remain editable later.
- **Mark delayed** shall keep the task incomplete, record that it was delayed, and provide a way to set a new start time and end time. The user shall be able to dismiss the reminder without choosing an action and make the completion or delay decision later from the task details.
- Users shall be able to mark a task complete later from the calendar or task details, enter or edit its actual completion date and time, and review the scheduled end time alongside the actual completion time.
- A task shall not be treated as completed solely because its scheduled end time has passed. Until the user confirms completion, it shall remain active or require an explicit overdue/delayed state.
- Timer and task timing shall continue in the background when the user navigates away, changes tabs, closes the app page, or reloads a page. The extension shall use persisted timestamps and the browser's extension alarm capabilities rather than relying only on an open page timer.
- The extension shall remain extension-only and shall not require a desktop companion application or external service. While the browser is running, scheduled reminders shall be delivered at their scheduled times through the on-page overlay. If the browser is completely closed, task and timer data shall remain persisted; when the browser starts again, the extension shall detect missed reminders and present them to the user.
- The schedule shall identify current, upcoming, active, and completed tasks and remain usable without horizontal scrolling.

### 6. Extension Controls and Persistence

- The extension popup shall include an enable/disable control and a field for the configured page URL, defaulting to `example.com`.
- The current enabled state and configured URL shall persist across browser restarts.
- Disabling the extension shall stop injected UI and reminders without deleting notes, calendar data, timers, settings, or preferences. Re-enabling shall restore them.
- The extension shall store data in browser storage with global scope. Notes, schedules, timers, settings, and other user data shall not be separated by web page.
- The extension shall avoid injecting duplicate UI when navigating, refreshing, or revisiting a page.
- Users shall be able to export and import data as separate categories: notes, schedules/calendar events, settings, and timers. Users shall also be able to export/import one combined backup containing all categories.
- Import shall validate the file format, report invalid data clearly, and provide a choice to replace existing data or merge it where supported.

### 7. Usability and Accessibility

- Controls shall have clear labels or accessible names, including drag handles, color pickers, timer controls, collapse controls, task menus, reminder overlays, and the enable/disable toggle.
- Core actions shall support standard keyboard shortcuts and keyboard navigation with visible focus states, including formatting, moving between text boxes, collapsing notes, completing tasks, and dismissing reminders.
- Text and controls shall remain readable and usable at supported desktop viewport sizes.
- Animations shall be reduced or disabled when the user has enabled a reduced-motion preference.
- The extension shall inject its own isolated container and must never replace, clear, rewrite, or interfere with the host page's existing DOM content or controls.

### Definition of Done

- The standalone `chrome-extension://` app works offline in Chrome and Edge desktop.
- Users can create, edit, reorder, resize, collapse, and delete independent notes without affecting calendar data.
- Notes, settings, schedules, timers, ordering, collapsed state, dimensions, and colors survive refreshes and browser restarts.
- Background task timing produces start and end reminders while the browser is running, even when the app page is closed or the user is on another supported page. Tasks and timers remain persisted while the browser is closed, and missed reminders are detected after browser restart.
- Reminder overlays, task overlap, exact start/end times, import/export, and enable/disable behavior are manually verified.
- End-time reminders provide working complete and delayed actions, preserve incomplete tasks when delayed, and record editable actual completion times.
- The extension does not replace or interfere with host-page content and does not inject duplicate UI.
- Focused tests or documented manual test steps cover WYSIWYG formatting, color editing, note operations, task scheduling, overlapping tasks, background timing, reminder dismissal, import/export, and reduced-motion behavior.
