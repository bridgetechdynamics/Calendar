Dynamic Vanilla Calendar
========================

This repository delivers a single-page, vanilla JavaScript calendar with a modern look, US holiday awareness, modal day/detail view, edit/delete flows, and a small public API that lets you seed, mutate, or inspect events after the page loads.

## Getting started

1. Open `calendar.html` in a browser (or serve it from any static hosting): everything lives in that file—HTML, CSS, and JavaScript.
2. The calendar automatically highlights today, supports month/year controls, remembers ad-hoc events via `localStorage`, and exposes the `CalendarApp` / `CalendarAPI` global for programmatic control.
3. The `init(initialEvents)` helper seeds the calendar with whatever JSON events you like; the 3-part object shape is `{ id: number, label: string, date: 'YYYY-MM-DD', href?: string }`.

## Public JavaScript API

Each method returns a `Promise` whenever it performs persistence or asynchronous work. You can access the API via `window.CalendarApp` or the `CalendarAPI` alias; both references are bound as soon as the script executes so you never get `CalendarApp is not defined` even if you call it very early.

### `CalendarApp.init(initialEvents)`

- **Purpose:** bootstrap the calendar data when the page loads.
- **Parameters:** `initialEvents` — an array of the `{id,label,date,href?}` objects you want to pre-render.
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
