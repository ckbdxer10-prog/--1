const DAYS = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье"
];
const WORKDAYS = DAYS.slice(0, 5);

const DAY_HINTS = {
  Понедельник: "Спокойный старт",
  Вторник: "Найти ритм",
  Среда: "Мягкий фокус",
  Четверг: "Глубокая работа",
  Пятница: "Бережно завершить",
  Суббота: "Дом и жизнь",
  Воскресенье: "Восстановление"
};

const DIFFICULTY_LABELS = {
  easy: "Легкая",
  medium: "Средняя",
  hard: "Сложная"
};

const CATEGORY_LABELS = {
  personal: "Личное",
  home: "Дом",
  work: "Работа",
  study: "Учеба",
  hobby: "Хобби"
};

const STORAGE_KEY = "personal-weekly-planner.tasks";
const FILTERS_KEY = "personal-weekly-planner.filters";
const UI_STATE_KEY = "personal-weekly-planner.ui";
const OFFLINE_QUEUE_KEY = "personal-weekly-planner.offline-queue";
const THEME_KEY = "personal-weekly-planner.theme";
const MAX_TITLE_LENGTH = 90;
const MAX_DESCRIPTION_LENGTH = 1000;
const MAX_CONTEXT_TAGS = 5;
const MAX_CONTEXT_TAG_LENGTH = 20;
const MAX_ENERGY_LIMIT = 100;
const MIN_ENERGY_LIMIT = 1;
const INITIAL_RENDER_LIMIT = 30;
const RENDER_BATCH_SIZE = 30;
const ENERGY_STATUS = {
  normal: "Норма",
  warning: "Много нагрузки",
  overload: "Нужна пауза"
};
const DAY_MIGRATION = {
  Monday: "Понедельник",
  Tuesday: "Вторник",
  Wednesday: "Среда",
  Thursday: "Четверг",
  Friday: "Пятница",
  Saturday: "Суббота",
  Sunday: "Воскресенье"
};

const SEED_TRANSLATIONS = {
  "seed-1": {
    title: "Определить приоритеты недели",
    description: "Выбрать три главных опоры недели и оставить место для отдыха.",
    context: ["планирование", "неделя"]
  },
  "seed-2": {
    title: "Проверить счета",
    description: "",
    context: ["финансы"]
  },
  "seed-3": {
    title: "Глубокий дизайн-проход",
    description: "Защитить тихий блок времени и убрать уведомления.",
    context: ["дизайн", "фокус"]
  }
};

const seedTasks = [];

let tasks = loadTasks();
let searchQuery = "";
let isSyncing = false;
let retryAction = null;
let searchTimer = null;
let largeDatasetNoticeShown = false;

const store = {
  tasks,
  filters: {},
  search: "",
  selectedTask: null,
  modal: { open: false, mode: "create" },
  drag: { activeId: null, lastDropSignature: "", lastDropAt: 0 },
  offlineQueue: loadOfflineQueue(),
  collapsedStates: {},
  visibleLimits: {},
  lastViewedWeek: getSafeWeekKey()
};

const board = document.querySelector("#board");
const dialog = document.querySelector("#taskDialog");
const form = document.querySelector("#taskForm");
const dialogTitle = document.querySelector("#dialogTitle");
const deleteTaskButton = document.querySelector("#deleteTaskButton");
const energySummary = document.querySelector("#energySummary");
const energyValue = document.querySelector("#energyValue");
const contextPreview = document.querySelector("#contextPreview");
const toast = document.querySelector("#toast");
const toastMessage = document.querySelector("#toastMessage");
const toastRetry = document.querySelector("#toastRetry");

const fields = {
  id: document.querySelector("#taskId"),
  title: document.querySelector("#titleInput"),
  description: document.querySelector("#descriptionInput"),
  day: document.querySelector("#dayInput"),
  category: document.querySelector("#categoryInput"),
  context: document.querySelector("#contextInput"),
  energy: document.querySelector("#energyInput"),
  completed: document.querySelector("#completedInput"),
  archived: document.querySelector("#archivedInput")
};

const fieldErrorTargets = {
  title: fields.title,
  description: fields.description,
  energy: fields.energy,
  context: fields.context
};

const filters = {
  search: document.querySelector("#searchInput"),
  energy: document.querySelector("#energyFilter"),
  difficulty: document.querySelector("#difficultyFilter"),
  category: document.querySelector("#categoryFilter"),
  context: document.querySelector("#contextFilter"),
  archived: document.querySelector("#archivedFilter"),
  completed: document.querySelector("#completedFilter")
};

function loadTasks() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const source = saved ? JSON.parse(saved) : seedTasks;
    return source.map(migrateTask);
  } catch (error) {
    showDeferredToast("Поврежденные локальные данные заменены демо-задачами.");
    return seedTasks.map(migrateTask);
  }
}

function loadOfflineQueue() {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]");
  } catch (error) {
    return [];
  }
}

function saveOfflineQueue() {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(store.offlineQueue));
}

function getSafeWeekKey() {
  try {
    const date = new Date();
    if (Number.isNaN(date.getTime())) return "week-unknown";
    const year = date.getFullYear();
    const firstDay = new Date(year, 0, 1);
    const dayOffset = Math.floor((date - firstDay) / 86400000);
    return `${year}-W${Math.ceil((dayOffset + firstDay.getDay() + 1) / 7)}`;
  } catch (error) {
    return "week-unknown";
  }
}

function showDeferredToast(message) {
  window.setTimeout(() => showToast(message, null), 0);
}

function migrateTask(task) {
  const seedTranslation = SEED_TRANSLATIONS[task.id];
  const rawEnergy = Number(task.energy) || 50;
  const migratedEnergy = rawEnergy <= 5 ? rawEnergy * 20 : rawEnergy;

  return {
    ...task,
    ...(seedTranslation || {}),
    day: DAY_MIGRATION[task.day] || task.day,
    title: sanitizeText(seedTranslation?.title ?? task.title ?? "", MAX_TITLE_LENGTH),
    description: sanitizeText(seedTranslation?.description ?? task.description ?? "", MAX_DESCRIPTION_LENGTH),
    context: seedTranslation?.context ?? normalizeContext(task.context),
    energy: clampEnergy(migratedEnergy)
  };
}

function normalizeContext(context) {
  return (Array.isArray(context) ? context : [])
    .map((tag) => sanitizeText(tag, MAX_CONTEXT_TAG_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_CONTEXT_TAGS);
}

function sanitizeText(value, maxLength) {
  return stripUnsafeText(value)
    .slice(0, maxLength);
}

function stripUnsafeText(value) {
  return String(value)
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>]/g, "")
    .trim();
}

function clampEnergy(value) {
  return Math.min(
    MAX_ENERGY_LIMIT,
    Math.max(MIN_ENERGY_LIMIT, Math.trunc(Number(value) || 50))
  );
}

function saveTasks(action = () => saveTasks()) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    store.tasks = tasks;
    hideToast();
  } catch (error) {
    showToast("Не удалось сохранить изменения.", action);
  }
}

function getFilterState() {
  return {
    search: filters.search.value,
    energy: filters.energy.value,
    difficulty: filters.difficulty.value,
    category: filters.category.value,
    context: filters.context.value,
    archived: filters.archived.checked,
    completed: filters.completed.checked
  };
}

function saveFilters() {
  store.filters = getFilterState();
  store.search = filters.search.value;
  localStorage.setItem(FILTERS_KEY, JSON.stringify(store.filters));
}

function restoreFilters() {
  try {
    const saved = JSON.parse(localStorage.getItem(FILTERS_KEY) || "{}");
    Object.entries(saved).forEach(([key, value]) => {
      if (!filters[key]) return;
      if (filters[key].type === "checkbox") {
        filters[key].checked = Boolean(value);
      } else {
        filters[key].value = value;
      }
    });
    searchQuery = filters.search.value;
    store.filters = getFilterState();
  } catch (error) {
    store.filters = getFilterState();
  }
}

function saveUiState() {
  const uiState = {
    theme: localStorage.getItem(THEME_KEY) || "light",
    lastViewedWeek: store.lastViewedWeek,
    collapsedStates: store.collapsedStates,
    boardScroll: board.scrollLeft
  };
  localStorage.setItem(UI_STATE_KEY, JSON.stringify(uiState));
}

function restoreUiState() {
  try {
    const uiState = JSON.parse(localStorage.getItem(UI_STATE_KEY) || "{}");
    store.lastViewedWeek = uiState.lastViewedWeek || store.lastViewedWeek;
    store.collapsedStates = uiState.collapsedStates || {};
    window.setTimeout(() => {
      board.scrollLeft = Number(uiState.boardScroll) || 0;
    }, 0);
  } catch (error) {
    saveUiState();
  }
}

function carryUnfinishedTasksToCurrentWeek() {
  const currentWeek = getSafeWeekKey();

  if (!store.lastViewedWeek || store.lastViewedWeek === currentWeek) {
    store.lastViewedWeek = currentWeek;
    saveUiState();
    return;
  }

  const unfinishedTasks = tasks
    .filter((task) => !task.completed && !task.archived)
    .sort((a, b) => {
      const dayDiff = DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
      return dayDiff || a.order - b.order;
    });

  if (unfinishedTasks.length === 0) {
    store.lastViewedWeek = currentWeek;
    saveUiState();
    return;
  }

  const now = new Date().toISOString();
  const orderByDay = Object.fromEntries(WORKDAYS.map((day) => [day, 0]));
  const movedTasks = new Set();

  tasks = tasks.map((task) => {
    if (task.completed || task.archived) return task;

    const index = unfinishedTasks.findIndex((item) => item.id === task.id);
    if (index < 0) return task;

    const nextDay = WORKDAYS[index % WORKDAYS.length];
    const nextOrder = orderByDay[nextDay];
    orderByDay[nextDay] += 1;
    movedTasks.add(task.id);

    return {
      ...task,
      day: nextDay,
      order: nextOrder,
      updatedAt: now
    };
  });

  store.lastViewedWeek = currentWeek;
  saveTasks();
  saveUiState();

  movedTasks.forEach((id) => {
    const task = tasks.find((item) => item.id === id);
    queueOperation("carry-over", { id, day: task.day, order: task.order, updatedAt: task.updatedAt });
  });

  showToast("Невыполненные задачи мягко перенесены на будни новой недели.", null);
}

function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function queueOperation(type, payload) {
  const operation = {
    id: createId(),
    type,
    payload,
    createdAt: new Date().toISOString()
  };

  if (!navigator.onLine) {
    store.offlineQueue.push(operation);
    saveOfflineQueue();
    showToast("Нет соединения. Все спокойно: изменение сохранено локально.", syncOfflineQueue);
    return;
  }

  simulateRealtimeSync(operation);
}

function syncOfflineQueue() {
  if (!navigator.onLine) {
    showToast("Соединение пока не восстановлено. Изменения остаются на устройстве.", syncOfflineQueue);
    return;
  }

  isSyncing = true;
  render();
  window.setTimeout(() => {
    store.offlineQueue.splice(0).forEach(simulateRealtimeSync);
    saveOfflineQueue();
    isSyncing = false;
    render();
    showToast("Локальные изменения синхронизированы.", null);
  }, 450);
}

function simulateRealtimeSync(operation) {
  const incomingUpdatedAt = operation.payload?.updatedAt;
  const localTask = operation.payload?.id
    ? tasks.find((task) => task.id === operation.payload.id)
    : null;

  if (
    localTask &&
    incomingUpdatedAt &&
    new Date(incomingUpdatedAt) < new Date(localTask.updatedAt)
  ) {
    showToast("Есть более свежая локальная версия. Оставили ее без потерь.", null);
  }
}

function initRealtime() {
  if (!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    return;
  }

  try {
    const client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    client
      .channel("tasks")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, (payload) => {
        const incoming = payload.new || payload.old;
        if (!incoming?.id) return;
        simulateRealtimeSync({ type: payload.eventType, payload: incoming });
      })
      .subscribe();
  } catch (error) {
    showDeferredToast("Синхронизация недоступна. Можно продолжать локально.");
  }
}

function normalizeDay(day) {
  return tasks
    .filter((task) => task.day === day)
    .sort((a, b) => a.order - b.order)
    .map((task, order) => ({ ...task, order }));
}

function normalizeTasks() {
  tasks = DAYS.flatMap((day) => normalizeDay(day));
}

function getDayDate(dayIndex) {
  const today = new Date();
  const mondayOffset = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - mondayOffset + dayIndex);
  return monday.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function getEnergyStatus(total) {
  if (total > 140) return { key: "overload", label: ENERGY_STATUS.overload };
  if (total > 100) return { key: "warning", label: ENERGY_STATUS.warning };
  return { key: "normal", label: ENERGY_STATUS.normal };
}

function getDayEnergy(tasksForDay) {
  return tasksForDay.reduce((sum, task) => sum + task.energy, 0);
}

function getFilteredTasks() {
  const query = searchQuery.trim().toLowerCase();
  const contextQuery = filters.context.value.trim().toLowerCase();
  const energy = filters.energy.value;
  const category = filters.category.value;
  const difficulty = filters.difficulty.value;
  const showArchived = filters.archived.checked;
  const onlyCompleted = filters.completed.checked;

  return tasks.filter((task) => {
    const inText =
      !query ||
      task.title.toLowerCase().includes(query) ||
      task.description.toLowerCase().includes(query) ||
      task.context.some((tag) => tag.toLowerCase().includes(query));

    const inContext =
      !contextQuery ||
      task.context.some((tag) => tag.toLowerCase().includes(contextQuery));

    return (
      inText &&
      inContext &&
      (!energy || task.energy === Number(energy)) &&
      (difficulty === "all" || task.difficulty === difficulty) &&
      (category === "all" || task.category === category) &&
      (!onlyCompleted || task.completed) &&
      (showArchived || !task.archived)
    );
  });
}

function render() {
  normalizeTasks();
  saveTasks();
  board.innerHTML = "";
  document.body.classList.toggle("is-syncing", isSyncing);

  if (tasks.length >= 1000 && !largeDatasetNoticeShown) {
    largeDatasetNoticeShown = true;
    showToast("Большая доска: показываем задачи постепенно, чтобы интерфейс оставался спокойным.", null);
  }

  if (isSyncing) {
    renderSkeletons();
    return;
  }

  const visibleTasks = getFilteredTasks();
  updateEnergySummary();
  const hasNoFilteredResults = visibleTasks.length === 0 && hasActiveFilters();

  DAYS.forEach((day, dayIndex) => {
    const dayTasks = visibleTasks
      .filter((task) => task.day === day)
      .sort((a, b) => a.order - b.order);
    const renderLimit = store.visibleLimits[day] || INITIAL_RENDER_LIMIT;
    const renderedDayTasks = dayTasks.slice(0, renderLimit);
    const totalEnergy = getDayEnergy(dayTasks);
    const energyStatus = getEnergyStatus(totalEnergy);

    const column = document.createElement("section");
    column.className = `day-column energy-${energyStatus.key}`;
    column.dataset.day = day;
    column.innerHTML = `
      <header class="column-header">
        <div>
          <h2 class="column-title">${day}</h2>
          <p class="column-date">${getDayDate(dayIndex)}</p>
          <p class="column-hint">${DAY_HINTS[day]}</p>
        </div>
        <button class="icon-button add-task" type="button" aria-label="Добавить задачу">+</button>
      </header>
      <div class="column-meta">
        <span>${dayTasks.length} задач</span>
        <span>${totalEnergy} энергии · ${energyStatus.label}</span>
      </div>
      <div class="load-track"><div class="load-fill"></div></div>
      <div class="task-list"></div>
    `;

    column.querySelector(".load-fill").style.width = `${Math.min(100, (totalEnergy / 140) * 100)}%`;

    const taskList = column.querySelector(".task-list");
    if (dayTasks.length === 0) {
      taskList.innerHTML = `
        <div class="empty-column">
          <span class="empty-icon">✦</span>
          <span>${hasNoFilteredResults ? "Задачи не найдены" : "Свободное место"}</span>
          <button class="secondary-button empty-add" type="button">Добавить</button>
        </div>
      `;
      taskList.querySelector(".empty-add").addEventListener("click", () => openCreateDialog(day));
    } else {
      renderedDayTasks.forEach((task) => taskList.append(createTaskCard(task)));
      if (dayTasks.length > renderedDayTasks.length) {
        const loadMoreButton = document.createElement("button");
        loadMoreButton.className = "secondary-button load-more";
        loadMoreButton.type = "button";
        loadMoreButton.textContent = `Показать еще ${Math.min(RENDER_BATCH_SIZE, dayTasks.length - renderedDayTasks.length)}`;
        loadMoreButton.addEventListener("click", () => {
          store.visibleLimits[day] = renderLimit + RENDER_BATCH_SIZE;
          render();
        });
        taskList.append(loadMoreButton);
      }
    }

    column.querySelector(".add-task").addEventListener("click", () => openCreateDialog(day));
    column.addEventListener("dragover", handleColumnDragOver);
    column.addEventListener("dragleave", () => {
      column.classList.remove("drag-over");
      removeDropPlaceholders();
    });
    column.addEventListener("drop", handleColumnDrop);
    board.append(column);
  });
}

function hasActiveFilters() {
  return Boolean(
    searchQuery.trim() ||
      filters.energy.value ||
      filters.difficulty.value !== "all" ||
      filters.category.value !== "all" ||
      filters.context.value.trim() ||
      filters.archived.checked ||
      filters.completed.checked
  );
}

function renderSkeletons() {
  board.innerHTML = DAYS.map(
    () => `
      <section class="day-column">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-line"></div>
        <div class="skeleton skeleton-card"></div>
        <div class="skeleton skeleton-card"></div>
      </section>
    `
  ).join("");
}

function updateEnergySummary() {
  const total = tasks
    .filter((task) => !task.archived)
    .reduce((sum, task) => sum + task.energy, 0);
  const completed = tasks.filter((task) => task.completed && !task.archived).length;
  energySummary.textContent = `Энергия недели: ${total} · выполнено ${completed}`;
}

function createTaskCard(task) {
  const card = document.createElement("article");
  card.className = `task-card${task.completed ? " completed" : ""}`;
  card.draggable = true;
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Открыть задачу: ${task.title}`);
  card.dataset.id = task.id;

  const contextBadges = task.context
    .slice(0, 3)
    .map((tag) => `<span class="badge sky">${escapeHtml(tag)}</span>`)
    .join("");
  card.innerHTML = `
    <div class="task-top">
      <div>
        <h3>${escapeHtml(task.title)}</h3>
        ${task.description ? `<p>${escapeHtml(task.description)}</p>` : ""}
      </div>
      <div class="quick-actions" aria-label="Быстрые действия">
        <button class="quick-button complete-task" type="button" aria-label="Выполнить">✓</button>
        <button class="quick-button edit-task" type="button" aria-label="Редактировать">✎</button>
        <button class="quick-button duplicate-task" type="button" aria-label="Дублировать" ${isSyncing ? "disabled" : ""}>⧉</button>
        <button class="quick-button delete-task" type="button" aria-label="Удалить">×</button>
      </div>
    </div>
    <div class="badge-row">
      <span class="badge">${DIFFICULTY_LABELS[task.difficulty]}</span>
      <span class="badge lilac">${CATEGORY_LABELS[task.category]}</span>
      ${contextBadges}
      ${task.completed ? `<span class="badge">Готово</span>` : ""}
      ${task.archived ? `<span class="badge coral">Архив</span>` : ""}
    </div>
    <footer class="task-footer">
      <span>${energyBars(task.energy)} ${task.energy}/100</span>
    </footer>
  `;

  card.addEventListener("click", (event) => {
    if (event.target.closest(".quick-button")) return;
    openEditDialog(task.id);
  });
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openEditDialog(task.id);
    }
  });
  card.addEventListener("dragstart", (event) => {
    event.dataTransfer.setData("text/plain", task.id);
    store.drag.activeId = task.id;
    card.classList.add("dragging");
    document.body.classList.add("is-dragging");
  });
  card.addEventListener("dragend", () => {
    store.drag.activeId = null;
    card.classList.remove("dragging");
    document.body.classList.remove("is-dragging");
    removeDropPlaceholders();
  });
  card.addEventListener("touchstart", () => {
    store.drag.activeId = task.id;
  }, { passive: true });
  card.addEventListener("touchmove", (event) => {
    const touch = event.touches[0];
    store.drag.touch = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });
  card.addEventListener("touchend", () => {
    const point = store.drag.touch;
    if (!point) return;
    const column = document.elementFromPoint(point.x, point.y)?.closest(".day-column");
    if (column?.dataset.day) {
      moveTaskToDay(task.id, column.dataset.day);
    }
    store.drag.activeId = null;
    store.drag.touch = null;
  });
  card.querySelector(".complete-task").addEventListener("click", (event) => {
    event.stopPropagation();
    toggleTaskComplete(task.id);
  });
  card.querySelector(".edit-task").addEventListener("click", (event) => {
    event.stopPropagation();
    openEditDialog(task.id);
  });
  card.querySelector(".duplicate-task").addEventListener("click", (event) => {
    event.stopPropagation();
    duplicateTask(task.id);
  });
  card.querySelector(".delete-task").addEventListener("click", (event) => {
    event.stopPropagation();
    deleteTask(task.id);
  });

  return card;
}

function toggleTaskComplete(id) {
  tasks = tasks.map((task) =>
    task.id === id
      ? { ...task, completed: !task.completed, updatedAt: new Date().toISOString() }
      : task
  );
  queueOperation("update", { id, updatedAt: new Date().toISOString() });
  render();
}

function duplicateTask(id) {
  if (isSyncing) return;
  const task = tasks.find((item) => item.id === id);
  if (!task) return;
  const now = new Date().toISOString();
  const order = tasks.filter((item) => item.day === task.day).length;
  tasks.push({
    ...task,
    id: createId(),
    title: `${task.title} — копия`,
    completed: false,
    archived: false,
    order,
    createdAt: now,
    updatedAt: now
  });
  queueOperation("create", tasks[tasks.length - 1]);
  render();
}

function deleteTask(id) {
  if (!tasks.some((task) => task.id === id)) {
    showToast("Задача уже удалена.", null);
    return;
  }
  tasks = tasks.filter((task) => task.id !== id);
  queueOperation("delete", { id, updatedAt: new Date().toISOString() });
  render();
}

function energyBars(energy) {
  return `<span class="energy-bars">${[1, 2, 3, 4, 5]
    .map((bar) => `<span class="${bar <= Math.ceil(energy / 20) ? "active" : ""}"></span>`)
    .join("")}</span>`;
}

function openCreateDialog(day = "Понедельник") {
  clearInlineErrors();
  dialogTitle.textContent = "Новая задача";
  deleteTaskButton.classList.add("hidden");
  store.selectedTask = null;
  store.modal = { open: true, mode: "create" };
  form.reset();
  fields.id.value = "";
  fields.day.value = day;
  setDifficultyValue("easy");
  fields.category.value = "personal";
  fields.energy.value = "50";
  updateEnergyValue();
  updateContextPreview();
  dialog.showModal();
}

function openEditDialog(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task) return;

  clearInlineErrors();
  dialogTitle.textContent = "Редактировать задачу";
  deleteTaskButton.classList.remove("hidden");
  store.selectedTask = task;
  store.modal = { open: true, mode: "edit" };
  fields.id.value = task.id;
  fields.title.value = task.title;
  fields.description.value = task.description;
  fields.day.value = task.day;
  setDifficultyValue(task.difficulty);
  fields.category.value = task.category;
  fields.context.value = task.context.join(", ");
  fields.energy.value = String(task.energy);
  updateEnergyValue();
  fields.completed.checked = task.completed;
  fields.archived.checked = task.archived;
  updateContextPreview();
  dialog.showModal();
}

function closeDialog() {
  store.modal.open = false;
  store.selectedTask = null;
  clearInlineErrors();
  dialog.close();
}

function parseContext(value) {
  return value
    .split(",")
    .map((tag) => sanitizeText(tag, MAX_CONTEXT_TAG_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_CONTEXT_TAGS);
}

function getDifficultyValue() {
  return form.querySelector('input[name="difficultyInput"]:checked')?.value || "easy";
}

function setDifficultyValue(value) {
  const input = form.querySelector(`input[name="difficultyInput"][value="${value}"]`);
  if (input) input.checked = true;
}

function updateEnergyValue() {
  energyValue.textContent = fields.energy.value;
}

function updateContextPreview() {
  const tags = parseContext(fields.context.value);
  contextPreview.innerHTML = tags
    .map((tag) => `<span class="badge sky">${escapeHtml(tag)}</span>`)
    .join("");
}

function clearInlineErrors() {
  form.querySelectorAll(".field-error").forEach((error) => error.remove());
  Object.values(fieldErrorTargets).forEach((field) => {
    field?.removeAttribute("aria-invalid");
  });
}

function showFieldError(name, message) {
  const target = fieldErrorTargets[name];
  if (!target) return;

  target.setAttribute("aria-invalid", "true");
  const error = document.createElement("p");
  error.className = "field-error";
  error.textContent = message;
  target.closest("label")?.append(error);
}

function validateTaskInput(input) {
  const errors = {};
  const rawTags = fields.context.value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  if (!input.title) errors.title = "Введите название задачи.";
  if (input.title.length > MAX_TITLE_LENGTH) {
    errors.title = `Название должно быть не длиннее ${MAX_TITLE_LENGTH} символов.`;
  }
  if (input.description.length > MAX_DESCRIPTION_LENGTH) {
    errors.description = `Описание должно быть не длиннее ${MAX_DESCRIPTION_LENGTH} символов.`;
  }
  if (!Number.isInteger(input.energy) || input.energy < MIN_ENERGY_LIMIT || input.energy > MAX_ENERGY_LIMIT) {
    errors.energy = "Энергия должна быть целым числом от 1 до 100.";
  }
  if (rawTags.length > MAX_CONTEXT_TAGS) {
    errors.context = `Можно указать максимум ${MAX_CONTEXT_TAGS} тегов.`;
  }
  if (rawTags.some((tag) => tag.length > MAX_CONTEXT_TAG_LENGTH)) {
    errors.context = `Каждый тег должен быть не длиннее ${MAX_CONTEXT_TAG_LENGTH} символов.`;
  }
  return errors;
}

function showInlineErrors(errors) {
  clearInlineErrors();
  Object.entries(errors).forEach(([name, message]) => showFieldError(name, message));
  const firstError = form.querySelector("[aria-invalid='true']");
  firstError?.focus();
}

function handleSubmit(event) {
  event.preventDefault();

  const now = new Date().toISOString();
  const id = fields.id.value;
  const input = {
    title: stripUnsafeText(fields.title.value),
    description: stripUnsafeText(fields.description.value),
    day: fields.day.value,
    difficulty: getDifficultyValue(),
    category: fields.category.value,
    context: parseContext(fields.context.value),
    energy: clampEnergy(fields.energy.value),
    completed: fields.completed.checked,
    archived: fields.archived.checked
  };
  const errors = validateTaskInput(input);

  if (Object.keys(errors).length > 0) {
    showInlineErrors(errors);
    return;
  }

  const safeInput = {
    ...input,
    title: sanitizeText(input.title, MAX_TITLE_LENGTH),
    description: sanitizeText(input.description, MAX_DESCRIPTION_LENGTH),
    context: parseContext(fields.context.value)
  };

  if (id) {
    tasks = tasks.map((task) =>
      task.id === id ? { ...task, ...safeInput, updatedAt: now } : task
    );
    queueOperation("update", { id, ...safeInput, updatedAt: now });
  } else {
    const order = tasks.filter((task) => task.day === safeInput.day).length;
    const task = {
      id: createId(),
      ...safeInput,
      order,
      createdAt: now,
      updatedAt: now
    };
    tasks.push(task);
    queueOperation("create", task);
  }

  closeDialog();
  render();
}

function handleDelete() {
  const id = fields.id.value;
  if (!id) return;
  if (!tasks.some((task) => task.id === id)) {
    showToast("Задача уже удалена.", null);
    closeDialog();
    return;
  }
  tasks = tasks.filter((task) => task.id !== id);
  queueOperation("delete", { id, updatedAt: new Date().toISOString() });
  closeDialog();
  render();
}

function handleColumnDragOver(event) {
  event.preventDefault();
  const column = event.currentTarget;
  column.classList.add("drag-over");
  showDropPlaceholder(column);
}

function handleColumnDrop(event) {
  event.preventDefault();
  const column = event.currentTarget;
  column.classList.remove("drag-over");
  removeDropPlaceholders();

  const id = event.dataTransfer.getData("text/plain") || store.drag.activeId;
  const day = column.dataset.day;
  const task = tasks.find((item) => item.id === id);
  if (!task || !day) return;

  const targetCards = [...column.querySelectorAll(".task-card:not(.dragging)")];
  const overCard = targetCards.find((card) => {
    const rect = card.getBoundingClientRect();
    return event.clientY < rect.top + rect.height / 2;
  });
  const nextOrder = overCard
    ? tasks.find((item) => item.id === overCard.dataset.id)?.order ?? 0
    : tasks.filter((item) => item.day === day && item.id !== id).length;
  const signature = `${id}:${day}:${nextOrder}`;
  const now = Date.now();

  if (store.drag.lastDropSignature === signature && now - store.drag.lastDropAt < 350) {
    return;
  }

  store.drag.lastDropSignature = signature;
  store.drag.lastDropAt = now;

  moveTaskToDay(id, day, nextOrder);
}

function moveTaskToDay(id, day, orderOverride) {
  const task = tasks.find((item) => item.id === id);
  if (!task || !day) return;
  const nextOrder =
    orderOverride ?? tasks.filter((item) => item.day === day && item.id !== id).length;

  tasks = tasks.map((item) =>
    item.id === id
      ? { ...item, day, order: nextOrder, updatedAt: new Date().toISOString() }
      : item.day === day && item.id !== id && item.order >= nextOrder
        ? { ...item, order: item.order + 1 }
        : item
  );
  queueOperation("reorder", { id, day, order: nextOrder, updatedAt: new Date().toISOString() });
  render();
}

function showDropPlaceholder(column) {
  removeDropPlaceholders();
  const placeholder = document.createElement("div");
  placeholder.className = "drop-placeholder";
  placeholder.textContent = "Переместить сюда";
  column.querySelector(".task-list").append(placeholder);
}

function removeDropPlaceholders() {
  document.querySelectorAll(".drop-placeholder").forEach((item) => item.remove());
}

function showToast(message, action) {
  retryAction = action;
  toastMessage.textContent = message;
  toast.classList.add("visible");
}

function hideToast() {
  toast.classList.remove("visible");
}

function debounce(callback, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => callback(...args), delay);
  };
}

const saveUiStateDebounced = debounce(saveUiState, 250);

const renderDebounced = debounce(() => {
  saveFilters();
  render();
}, 120);

function handleGlobalDrop(event) {
  if (!event.target.closest(".day-column")) {
    store.drag.activeId = null;
    document.body.classList.remove("is-dragging");
    removeDropPlaceholders();
    showToast("Задача осталась на месте. Перетащите ее в нужный день.", null);
  }
}

function handleConnectionChange() {
  if (navigator.onLine) {
    showToast("Соединение восстановлено. Синхронизируем спокойно.", syncOfflineQueue);
    syncOfflineQueue();
  } else {
    showToast("Офлайн-режим: изменения сохраняются локально.", null);
  }
}

function handleHotkeys(event) {
  const target = event.target;
  const isTyping =
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement;

  if (event.key === "Escape" && dialog.open) {
    closeDialog();
    return;
  }

  if (event.key === "/" && !dialog.open) {
    event.preventDefault();
    filters.search.focus();
    return;
  }

  if ((event.key === "n" || event.key === "N" || event.key === "т" || event.key === "Т") && !isTyping) {
    event.preventDefault();
    openCreateDialog();
    return;
  }

  if (event.key === "Delete" && dialog.open && store.selectedTask) {
    event.preventDefault();
    handleDelete();
  }
}

function escapeHtml(value) {
  const element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
}

function initDayOptions() {
  fields.day.innerHTML = DAYS.map((day) => `<option value="${day}">${day}</option>`).join("");
}

document.querySelector("#newTaskButton").addEventListener("click", () => openCreateDialog());
document.querySelector("#fabButton").addEventListener("click", () => openCreateDialog());
document.querySelector("#closeDialogButton").addEventListener("click", closeDialog);
document.querySelector("#cancelButton").addEventListener("click", closeDialog);
deleteTaskButton.addEventListener("click", handleDelete);
form.addEventListener("submit", handleSubmit);
fields.energy.addEventListener("input", updateEnergyValue);
fields.context.addEventListener("input", updateContextPreview);
filters.search.addEventListener(
  "input",
  debounce((event) => {
    searchQuery = event.target.value;
    saveFilters();
    render();
  }, 300)
);
Object.entries(filters)
  .filter(([key]) => key !== "search")
  .forEach(([, filter]) => filter.addEventListener("input", renderDebounced));
toastRetry.addEventListener("click", () => {
  if (retryAction) retryAction();
});
board.addEventListener("scroll", saveUiStateDebounced);
document.addEventListener("drop", handleGlobalDrop);
document.addEventListener("keydown", handleHotkeys);
window.addEventListener("online", handleConnectionChange);
window.addEventListener("offline", handleConnectionChange);
window.addEventListener("beforeunload", saveUiState);

initDayOptions();
restoreFilters();
restoreUiState();
carryUnfinishedTasksToCurrentWeek();
initRealtime();
isSyncing = true;
render();
setTimeout(() => {
  isSyncing = false;
  render();
}, 450);
