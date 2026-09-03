# Remember — мобильное приложение

Expo / React Native (TypeScript), iOS + Android. Единственный клиент продукта; общается только с
`api`. Общий пакет типов с `api` не заводится — нужные типы дублируются здесь (`src/api.ts`).

Сейчас здесь клиент аккаунтов (m-3): вход тремя способами, токен сессии в `expo-secure-store`
(Keychain на iOS, EncryptedSharedPreferences на Android), ник, профиль, выход — и гейт, который
решает, какие экраны вообще существуют. Поверх него — первые экраны воспоминаний (m-0): список
своих воспоминаний на главной и создание нового. Экрана самого воспоминания ещё нет.

Из трёх входов вживую работает только ссылка на email. Apple и Google подключены целиком, но им
нужны ключи на стороне `api` — без них он отвечает `501` — и **dev-билд**: в Expo Go нет ни
entitlement на Sign in with Apple, ни нашей URL-схемы. Кнопке Google нужен вдобавок
`EXPO_PUBLIC_GOOGLE_CLIENT_ID`; без него она сразу говорит, что вход недоступен, и браузер не
открывает.

## Требования

- Node 20+
- Expo Go на телефоне **или** iOS-симулятор / Android-эмулятор
- Запущенный `api` (соседний репозиторий) — без него не войти, а главный экран вместо списка
  покажет ошибку и кнопку «Try again»

## Запуск

```sh
npm install
EXPO_PUBLIC_API_URL=http://localhost:3000 npx expo start
```

Дальше — `i` (iOS-симулятор), `a` (Android-эмулятор) или QR-код в Expo Go.

Чтобы не писать переменную каждый раз, положите её в `.env` (файл в `.gitignore`):

```sh
EXPO_PUBLIC_API_URL=http://localhost:3000
```

### `EXPO_PUBLIC_API_URL`

Базовый URL API. Без неё берётся `http://localhost:3000`.

`localhost` работает только на симуляторе/эмуляторе. **С телефона через Expo Go** подставьте
IP машины в локальной сети, например `EXPO_PUBLIC_API_URL=http://192.168.1.10:3000`.

Переменная подставляется в бандл на сборке — после её изменения перезапустите `expo start`.
По той же причине в `EXPO_PUBLIC_*` не кладутся секреты: содержимое уезжает в собранное приложение.

### Ссылка входа по email в разработке

Почты в MVP нет: ссылку `remember://auth/email?token=…` API печатает себе в лог (строка
`magic link issued`).

**Схема `remember://` работает только в dev-билде.** В Expo Go она принадлежит не нам, и
`xcrun simctl openurl booted "remember://…"` падает с `LSApplicationWorkspaceErrorDomain 115`.
В Expo Go тот же экран открывается через схему Expo:

```sh
xcrun simctl openurl booted "exp://127.0.0.1:8081/--/auth/email?token=<TOKEN>"
```

## Экраны

Навигация — `expo-router` (файловая маршрутизация, `src/app/`), корневой layout — `Stack` с гейтом.

- **`login` — Sign in** (`src/app/login.tsx`) — три входа: письмо со ссылкой, Apple и Google;
  недоступный провайдер объясняет это прямо на кнопке, а не падает.
- **`auth/email` — Signing in** (`src/app/auth/email.tsx`) — куда приземляется ссылка
  `remember://auth/email?token=…`: меняет токен из ссылки на сессию, протухшую отправляет за новой.
- **`set-username` — Pick a username** (`src/app/set-username.tsx`) — единственный экран, доступный
  вошедшему аккаунту без ника; занял ник — открылось остальное.
- **`index` — Remember** (`src/app/index.tsx`) — главный экран: список воспоминаний, где аккаунт
  организатор или участник (`GET /memories`), с состояниями «загрузка», «пусто» и «ошибка +
  Try again». Перезапрашивается на каждый фокус, поэтому возврат с `create` показывает новое
  воспоминание сам. Строка ведёт на `/memory/[id]` — этого маршрута ещё нет, он придёт с TASK-14.
- **`create` — New memory** (`src/app/create.tsx`) — название и дата (или интервал) мероприятия;
  дату выбирает системный календарь `@react-native-community/datetimepicker`, так что ввести
  неверную нельзя. Уходит в `POST /memories` началом и концом **local** суток — `toISOString()`
  даёт RFC 3339 со смещением, которого требует `api`.
- **`memory/[id]/upload` — Upload** (`src/app/memory/[id]/upload.tsx`) — выбор фото и видео из
  галереи телефона. Доступ к медиатеке спрашивается кнопкой, а не на входе: до согласия экран не
  читает ничего, и есть состояние «нет доступа» — включая `limited`, когда отдали не всю
  библиотеку, а несколько кадров. Кнопка «Select all from that date» — это `assetsInEventWindow`
  из `src/media-window.ts` по окну мероприятия, и ничего больше. Экран заканчивается списком к
  отправке: сама отправка в R2 придёт с TASK-24.
- **`profile` — Profile** (`src/app/profile.tsx`) — ник и имя, смена ника, выход.
- **`about` — About** (`src/app/about.tsx`) — показывает текущий `EXPO_PUBLIC_API_URL`.

Весь HTTP — в `src/api.ts`, состояние сессии — в `src/auth.tsx`.

### Как добавить экран за входом

Гейт — `Stack.Protected` в `src/app/_layout.tsx`; ключ к нему — `status` из `useAuth()`. Экраны
не прячутся, а **не существуют**: `expo-router` выкидывает из навигатора всё, что гейт не пустил.

| `status`         | Какие экраны существуют                                            |
|------------------|--------------------------------------------------------------------|
| `loading`        | `login`, `auth/email` — под сплэшем, чтобы холодному старту по ссылке было куда приземлиться |
| `signed-out`     | `login`, `auth/email`                                              |
| `needs-username` | `set-username`                                                     |
| `ready`          | `index`, `create`, `profile`, `about`                              |

Новому экрану за входом нужны **две** вещи: файл в `src/app/` и строка в блоке `status === 'ready'`.

```tsx
<Stack.Protected guard={status === 'ready'}>
  <Stack.Screen name="memories" options={{ title: 'Memories' }} />
</Stack.Protected>
```

Забыли вторую — маршрута **молча** не будет: переход по нему не упадёт с ошибкой, а уведёт на
первый экран, который всё-таки объявлен.

Текущий пользователь — `const { user, token } = useAuth()`; за гейтом он уже загружен, и `token`
не `null`. Вызов API — новая функция в `src/api.ts`, которая принимает `token` параметром;
заголовок `Authorization: Bearer` вешает сам `request`:

```ts
export function listMemories(token: string): Promise<Memory[]> {
  return request('/memories', { token });
}
```

Ошибку с такого вызова показывают через `errorMessage(error)` — она достаёт формулировку самого
API. Ветвиться на конкретный ответ (`401`, `409`) можно по `error instanceof ApiError` и
`error.status`.

## Команды

| Команда | Что делает |
|---|---|
| `npx expo start` | dev-сервер: Expo Go, симулятор, эмулятор |
| `npm run ios` / `npm run android` | то же, сразу открыть симулятор/эмулятор |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | vitest, один прогон |

## Чего здесь нет

CI, конфигурация EAS-сборок, экраны и сущности воспоминаний, стейт-менеджер, UI-кит — всё это
принесёт та фича, которой понадобится. Экраны на пилоте проверяются руками: рендер-обвязки нет,
vitest здесь только под чистую логику вроде `src/media-window.ts`.
