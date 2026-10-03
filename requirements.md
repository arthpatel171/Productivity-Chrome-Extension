## Todo Extension Requirements

### 1. Notepads and Text Boxes

- The extension shall support multiple independent notepads. Each notepad shall have a user-editable title displayed in its header, replacing the current `NOTE` label.
- Each text box shall be independently resizable. Changing the height or width of one text box must not resize neighboring text boxes or all text boxes together.
- Text boxes shall support collapsing and expanding. A collapsed text box shall show only its title/header; expanding it shall restore its content and dimensions.
- Text boxes shall be reorderable vertically within a notepad by dragging a dedicated drag handle. The drag handle must be keyboard-accessible where practical, and the new order must remain after the page is refreshed.
- The extension shall remove unnecessary whitespace above the page-level `NOTES` heading while preserving readable spacing and alignment.

### 2. Text Editing and Appearance

- The editor toolbar shall support, at minimum:
	- Bold, italic, and underline formatting
	- Font-family selection
	- Font-size selection
	- Text alignment
	- Undo and redo
	- Text-color and highlight-color controls
- The default font for newly created text and text boxes shall be **Handlee**. Existing user formatting must not be overwritten when the default changes.
- Text color shall be fully customizable rather than limited to presets. Users shall be able to enter a hexadecimal color value and adjust the color using a draggable color-control UI. The selected color must provide a visible preview and apply only to the selected text or the current typing position.
- The default highlight color shall be dark blue, while still allowing users to customize it through the same color controls.
- Color input shall validate hexadecimal values and provide a clear invalid-value state without losing the last valid color.

### 3. Fixed Clock, Laps, and Alarms

- A clock panel shall remain fixed on the left side of the viewport while the user scrolls through any page. It must not cover the page content and must adapt to smaller screens.
- The clock shall display the current time and provide start, pause, resume, and reset controls.
- Users shall be able to record laps. Each lap shall include:
	- Lap number
	- Elapsed time
	- A user-entered description, such as “In this lap, I completed ...”
- Users shall be able to configure a countdown timer and start, pause, resume, reset, or cancel it.
- When the countdown reaches zero, an alarm indicator using an alarm-clock emoji shall animate by growing, vibrating, and shrinking before becoming invisible. The alarm state must be visible regardless of which page the user is viewing, and the animation must respect reduced-motion preferences.
- The alarm shall provide an accessible text/state equivalent to the emoji and must not prevent normal page interaction. Users shall be able to dismiss it.

### 4. Today’s Schedule

- The extension shall provide a “Today’s Schedule” view.
- Users shall enter a starting time using a clear 12-hour or 24-hour format. The chosen format must be consistent throughout the view; `8:30` shall be accepted as a valid example.
- After a start time is entered, the extension shall generate consecutive 30-minute time slots for the day.
- Each slot shall allow a user to enter, edit, clear, and review a task or note.
- The schedule shall clearly indicate the current time and distinguish completed, active, and upcoming slots where applicable.
- The generated schedule shall remain usable on narrow screens without horizontal overflow.

### 5. Extension Controls and Persistence

- The browser extension popup shall include an enable/disable control for the extension.
- The current enabled state shall be visible in the popup and persist across browser restarts.
- Disabling the extension shall stop its injected UI and behavior without deleting saved notes, formatting, schedules, laps, or preferences. Re-enabling shall restore them.
- User-created notes, text-box order, collapsed state, dimensions, colors, font settings, schedule entries, and relevant timer preferences shall persist across page refreshes and browser restarts.
- The extension shall avoid injecting duplicate UI when navigating between pages or refreshing a page.

### 6. Usability and Accessibility

- Controls shall have clear labels or accessible names, including drag handles, color inputs, timer controls, collapse controls, and the enable/disable toggle.
- All core actions shall be usable with keyboard navigation and visible focus states.
- Text and controls shall remain readable and usable at common desktop and mobile viewport sizes.
- Animations shall be disabled or reduced when the user has enabled a reduced-motion preference.
- The extension shall not block, rewrite, or interfere with the host page’s existing controls and content.

### Definition of Done

- Each requirement above is implemented and manually verified on a representative set of pages.
- Notes, settings, schedules, laps, ordering, and UI state survive a refresh and browser restart.
- The extension can be enabled and disabled from its popup without data loss.
- The layout does not cause unrelated text boxes to resize, introduce excessive top whitespace, or create horizontal scrolling at supported viewport sizes.
- Timer expiry, drag reordering, color editing, collapse/expand, and schedule generation have focused regression tests or documented manual test steps.
