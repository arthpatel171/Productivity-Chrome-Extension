## Todo Extension Requirements

### 1. Product Scope and App Page

- The extension shall provide a standalone app page bundled inside the extension and opened through a `chrome-extension://` URL. It must work without internet access or external hosting.
- The extension shall support Chrome and Microsoft Edge on desktop. Mobile browsers are out of scope.
- The app shall combine three separate areas: Notes, a calendar/schedule manager, and time-management tools.
- Notes shall be independent from calendar events and tasks.
- The extension shall not configure, target, or inject its workspace into `example.com` or any other configured page. The bundled app is opened from its `chrome-extension://` URL; ordinary web pages receive only the reminder overlay when an active alarm requires it.

### 2. Notes and Text Boxes

- Users shall be able to create, rename, switch between, and delete multiple independent notes.
- Each note shall have a user-editable title displayed in its header, replacing the current `NOTE` label.
- Each note shall support one or more text boxes. Text boxes shall be independently resizable using dimensions similar to the current implementation; resizing one must not resize neighboring boxes.
- Text boxes shall grow vertically with their content and shall not impose a fixed height that creates an internal scrolling area while typing.
- Text boxes shall support collapsing and expanding. A collapsed text box shall show only its title/header, and expanding it shall restore its content and saved dimensions.
- Text boxes shall be reorderable vertically within a note using a dedicated drag handle. The order shall persist after refresh and browser restart.
- The extension shall remove unnecessary whitespace above the page-level `NOTES` heading while preserving readable spacing and alignment.
- Users shall be able to delete any note, including notes with no content. Deleting a note shall require confirmation or an undo option.
- There shall be shortcuts to text formatting. If the user types `# ` in the textbox, then that line shall automatically become heading 1. If the user types `* ` or `- `, then it should automatically start a bulleted list starting with the line `* ` or `- ` appears on, with the list using an asterisk or a dash depending on what the user wrote to initate the list. Typing `1) ` or `1. ` shall automatically start a numbered list using `)` or `.` respectively depending on what the user chose to initiate. 

### 3. WYSIWYG Editor and Appearance

- The note editor shall use a proven WYSIWYG editing library rather than implementing rich-text editing from scratch. The selected library must work in a bundled Chrome/Edge extension page and support local/offline use.
- The editor toolbar shall support, at minimum, bold, italic, underline, font family, font size, text alignment, undo, redo, text color, and highlight color.
- The font-family control shall contain a substantially expanded, curated list of common system-safe and bundled fonts. Each option shall be rendered in its own font so users can preview the font in the control, in the same manner as a word processor.
- The font-family control shall maintain a persisted list of recently used fonts and show those fonts at the top, without duplicates, followed by the full font list.
- Clicking or placing the caret in text that uses a font shall update the font-family control to display that font. The displayed value shall update when the selection changes between differently formatted text.
- Typing `# ` at the beginning of a line shall remove the marker and convert that line to an H1 heading.
- Formatting shall behave like a word processor: when text is selected, it applies to the selection; with no selection, it applies at the cursor/current typing position.
- The default font for newly created text and text boxes shall be **Arial**. Existing formatting must not be overwritten when the default changes.
- Text color shall use a standard color-picker UI with a visible preview and support hexadecimal `#RRGGBB` values. Standard colors should also be offered, which include Dark Red, Red, Orange, Yellow, Light Green, Green, Teal, Blue, Dark Blue, Purple (Violet). Any user chosen color from the color picker shall be added to standard colors options. The chosen color shall apply to selected text or the current typing position. If any manually chosen color is not used in a textbox, then that color shall be removed from the standard colors option. Therefore, it is possible that standard colors in one textbox are different than stadard colors from a different textbox
- The default highlight color shall be dark blue and shall remain customizable through the color-picker UI and standard colors.
- Selecting highlighted text and pressing the highlight toolbar button shall remove the highlight; pressing it on unhighlighted selected text shall apply the highlight color.
- Invalid hexadecimal input shall show a clear validation state without replacing the last valid color.

### 4. Clock, Stopwatch, and Laps

- The stopwatch shall provide start, pause, resume, reset, and lap controls.
- Each lap shall include a lap number, elapsed time, and editable user description.
- The stopwatch and countdown panels shall keep stable dimensions. Adding laps must not resize the countdown panel.
- When a countdown reaches zero, it shall display an alarm emoji on the page the user is currently on. There shall be no message or background for the alarm emoji. Clicking the alarm emoji will dismiss it, making it disapear from the page I am currently on. The alarm emoji shall not be displayed in every single tab the user has open, it should only display on the current tab the user is on.
- The countdown shall give 3 input boxes: hours, minutes, and seconds. All values shall default to 0.

### 5. Calendar, Tasks, and Reminders

- The extension shall provide a calendar/schedule management view with events and tasks that have a title, optional description, start time, end time, and customizable color. The user can manually select the color from a color picker UI or have standard colors. 
- At task creation, users shall choose either **Start now** or **Schedule for later**. The user must provide an end time for every task, including tasks started with **Start now**. The start time shall not be before the current time and the end time must be after the start time. If the user clicks **Start now**, then a task box shall appear in the schedule.
- Multiple tasks may not overlap.
- The schedule shall display a 30-minute time-axis for reference, while allowing exact times such as `5:47`. These exact times shall fit perfectly in the y axis, which has the time references. So `5:47` shall be slightly more below than halfway beteen the `5:30` reference and `6:00` reference.
- New tasks shall default start time to the current local time at the moment the create task button is clicked.
- A task started immediately shall display from its actual start time. A task may be ended manually, which records the end time at the moment the user chooses **Finish task**. Manual task completion can happen when the user clicks the task in the schedule. This brings the user to the top of the page containing task information. Since the task has already been started, a **Finish task** button appears with a green background. Clicking that button shall end the task and the box shall adjust its size accordingly to represent its start and end time in the schedule. If the scheduled end time arrives while the task is still active, a popup shall appear only on the tab the user is currently viewing. The popup shall show an alarm, task title, **Finish** button, and **Extend** button, and shall not have a dismiss or close action. The user must choose **Finish** or **Extend**. The **Finish** button ends the task so the schedule stops growing the task box. The **Extend** button places the task into an extended state; the task box shall continue growing indefinitely until the user clicks the task and chooses **End task** in its properties. The **Finish** or **End task** action for an extended task shall use a red background. If the extended task reaches the start time of another task, the later task and every following task shall be pushed later minute by minute so that no tasks overlap. Any blank periods between tasks shall be pushed as part of the schedule flow as well.
- While an extended task is growing, all later task start and end times shall be shifted and persisted, preserving each task's original duration. The shifts shall apply even when the intervening schedule contains blank time. If the shifted schedule reaches beyond the currently visible time frame, the visible end boundary shall extend automatically. The visible frame shall never hide any portion of an active or scheduled task. If the schedule extends past midnight, the calendar shall add or extend the grey dashed midnight divider and allow task boxes to continue across it.
- Active tasks shall display a box spanning from their start time to the current time. Completed tasks shall display from their start time to their recorded end time. Empty periods shall remain blank.
- Clicking a task shall scroll the workspace to the top and show its task properties.
- Task details shall include a clearly labeled **Delete task** action. Deleting a task shall require confirmation and remove it from the schedule calendar, making that space blank.
- A task shall not be treated as completed solely because its scheduled end time has passed. Until the user confirms completion, it shall remain active or require an explicit overdue/delayed state.
- Timer and task timing shall continue in the background when the user navigates away, changes tabs, closes the app page, or reloads a page. The extension shall use persisted timestamps and the browser's extension alarm capabilities rather than relying only on an open page timer.
- The extension shall remain extension-only and shall not require a desktop companion application or external service. While the browser is running, scheduled reminders shall be delivered at their scheduled times through the on-page overlay. If the browser is completely closed, task and timer data shall remain persisted; when the browser starts again, the extension shall detect missed reminders and present them to the user.
- The calendar shall present a Microsoft Calendar-style single-day view for the current local day, with a vertical time axis, 30-minute grid lines, a current-time marker, and events positioned by their exact local start and end times.
- The calendar's visible day window shall have independently draggable start and end boundary controls. The controls shall be blue horizontal handles that can be dragged vertically to shorten or expand the displayed calendar window without changing any task's stored start or end values.
- The default visible day window shall be from 8am to 10pm. The full day remains available by dragging either boundary.
- The calendar shall never hide any portion of an active or scheduled task. If any task would fall partly or wholly outside the visible time window, the appropriate visible boundary shall expand automatically until the entire task duration is visible.
- A grey dashed horizontal divider shall mark midnight within the calendar when the visible window crosses midnight. The time axis below that divider shall begin at `12:01 AM`, allowing a task such as 10:00 PM–3:00 AM to continue visually across the divider.
- Changing the visible day start shall clip only the rendered portion of a task that falls before the window; it shall never delete, truncate, or mutate the task's stored properties. For example, a 6:00 AM–8:00 AM task shown with a 7:00 AM day start shall render from 7:00 AM to 8:00 AM, while task details continue to show 6:00 AM–8:00 AM.
- The calendar shall identify current, upcoming, active, and completed tasks and remain usable without horizontal scrolling.
- The extension name shown in the manifest, browser action, popup, and workspace title shall be **Offline Workspace**.
- Clicking a calendar task shall scroll to the top of the workspace and open the task builder as an edit form. The form shall be prefilled with the task title, description, color, start date/time, and end date/time, and saving it shall update that task without modal prompts.
- Users shall be able to type clock times directly in the task form and choose AM or PM with a dedicated control.
- The current-time marker and calendar display shall refresh while the workspace remains open, without requiring a page reload.

### 6. Extension Controls and Persistence

- The extension popup shall include an enable/disable control and an action to open the bundled workspace.
- The enabled state shall persist across browser restarts. There shall be no configured-page field and no settings page.
- Disabling the extension shall stop injected UI and reminders without deleting notes, calendar data, timers, settings, or preferences. Re-enabling shall start displaying the injected UI if necessary again.
- The extension shall store data in browser storage with global scope. Notes, schedules, timers, settings, and other user data shall not be separated by web page.
- The extension shall avoid injecting duplicate reminder UI when navigating, refreshing, or revisiting a page.
- Users shall be able to export and import data as separate categories: notes, schedules/calendar events, settings, and timers. Users shall also be able to export/import one combined backup containing all categories.
- Import shall validate the file format, report invalid data clearly, and provide a choice to replace existing data or merge it where supported.
- All of the buttons for import and export shall fall into a dropdown menu titled `Import/Export`. Expanding that drowdown shall display all of the import buttons and export buttons. 

### 6.1 Editor ribbon controls

- The note editor ribbon shall include font family, font size controls, color, highlight, bold, italic, underline, and numbered and bulleted list. Changing them shall apply to the current selection or typing position, and shall not overwrite existing formatting elsewhere.

### 7. Usability and Accessibility

- Controls shall have clear labels or accessible names, including drag handles, color pickers, timer controls, collapse controls, task menus, reminder overlays, and the enable/disable toggle.
- Core actions shall support standard keyboard shortcuts and keyboard navigation with visible focus states, including formatting, moving between text boxes, collapsing notes, completing tasks, and dismissing reminders.
- Text and controls shall remain readable and usable at supported desktop viewport sizes.
- All displayed task, event, stopwatch, lap, and countdown times shall use the user's local time zone and local wall-clock format; UTC strings shall not be shown in the interface.
- The extension shall inject its own isolated container and must never replace, clear, rewrite, or interfere with the host page's existing DOM content or controls.

### Extension Popup
- The extension popup shall have a black,blue, and white theme. Black background, blue buttons, and white text.
- It shall display the title of the extension, which is `Offline Workspace`, it shall have an enable checkbox, which when on shall inject the alarm alerts when either the countdown reaches 0 or task scheduled finish time arrives. Not checking that box shall not display those alerts. The countdown shall reset automatically when it reaches 0 and the task shall automatically go into extended state when the time comes for it to display the popup.
- There shall be a `ⓘ` next to enable extension checkbox on the right of the `Enable Extension` text that when i hover over it, a popup appears with the text `Allow popups on your active page when the timer hits 0 or a scheduled end time of your task arrives.`. The text shall be in white and in grey backgroun.
- There shall also be a section under the enable and disable icons that displays current status of timer and tasks. For timer, it shall display how many hr, min, sec are left. For tasks, it shall display task name, start time like `Start Time: ` + whatever the start time is and it shall display the scheduled end time like `Scheduled End Time: ` + whatever the scheduled end time is. For any extended tasks, since they are still active, the extension popup shall merely make the font color of scheduled end time red since that time has already passed. 

### Definition of Done

- The standalone `chrome-extension://` app works offline in Chrome and Edge desktop.
- Users can create, edit, reorder, resize, collapse, and delete independent notes without affecting calendar data.
- Notes, settings, schedules, timers, ordering, collapsed state, dimensions, and colors survive refreshes and browser restarts.
- Background task timing produces start and end reminders while the browser is running, even when the app page is closed or the user is on another supported page. Tasks and timers remain persisted while the browser is closed, and missed reminders are detected after browser restart.
- Countdown supports only one active countdown. At zero, an alarm emoji appears that grows in size, vibrates, and shrinks. Clicking on that emoji will dismiss the alarm. The emoji shall have transparent background to it looks like a clear emoji popup rather than a rectangle popup. There shall be no duplicate popups across pages. Dismissal is persisted for that countdown occurrence and prevents the same notification from returning after reopening the workspace or visiting another page.
- Reminder overlays, task non-overlap, automatic persisted task shifting, exact start/end times, automatic visible-frame extension, import/export, and enable/disable behavior are manually verified.
- End-time reminders provide working complete and extend actions, preserve incomplete tasks when extended, and record editable actual completion times.
- The extension does not replace or interfere with host-page content and does not inject duplicate UI.
- Focused tests or documented manual test steps cover WYSIWYG formatting, color editing, note operations, task scheduling, background timing, reminder dismissal, and import/export.
