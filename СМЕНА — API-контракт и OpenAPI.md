# СМЕНА — API-контракт и OpenAPI

Sep 26, 2026 · @yvla

API-контракт backend ↔ frontend для мини-приложения «Смена», построенный от уже готового Figma-дизайна (файл `mQhuNOshLTorGyHCVpyEaf`, страницы 01–08), а не от абстрактной модели данных. Источники: архитектурный MD (раздел «Конвенции API» и таблица из 15 endpoint'ов — переиспользована без дублирования) и UI MD (экраны, статусы, тексты). Полный `openapi.yaml` — раздел 8; файл также отправлен отдельным вложением для вставки в Swagger Editor.

## 1. Figma → API анализ

Пройдено по методике задания: экран → что отображается (backend) → что вводит пользователь → действие → что обновляется → что локально → ошибки → состояния. Полная построчная развёртка — в разделе 6 (Matrix); здесь — анализ по группам с акцентом на то, что **не** уходит на backend, и почему.

### Employee

| Экран | Отображает (backend) | Действие → API | Локально (frontend-only) |
| --- | --- | --- | --- |
| Connect | — (экран ждёт `GET /me` → 403 `NOT_LINKED`) | Само подключение — вне мини-аппа (бот, deeplink `join_<code>`); мини-апп только опрашивает `GET /me` | Плашка «Демо-данные», если `isDemo` |
| Home | остаток дней, дата расчёта, текущая заявка — `GET /me` + `GET /leave-requests?scope=mine` | Тап по заявке → «Моя заявка» | Выбор вкладки нижнего меню (набор вкладок — производная от `me.roles`, сам таб-бар локален) |
| New Request → Calendar | занятые окна коллег — `GET /team/calendar` | Каждое изменение дат → `POST /leave-requests/preview` (debounce 300 мс) | Рисование календаря, выбор дат до отправки — состояние формы |
| Verdict Banner (Green/Yellow/Red) | весь вердикт целиком (`level`, `checks[]`, `suggestion`, дедлайны) — из ответа `preview` | Кнопка «Отправить на согласование» / «Подать на {дату}» → `POST /leave-requests` | Комментарий (черновик до отправки) |
| My Request | статус, вердикт, история, документы — `GET /leave-requests/{id}` | «Отозвать заявку» → `POST /leave-requests/{id}/cancel` | — |
| My Documents | список документов сотрудника — Рекомендация: `documents[]` внутри `GET /leave-requests?scope=mine`, без отдельного списочного endpoint'а (в архитектурном MD нет `GET /api/documents`) | Тап по карточке → Document Card | Фильтр/сортировка списка, если есть, — локально |
| Document Card / Detail | номер, статус, подписанты, PDF-ссылка, sha256 — `GET /documents/{id}` | «Скачать» — открывает `pdfUrl` | Превью PDF средствами платформы |
| Signing | те же данные документа + шаг подписи | **Frontend/device**: `BiometricManager.authenticate()` — биометрия локальна на устройстве, backend её не видит. **Backend**: подтверждение результата подписи — ⚠️ endpoint не задокументирован, см. GAP-01 | Анимация/статус «идёт проверка» во время биометрии |
| biometric states (success/cancelled/fallback/duplicate tap) | — | `cancelled`/`fallback` не доходят до backend вообще (локальный результат `BiometricManager`); `success` инициирует запрос из GAP-01 | Все 4 состояния — локальный UI-стейт экрана Signing |
| График команды | то же, что `team/calendar`, в разрезе месяца | — | Переключение месяца — параметры `from/to` пересчитываются локально и уходят новым запросом |
| Подработка → Доступность | текущие окна доступности — Рекомендация: `GET /me/availability` (архитектурный MD описывает только `PUT`) | Переключатель + расписание → `PUT /me/availability` | Черновик формы до сохранения |
| Подработка → Предложение смены | детали, score, reasons — Рекомендация: `GET /shift-offers/{id}` (экран открывается по deeplink `off_<id>` и должен получить данные откуда-то) | «Выйду» → `POST /shift-offers/{id}/accept`; «Не смогу» → ⚠️ GAP-05 | — |

### Manager

| Экран | Отображает (backend) | Действие → API | Локально |
| --- | --- | --- | --- |
| Inbox | заявки точки на согласовании — `GET /leave-requests?scope=inbox` (403 для не-manager) | Тап → Approval | Сегменты «Ждут решения»/«Решённые» — локальная группировка по `status`, без отдельного query-параметра |
| Approval | вердикт, checks, история — `GET /leave-requests/{id}` | «Согласовать» → `POST /leave-requests/{id}/approve` (`method: biometric\|confirm`) | Выбор способа подтверждения (биометрия доступна → иначе шторка-фолбэк) — локальное решение платформы |
| Reject Bottom Sheet | быстрые причины (chips), чипы альтернативных дат — статичны тексты UI, не API | `reasonCode`/`reasonText`, `alternativeStart/End` | Кнопка «Отклонить» активна только когда указана причина → `POST /leave-requests/{id}/reject` |
| Team | состав команды, кто в отпуске — Рекомендация: `GET /team/calendar` с широким `from/to`; отдельного «sostav команды» endpoint'а в MD нет | — | — |
| Подмены → Candidate Swipe Card | score, reasons по каждому кандидату (без фото/возраста/пола) — `GET /shifts/{id}/candidates` | Свайп вправо → `POST /shift-offers`; свайп влево → пропуск кандидата без запроса к backend | Позиция свайпа в стопе — локально |

### Accountant

| Экран | Отображает (backend) | Действие → API | Локально |
| --- | --- | --- | --- |
| Document Registry | список всех документов компании — ⚠️ ни один из 15 endpoint'ов архитектурного MD это не отдаёт (`GET /documents/{id}` — только карточка одного). См. GAP-03 | — | Фильтры/поиск — на том, что вернёт GAP-03 |
| Document Card | то же, что у Employee — `GET /documents/{id}` | Скачать / перейти в учёт | — |
| Сроки выплат | список документов с приближающимся/просроченным `payBy`, кнопка «Отметить выплату» — ⚠️ нет ни списочного endpoint'а, ни действия — См. GAP-04 | — | — |
| Review Queue | то же `documents`, фильтрованные по `status=to_sign\|in_accounting` — часть того же GAP-03, не отдельный gap | — | Фильтр по статусу — локально, если список уже загружен |
| Журнал | записи аудита — `GET /audit?requestId` (+ Рекомендация: `employeeId/from/to` — совместимое расширение того же endpoint'а для ленты без привязки к заявке) | «Собрать папку к проверке» → `GET /audit/export` (ZIP) | — |

### Admin

| Экран | Состояние API |
| --- | --- |
| Company Connect | ⚠️ Не задокументировано ни в одном MD (создание компании, точек, генерация `join_<code>`). См. GAP-06 |
| Employees | ⚠️ Список/добавление/роли сотрудников — не задокументировано. См. GAP-06 |
| Settings → Основания | Единственный кусок Admin с реальным покрытием — `GET /rules` отдаёт YAML-справочник как есть (чтение, без редактирования — правка в YAML вне API-контракта) |
| Settings → остальное | ⚠️ Не задокументировано. См. GAP-06 |

### States (сквозные, п. 10 UI MD)

| Состояние | Механизм |
| --- | --- |
| loading | Фронтенд показывает скелетон, пока любой GET-запрос в полёте — чисто frontend-стейт |
| empty | Пустой массив `[]` в ответе списочного endpoint'а (напр. `leave-requests`, `documents`) — текст пустого состояния локален |
| error | Сетевая/500 ошибка — единый `ErrorResponse`, кнопка «Повторить» переделывает тот же запрос |
| forbidden | 403 `FORBIDDEN` — действие/объект не для этой роли |
| not-linked | 403 `NOT_LINKED` на `GET /me` — единственное место, где он возникает (дальше все экраны недостижимы) |
| already-resolved | `approve`/`accept` повторно → 200 идемпотентно; `reject` повторно → 409 `ALREADY_RESOLVED` (разные действия — разная семантика, см. раздел 5) |
| recalculated verdict | Каждый `preview` пересчитывает заново; сам `submit` тоже пересчитывает и не доверяет вердикту из `preview` — если расхождение, побеждает свежий расчёт |
| biometric cancelled | Локально на устройстве — запрос к backend не уходит, шторка-фолбэк предлагает `method: confirm` |
| duplicate tap | Фронтенд блокирует кнопку на время запроса; если всё же два `approve` ушли — второй идемпотентен (200, то же состояние), не ошибка |
| unsaved form | Черновик формы (New Request даты, комментарий; Availability) — чисто локальное состояние до нажатия кнопки сохранения |

## 2. Основные user flows

Каждый — цепочка Frontend → API → Backend → DB/Rules Engine → API Response → Figma state.

**1. Подключение сотрудника** — бот (deeplink `join_<code>`) → вне API этого контракта → связывает `max_user_id` с `employees.id` → таблица `employees` → — → мини-апп теперь открывается без 403 `NOT_LINKED` на `GET /me`. Граница: само создание связи — вне этого API-контракта (бот-логика).

**2. Просмотр Home** — открытие экрана → `GET /me` + `GET /leave-requests?scope=mine` → чтение `employees`, `leave_requests` → — → `Me` + `LeaveRequestSummary[]` → остаток дней крупно, карточка текущей заявки (если есть), нижнее меню по ролям.

**3. Preview заявки** — выбор дат в календаре → `POST /leave-requests/preview {startDate, endDate}` → Rules Engine прогоняет все `Norm` из YAML против дат и `employees.leave_balance`, без записи в `leave_requests` → читает `employees`, `team_calendar`/`leave_requests` (пересечения), справочник правил → `Verdict {level, checks[], suggestion, …}` → Verdict Banner меняет цвет/текст без перезагрузки экрана.

**4. Создание заявки** — кнопка «Отправить» → `POST /leave-requests {startDate, endDate, comment}` → сервер пересчитывает вердикт заново (не доверяет preview с клиента) → INSERT в `leave_requests` (`status=pending`) + снимок `verdict`/`rulesVersion` + запись в `audit_log` (`leave.submitted`) → `LeaveRequestDetail` (201) → экран «Моя заявка», статус `pending`; worker шлёт карточку руководителю в чат (вне этого API).

**5. Согласование** — кнопка «Согласовать» (после `BiometricManager.authenticate()` на устройстве) → `POST /leave-requests/{id}/approve {method}` → проверка роли `manager` + своей точки, идемпотентность повторного вызова → UPDATE `leave_requests.status=approved` → формирование документов (`documents.status=formed`, вне этого endpoint'а, асинхронно) + `audit_log` → `LeaveRequestDetail` (200) → статус `approved`, баннер успеха у руководителя, уведомление сотруднику (вне API).

**6. Отклонение** — шторка «Отказ», причина + альтернативная дата → `POST /leave-requests/{id}/reject {reasonCode, reasonText, alternativeStart, alternativeEnd}` → та же проверка роли; повторный вызов — 409, не идемпотентно (отказ нельзя применить дважды) → UPDATE `leave_requests.status=rejected` + `reject_reason` → `audit_log` → `LeaveRequestDetail` (200) → статус `rejected`, причина и альтернативная дата на экране сотрудника.

**7. Просмотр документов** — тап по карточке документа → `GET /documents/{id}` → чтение `documents` + проверка доступа (владелец/подписант/бухгалтер/админ) → — → `DocumentDetail` с временной `pdfUrl` → карточка документа, превью PDF, строка целостности.

**8. Подписание** — экран Signing, кнопка «Подписать» → **frontend/device**: `BiometricManager.authenticate()`, backend не участвует → при успехе **⚠️ GAP-01**: дальше в архитектурном MD нет endpoint'а, который бы переводил `documents.status → signed` и добавлял запись в `signers[]` — цепочка обрывается на этом шаге, решение — за командой.

**9. Подмена** — руководитель открывает Подмены для открытой смены → `GET /shifts/{id}/candidates` → `score_candidate()` считает ранжирование по доступности/расстоянию/истории смен (без фото/возраста/пола) → чтение `availability`, `shifts` → `ShiftCandidate[]` → карточки со свайпом; свайп вправо → `POST /shift-offers {shiftId, employeeId}` → INSERT `shift_offers (status=proposed)` → — → `ShiftOffer` (201) → бот шлёт кандидату deeplink `off_<id>`; тот открывает экран «Предложение смены», кнопка «Выйду» → `POST /shift-offers/{id}/accept` → UPDATE `shift_offers.status=accepted` + `shifts.status=filled` → — → `ShiftOffer` (200) → смена закрыта у руководителя.

## 3. API endpoints

16 путей, все — с причиной существовать (экран Figma или архитектурный MD). Никаких дубликатов 15 endpoint'ов из MD — каждый взят ровно один раз, путь и метод — как в MD.

| Endpoint | Источник | Какой экран вызывает |
| --- | --- | --- |
| `GET /me` | архитектурный MD, как есть | Home (шапка), Connect (проверка привязки) |
| `POST /leave-requests/preview` | архитектурный MD, как есть | New Request → календарь → Verdict Banner |
| `GET /leave-requests?scope=` | архитектурный MD (`GET /api/leave-requests`), `scope` — совместимое уточнение (Рекомендация): без него один endpoint не может отдать и «Мою заявку», и «Входящие» без двусмысленности, а в MD два разных экрана делят один путь | Home, My Request, Inbox |
| `POST /leave-requests` | архитектурный MD, как есть | New Request → кнопка отправки |
| `GET /leave-requests/{id}` | архитектурный MD, как есть | My Request, Approval |
| `POST /leave-requests/{id}/approve` | архитектурный MD, как есть | Approval → кнопка «Согласовать» |
| `POST /leave-requests/{id}/reject` | архитектурный MD, как есть | Reject Bottom Sheet |
| `POST /leave-requests/{id}/cancel` | архитектурный MD, как есть | My Request → «Отозвать заявку» |
| `GET /team/calendar` | архитектурный MD, как есть | New Request → календарь, График команды |
| `GET /rules` | архитектурный MD, как есть | Admin → Settings → Основания |
| `GET /documents/{id}` | архитектурный MD, как есть | Document Card/Detail, Signing (чтение; сама подпись — GAP-01) |
| `GET /shifts/{id}/candidates` | архитектурный MD, как есть | Подмены → Candidate Swipe Card |
| `POST /shift-offers` | архитектурный MD, как есть | Подмены → свайп вправо |
| `POST /shift-offers/{id}/accept` | архитектурный MD, как есть | Предложение смены → «Выйду» (“not smog” — GAP-05) |
| `PUT /me/availability` | архитектурный MD, как есть | Подработка → Доступность |
| `GET /audit` | архитектурный MD (`?requestId`), доп. фильтры — Рекомендация | Журнал |
| `GET /audit/export` | выводится из фразы UI MD «выгрузка «папка к проверке»», названое пути не зафиксировано в MD — Рекомендация, совместимое расширение того же ресурса | Журнал → «Собрать папку к проверке» |

Что **не** вошло в этот список и почему: подписание документа, реестр документов компании, список сроков выплат, отклонение предложения смены, весь Admin — они требуются Figma, но не задокументированы — они вынесены в раздел 7 и **не вошли** в `openapi.yaml`.

## 4. Request / Response DTO

Принцип: DTO ≠ таблица БД. Например, `leave_requests` в БД хранит `rules_version_hash`, внутренние FK и служебные поля аудита — ничего из этого не попадает в `LeaveRequestSummary`/`Detail`, пока того не требует какой-то экран Figma.

**Ключевые схемы и обоснование:**

- **`Verdict`** — поля взяты дословно из т.6 задания (`calendarDays, chargeableDays, balanceAfter, notifyBy, payBy, checks, suggestion`) + `level` (цвет светофора) и `rulesVersion` (архитектурный MD: вердикт должен хранить версию справочника, под которой посчитан). Ни одного поля сверх требования.
- **`CheckResult`** — напрямую из Python-датакласса `CheckResult` архитектурного MD (`ruleId, type, passed, severity, message, norm, checkedAt`), без внутренних полей движка правил (например, внутренний `params` движка — не нужен Figma, `message` уже готовая строка для карточки проверки).
- **`Me` ≠ `Employee`** — `Me` (ответ `GET /me`) несёт `roles`, `leaveBalance`, `isDemo` — то, что нужно только «о себе». `Employee` (вложен в `LeaveRequestSummary.employee`, `Signer` и т.д.) — только `id, fullName, position, locationId/Name`, без чужого остатка и ролей — эти данные никто, кроме самого сотрудника, не видит в Figma.
- **`LeaveRequestSummary` vs `LeaveRequestDetail`** — список (Home, My Request карточка, Inbox) не тащит `verdict.checks[]` и `history[]` — этого нигде не показывают список. `Detail` (карточка заявки) добавляет их через `allOf`, без дублирования общих полей.
- **`DocumentSummary` vs `DocumentDetail`** — тот же принцип: `pdfUrl`/`sha256`/`integrityVerified`/`history` — только в `Detail`, т.к. нужны лишь на экране открытой карточки, а в `LeaveRequestSummary.documents[]` — только `Summary` (избегает N+1 на экране «Мои документы», помечено в YAML как Рекомендация).
- **`ShiftCandidate`** — намеренно без `photo`, `age`, `gender`: архитектурный MD явно говорит, что `score_candidate()` их не получает, значит их нет и в DTO, хотя в таблице `employees` они, возможно, есть.
- **`Norm`** — только `title` + `url`; всё, что показывает строка проверки в Figma — ссылка на норму ТК РФ.

**Request DTO остаются минимальными**: `PreviewRequest`/`SubmitLeaveRequest` — только `startDate/endDate(/comment)`, т.к. именно это вводит пользователь в календаре — `verdict`, `status`, `id` вычисляет/присваивает сервер, их нет в теле запроса (принцип «frontend не считает вердикт сам» из т.6 задания).

## 5. Error contract

Единая форма: `{ "error": { "code", "message", "details" } }` на каждой не-2xx ответ (`components.schemas.ErrorResponse` в YAML).

**details: `[]` vs `{}`** — архитектурный MD показывает `"details": {}`, а текст этой задачи (раздел 11) — `"details": []`. Это форматное расхождение, не бизнес-логика: в `openapi.yaml` `details` зафиксирован как **массив** `ErrorDetail[]` (`{field, issue}`) — следует явному примеру из этого задания и удобнее ложится в валидацию с несколькими ошибками полей (например `endDate` раньше `startDate` и одновременно отсутствует `comment`). Когда деталей нет — `details: []` (пустой массив, не объект). Не API GAP — проектное решение, которое команде стоит зафиксировать в архитектурном MD.

**Коды → HTTP → состояние Figma:**

| Код | HTTP | Когда | Состояние Figma |
| --- | --- | --- | --- |
| `NOT_LINKED` | 403 | `GET /me` — нет связи max\_user\_id → employee | экран Connect |
| `FORBIDDEN` | 403 | действие/объект вне прав роли (напр. employee дёргается в `scope=inbox`) | блокировка экрана/действия (forbidden state) |
| `NOT_FOUND` | 404 | `requestId`/`documentId`/т.д. не существует или не виден роли | экран «не найдено» |
| `VALIDATION_ERROR` | 400/401 | некорректный body/подпись `initData` не сошлась (401 — отдельный HTTP-код, но тот же `code`) | валидация под полем формы |
| `RULE_VIOLATION` | 422 | `submit` при красном вердикте без совпадения с `suggestion` | красный баннер остаётся, форма не отправлена |
| `ALREADY_RESOLVED` | 409 | повторный `reject`/`accept` над уже решённым объектом | тост «Уже согласована 18 сентября» (already-resolved) |
| `CONFLICT` | 409 | общий код для несовместимого статуса без отдельного кода (напр. `cancel` заявки не в `pending`) | ошибка действия |

`RULE_VIOLATION` добавлен в `ErrorCode`, т.к. он есть в списке задания (раздел 10) и точно описывает случай 422 в `POST /leave-requests`; `400` и `500` из списка задания не вынесены отдельно: 400 покрыт `VALIDATION_ERROR`, 500 — общий случай без специфичного `code` и не требует отдельной схемы на каждом endpoint’е (никакой состояние Figma его отдельно не различает, экран единый «ошибка»).

## 6. Figma → API Matrix

| Figma page | Экран | UI element | Action | API | Method | Request | Response | UI state |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 03 Employee | Connect | — | открытие мини-аппа | `/me` | GET | — | 403 `NOT_LINKED` | not-linked |
| 03 Employee | Home | Шапка + текущая заявка | загрузка | `/me`, `/leave-requests?scope=mine` | GET | — | `Me`, `LeaveRequestSummary[]` | loading → data/empty |
| 03 Employee | Home | Кнопка «Новая заявка» | тап | — (локальная навигация) | — | — | — | открывается New Request |
| 03 Employee | New Request → Calendar | выбор дат | изменение дат | `/leave-requests/preview` | POST | `{startDate, endDate}` | `Verdict` | Green/Yellow/Red |
| 03 Employee | New Request → Verdict Banner (green/yellow) | кнопка «Отправить на согласование» | тап | `/leave-requests` | POST | `{startDate, endDate, comment}` | `LeaveRequestDetail` (201) | My Request, `pending` |
| 03 Employee | New Request → Verdict Banner (red) | кнопка «Подать на {дату}» | тап (согласие с `suggestion`) | `/leave-requests` | POST | `{startDate/endDate = suggestion}` | 201 или 422 `RULE_VIOLATION` | pending или форма остаётся |
| 03 Employee | My Request | статус/вердикт/история | загрузка | `/leave-requests/{id}` | GET | — | `LeaveRequestDetail` | pending/approved/rejected/… |
| 03 Employee | My Request | Кнопка «Отозвать заявку» | тап (только в `pending`) | `/leave-requests/{id}/cancel` | POST | — | `LeaveRequestDetail` (200) или 409 | cancelled |
| 03 Employee | My Documents | список карточек | загрузка | `/leave-requests?scope=mine` (`documents[]`) | GET | — | `LeaveRequestSummary[]` | empty/data |
| 03 Employee | Document Card | карточка | тап | `/documents/{id}` | GET | — | `DocumentDetail` | Document Detail |
| 03 Employee | Signing | Кнопка «Подписать» | биометрия | `BiometricManager.authenticate()` (device) → ⚠️ GAP-01 (backend-подтверждение не задокументировано) | — | — | — | success/cancelled/fallback/duplicate tap |
| 04 Manager | Inbox | список | загрузка | `/leave-requests?scope=inbox` | GET | — | `LeaveRequestSummary[]` | empty/data |
| 04 Manager | Approval | детали заявки | тап по строке входящих | `/leave-requests/{id}` | GET | — | `LeaveRequestDetail` | detail |
| 04 Manager | Approval | Кнопка «Согласовать» | тап (+ биометрия/confirm) | `/leave-requests/{id}/approve` | POST | `{method}` | `LeaveRequestDetail` (200) | approved или already-resolved |
| 04 Manager | Reject Bottom Sheet | Кнопка «Отклонить» | тап (причина обязательна) | `/leave-requests/{id}/reject` | POST | `{reasonCode, reasonText, alternativeStart, alternativeEnd}` | `LeaveRequestDetail` (200) или 409 `ALREADY_RESOLVED` | rejected |
| 05 Accountant | Document Registry | список всех документов | загрузка | ⚠️ GAP-03 (нет endpoint'а) | — | — | — | — |
| 05 Accountant | Document Card | карточка | тап | `/documents/{id}` | GET | — | `DocumentDetail` | detail |
| 05 Accountant | Сроки выплат | список + «Отметить выплату» | загрузка/тап | ⚠️ GAP-04 (нет списка и действия) | — | — | — | — |
| 05 Accountant | Review Queue | список `to_sign`/`in_accounting` | загрузка | ⚠️ GAP-03 (часть того же гапа) | — | — | — | — |
| 06 Admin | Company Connect | форма создания компании | submit | ⚠️ GAP-06 | — | — | — | — |
| 06 Admin | Employees | список/добавление | загрузка/submit | ⚠️ GAP-06 | — | — | — | — |
| 06 Admin | Settings → Основания | список норм | загрузка | `/rules` | GET | — | `Rule[]` | data |
| Secondary | График команды (Employee/Manager) | календарь | загрузка/листание | `/team/calendar` | GET | `from, to` | `TeamCalendarEntry[]` | data |
| Secondary | Подмены (Manager) → Candidate Swipe Card | список кандидатов | загрузка | `/shifts/{id}/candidates` | GET | — | `ShiftCandidate[]` | data |
| Secondary | Подмены → Candidate Swipe Card | свайп вправо | отправить предложение | `/shift-offers` | POST | `{shiftId, employeeId}` | `ShiftOffer` (201) | proposed |
| Secondary | Предложение смены (Employee) | Кнопка «Выйду» | тап | `/shift-offers/{id}/accept` | POST | — | `ShiftOffer` (200) | accepted |
| Secondary | Предложение смены (Employee) | Кнопка «Не смогу» | тап | ⚠️ GAP-05 (нет endpoint отклонения) | — | — | — | — |
| Secondary | Подработка → Доступность | Switch + расписание | сохранить | `/me/availability` | PUT | `AvailabilityWindow[]` | `AvailabilityWindow[]` (200) | saved |

## 7. API Gaps

Где Figma требует того, чего нет в архитектурном MD — не додумано и не включено в `openapi.yaml`.

**⚠️ API GAP-01** экран: Signing UI action: Подписать документ (любой из 5 видов — Согласие ЭДО/ПЭП, Заявление, Уведомление, Приказ Т-6, График Т-7) проблема: Figma содержит действие подписания, но архитектурный MD не определяет backend-операцию, которая переводит `documents.status → signed` и добавляет запись в `signers[]` после успешной локальной биометрии. необходимо решить: какой backend endpoint подтверждает подпись (например `POST /documents/{id}/sign`), какие данные он принимает (подпись-токен от устройства? `method: biometric\|confirm`, как в approve?), и меняет ли он статус всего документа сразу после первой подписи или только после всех `signers`.

**⚠️ API GAP-02** экран: My Documents / Document Card UI action: отображение вида документа «Уведомление о начале отпуска» (один из 5 документов в UI MD, раздел 4) проблема: `documents.kind` в архитектурном MD содержит только три значения (`application`, `order_t6`, `schedule_t7`); «Уведомление» и «Согласие ЭДО/ПЭП» в этот перечень не входят, хотя UI MD описывает все 5 видов документов как часть пакета заявки. необходимо решить: дополнить ли `documents.kind` до 5 значений (и как назвать недостающие два — `edo_consent`, `notice`?), либо уведомление/согласие — не `documents`-сущности, а часть другого потока.

**⚠️ API GAP-03** экран: Accountant / Document Registry, Review Queue UI action: просмотр всех документов компании (не только своих) проблема: все 15 endpoint'ов архитектурного MD дают доступ либо к своим заявкам (`scope=mine`), либо к одному документу по id (`GET /documents/{id}`); списочного endpoint'а «все документы компании/точки» для роли accountant нет. необходимо решить: нужен ли `GET /documents?status=&kind=&from=&to=` (с ролевой проверкой на сервере, как у `/leave-requests?scope=`), и какая граница видимости (вся компания или только своя точка).

**⚠️ API GAP-04** экран: Accountant / Сроки выплат UI action: список документов с приближающимся/просроченным `payBy`, кнопка «Отметить выплату» проблема: `payBy` есть внутри `Verdict`/`LeaveRequestSummary` каждой отдельной заявки, но агрегированного списка «все ближайшие выплаты» и действия отметки выплаты в архитектурном MD нет; непонятно также, в какой таблице хранится факт выплаты (отдельное поле у `leave_requests` или связь с `documents`). необходимо решить: списочный endpoint (например `GET /leave-requests?scope=deadlines`) + действие отметки (`POST /leave-requests/{id}/mark-paid`?) и где этот факт хранится.

**⚠️ API GAP-05** экран: Предложение смены (Employee) UI action: Кнопка «Не смогу» (отклонение предложенной смены) проблема: `shift_offers.status` имеет значение `declined` в архитектурном MD (state-диаграмма упоминает его), но в таблице из 15 endpoint'ов есть только `POST /shift-offers/:id/accept` — парного `/decline` нет. необходимо решить: добавить `POST /shift-offers/{id}/decline` (симметрично `reject` у заявки) — или подтвердить, что отклонение происходит только по истечению (`expired`) без явного действия сотрудника.

**⚠️ API GAP-06** экран: Admin — Company Connect, Employees, большая часть Settings UI action: создание компании/точек, список/добавление/роли сотрудников, большинство настроек проблема: весь admin-контур в UI MD описан текстом экранов, но архитектурный MD не описывает ни одного endpoint'а для admin-действий, кроме чтения `/rules`. необходимо решить: это отдельный блок работы для команды (company/employees/settings CRUD + генерация deeplink `join_<code>`), выходящий за рамки этой задачи — не включен в `openapi.yaml` целиком, чтобы не придумывать схему данных компании/точек, которой нет в исходных MD.

## 8. Полный `openapi.yaml`

Валидирован ($ref-проверка: 48 ссылок, 0 битых, YAML грузится `yaml.safe_load`). 16 путей, 39 схем. Файл также отправлен отдельным вложением (`openapi.yaml`) — для вставки в Swagger Editor надёжнее скопировать из файла, чем из документа (ниже — та же самая спецификация целиком, часть 1/3 — `info`, `servers`, `tags`, `security`, `paths` до `/leave-requests/{requestId}/cancel`).

```yaml
openapi: 3.1.0

info:
  title: СМЕНА API
  version: 0.1.0-mvp
  description: |
    Backend-контракт мини-приложения «Смена» (отпуска и документооборот в MAX).

    Источники:
    - «СМЕНА — архитектура, правила команды и дизайн мини-приложения.md» (далее «архитектурный MD») — раздел
      «Конвенции API» и таблица эндпоинтов являются основным источником путей и семантики.
    - «СМЕНА — что должно быть в UI мини-приложения.md» (далее «UI MD») — источник UI-состояний и полей,
      которые обязаны попасть в response.
    - Готовый Figma-дизайн (файл mQhuNOshLTorGyHCVpyEaf, страницы 01–08).

    Каждый endpoint ниже покрывает конкретный экран Figma или прямо упомянут в архитектурном MD. Полный разбор —
    в сопроводительном документе «Figma → API анализ». Пробелы (то, что Figma требует, а архитектурный MD не
    определяет) НЕ включены сюда как endpoints — они перечислены отдельно в разделе «API Gaps» сопроводительного
    документа и требуют решения команды, а не молчаливого допридумывания.

    Все запросы аутентифицируются заголовком `X-Max-Init-Data` (строка `WebApp.initData` из MAX Bridge).
    Сервер проверяет HMAC-подпись и ищет сотрудника по `max_user_id`; не найден → 403 `NOT_LINKED`.
    Собственных логинов/паролей нет.

servers:
  - url: https://smena.example.com/api
    description: Продакшн (пример — заменить на реальный хост при генерации типов)
  - url: http://localhost:8000/api
    description: Локальная разработка (AUTH_MODE=dev, mock-initData)

tags:
  - name: Me
    description: Текущий сотрудник — профиль, роли, остаток дней (экран «Главная»)
  - name: LeaveRequests
    description: Заявки на отпуск — предпросмотр, подача, согласование, отказ, отзыв (Новая заявка, Моя заявка, Входящие, Согласование, Отказ)
  - name: Team
    description: Занятые окна коллег (Новая заявка → календарь, График команды)
  - name: Rules
    description: Справочник норм ТК РФ (экран «Основания»)
  - name: Documents
    description: PDF документов по временной ссылке (Карточка документа, Подписание)
  - name: Shifts
    description: Подбор подмены — кандидаты, предложения смен (Подмены, Предложение смены)
  - name: Availability
    description: Доступность сотрудника для подработки
  - name: Audit
    description: Журнал согласований и выгрузка «папки к проверке»

security:
  - MaxInitData: []

paths:
  /me:
    get:
      operationId: getMe
      tags: [Me]
      summary: Кто я, мои роли, остаток дней
      description: |
        Источник для шапки экрана «Главная»: остаток дней крупно, дата расчёта. Список ролей определяет,
        какое нижнее меню и какая главная вкладка показываются (UI MD, раздел 1).
      responses:
        '200':
          description: Профиль текущего сотрудника
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Me'
              example:
                id: 8f14e2a4-0000-4000-8000-000000000001
                fullName: Петрова Марина Алексеевна
                position: Кассир-консультант
                locationId: 8f14e2a4-0000-4000-8000-0000000000aa
                locationName: «Баумана, 12»
                roles: [employee]
                leaveBalance: { days: 28, asOf: '2026-09-25' }
                isDemo: true
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/NotLinked'

  /leave-requests/preview:
    post:
      operationId: previewLeaveRequest
      tags: [LeaveRequests]
      summary: Вердикт для выбранных дат без сохранения
      description: |
        Вызывается мини-приложением при каждом изменении дат в календаре (с задержкой 300 мс после
        последнего касания, цель — ответ быстрее 200 мс). Frontend НЕ считает вердикт сам — сервер
        единственный источник истины (архитектурный MD, принцип 1). Ответ определяет цвет светофора
        (Green / Yellow / Red — это один и тот же контракт, разные значения `verdict.level`, см. Verdict
        Banner в Figma).
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/PreviewRequest'
            example:
              startDate: '2026-10-05'
              endDate: '2026-10-18'
      responses:
        '200':
          description: Рассчитанный вердикт (не сохраняется)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Verdict'
              example:
                level: green
                calendarDays: 14
                chargeableDays: 14
                balanceAfter: 14
                notifyBy: '2026-09-21'
                payBy: '2026-10-02'
                rulesVersion: 3f9a1c2b
                suggestion: null
                checks:
                  - ruleId: tk.115.balance
                    type: law
                    passed: true
                    severity: info
                    message: Остаток дней — ст. 115 ТК РФ
                    norm: { title: ст. 115 ТК РФ, url: 'https://example.org/tk/115' }
                    checkedAt: '2026-09-20'
                  - ruleId: tk.125.min-part-14
                    type: calculation
                    passed: true
                    severity: info
                    message: Часть отпуска не менее 14 дней — ст. 125 ТК РФ
                    norm: { title: ст. 125 ТК РФ, url: 'https://example.org/tk/125' }
                    checkedAt: '2026-09-20'
        '400':
          $ref: '#/components/responses/ValidationError'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/NotLinked'

  /leave-requests:
    get:
      operationId: listLeaveRequests
      tags: [LeaveRequests]
      summary: Мои заявки или входящие на согласование
      description: |
        `scope=mine` — экран «Моя заявка» / блок «Текущая заявка» на «Главной».
        `scope=inbox` — экран «Входящие» руководителя (доступен только роли `manager`, своя точка —
        проверяется на сервере, см. таблицу прав в архитектурном MD).
        Сегменты «Ждут решения» / «Решённые» на экране «Входящие» — это локальная группировка списка по
        `status` на фронтенде, отдельного query-параметра не требуется.
      parameters:
        - name: scope
          in: query
          required: true
          schema:
            type: string
            enum: [mine, inbox]
      responses:
        '200':
          description: Список заявок
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/LeaveRequestSummary'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
    post:
      operationId: submitLeaveRequest
      tags: [LeaveRequests]
      summary: Подать заявку на отпуск
      description: |
        Экран «Новая заявка», кнопка «Отправить на согласование» (green/yellow) или «Подать на {дату}» (red,
        когда сотрудник соглашается с предложенной датой из `suggestion`). Сервер пересчитывает вердикт заново
        и сохраняет его снимок вместе с версией справочника правил — то, что пришло из `preview`, не
        принимается на веру. После сохранения статус — `pending`, событие `leave.submitted` уходит в worker
        (карточка руководителю в чате).
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/SubmitLeaveRequest'
            example:
              startDate: '2026-10-05'
              endDate: '2026-10-18'
              comment: null
      responses:
        '201':
          description: Заявка создана
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/LeaveRequestDetail'
        '400':
          $ref: '#/components/responses/ValidationError'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/NotLinked'
        '422':
          description: Вердикт красный, а `startDate/endDate` не совпадают с ближайшей допустимой датой из preview
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /leave-requests/{requestId}:
    get:
      operationId: getLeaveRequest
      tags: [LeaveRequests]
      summary: Карточка заявки — вердикт, история, документы
      description: |
        Экраны «Моя заявка» и «Согласование». Поле `history` — шаги «Подана → Согласована → …» c датой и
        именем участника. Поле `documents` — пакет из трёх документов заявки (Заявление, Уведомление,
        Приказ Т-6 — см. примечание о `DocumentKind` в API Gaps относительно «Уведомления»).
      parameters:
        - $ref: '#/components/parameters/RequestId'
      responses:
        '200':
          description: Заявка
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/LeaveRequestDetail'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'

  /leave-requests/{requestId}/approve:
    post:
      operationId: approveLeaveRequest
      tags: [LeaveRequests]
      summary: Согласовать заявку
      description: |
        Экран «Согласование», кнопка «Согласовать». Доступно только роли `manager` для заявок сотрудников
        своей точки. `method` фиксирует, как подтверждено действие: `biometric` — через
        `BiometricManager.authenticate()` внутри мини-приложения; `confirm` — фолбэк-шторка
        «Подтвердите подпись» на платформах без биометрии (web/desktop). Повторный `approve` уже
        согласованной заявки — не ошибка, возвращает 200 и текущее состояние (см. UI-состояние
        «already-resolved»).
      parameters:
        - $ref: '#/components/parameters/RequestId'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ApproveLeaveRequest'
            example:
              method: biometric
      responses:
        '200':
          description: Заявка согласована (или уже была согласована ранее — идемпотентно)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/LeaveRequestDetail'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
        '409':
          description: Заявка уже в конечном статусе, несовместимом с согласованием (например, отклонена)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /leave-requests/{requestId}/reject:
    post:
      operationId: rejectLeaveRequest
      tags: [LeaveRequests]
      summary: Отклонить заявку с причиной и альтернативной датой
      description: |
        Нижняя шторка «Отказ» (UI MD, раздел 5). Кнопка становится активной только когда указана причина —
        быстрый вариант (`reasonCode`) и/или свободный текст (`reasonText`); при `reasonCode: other`
        `reasonText` обязателен. `alternativeStart`/`alternativeEnd` — одна из дат, предложенных `suggest()`
        (те же чипы, что показываются в шторке), либо дата, выбранная руководителем в календаре.
      parameters:
        - $ref: '#/components/parameters/RequestId'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/RejectLeaveRequest'
            example:
              reasonCode: team_overlap
              reasonText: null
              alternativeStart: '2026-09-30'
              alternativeEnd: '2026-10-13'
      responses:
        '200':
          description: Заявка отклонена
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/LeaveRequestDetail'
        '400':
          $ref: '#/components/responses/ValidationError'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
        '409':
          $ref: '#/components/responses/AlreadyResolved'

  /leave-requests/{requestId}/cancel:
    post:
      operationId: cancelLeaveRequest
      tags: [LeaveRequests]
      summary: Отозвать свою заявку
      description: |
        Экран «Моя заявка», кнопка «Отозвать заявку» — доступна только пока статус `pending`. Документы
        заявки (если были сформированы) переходят в `annulled`.
      parameters:
        - $ref: '#/components/parameters/RequestId'
      responses:
        '200':
          description: Заявка отозвана
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/LeaveRequestDetail'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
        '409':
          description: Заявка не в статусе `pending` — отзыв недоступен
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
```

Часть 2/3 — остальные `paths` (`/team/calendar` … `/audit/export`) и начало `components` (`securitySchemes`, `parameters`, `responses`):

```yaml
  /team/calendar:
    get:
      operationId: getTeamCalendar
      tags: [Team]
      summary: Занятые окна коллег
      description: |
        Календарь на экране «Новая заявка» (точки на датах, имя — по тапу) и экран «График команды».
        Отдаёт только имя и даты — без вида отпуска и причин (минимизация данных, 152-ФЗ; см. таблицу прав
        в архитектурном MD). Видимость по точке/компании определяется ролью на сервере, не query-параметром.
      parameters:
        - name: from
          in: query
          required: true
          schema: { type: string, format: date }
        - name: to
          in: query
          required: true
          schema: { type: string, format: date }
      responses:
        '200':
          description: Занятые периоды коллег в диапазоне
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/TeamCalendarEntry'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/NotLinked'

  /rules:
    get:
      operationId: listRules
      tags: [Rules]
      summary: Список норм и дат актуальности
      description: |
        Экран «Основания» (Администратор → Настройки → «Основания и нормы расчёта»). Отдаёт содержимое
        YAML-справочника правил как есть — норму, параметры, тексты сообщений, дату сверки с
        КонсультантПлюс.
      responses:
        '200':
          description: Действующий справочник правил
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Rule'
        '401':
          $ref: '#/components/responses/Unauthorized'

  /documents/{documentId}:
    get:
      operationId: getDocument
      tags: [Documents]
      summary: Карточка документа с временной подписанной ссылкой на PDF
      description: |
        Экраны «Карточка документа» и «Экран подписания» (общий для всех ролей и всех пяти видов
        документов — UI MD, раздел 4). `pdfUrl` — временная подписанная ссылка, используется и превью, и
        кнопкой «Скачать» (`downloadFile`). `integrityVerified` — сверка sha256, источник строки
        «✓ Документ не изменялся после подписания».

        Действие подписания САМОГО документа этим endpoint'ом не покрывается — см. GAP-01
        в сопроводительном анализе (в архитектурном MD не определён endpoint, меняющий статус документа
        на `signed`).
      parameters:
        - $ref: '#/components/parameters/DocumentId'
      responses:
        '200':
          description: Документ
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DocumentDetail'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'

  /shifts/{shiftId}/candidates:
    get:
      operationId: listShiftCandidates
      tags: [Shifts]
      summary: Кандидаты на открытую смену с причинами оценки
      description: |
        Экран «Подмены» → карточки кандидатов со свайпом. `score` и `reasons` — прямой вывод
        `score_candidate()`; фото, возраст и пол намеренно не передаются (см. архитектурный MD, раздел
        «Матчинг подмен»). Каждая строка `reasons` — то, что отображается отдельной строкой карточки
        (свободен / расстояние / история смен).
      parameters:
        - $ref: '#/components/parameters/ShiftId'
      responses:
        '200':
          description: Ранжированный список кандидатов
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/ShiftCandidate'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'

  /shift-offers:
    post:
      operationId: createShiftOffer
      tags: [Shifts]
      summary: Предложить смену кандидату
      description: |
        Экран «Подмены», кнопка «Предложить смену» (свайп вправо). Создаёт `shift_offers` со статусом
        `proposed`; бот отправляет кандидату сообщение с deeplink `off_<offerId>`, который открывает
        экран «Предложение смены».
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateShiftOfferRequest'
      responses:
        '201':
          description: Предложение создано
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ShiftOffer'
        '400':
          $ref: '#/components/responses/ValidationError'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'

  /shift-offers/{offerId}/accept:
    post:
      operationId: acceptShiftOffer
      tags: [Shifts]
      summary: Принять предложенную смену
      description: |
        Экран «Предложение смены», кнопка «Выйду». Переводит `shift_offers.status` в `accepted` и закрывает
        смену (`shifts.status = filled`). Действие «Не смогу» (отклонение предложения) в архитектурном MD не
        имеет своего endpoint'а — см. GAP-05 в сопроводительном анализе.
      parameters:
        - $ref: '#/components/parameters/OfferId'
      responses:
        '200':
          description: Предложение принято
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ShiftOffer'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
        '409':
          $ref: '#/components/responses/AlreadyResolved'

  /me/availability:
    put:
      operationId: setMyAvailability
      tags: [Availability]
      summary: Задать окна доступности для подработки
      description: |
        Переключатель «Доступен для подработки» (`Switch` из MAX UI) и его расписание. Полностью заменяет
        текущий набор окон сотрудника (`availability` по `employee_id`).
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: array
              items:
                $ref: '#/components/schemas/AvailabilityWindow'
      responses:
        '200':
          description: Сохранённые окна доступности
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/AvailabilityWindow'
        '400':
          $ref: '#/components/responses/ValidationError'
        '401':
          $ref: '#/components/responses/Unauthorized'

  /audit:
    get:
      operationId: listAudit
      tags: [Audit]
      summary: Журнал согласований
      description: |
        Экран «Журнал». `requestId` — обязательный сценарий, документированный в архитектурном MD
        («Журнал согласований … GET /api/audit?requestId»). `employeeId`/`from`/`to` — совместимое
        расширение того же параметра фильтрации для более широкой ленты на экране «Журнал» (Бухгалтер,
        Руководитель); отмечено как проектное решение (Рекомендация), а не отдельный endpoint.
      parameters:
        - name: requestId
          in: query
          required: false
          schema: { type: string, format: uuid }
        - name: employeeId
          in: query
          required: false
          schema: { type: string, format: uuid }
        - name: from
          in: query
          required: false
          schema: { type: string, format: date }
        - name: to
          in: query
          required: false
          schema: { type: string, format: date }
      responses:
        '200':
          description: Записи журнала, от новых к старым
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/AuditEntry'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'

  /audit/export:
    get:
      operationId: exportAuditPackage
      tags: [Audit]
      summary: Собрать папку к проверке (ZIP)
      description: |
        Кнопка «Собрать папку к проверке» на экране «Журнал» (UI MD, раздел 6). Название endpoint'а в
        архитектурном MD прямо не зафиксировано, но «выгрузка «папка к проверке»» явно названа частью
        назначения `GET /api/audit` — поэтому вынесено сюда как совместимое расширение того же ресурса, а
        не как отдельный незадокументированный gap. Содержимое ZIP по UI MD: PDF всех документов за период,
        журнал в CSV, сводка по каждому отпуску.
      parameters:
        - name: from
          in: query
          required: true
          schema: { type: string, format: date }
        - name: to
          in: query
          required: true
          schema: { type: string, format: date }
      responses:
        '200':
          description: ZIP-архив
          content:
            application/zip:
              schema:
                type: string
                format: binary
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'

components:
  securitySchemes:
    MaxInitData:
      type: apiKey
      in: header
      name: X-Max-Init-Data
      description: |
        Строка `WebApp.initData` из MAX Bridge, подписанная HMAC-SHA256 токеном бота (см. архитектурный MD,
        «Авторизация через initData»). Не JWT и не OAuth — единственная схема аутентификации в этом API.

  parameters:
    RequestId:
      name: requestId
      in: path
      required: true
      schema: { type: string, format: uuid }
    DocumentId:
      name: documentId
      in: path
      required: true
      schema: { type: string, format: uuid }
    ShiftId:
      name: shiftId
      in: path
      required: true
      schema: { type: string, format: uuid }
    OfferId:
      name: offerId
      in: path
      required: true
      schema: { type: string, format: uuid }

  responses:
    Unauthorized:
      description: Заголовок `X-Max-Init-Data` отсутствует или подпись не сошлась
      content:
        application/json:
          schema: { $ref: '#/components/schemas/ErrorResponse' }
          example: { error: { code: VALIDATION_ERROR, message: initData не прошла проверку подписи, details: [] } }
    NotLinked:
      description: Пользователь MAX не привязан к сотруднику компании
      content:
        application/json:
          schema: { $ref: '#/components/schemas/ErrorResponse' }
          example: { error: { code: NOT_LINKED, message: Сотрудник не найден. Пройдите подключение к компании, details: [] } }
    Forbidden:
      description: Действие недоступно текущей роли для этого объекта
      content:
        application/json:
          schema: { $ref: '#/components/schemas/ErrorResponse' }
          example: { error: { code: FORBIDDEN, message: Эта заявка вам недоступна, details: [] } }
    NotFound:
      description: Объект не найден
      content:
        application/json:
          schema: { $ref: '#/components/schemas/ErrorResponse' }
          example: { error: { code: NOT_FOUND, message: Заявка не найдена, details: [] } }
    ValidationError:
      description: Некорректный запрос
      content:
        application/json:
          schema: { $ref: '#/components/schemas/ErrorResponse' }
          example: { error: { code: VALIDATION_ERROR, message: Некорректные даты периода, details: [{ field: endDate, issue: должна быть не раньше startDate }] } }
    AlreadyResolved:
      description: Заявка/предложение уже находится в конечном статусе — действие не требуется повторно
      content:
        application/json:
          schema: { $ref: '#/components/schemas/ErrorResponse' }
          example: { error: { code: ALREADY_RESOLVED, message: 'Уже согласована 18 сентября', details: [] } }
```

Часть 3/3 — `components.schemas` (все 39 схем):

```yaml
  schemas:
    Role:
      type: string
      enum: [employee, manager, accountant, admin]
      description: Роли ровно как в UI MD и таблице прав архитектурного MD. Один человек может иметь несколько ролей.

    VerdictLevel:
      type: string
      enum: [green, yellow, red]

    CheckSeverity:
      type: string
      enum: [block, warn, info]

    CheckType:
      type: string
      enum: [law, calculation, company]

    Norm:
      type: object
      required: [title, url]
      properties:
        title: { type: string, example: ст. 123 ТК РФ }
        url: { type: string, format: uri }

    CheckResult:
      type: object
      required: [ruleId, type, passed, severity, message, checkedAt]
      properties:
        ruleId: { type: string, example: tk.123.notice }
        type: { $ref: '#/components/schemas/CheckType' }
        passed: { type: boolean }
        severity: { $ref: '#/components/schemas/CheckSeverity' }
        message: { type: string, description: Готовый текст для пользователя — строка проверки в Figma }
        norm:
          oneOf:
            - $ref: '#/components/schemas/Norm'
            - type: 'null'
        checkedAt: { type: string, format: date, description: Дата актуальности нормы }

    DateRange:
      type: object
      required: [startDate, endDate]
      properties:
        startDate: { type: string, format: date }
        endDate: { type: string, format: date }

    Verdict:
      type: object
      required: [level, calendarDays, chargeableDays, balanceAfter, notifyBy, payBy, checks, rulesVersion]
      properties:
        level: { $ref: '#/components/schemas/VerdictLevel' }
        calendarDays: { type: integer, minimum: 1 }
        chargeableDays: { type: integer, minimum: 0, description: Списываемые дни — праздники исключены }
        balanceAfter: { type: number, description: Остаток после этого отпуска }
        notifyBy: { type: string, format: date }
        payBy: { type: string, format: date }
        checks:
          type: array
          items: { $ref: '#/components/schemas/CheckResult' }
        suggestion:
          description: Ближайшая допустимая дата при красном вердикте (`suggest()`); иначе null
          oneOf:
            - $ref: '#/components/schemas/DateRange'
            - type: 'null'
        rulesVersion: { type: string, description: sha256 версии YAML-справочника, под которой посчитан вердикт }

    Employee:
      type: object
      required: [id, fullName, position, locationId]
      properties:
        id: { type: string, format: uuid }
        fullName: { type: string }
        position: { type: string }
        locationId: { type: string, format: uuid }
        locationName: { type: string, description: 'Денормализованное имя точки для отображения, напр. «Баумана, 12»' }

    Me:
      type: object
      required: [id, fullName, position, roles, leaveBalance, isDemo]
      properties:
        id: { type: string, format: uuid }
        fullName: { type: string }
        position: { type: string }
        locationId: { type: string, format: uuid }
        locationName: { type: string }
        roles:
          type: array
          items: { $ref: '#/components/schemas/Role' }
        leaveBalance:
          type: object
          required: [days, asOf]
          properties:
            days: { type: number }
            asOf: { type: string, format: date }
        isDemo: { type: boolean, description: 'Показать плашку «Демо-данные»' }

    LeaveRequestStatus:
      type: string
      enum: [pending, approved, rejected, cancelled, active, completed]

    LeaveRequestSummary:
      type: object
      required: [id, employee, startDate, endDate, calendarDays, chargeableDays, status, verdictLevel, notifyDeadline, payDeadline, createdAt]
      properties:
        id: { type: string, format: uuid }
        employee: { $ref: '#/components/schemas/Employee' }
        startDate: { type: string, format: date }
        endDate: { type: string, format: date }
        calendarDays: { type: integer }
        chargeableDays: { type: integer }
        status: { $ref: '#/components/schemas/LeaveRequestStatus' }
        verdictLevel: { $ref: '#/components/schemas/VerdictLevel' }
        notifyDeadline: { type: string, format: date }
        payDeadline: { type: string, format: date }
        comment:
          oneOf: [{ type: string, maxLength: 200 }, { type: 'null' }]
        createdAt: { type: string, format: date-time }
        documents:
          type: array
          description: |
            Рекомендация: лёгкая сводка документов заявки, чтобы экран «Мои документы» строился без N+1
            запросов к `GET /leave-requests/{id}`. Не зафиксировано явно в архитектурном MD — проектное
            расширение существующего списочного ответа, а не новый endpoint.
          items: { $ref: '#/components/schemas/DocumentSummary' }

    HistoryEvent:
      type: object
      required: [occurredAt, action, toStatus, actorId, actorName]
      properties:
        occurredAt: { type: string, format: date-time }
        action: { type: string, example: approve }
        fromStatus:
          oneOf: [{ $ref: '#/components/schemas/LeaveRequestStatus' }, { type: 'null' }]
        toStatus: { $ref: '#/components/schemas/LeaveRequestStatus' }
        actorId: { type: string, format: uuid }
        actorName: { type: string }
        method:
          oneOf: [{ type: string, enum: [biometric, confirm] }, { type: 'null' }]

    LeaveRequestDetail:
      allOf:
        - $ref: '#/components/schemas/LeaveRequestSummary'
        - type: object
          required: [verdict, history, documents]
          properties:
            verdict: { $ref: '#/components/schemas/Verdict' }
            rejectReason:
              oneOf: [{ type: string }, { type: 'null' }]
            replacesId:
              description: Заявка, которую эта заменяет (перенос дат после согласования — новая заявка)
              oneOf: [{ type: string, format: uuid }, { type: 'null' }]
            history:
              type: array
              items: { $ref: '#/components/schemas/HistoryEvent' }
            documents:
              type: array
              items: { $ref: '#/components/schemas/DocumentSummary' }

    DocumentKind:
      type: string
      enum: [application, order_t6, schedule_t7]
      description: |
        Ровно значения `documents.kind` из архитектурного MD. UI MD и Figma требуют четвёртый тип —
        «Уведомление о начале отпуска» — которого нет в этом перечислении backend'а. Смотри GAP-02 в
        сопроводительном анализе; значение сюда намеренно не добавлено.

    DocumentStatus:
      type: string
      enum: [formed, to_sign, signed, in_accounting, archived, annulled]

    Signer:
      type: object
      required: [employeeId, fullName, role]
      properties:
        employeeId: { type: string, format: uuid }
        fullName: { type: string }
        role: { type: string, example: employee }
        signedAt:
          oneOf: [{ type: string, format: date-time }, { type: 'null' }]
        method:
          oneOf: [{ type: string, enum: [biometric, confirm] }, { type: 'null' }]

    DocumentSummary:
      type: object
      required: [id, kind, number, requestId, status, issuedAt, signers]
      properties:
        id: { type: string, format: uuid }
        kind: { $ref: '#/components/schemas/DocumentKind' }
        number: { type: string, example: Т-6 № 14/2026 }
        requestId: { type: string, format: uuid }
        status: { $ref: '#/components/schemas/DocumentStatus' }
        issuedAt: { type: string, format: date-time }
        signers:
          type: array
          items: { $ref: '#/components/schemas/Signer' }

    DocumentDetail:
      allOf:
        - $ref: '#/components/schemas/DocumentSummary'
        - type: object
          required: [pdfUrl, sha256, integrityVerified, history]
          properties:
            pdfUrl: { type: string, format: uri, description: Временная подписанная ссылка }
            sha256: { type: string }
            integrityVerified: { type: boolean, description: 'Источник строки «✓ Документ не изменялся после подписания»' }
            history:
              type: array
              items: { $ref: '#/components/schemas/HistoryEvent' }

    PreviewRequest:
      type: object
      required: [startDate, endDate]
      properties:
        startDate: { type: string, format: date }
        endDate: { type: string, format: date }

    SubmitLeaveRequest:
      type: object
      required: [startDate, endDate]
      properties:
        startDate: { type: string, format: date }
        endDate: { type: string, format: date }
        comment:
          oneOf: [{ type: string, maxLength: 200 }, { type: 'null' }]

    ApprovalMethod:
      type: string
      enum: [biometric, confirm]
      description: 'biometric — BiometricManager.authenticate(); confirm — фолбэк-шторка на платформах без биометрии'

    ApproveLeaveRequest:
      type: object
      required: [method]
      properties:
        method: { $ref: '#/components/schemas/ApprovalMethod' }

    RejectReasonCode:
      type: string
      enum: [team_overlap, high_load, other]
      description: 'Быстрые варианты причины из нижней шторки: «Пересекается с отпуском коллеги», «Высокая загрузка», «Другое»'

    RejectLeaveRequest:
      type: object
      required: [reasonCode]
      properties:
        reasonCode: { $ref: '#/components/schemas/RejectReasonCode' }
        reasonText:
          description: Свободный текст причины; обязателен, когда `reasonCode = other`
          oneOf: [{ type: string }, { type: 'null' }]
        alternativeStart:
          oneOf: [{ type: string, format: date }, { type: 'null' }]
        alternativeEnd:
          oneOf: [{ type: string, format: date }, { type: 'null' }]

    TeamCalendarEntry:
      type: object
      required: [employeeId, fullName, startDate, endDate]
      properties:
        employeeId: { type: string, format: uuid }
        fullName: { type: string }
        startDate: { type: string, format: date }
        endDate: { type: string, format: date }

    Rule:
      type: object
      required: [id, type, check, severity, norm, effectiveFrom, checkedAt, messages]
      properties:
        id: { type: string, example: tk.123.notice }
        type: { $ref: '#/components/schemas/CheckType' }
        check: { type: string, example: notice_period }
        severity: { $ref: '#/components/schemas/CheckSeverity' }
        params:
          type: object
          additionalProperties: true
          description: Параметры правила как в YAML (например `minDaysBeforeStart`)
        norm: { $ref: '#/components/schemas/Norm' }
        effectiveFrom: { type: string, format: date }
        checkedAt: { type: string, format: date }
        messages:
          type: object
          required: [pass, fail]
          properties:
            pass: { type: string }
            fail: { type: string }

    ShiftStatus:
      type: string
      enum: [open, offered, filled, confirmed]

    Shift:
      type: object
      required: [id, locationId, startsAt, endsAt, roleRequired, status]
      properties:
        id: { type: string, format: uuid }
        locationId: { type: string, format: uuid }
        locationName: { type: string }
        startsAt: { type: string, format: date-time }
        endsAt: { type: string, format: date-time }
        roleRequired: { type: string }
        skillsRequired:
          type: array
          items: { type: string, example: kkt }
        status: { $ref: '#/components/schemas/ShiftStatus' }

    ShiftCandidate:
      type: object
      required: [employeeId, fullName, position, score, reasons]
      description: 'Намеренно без фото, возраста и пола — score_candidate() их не получает (data-minimisation).'
      properties:
        employeeId: { type: string, format: uuid }
        fullName: { type: string }
        position: { type: string }
        score: { type: number }
        reasons:
          type: array
          items: { type: string }
          description: 'Готовые строки для карточки (например «Свободен сегодня 9:00–21:00», «1,2 км от точки», «12 смен без неявок»)'

    CreateShiftOfferRequest:
      type: object
      required: [shiftId, employeeId]
      properties:
        shiftId: { type: string, format: uuid }
        employeeId: { type: string, format: uuid }

    ShiftOfferStatus:
      type: string
      enum: [proposed, accepted, declined, expired]

    ShiftOffer:
      type: object
      required: [id, shiftId, employeeId, score, reasons, status, createdAt]
      properties:
        id: { type: string, format: uuid }
        shiftId: { type: string, format: uuid }
        employeeId: { type: string, format: uuid }
        score: { type: number }
        reasons:
          type: array
          items: { type: string }
        status: { $ref: '#/components/schemas/ShiftOfferStatus' }
        createdAt: { type: string, format: date-time }

    Weekday:
      type: string
      enum: [mon, tue, wed, thu, fri, sat, sun]

    AvailabilityWindow:
      type: object
      required: [weekday, timeFrom, timeTo, openForExtra]
      properties:
        weekday: { $ref: '#/components/schemas/Weekday' }
        timeFrom: { type: string, pattern: '^([01]\d|2[0-3]):[0-5]\d$', example: '09:00' }
        timeTo: { type: string, pattern: '^([01]\d|2[0-3]):[0-5]\d$', example: '21:00' }
        openForExtra: { type: boolean }

    AuditEntry:
      type: object
      required: [occurredAt, actorId, actorName, entity, entityId, action, hash]
      properties:
        occurredAt: { type: string, format: date-time }
        actorId: { type: string, format: uuid }
        actorName: { type: string }
        entity: { type: string, example: leave_request }
        entityId: { type: string, format: uuid }
        action: { type: string, example: approve }
        fromStatus:
          oneOf: [{ type: string }, { type: 'null' }]
        toStatus:
          oneOf: [{ type: string }, { type: 'null' }]
        method:
          oneOf: [{ type: string, enum: [biometric, confirm] }, { type: 'null' }]
        hash: { type: string, description: 'Часть цепочки хешей журнала (только INSERT, не редактируется)' }
        prevHash:
          oneOf: [{ type: string }, { type: 'null' }]

    ErrorCode:
      type: string
      enum: [NOT_LINKED, FORBIDDEN, NOT_FOUND, VALIDATION_ERROR, RULE_VIOLATION, ALREADY_RESOLVED, CONFLICT]

    ErrorDetail:
      type: object
      properties:
        field:
          oneOf: [{ type: string }, { type: 'null' }]
        issue: { type: string }

    ErrorResponse:
      type: object
      required: [error]
      properties:
        error:
          type: object
          required: [code, message]
          properties:
            code: { $ref: '#/components/schemas/ErrorCode' }
            message: { type: string, description: Текст для человека, на «вы», без канцелярита }
            details:
              type: array
              items: { $ref: '#/components/schemas/ErrorDetail' }
```
