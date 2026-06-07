(() => {
      const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

      const US_HOLIDAYS = {
        '01-01':"New Year's Day",
        '01-20':"Martin Luther King Jr. Day",
        '02-17':"Presidents' Day",
        '05-25':"Memorial Day",
        '07-04':"Independence Day",
        '09-07':"Labor Day",
        '10-12':"Columbus Day",
        '11-11':"Veterans Day",
        '11-26':"Thanksgiving",
        '12-25':"Christmas Day"
      };

      const storageKey = 'ctd-calendar-events';
      const state = {
        month: new Date().getMonth(),
        year: new Date().getFullYear(),
        selectedDate: null,
        panelDate: null,
        editingEventId: null,
        viewingEventId: null,
        pendingAddEventId: null,
        showHolidays: true,
        tags: [],
        activeTagKey: null
      };

      const elements = {};
      let eventsById = new Map();
      let tagLookup = new Map();
      // Track the highest ID we have ever assigned so UI additions can keep incrementing.
      let highestEventId = 0;

      const helpers = {
        pad: (value) => value.toString().padStart(2, '0'),
        formatISO: (date) => {
          const year = date.getFullYear();
          return `${year}-${helpers.pad(date.getMonth() + 1)}-${helpers.pad(date.getDate())}`;
        },
        parseISO: (iso) => {
          if (!iso || typeof iso !== 'string') {
            return new Date(iso);
          }
          const [year, month, day] = iso.split('-').map(Number);
          return new Date(year, month - 1, day);
        },
        sameDay: (a,b) => a === b
      };

      function updateHighestId(idValue) {
        if (typeof idValue === 'number' && Number.isFinite(idValue)) {
          highestEventId = Math.max(highestEventId, idValue);
        }
      }

      function lockEditPanelInputs(readonly = true) {
        [elements.editLabel, elements.editHref, elements.editDate].forEach((input) => {
          if (input) {
            input.readOnly = readonly;
          }
        });
      }

      function populateViewPanel(eventData) {
        if (!eventData || !elements.panelView) {
          return;
        }
        if (elements.viewIdValue) {
          elements.viewIdValue.textContent = eventData.id;
        }
        if (elements.viewLabel) {
          elements.viewLabel.textContent = eventData.label;
        }
        if (elements.viewDate) {
          elements.viewDate.textContent = eventData.date;
        }
        if (elements.viewLink) {
          if (eventData.href) {
            elements.viewLink.href = eventData.href;
            elements.viewLink.textContent = eventData.href;
            elements.viewLink.parentElement?.classList.remove('hidden');
          } else {
            elements.viewLink.removeAttribute('href');
            elements.viewLink.textContent = '';
            elements.viewLink.parentElement?.classList.add('hidden');
          }
        }
        if (elements.viewTag) {
          if (eventData.tag) {
            elements.viewTag.textContent = eventData.tag.label;
            elements.viewTagLine?.classList.remove('hidden');
          } else {
            elements.viewTag.textContent = '';
            elements.viewTagLine?.classList.add('hidden');
          }
        }
      }

      function showViewPanel(eventId) {
        const eventData = eventsById.get(eventId);
        if (!eventData) {
          return;
        }
        state.viewingEventId = eventId;
        populateViewPanel(eventData);
        hideAllPanels();
        if (elements.panelView) {
          elements.panelView.classList.remove('hidden');
        }
      }

      function setTagConfig(tags = []) {
        state.tags = Array.isArray(tags) ? tags : [];
        tagLookup = new Map(state.tags.map((tag) => [tag.key, tag]));
        state.activeTagKey = null;
        toggleTagSelectVisibility(state.tags.length > 0);
        renderTagFilter();
        populateTagSelects();
      }

      function toggleTagSelectVisibility(show) {
        elements.tagSelectGroups.forEach((container) => {
          container.classList.toggle('hidden', !show);
        });
      }

      function populateTagSelects() {
        const selects = [elements.editTagSelect, elements.addTagSelect].filter(Boolean);
        if (!state.tags.length) {
          selects.forEach((select) => {
            select.innerHTML = '<option value="">None</option>';
          });
          return;
        }
        const options = ['<option value="">None</option>', ...state.tags.map((tag) => `<option value="${tag.key}">${tag.label}</option>`)];
        selects.forEach((select) => {
          select.innerHTML = options.join('');
        });
      }

      function renderTagFilter() {
        if (!elements.tagFilterRow) {
          return;
        }
        elements.tagFilterRow.innerHTML = '';
        if (!state.tags.length) {
          elements.tagFilterRow.classList.add('hidden');
          return;
        }
        elements.tagFilterRow.classList.remove('hidden');
        state.tags.forEach((tag) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'tag-filter__bubble';
          button.textContent = tag.label;
          button.dataset.tagKey = tag.key;
          button.style.color = tag.color || 'currentColor';
          button.style.borderColor = tag.color || 'rgba(148, 163, 184, 0.5)';
          if (state.activeTagKey === tag.key) {
            button.classList.add('active');
          }
          button.addEventListener('click', () => {
            state.activeTagKey = state.activeTagKey === tag.key ? null : tag.key;
            render();
            renderDayPanel();
            renderTagFilter();
          });
          elements.tagFilterRow.appendChild(button);
        });
      }

      function getTagByKey(key) {
        if (!key || !tagLookup) {
          return undefined;
        }
        const tag = tagLookup.get(key);
        return tag ? { ...tag } : undefined;
      }

      function applyTagFilter(events) {
        if (!state.activeTagKey) {
          return events;
        }
        return events.filter((event) => event.tag && event.tag.key === state.activeTagKey);
      }

      function cacheElements() {
        elements.monthSelect = document.getElementById('month-select');
        elements.yearSelect = document.getElementById('year-select');
        elements.calendarTitle = document.getElementById('calendar-title');
        elements.calendarDays = document.getElementById('calendar-days');
        elements.todayButton = document.getElementById('today-button');
        elements.dayPanel = document.getElementById('day-panel');
        elements.panelDate = document.getElementById('panel-date');
        elements.eventList = document.getElementById('event-list');
        elements.panelDisplay = document.getElementById('panel-display');
        elements.panelView = document.getElementById('panel-view');
        elements.panelEdit = document.getElementById('panel-edit');
        elements.panelConfirm = document.getElementById('panel-confirm');
        elements.editForm = document.getElementById('edit-form');
        elements.editLabel = document.getElementById('edit-label');
        elements.editHref = document.getElementById('edit-href');
        elements.editDate = document.getElementById('edit-date');
        elements.editIdValue = document.getElementById('edit-id-value');
        lockEditPanelInputs(false);
        elements.closePanel = document.querySelector('.close-panel');
        elements.holidayToggle = document.getElementById('holiday-toggle');
        elements.tagFilterRow = document.getElementById('tag-filter-row');
        elements.editTagSelect = document.getElementById('edit-tag');
        elements.addTagSelect = document.getElementById('add-tag');
        elements.tagSelectGroups = document.querySelectorAll('[data-role="tag-select"]');
        elements.addButton = document.getElementById('add-event-button');
        elements.panelAdd = document.getElementById('panel-add');
        elements.addForm = document.getElementById('add-form');
        elements.addLabel = document.getElementById('add-label');
        elements.addHref = document.getElementById('add-href');
        elements.addDate = document.getElementById('add-date');
        elements.addIdValue = document.getElementById('add-id-value');
        elements.cancelAdd = document.getElementById('cancel-add');
        elements.viewIdValue = document.getElementById('view-id-value');
        elements.viewLabel = document.getElementById('view-label');
        elements.viewDate = document.getElementById('view-date');
        elements.viewLink = document.getElementById('view-link');
        elements.viewTag = document.getElementById('view-tag');
        elements.viewTagLine = document.getElementById('view-tag-line');
        elements.viewCancel = document.getElementById('view-cancel');
        elements.viewEdit = document.getElementById('view-edit');
      }

      function populateSelects() {
        elements.monthSelect.innerHTML = MONTHS.map((name, index) => {
          return `<option value="${index}">${name}</option>`;
        }).join('');

        const currentYear = new Date().getFullYear();
        const span = 12;
        const start = currentYear - 6;
        const end = currentYear + span - 6;
        const options = [];
        for (let y = start; y <= end; y++) {
          options.push(`<option value="${y}">${y}</option>`);
        }
        elements.yearSelect.innerHTML = options.join('');
      }

      function attachControlHandlers() {
        elements.monthSelect.addEventListener('change', (event) => {
          state.month = Number(event.target.value);
          syncSelects();
          render();
        });

        elements.yearSelect.addEventListener('change', (event) => {
          state.year = Number(event.target.value);
          render();
        });

        document.querySelectorAll('[data-action]').forEach((button) => {
          button.addEventListener('click', () => {
            const action = button.dataset.action;
            if (action === 'prev-month') {
              adjustMonth(-1);
            } else if (action === 'next-month') {
              adjustMonth(1);
            } else if (action === 'prev-year') {
              adjustYear(-1);
            } else if (action === 'next-year') {
              adjustYear(1);
            }
          });
        });

        elements.todayButton.addEventListener('click', () => {
          const today = new Date();
          state.year = today.getFullYear();
          state.month = today.getMonth();
          state.selectedDate = helpers.formatISO(today);
          syncSelects();
          render();
        });

        if (elements.holidayToggle) {
          elements.holidayToggle.checked = state.showHolidays;
          elements.holidayToggle.addEventListener('change', () => {
            state.showHolidays = elements.holidayToggle.checked;
            render();
          });
        }

        elements.closePanel.addEventListener('click', () => hidePanel());
        elements.dayPanel.addEventListener('click', (event) => {
          if (event.target === elements.dayPanel) {
            hidePanel();
          }
        });
        document.addEventListener('keydown', (event) => {
          if (event.key === 'Escape' && elements.dayPanel && !elements.dayPanel.classList.contains('hidden')) {
            hidePanel();
          }
        });

        if (elements.viewCancel) {
          elements.viewCancel.addEventListener('click', () => {
            state.viewingEventId = null;
            showDisplayPanel();
          });
        }
        if (elements.viewEdit) {
          elements.viewEdit.addEventListener('click', () => {
            showEditPanel(state.viewingEventId);
          });
        }

        if (elements.addButton) {
          elements.addButton.addEventListener('click', () => openAddPanel());
        }
        if (elements.addForm) {
          elements.addForm.addEventListener('submit', handleAddFormSubmit);
        }
        if (elements.cancelAdd) {
          elements.cancelAdd.addEventListener('click', () => hideAddPanel());
        }

        elements.editForm.addEventListener('submit', (event) => {
          event.preventDefault();
          const eventId = state.editingEventId;
          if (!eventId) {
            showDisplayPanel();
            return;
          }
          const existingEvent = eventsById.get(eventId);
          if (!existingEvent) {
            showDisplayPanel();
            return;
          }
        existingEvent.label = elements.editLabel.value.trim();
        existingEvent.href = elements.editHref.value.trim() || undefined;
        existingEvent.date = elements.editDate.value;
        if (elements.editTagSelect) {
          existingEvent.tag = getTagByKey(elements.editTagSelect.value);
        }
        eventsById.set(eventId, existingEvent);
          persistEvents();
          if (state.panelDate !== existingEvent.date) {
            state.panelDate = existingEvent.date;
          }
          state.selectedDate = existingEvent.date;
          hideAllPanels();
          render();
          showDisplayPanel();
          renderDayPanel();
        });

        document.getElementById('cancel-edit').addEventListener('click', () => {
          hidePanel();
        });

        document.getElementById('confirm-delete').addEventListener('click', () => {
          if (!state.editingEventId) {
            showDisplayPanel();
            return;
          }
          eventsById.delete(state.editingEventId);
          state.editingEventId = null;
          persistEvents();
          render();
          showDisplayPanel();
          renderDayPanel();
        });

        document.getElementById('cancel-delete').addEventListener('click', () => {
          hidePanel();
        });
      }

      function hideAllPanels() {
        elements.panelDisplay.classList.add('hidden');
        if (elements.panelView) {
          elements.panelView.classList.add('hidden');
        }
        elements.panelEdit.classList.add('hidden');
        elements.panelConfirm.classList.add('hidden');
        setAddSectionVisibility(false);
      }

      function showDisplayPanel() {
        state.viewingEventId = null;
        hideAllPanels();
        elements.panelDisplay.classList.remove('hidden');
      }

      function clearEditFields() {
        if (elements.editLabel) elements.editLabel.value = '';
        if (elements.editHref) elements.editHref.value = '';
        if (elements.editDate) elements.editDate.value = '';
        if (elements.editIdValue) elements.editIdValue.textContent = '';
        if (elements.editTagSelect) {
          elements.editTagSelect.value = '';
        }
      }

      function populateEditFields(eventData) {
        if (!eventData) {
          clearEditFields();
          return;
        }
        if (elements.editLabel) elements.editLabel.value = eventData.label;
        if (elements.editHref) elements.editHref.value = eventData.href || '';
        if (elements.editDate) elements.editDate.value = eventData.date || '';
        if (elements.editIdValue) elements.editIdValue.textContent = eventData.id;
        if (elements.editTagSelect) {
          elements.editTagSelect.value = eventData.tag ? eventData.tag.key : '';
        }
      }

      function setEditSectionVisibility(enabled) {
        if (elements.panelEdit) {
          elements.panelEdit.classList.toggle('hidden', !enabled);
        }
        if (elements.panelConfirm) {
          elements.panelConfirm.classList.toggle('hidden', !enabled);
        }
      }

      function setAddSectionVisibility(enabled) {
        if (elements.panelAdd) {
          elements.panelAdd.classList.toggle('hidden', !enabled);
        }
      }

      function hideAddPanel() {
        state.pendingAddEventId = null;
        setAddSectionVisibility(false);
        showDisplayPanel();
      }

      function openAddPanel() {
        if (!elements.panelAdd) {
          return;
        }
        const baseDate = state.panelDate || state.selectedDate || helpers.formatISO(new Date());
        const nextId = highestEventId + 1;
        state.pendingAddEventId = nextId;
        if (elements.addIdValue) {
          elements.addIdValue.textContent = nextId;
        }
        if (elements.addLabel) {
          elements.addLabel.value = '';
        }
        if (elements.addHref) {
          elements.addHref.value = '';
        }
        if (elements.addDate) {
          elements.addDate.value = baseDate;
        }
        hideAllPanels();
        setAddSectionVisibility(true);
        elements.panelAdd.classList.remove('hidden');
      }

      function handleAddFormSubmit(event) {
        event.preventDefault();
        if (!elements.addLabel || !elements.addDate) {
          return;
        }
        const label = elements.addLabel.value.trim();
        const dateValue = elements.addDate.value;
        if (!label || !dateValue) {
          return;
        }
        const href = elements.addHref ? elements.addHref.value.trim() : '';
        const proposedId = Math.max(highestEventId, state.pendingAddEventId || 0) + 1;
        state.pendingAddEventId = proposedId;
        if (elements.addIdValue) {
          elements.addIdValue.textContent = proposedId;
        }
        const newEvent = { id: proposedId, label, date: dateValue };
        const selectedTag = elements.addTagSelect ? getTagByKey(elements.addTagSelect.value) : undefined;
        if (selectedTag) {
          newEvent.tag = selectedTag;
        }
        if (href) {
          newEvent.href = href;
        }
        eventsById.set(proposedId, newEvent);
        updateHighestId(proposedId);
        persistEvents();
        state.selectedDate = dateValue;
        state.panelDate = dateValue;
        state.pendingAddEventId = null;
        render();
        renderDayPanel();
        hideAllPanels();
        showDisplayPanel();
      }

      function prepareDefaultEdit() {
        const dayEvents = applyTagFilter(getEventsForDate(state.panelDate));
        if (dayEvents.length) {
          const eventData = dayEvents[0];
          state.editingEventId = eventData.id;
          populateEditFields(eventData);
          setEditSectionVisibility(true);
        } else {
          state.editingEventId = null;
          clearEditFields();
          setEditSectionVisibility(false);
        }
      }

      function showEditPanel(eventId) {
        const dayEvents = applyTagFilter(getEventsForDate(state.panelDate));
        const targetId = (typeof eventId !== 'undefined' && eventId !== null)
          ? eventId
          : (dayEvents.length ? dayEvents[0].id : null);
        if (!targetId) {
          state.editingEventId = null;
          clearEditFields();
          setEditSectionVisibility(false);
          hideAllPanels();
          showDisplayPanel();
          return;
        }
        const eventData = eventsById.get(targetId);
        if (!eventData) {
          state.editingEventId = null;
          clearEditFields();
          setEditSectionVisibility(false);
          hideAllPanels();
          showDisplayPanel();
          return;
        }
        state.editingEventId = targetId;
        populateEditFields(eventData);
        hideAllPanels();
        setEditSectionVisibility(true);
        elements.panelEdit.classList.remove('hidden');
      }

      function showConfirmPanel(eventId) {
        const targetId = eventId || state.editingEventId;
        if (!targetId) {
          return;
        }
        state.editingEventId = targetId;
        hideAllPanels();
        setEditSectionVisibility(true);
        elements.panelConfirm.classList.remove('hidden');
      }

      function hidePanel() {
        elements.dayPanel.classList.add('hidden');
        elements.dayPanel.setAttribute('aria-hidden', 'true');
        state.panelDate = null;
        state.pendingAddEventId = null;
        hideAllPanels();
        showDisplayPanel();
        setEditSectionVisibility(false);
      }

      function syncSelects() {
        elements.monthSelect.value = state.month;
        if (elements.yearSelect.querySelector(`option[value="${state.year}"]`)) {
          elements.yearSelect.value = state.year;
        }
        if (elements.holidayToggle) {
          elements.holidayToggle.checked = state.showHolidays;
        }
      }

      function adjustMonth(delta) {
        const tentative = new Date(state.year, state.month + delta, 1);
        state.year = tentative.getFullYear();
        state.month = tentative.getMonth();
        syncSelects();
        render();
      }

      function adjustYear(delta) {
        state.year += delta;
        syncSelects();
        render();
      }

      function getStoredEvents() {
        if (!window.localStorage) {
          return [];
        }
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) {
          return [];
        }
        try {
          const parsed = JSON.parse(raw);
          if (!Array.isArray(parsed)) {
            return [];
          }
          return parsed;
        } catch (error) {
          console.warn('Unable to parse stored events', error);
          return [];
        }
      }

      function persistEvents() {
        if (!window.localStorage) {
          return;
        }
        const payload = JSON.stringify([...eventsById.values()]);
        window.localStorage.setItem(storageKey, payload);
      }

      function loadEvents() {
        eventsById.clear();
        const stored = getStoredEvents();
        stored.forEach((event) => {
          if (event && event.id && event.label && event.date) {
            eventsById.set(event.id, { ...event });
            updateHighestId(event.id);
          }
        });
      }

      function getEventsForDate(dateString) {
        return [...eventsById.values()].filter((event) => event.date === dateString).sort((a, b) => a.id - b.id);
      }

      function renderDayPanel() {
        if (!state.panelDate) {
          return;
        }
        const formatted = helpers.parseISO(state.panelDate);
        if (!isFinite(formatted)) {
          elements.panelDate.textContent = state.panelDate;
        } else {
          elements.panelDate.textContent = formatted.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          });
        }
        const events = applyTagFilter(getEventsForDate(state.panelDate));
        elements.eventList.innerHTML = '';
        if (!events.length) {
          elements.eventList.innerHTML = '<p class="empty-text">No events scheduled.</p>';
          showDisplayPanel();
          return;
        }
        events.forEach((eventItem) => {
          const item = document.createElement('div');
          item.className = 'event-entry';
          const label = document.createElement('span');
          label.className = 'label';
          label.textContent = eventItem.label;
          const details = document.createElement('div');
          details.className = 'event-actions';
          if (eventItem.href) {
            const link = document.createElement('a');
            link.href = eventItem.href;
            link.textContent = 'Open link';
            link.target = '_blank';
            link.rel = 'noreferrer';
            link.addEventListener('click', (event) => event.stopPropagation());
            details.appendChild(link);
          }
          const deleteBtn = document.createElement('button');
          deleteBtn.innerHTML = '×';
          deleteBtn.title = 'Delete event';
          deleteBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            showConfirmPanel(eventItem.id);
          });
          details.appendChild(deleteBtn);
          item.append(label, details);
          item.addEventListener('click', () => {
            showViewPanel(eventItem.id);
          });
          elements.eventList.appendChild(item);
        });
        showDisplayPanel();
      }

      function render() {
        const firstOfMonth = new Date(state.year, state.month, 1);
        const daysInMonth = new Date(state.year, state.month + 1, 0).getDate();
        const startDay = firstOfMonth.getDay();

        elements.calendarTitle.textContent = `${MONTHS[state.month]} ${state.year}`;
        elements.calendarDays.innerHTML = '';
        syncSelects();

        const fragment = document.createDocumentFragment();
        const totalSlots = 42; // 6 weeks to cover month
        const gridStart = new Date(state.year, state.month, 1);
        gridStart.setDate(gridStart.getDate() - startDay);
        for (let i = 0; i < totalSlots; i++) {
          const cell = document.createElement('div');
          cell.className = 'day-cell';
          const dayNumber = document.createElement('div');
          dayNumber.className = 'day-number';
          const cellDate = new Date(gridStart);
          cellDate.setDate(gridStart.getDate() + i);
          const isoDate = helpers.formatISO(cellDate);
          const isCurrentMonth = cellDate.getMonth() === state.month;
          cell.dataset.date = isoDate;
          dayNumber.textContent = cellDate.getDate();
          if (!isCurrentMonth) {
            cell.classList.add('adjacent-month');
          }
          const today = helpers.formatISO(new Date());
          if (helpers.sameDay(isoDate, today)) {
            cell.classList.add('today');
          }
          if (state.selectedDate && helpers.sameDay(isoDate, state.selectedDate)) {
            cell.classList.add('selected');
          }
          cell.addEventListener('click', () => {
            state.selectedDate = isoDate;
            state.panelDate = isoDate;
            render();
            openDayPanel(isoDate);
          });
          const events = getEventsForDate(isoDate);
          const visibleEvents = applyTagFilter(events);
          if (visibleEvents.length) {
            const badges = document.createElement('div');
            badges.className = 'event-badges';
            visibleEvents.slice(0, 3).forEach((eventItem) => {
              const badge = document.createElement('div');
              badge.className = 'event-badge';
              badge.textContent = eventItem.label;
              const borderColor = eventItem.tag && eventItem.tag.color ? eventItem.tag.color : 'rgba(231, 111, 81, 0.4)';
              badge.style.borderColor = borderColor;
              badges.appendChild(badge);
            });
            if (visibleEvents.length > 3) {
              const more = document.createElement('button');
              more.type = 'button';
              more.className = 'more-link';
              more.textContent = `+${visibleEvents.length - 3} more`;
              more.addEventListener('click', (evt) => {
                evt.stopPropagation();
                state.selectedDate = isoDate;
                state.panelDate = isoDate;
                openDayPanel(isoDate);
              });
              badges.appendChild(more);
            }
            cell.appendChild(badges);
          }
          const isoMonthDay = `${helpers.pad(cellDate.getMonth() + 1)}-${helpers.pad(cellDate.getDate())}`;
          if (state.showHolidays && US_HOLIDAYS[isoMonthDay]) {
            const holiday = document.createElement('span');
            holiday.className = 'holiday-label';
            holiday.textContent = US_HOLIDAYS[isoMonthDay];
            cell.appendChild(holiday);
          }
          cell.appendChild(dayNumber);
          fragment.appendChild(cell);
        }

        elements.calendarDays.appendChild(fragment);
        if (state.panelDate) {
          renderDayPanel();
        }
      }

      function attachApiPanelHandlers() {
        const addForm = document.getElementById('api-add-form');
        const removeForm = document.getElementById('api-remove-form');
        const logButton = document.getElementById('api-log-events');
        const clearButton = document.getElementById('api-clear-events');
        const addStatus = document.getElementById('api-add-status');
        const removeStatus = document.getElementById('api-remove-status');
        const logStatus = document.getElementById('api-log-status');
        const clearStatus = document.getElementById('api-clear-status');

        const updateStatus = (el, text = '', isError = false) => {
          el.textContent = text;
          el.classList.toggle('api-status--error', isError);
        };

        addForm.addEventListener('submit', (event) => {
          event.preventDefault();
          try {
            const payload = JSON.parse(document.getElementById('api-add-input').value || '[]');
            if (!Array.isArray(payload)) {
              throw new Error('Expected an array of event objects');
            }
            publicAPI.addEvents(payload).then((result) => {
              updateStatus(addStatus, `Added ${result.added.length}, skipped ${result.skipped.length}`);
            });
          } catch (error) {
            updateStatus(addStatus, `JSON error: ${error.message}`, true);
          }
        });

        removeForm.addEventListener('submit', (event) => {
          event.preventDefault();
          try {
            const payload = JSON.parse(document.getElementById('api-remove-input').value || '[]');
            if (!Array.isArray(payload)) {
              throw new Error('Expected an array of {id} objects');
            }
            publicAPI.removeEvents(payload).then((result) => {
              updateStatus(removeStatus, `Removed ${result.removed.length}, missing ${result.missing.length}`);
            });
          } catch (error) {
            updateStatus(removeStatus, `JSON error: ${error.message}`, true);
          }
        });

        logButton.addEventListener('click', () => {
          publicAPI.logEvents().then(() => {
            updateStatus(logStatus, 'Events logged to console');
            setTimeout(() => updateStatus(logStatus, 'Console output only'), 2000);
          });
        });

        if (clearButton) {
          clearButton.addEventListener('click', () => {
            publicAPI.clearEvents().then(() => {
              updateStatus(clearStatus, 'Storage cleared');
              setTimeout(() => updateStatus(clearStatus, ''), 2000);
            });
          });
        }
      }

      function openDayPanel(dateISO) {
        state.panelDate = dateISO;
        renderDayPanel();
        prepareDefaultEdit();
        showDisplayPanel();
        elements.dayPanel.classList.remove('hidden');
        elements.dayPanel.setAttribute('aria-hidden', 'false');
      }

      function addEvents(incoming = [], { skipPersist = false } = {}) {
        const added = [];
        const skipped = [];
        incoming.forEach((eventItem) => {
        if (!eventItem || typeof eventItem.id === 'undefined' || typeof eventItem.label !== 'string' || !eventItem.date) {
          skipped.push({ reason: 'invalid payload', payload: eventItem });
          return;
        }
        if (eventsById.has(eventItem.id)) {
          skipped.push({ reason: 'duplicate id', id: eventItem.id });
          return;
        }
        const record = {
          id: eventItem.id,
          label: eventItem.label,
          href: eventItem.href,
          date: eventItem.date
        };
        if (eventItem.tag) {
          record.tag = eventItem.tag;
        }
        eventsById.set(eventItem.id, record);
        updateHighestId(eventItem.id);
        added.push(eventItem.id);
      });
        if (added.length && !skipPersist) {
          persistEvents();
          render();
        }
        return Promise.resolve({ success: true, added, skipped });
      }

      function removeEvents(targets = []) {
        const removed = [];
        const missing = [];
        targets.forEach((item) => {
          if (item && typeof item.id !== 'undefined' && eventsById.has(item.id)) {
            eventsById.delete(item.id);
            removed.push(item.id);
          } else {
            missing.push(item && item.id ? item.id : item);
          }
        });
        if (removed.length) {
          persistEvents();
          render();
        }
        return Promise.resolve({ success: true, removed, missing });
      }

      function clearEvents() {
        eventsById.clear();
        highestEventId = 0;
        state.selectedDate = helpers.formatISO(new Date());
        state.panelDate = null;
        state.editingEventId = null;
        state.pendingAddEventId = null;
        state.activeTagKey = null;
        if (window.localStorage) {
          window.localStorage.removeItem(storageKey);
        }
        hideAllPanels();
        showDisplayPanel();
        render();
        return Promise.resolve({ success: true });
      }

      function setMonthYear(month, year) {
        const limitedMonth = Math.max(0, Math.min(11, month));
        const limitedYear = Number.isFinite(year ? Number(year) : year) ? Number(year) : state.year;
        state.month = limitedMonth;
        state.year = limitedYear;
        syncSelects();
        render();
        return Promise.resolve({ success: true, month: state.month, year: state.year });
      }

      function getEvents() {
        return Promise.resolve([...eventsById.values()]);
      }

      function logEvents() {
        return getEvents().then((events) => {
          console.group('Calendar events');
          console.log(events);
          console.groupEnd();
          return events;
        });
      }

      // this is where intialEvents are made persistant
      function init(initialEvents = [], initialTags = []) {
        cacheElements();
        populateSelects();
        attachControlHandlers();
        loadEvents();
        setTagConfig(initialTags);
        state.selectedDate = helpers.formatISO(new Date());
        if (!eventsById.size && initialEvents.length) {
          addEvents(initialEvents, { skipPersist: true }).then(() => {
            persistEvents();
            render();
          });
        } else {
          render();
        }
      }

      const publicAPI = {
        init,
        addEvents,
        removeEvents,
        setMonthYear,
        getEvents,
        logEvents,
        clearEvents
      };

      if (typeof window !== 'undefined') {
        window.CalendarApp = publicAPI;
        window.CalendarAPI = publicAPI;
        window.attachCalendarApiPanelHandlers = attachApiPanelHandlers;
      }

    })();
