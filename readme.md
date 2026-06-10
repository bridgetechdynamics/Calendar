Dynamic Vanilla Calendar
========================

This repository delivers a single-page, vanilla JavaScript calendar with a modern look, US holiday awareness, modal day/detail view, edit/delete flows, and a small public API that lets you seed, mutate, or inspect events after the page loads. The CSS lives in `calendar.css` and the core calendar logic lives in `calendar-app.js`, so the HTML page just links those files and contains the lightweight bootstrap hook where you define your initial events/tags and the `EventDefinition` schema.

## Getting started

1. Open `calendar.html` in a browser (or serve it from any static hosting).
2. The calendar automatically highlights today, supports month/year controls, remembers ad-hoc events via `localStorage`, and exposes the `CalendarApp` / `CalendarAPI` global for programmatic control.
3. The `init(initialEvents)` helper seeds the calendar with whatever JSON events you like; the 3-part object shape is `{ id: number, label: string, date: 'YYYY-MM-DD', href?: string }`.

## Public JavaScript API

Each method returns a `Promise` whenever it performs persistence or asynchronous work. You can access the API via `window.CalendarApp` or the `CalendarAPI` alias; both references are bound as soon as the script executes so you never get `CalendarApp is not defined` even if you call it very early.

### `CalendarApp.init(initialEvents, tags, eventDefinition)`

- **Purpose:** bootstrap the calendar data, available tags, and the attribute definitions that describe how each event field is bound to the UI.
- **Parameters:**
  - `initialEvents` — an array of the `{id,label,date,href?,tag}` objects you want to pre-render.
  - `tags` — optional array of `{key,label,color?}` objects; if provided the Add/Edit modals show the tag chooser and the filter row appears under the controls.
  - `eventDefinition` — a simple schema that lists each attribute name plus the selectors the page uses for the add/edit/view controls, so the core module always reads/writes a consistent set of fields without hardcoding selectors itself.
  - `cacheOptions` — optional object that can include `pre_cache` (persist the provided `initialEvents` before reading `localStorage`) or `post_cache` (overwrite the cache with the provided events after loading) so you can choose whether the stored data defers to your remote source.
- **Returns:** resolves after the internal store is populated and the calendar is rendered.
- **Example:**
  ```html
  <script>
    document.addEventListener('DOMContentLoaded', () => {
      CalendarApp.init([
        { id: 1, label: 'Design review', date: '2026-04-02', href: 'https://...' }
      ]);
    });
  </script>
  ```

### `CalendarApp.addEvents(events)`

- **Purpose:** merge new events into the calendar; duplicates (by `id`) are skipped.
- **Parameters:** `events` — array of `{id,label,date,href?}` objects.
- **Returns:** resolves with `{ added: [...ids], skipped: [...reasons] }` so you can show feedback.
- **Example:**
  ```js
  CalendarApp.addEvents([{ id: 42, label: 'Client call', date: '2026-05-06' }]);
  ```

### `CalendarApp.removeEvents(ids)`

- **Purpose:** delete events from the calendar using their unique `id`.
- **Parameters:** `ids` — array of `{ id: number }` objects.
- **Returns:** resolves with `{ removed: [...ids], missing: [...id] }`.
- **Example:**
  ```js
  CalendarApp.removeEvents([{ id: 42 }]);
  ```

### `CalendarApp.setMonthYear(month, year)`

- **Purpose:** programmatically force the calendar to a specific month/year.
- **Parameters:** `month` (0-11) and `year` (four digits).
- **Returns:** resolves with the new visible month/year.
- **Example:**
  ```js
  CalendarApp.setMonthYear(3, 2026); // shows April 2026
  ```

### `CalendarApp.getEvents()`

- **Purpose:** retrieve the current in-memory/event-store snapshot.
- **Parameters:** none.
- **Returns:** resolves with the full array of event objects.
- **Example:**
  ```js
  CalendarApp.getEvents().then((events) => {
    console.table(events);
  });
  ```

### `CalendarApp.logEvents()`

- **Purpose:** write the current events to the console for debugging.
- **Parameters:** none.
- **Returns:** resolves with the same array that gets logged.

### `CalendarApp.clearEvents()`

- **Purpose:** remove every event from the calendar and wipe the backing `localStorage` key so the component returns to a clean slate.
- **Parameters:** none.
- **Returns:** resolves once the storage has been cleared.
- **Tip:** use the “Clear stored events” button in the API panel if you want to expose this action to clients without calling `clearEvents()` manually.

## UI automation notes

- The “Add Event” button opens a modal that mirrors the Edit flow but auto-generates the next ID (based on the highest ID every event has ever used) so the interface never asks the user to pick one manually.
- When you save from the modal, the calendar persists the new event, closes the overlay, and re-selects the date so the list updates instantly.
- If you pass a `tags` array into `init`, the Add/Edit modals show a drop-down and the calendar renders a row of tag bubbles beneath the header controls so you can filter the entire grid by a tag’s key; clicking a bubble toggles the filter and highlights the badge.
- When you click an event badge in the day panel, a new “View Event” panel appears first; it provides read-only details plus Cancel (back to the list) and Edit buttons so you can decide whether to make changes.

### Event definition schema

The inline bootstrap script defines an `EventDefinition` object that currently lists the five attributes (`id`, `label`, `href`, `date`, `tag`) and the selectors used by the Add/Edit/View panels. That schema is handed to `CalendarApp.init` so the module can automatically read from the correct inputs, populate them, copy every attribute when persisting, and render the view panel. To add your own fields, update that `EventDefinition` object with the new attribute name and selectors (the HTML for the inputs stays where you placed it), and the module will include the new attribute everywhere across add/edit/render/persist without editing the core logic.
- When you click an event badge in the day panel, a new “View Event” panel appears first; it provides read-only details plus Cancel (back to the list) and Edit buttons so you can decide whether to make changes.

## Example workflows

### Inline JavaScript hook

```html
<script>
  document.addEventListener('DOMContentLoaded', () => {
    const seed = [
      { id: 100, label: 'Sprint retro', date: '2026-05-03' }
    ];
    CalendarApp.init(seed);
    document.getElementById('log-events').addEventListener('click', () => {
      CalendarApp.logEvents();
    });
  });
</script>
```

### Responding to form submissions

If you are collecting data in another part of the page, you can pipe it into `CalendarApp.addEvents`:

```js
const form = document.querySelector('#quick-add');
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const payload = [{
    id: Date.now(),
    label: event.target.elements.label.value,
    date: event.target.elements.date.value
  }];
  CalendarApp.addEvents(payload);
});
```

## Integrating from other languages

Because the calendar lives in the browser, external languages interact with it by rendering the right markup/JSON or by driving the page through a template.

### Python (Flask/Jinja)

```jinja
{% set events = [{ 'id': 1, 'label': 'Standup', 'date': '2026-05-12' }] %}
<script>
  document.addEventListener('DOMContentLoaded', () => {
    CalendarApp.init({{ events | tojson }});
  });
</script>
```

Or if you expose an API endpoint, respond with JSON and fetch it on the client before calling `CalendarApp.addEvents`.

### Ruby (Rails/ERB)

```erb
<%= javascript_tag do %>
  document.addEventListener('DOMContentLoaded', () => {
    const initialEvents = <%= @events.to_json.html_safe %>;
    CalendarApp.init(initialEvents);
  });
<% end %>
```

### PHP

```php
<?php $events = json_encode([['id' => 10, 'label' => 'Budget sync', 'date' => '2026-05-20']]); ?>
<script>
  document.addEventListener('DOMContentLoaded', function () {
    CalendarApp.init(<?= $events ?>);
  });
</script>
```

If you need to drive the calendar entirely from a backend script (for example, during a build/test workflow), any language that can execute JavaScript (execjs, node, Duktape, etc.) can `require` `calendar.html` or evaluate the `CalendarApp` object in a headless engine and call the exposed methods.

## Tips

- Keep the IDs unique when calling `addEvents` via the API; the UI incrementer only applies to the gated “Add Event” modal.
- Use `CalendarApp.setMonthYear` when you want to show a different month in response to filters or navigation outside the calendar component.
- Persist your own server-side cache if you need long-term storage—this calendar keeps things only in `localStorage`.
- Use the `cacheOptions` object passed into `CalendarApp.init` if you need to control the cache on load: `pre_cache` pushes your provided events into storage before reading it, while `post_cache` overwrites the stored events with your payload after loading so a remote data pull can replace any previously cached set.
- To add or rename event attributes, edit the `EventDefinition` in the HTML bootstrap (it lists each attribute name plus the selectors for the add/edit/view controls) so the shared module automatically includes the new fields everywhere.
- To make the UI read-only for less privileged users:
  1. Call the `lockEditPanelInputs(true)` helper exposed in the script after `CalendarApp` loads (the bootstrap already calls it with `false` inside `cacheElements()`, so you can override it whenever you change editability) to flip the Edit panel inputs to read-only while keeping their normal styling.
  2. Hide unwanted controls with CSS rather than removing the markup; the combination below hides everything at once but you can also apply each rule individually as needed:
     ```css
     #panel-confirm,
     #add-event-button,
     #panel-edit .hero-actions button,
     .api-panel {
       display: none !important;
     }
     ```
     To hide them one-by-one:
     - **Delete confirmation panel:** `#panel-confirm { display: none !important; }` keeps the JS reference but never shows the warning.
     - **“Add Event” button:** `#add-event-button { display: none !important; }` removes the trigger while preserving the modal markup.
     - **Edit/Cancel buttons:** `#panel-edit .hero-actions button { display: none !important; }` leaves the panel visible but read-only-ready.
     - **API panel:** `.api-panel { display: none !important; }` hides the JSON controls but retains the wiring for future re-enable.
  3. If you also want the read-only fields to look active, add `pointer-events: none; cursor: default;` or similar rules so the non-editable inputs still feel like normal text boxes even though typing is blocked.
