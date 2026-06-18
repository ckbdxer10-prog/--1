# Планы недели

SPA-планировщик недели в формате канбан-доски.

## Стек

- HTML
- CSS
- JavaScript

## Файлы

- `index.html` - структура приложения
- `styles.css` - визуальный стиль и адаптив
- `script.js` - логика задач, фильтры, перетаскивание, локальное хранение

## Ограничения полей

- Описание необязательное, максимум 1000 символов
- Энергия - целое число от 1 до 100
- Контекст - максимум 5 тегов
- Каждый тег контекста - максимум 20 символов

## Интерфейс

- Стиль: элегантный минимализм
- Основная палитра: светлый фон, поверхность, золото, мягкие статусы
- Название приложения: `Планы недели`
- Фон: мягкие цветочные элементы в палитре планировщика
- Радиусы: 20px
- Тени: `0 4px 20px rgba(0, 0, 0, 0.06)`
- На desktop 1440px+ отображаются все 7 колонок без горизонтальной прокрутки
- На tablet включается горизонтальная прокрутка доски
- На mobile отображается 1 колонка на экран, свайп между днями, sticky-фильтры и FAB-кнопка добавления

## Главный UX-принцип

Приложение не должно давить, перегружать или вызывать тревожность.

Интерфейс помогает мягко распределять нагрузку и чувствовать контроль над жизнью без ощущения гонки продуктивности:

- статусы энергии формулируются поддерживающе
- empty states оставляют ощущение пространства, а не пустоты
- ошибки объясняются спокойно и предлагают следующий шаг
- большие списки показываются постепенно
- офлайн и конфликты синхронизации не пугают пользователя потерей данных

## Главный экран

- Header: логотип, название недели, поиск, фильтры, сводка энергии
- Board: 7 колонок дней
- Колонка: день, дата, суммарная энергия, статус энергии, счетчик задач, список задач, кнопка добавления
- Карточка: название, категория, энергия, сложность, контекстные теги, статус выполнения

## Поведение

- Клик по карточке открывает редактирование
- Hover показывает быстрые действия: выполнить, редактировать, удалить, дублировать
- Drag start: карточка увеличивается, появляется тень, остальные карточки становятся прозрачнее
- Drag over: колонка подсвечивается и показывает placeholder
- Drop: обновляются день, порядок, состояние и localStorage
- Поиск работает по названию, описанию и тегам с debounce 300ms
- Фильтрация мгновенная, клиентская, без перезагрузки
- При переходе на новую неделю невыполненные задачи автоматически переносятся на будни, с понедельника по пятницу, пока не будут выполнены

## Фильтры

- Категория
- Сложность
- Энергия
- Выполнено
- Контекстные теги

## Модальное окно

- Режимы: создание и редактирование
- Поля: название, описание, день, сложность, категория, контекст, энергия, выполнено
- Сложность оформлена как segmented control
- Контекст вводится как multi-tag через запятую с предпросмотром тегов
- Энергия задается slider

## Статусы энергии дня

- 0-100: Норма
- 101-140: Много нагрузки
- 141+: Нужна пауза

## Состояния

- Пустая колонка показывает иконку, текст и кнопку добавления
- Пустой поиск показывает сообщение `Задачи не найдены`
- При загрузке показываются skeleton-карточки
- Во время синхронизации отображается мягкий spinner
- Ошибки сохранения показываются toast-уведомлением с повтором
- Ошибки формы показываются inline под соответствующим полем

## Edge Cases

- Пустое или слишком длинное название блокируется inline validation
- Слишком длинные теги обрезаются до 20 символов, максимум 5 тегов
- Duplicate drag/drop игнорируется
- Drop вне колонки показывает toast
- Удаление уже удаленной задачи показывает toast
- Для 1000+ задач показывается performance notice
- Offline и потеря соединения переводят операции в локальную очередь
- После reconnect очередь синхронизируется
- Realtime conflict сохраняет более новую локальную версию
- Touch drag mobile, scroll during drag и rapid updates обработаны на клиенте

## State Management

В трехфайловом HTML/CSS/JS варианте используется lightweight vanilla store, который хранит:

- tasks
- filters
- search
- selected task
- modal state
- drag state

Zustand требует npm-сборку, поэтому для текущего стека реализован эквивалент без зависимости.

## Local Storage

Сохраняются:

- задачи
- фильтры
- тема
- последняя открытая неделя
- collapsed states
- scroll доски
- offline queue

## Offline-first и Realtime

- В offline-режиме операции сохраняются локально
- После reconnect запускается sync очереди
- Supabase Realtime подключается автоматически, если на странице доступны `window.supabase`, `window.SUPABASE_URL`, `window.SUPABASE_ANON_KEY`

## A11Y и Hotkeys

- Карточки доступны с клавиатуры через `Enter` и `Space`
- Есть ARIA labels, focus states и screen reader status для toast
- `N` - новая задача
- `/` - фокус на поиск
- `ESC` - закрыть модальное окно
- `DEL` - удалить выбранную задачу в режиме редактирования

## Performance

- Lazy rendering длинных списков: колонка сначала показывает ограниченный батч задач
- Для длинных колонок доступна кнопка `Показать еще`
- Drag-анимации сделаны через transform/opacity для 60fps
- Нет layout shift для основных контролов
- Для Lighthouse > 90 и TTI < 2s проект остается без сборки и тяжелых runtime-зависимостей

## Security

- Inputs очищаются перед сохранением
- Вывод пользовательского текста проходит через HTML escaping
- XSS через `<` и `>` дополнительно нейтрализуется при сохранении
- Backend validation и secure auth должны дублировать клиентские ограничения на API-слое
- RLS policies описаны в `supabase/schema.sql`

## API Contracts

### GET `/tasks`

```json
[
  {
    "id": "uuid",
    "title": "Read book",
    "day": "monday"
  }
]
```

### POST `/tasks`

```json
{
  "title": "New Task",
  "day": "monday",
  "energy": 20
}
```

### PATCH `/tasks/:id`

```json
{
  "day": "friday",
  "order": 2
}
```

### DELETE `/tasks/:id`

```json
{
  "success": true
}
```

## Testing

Для текущего трехфайлового варианта тесты описаны как обязательный следующий шаг при добавлении test runner:

- Unit: validators, store, utils
- Integration: drag-and-drop, modal create, filters
- E2E: create task, edit task, move task, delete task

## Code Style

Текущая версия работает без сборки. При переходе на production stack:

- TypeScript strict mode
- ESLint
- Prettier
- no any
- no console.log
- Components: PascalCase
- Hooks: camelCase
- Constants: UPPER_SNAKE_CASE

## Definition of Done

- CRUD работает
- Drag-and-drop работает
- Realtime adapter добавлен
- Filters работают
- Mobile responsive готов
- Анимации плавные
- Интервалы консистентные
- Accessibility support добавлен
- Layout shift минимизирован

## MVP Roadmap

- Day 1: setup project, Tailwind, Supabase, layout
- Day 2: board UI, columns, task cards
- Day 3: drag-and-drop, Zustand store, animations
- Day 4: modals, forms, validation
- Day 5: filters, search, energy logic
- Day 6: backend integration, realtime sync, optimistic updates
- Day 7: mobile adaptation, accessibility, polishing, bug fixing

## Post-MVP Features

- AI planning assistant
- Recurring tasks
- Pomodoro timer
- Calendar sync
- Google Calendar integration
- Notion sync
- Voice input
- Analytics dashboard
- Mood tracking
- AI energy prediction

## Запуск

Откройте `index.html` в браузере. Сервер и сборка не нужны.
