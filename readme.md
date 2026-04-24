Usage
-----
```
  CalendarApp.addEvents([
    { id: 42, label: 'New meeting', date: '2026-04-05', href: 'https://example.com' }
  ]).then(result => {
    console.log('added/skipped', result);
  });

  CalendarApp.removeEvents([{ id: 42 }]);
  CalendarApp.setMonthYear(3, 2026); // April (=3)
  CalendarApp.getEvents().then(events => console.log(events));
```
