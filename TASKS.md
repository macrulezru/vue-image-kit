# vue-image-kit — roadmap

---

## v2.0 — CLI, CDN адаптеры, ключевые улучшения

### A. CLI (`vue-image-kit generate`)

- [x] `--input`, `--output`, `--widths`, `--formats`, `--quality`, `--template`, `--manifest`, `--public-path`
- [x] `--lqip` — LQIP base64 (resize 20px, quality 20)
- [x] `--blurhash` — BlurHash encoding (`src/cli/blurhash-encode.ts`)
- [x] `--clean`, `--dry-run`, `--skip-existing`, `--concurrency`, `--watch`
- [x] Subpath export `vue-image-kit/cli`, `"bin"` в package.json
- [x] `sharp` — только `peerDependencies` (optional), не в браузерном бандле
- [x] Прогресс в терминале, понятные ошибки при отсутствии sharp
- [x] Config file: `vue-image-kit.config.{js,mjs,cjs,json}` (`src/cli/config.ts`)
- [x] `tsconfig.cli.json` + `scripts/fix-cli-shebang.cjs`

---

### B. CDN URL адаптеры (`vue-image-kit/cdn`)

- [x] Общий интерфейс `CdnAdapter` — `.url(path, options)` / `.srcset(path, widths)`
- [x] **Cloudinary** — `w_N,q_auto,f_auto`, поддержка fit/dpr/format
- [x] **imgix** — `?w=N&auto=format`, поддержка fit/dpr/format
- [x] **Bunny CDN** — `?width=N&quality=N&format=N`
- [x] **Storyblok** — `{W}x{H}/filters:format(webp)/`
- [x] **Sanity** — `?w=N&auto=format&q=N`
- [x] **Contentful** — `?w=N&fm=webp&q=N`
- [x] **Vercel** — `/_vercel/image?url=...&w=N&q=N`
- [x] `vite.cdn.config.ts` — отдельная сборка ESM+CJS

---

### C. Исправления и улучшения ядра

- [x] **Art direction sorting** — `useBreakpoints.ts` теперь различает `max-width` (ascending) и `min-width` (descending), прочие — без изменений
- [x] **`fetchpriority` проп** — пробрасывается на все `<img>` в VImage
- [x] **`decoding` проп** — дефолт `"async"`, пробрасывается на все `<img>`
- [x] **IO pooling** — `src/utils/observer-pool.ts`: один shared IO на уникальную `rootMargin+threshold` комбинацию; `useLazyLoad.ts` переписан на пул

---

### D. Новые возможности ядра

- [x] **ThumbHash** — `src/utils/thumbhash-decode.ts`: `decodeThumbHash(hash)` → `data:image/png;base64,...`, встроенный PNG encoder, поддержка альфа
- [x] **`buildSizes()`** — утилита в `srcset.ts`: `{ sm: '100vw', default: '33vw' }` + breakpoints → строка sizes
- [x] **`generatePreloadLink()`** — генерирует `<link rel="preload" as="image" ...>` для SSR/Nuxt useHead
- [x] **Error retry** — `maxRetries` + `retryDelay` в `useImage()`, экспоненциальный backoff
- [x] **`v-lazy-img` transition** — опция `transition` в `LazyImgOptions`, дефолт `'0.4s ease'`
- [x] **`useImagePreloader`** — `src/composables/useImagePreloader.ts`: `{ loaded, total, progress, isComplete, errors, preload(urls) }`

---

### E. Экосистема

- [x] **Nuxt модуль** — `src/nuxt/module.ts` + `src/nuxt/runtime/plugin.ts`; auto-register VImage + v-lazy-img, auto-imports composables, breakpoints через runtimeConfig; export `vue-image-kit/nuxt`
- [x] **Vite plugin** — `src/vite/plugin.ts`; запускает generate на `buildStart` и `handleHotUpdate`; export `vue-image-kit/vite`

---

### F. DX и документация

- [ ] Обновить `README.md`: разделы CLI, CDN адаптеры, ThumbHash, `fetchpriority`/`decoding`, IO pooling, Nuxt module, Vite plugin
- [ ] Тесты: CDN адаптеры, `buildSizes`, `generatePreloadLink`, `decodeThumbHash`, IO pool, `useImagePreloader`
- [ ] Обновить версию в package.json до `2.0.0` *(уже сделано)*

---

# v1.0 — план реализации (выполнено)

---

## 1. Инициализация проекта

- [x] Создать `package.json` (name, version, exports, sideEffects: false, peerDeps)
- [x] Создать `tsconfig.json` (strict mode, paths, noEmit)
- [x] Создать `vite.config.ts` (lib mode, ESM + CJS, dts)
- [x] Установить dev-зависимости: `vite`, `typescript`, `vue`, `vitest`, `@vue/test-utils`, `vite-plugin-dts`
- [x] Создать структуру папок `src/` согласно ТЗ
- [x] Создать `vitest.config.ts`

---

## 2. Типы (`src/types/index.ts`)

- [x] `ImageStatus = 'idle' | 'loading' | 'loaded' | 'error'`
- [x] `SrcSet { avif?, webp?, fallback }`
- [x] `ResponsiveSrc { mobile?, tablet?, desktop? }`
- [x] `LazyImgOptions { src, placeholder?, rootMargin?, threshold?, onLoad?, onError? }`
- [x] `ObjectFit = 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'`

---

## 3. Утилиты (без Vue)

### 3.1 `src/utils/blurhash-decode.ts`
- [x] Реализовать таблицу base83 символов
- [x] Реализовать `decode83()` — декодирование base83 числа
- [x] Реализовать `decodeDC()` — декодирование DC-компоненты (первый цвет)
- [x] Реализовать `decodeAC()` — декодирование AC-компонент
- [x] Реализовать `sRGBToLinear()` и `linearTosRGB()` — конвертация гамма-коррекции
- [x] Реализовать `signPow()` — знаковая степень для AC-компонент
- [x] Реализовать `decodeBlurhash(blurhash, width, height)` → `Uint8ClampedArray`
- [x] Экспортировать `decodeBlurhash`

### 3.2 `src/utils/srcset.ts`
- [x] Реализовать `generateSrcset(src, widths)` → строка `srcset`
- [x] Реализовать `generateSizes(sizes)` → строка `sizes` (passthrough или дефолт)
- [x] Экспортировать обе функции

---

## 4. Composables

### 4.1 `src/composables/useLazyLoad.ts`
- [x] Проверка `typeof window !== 'undefined'` (SSR guard)
- [x] Создать `IntersectionObserver` с `rootMargin` и `threshold`
- [x] Вернуть `isIntersecting: Ref<boolean>` и `observe(el)` 
- [x] Корректно отписываться в `onUnmounted`
- [x] На сервере — сразу `isIntersecting = true` (fallback)

### 4.2 `src/composables/useBlurhash.ts`
- [x] Принимать `blurhash: string`, `width: number`, `height: number`
- [x] Создавать `<canvas>` элемент только в `onMounted`
- [x] Вызывать `decodeBlurhash()` и рисовать пикселя через `ImageData`
- [x] Возвращать `canvasRef: Ref<HTMLCanvasElement | null>`
- [x] На сервере — возвращать `null`

### 4.3 `src/composables/useImage.ts`
- [x] Принимать все пропы компонента как `options`
- [x] Машина состояний: `idle → loading → loaded | error`
- [x] Использовать `useLazyLoad` для отслеживания viewport
- [x] При `lazy: false` — сразу переходить в `loading`
- [x] Генерировать `imgAttrs` через `generateSrcset` и `generateSizes`
- [x] Вернуть `{ status, isLoaded, isError, imgAttrs, observe }`

---

## 5. Компонент `src/components/VImage.vue`

- [x] Определить все пропы согласно таблице в ТЗ (`alt` — required)
- [x] Использовать `useImage()` для управления состоянием
- [x] Рендерить `<picture>` с `<source>` для AVIF и WebP (если переданы)
- [x] Показывать blurhash canvas через `useBlurhash` пока `status !== 'loaded'`
- [x] Показывать LQIP placeholder с `filter: blur()` пока грузится основное фото
- [x] Плавный transition от placeholder к оригиналу (CSS opacity/transition)
- [x] Именованный слот `#error` + встроенный дефолтный fallback (серый прямоугольник)
- [x] Эмитировать `@load` и `@error` события
- [x] Резервировать aspect-ratio через `width`/`height` пропы
- [x] `object-fit` через проп `fit`
- [x] SSR: без canvas, без IO — только `<img loading="lazy">`

---

## 6. Директива `src/directives/vLazyImg.ts`

- [x] Принимать `string` или `LazyImgOptions` как значение директивы
- [x] В `mounted` — создать `IntersectionObserver`
- [x] При пересечении viewport — установить `background-image: url(...)`
- [x] Поддержать `placeholder` — установить сначала placeholder, затем оригинал
- [x] Вызывать `onLoad` / `onError` колбэки
- [x] Корректно отписываться в `unmounted`
- [x] SSR-safe: в `mounted` проверять наличие `window`

---

## 7. Публичный экспорт `src/index.ts`

- [x] Экспортировать компонент `VImage`
- [x] Экспортировать composable `useImage`
- [x] Экспортировать директиву `vLazyImg`
- [x] Экспортировать все типы из `src/types/index.ts`
- [x] Создать и экспортировать `VImageKitPlugin` (регистрирует компонент + директиву глобально)
- [x] Дефолтный экспорт — плагин

---

## 8. Тесты

### 8.1 `blurhash-decode.ts` (цель: 100%)
- [x] Тест корректного декодирования известной blurhash-строки
- [x] Тест размера результирующего массива (`width * height * 4`)
- [x] Тест граничных значений пикселей (0–255)
- [x] Тест `decode83` с известными значениями
- [x] Тест `sRGBToLinear` / `linearTosRGB` round-trip

### 8.2 `srcset.ts` (цель: 100%)
- [x] Тест генерации строки `srcset` из массива ширин
- [x] Тест с пустым массивом `widths`
- [x] Тест passthrough `sizes`
- [x] Тест дефолтного значения `sizes`

### 8.3 `useLazyLoad.ts` (цель: 90%+)
- [x] Тест: `isIntersecting` переключается при срабатывании IO
- [x] Тест: IO создаётся с переданными `rootMargin` и `threshold`
- [x] Тест: отписка в `onUnmounted`
- [x] Тест SSR: при `window === undefined` `isIntersecting` сразу `true`

### 8.4 `useImage.ts` (цель: 90%+)
- [x] Тест начального статуса `idle`
- [x] Тест перехода `idle → loading → loaded`
- [x] Тест перехода `idle → loading → error`
- [x] Тест `lazy: false` — сразу `loading`
- [x] Тест `imgAttrs` содержит корректный `srcset`

### 8.5 `VImage.vue` (цель: 80%+)
- [x] Тест рендера с обязательными пропами
- [x] Тест рендера `<picture>` с AVIF/WebP источниками
- [x] Тест слота `#error` при ошибке загрузки
- [x] Тест дефолтного fallback при ошибке (без слота)
- [x] Тест `@load` и `@error` событий
- [x] Тест SSR рендера без ошибок — покрыт в `useLazyLoad.test.ts`

---

## 9. Demo-приложение (`demo/`)

### 9.1 Инициализация demo
- [x] Создать `demo/package.json` с отдельными зависимостями (Vite, Vue)
- [x] Создать `demo/vite.config.ts` — алиас `vue-image-kit` → `../src/index.ts`
- [x] Создать `demo/tsconfig.json`
- [x] Создать `demo/index.html`
- [x] Добавить скрипты в корневой `package.json`: `demo`, `demo:dev`, `demo:build`
- [x] Создать `demo/src/` структуру: `App.vue`, `tabs/`, `assets/`
- [x] Подготовить тестовые изображения в `demo/public/images/`: JPEG + 400w/800w + WebP + AVIF (8 фото × 5 файлов = 40 файлов)

### 9.2 Шелл и навигация
- [x] `App.vue` — таб-навигация с переключением между разделами
- [x] Стили шелла: тёмный фон, sidebar-навигация, responsive (коллапс в горизонтальное меню)

### 9.3 Tab: Basic
- [x] `TabBasic.vue` — `<VImage>` с разными пропами через live-контролы
- [x] Показать все состояния: `idle`, `loading`, `loaded`, `error`
- [x] Кнопка сброса для повторного воспроизведения

### 9.4 Tab: Blurhash vs LQIP
- [x] `TabBlurhash.vue` — два блока рядом: blurhash canvas и LQIP base64
- [x] Ввод произвольной blurhash-строки с live-превью
- [x] Кнопка «reload» для воспроизведения перехода blur → оригинал
- [x] Отображение decoded canvas в маленьком превью отдельно

### 9.5 Tab: AVIF / WebP
- [x] `TabFormats.vue` — одно изображение в трёх форматах (AVIF / WebP / JPEG)
- [x] Показать какой `<source>` подхватил браузер (через `@load` + `currentSrc`)
- [x] Сравнительная таблица: формат, размер файла, качество

### 9.6 Tab: srcset
- [x] `TabSrcset.vue` — три preview с разными `sizes`, каждый показывает `currentSrc`
- [x] Кандидаты srcset с реальными файлами (400w/800w/1200w) и их размерами
- [x] Live-редактор `sizes` строки через `generateSizes()`

### 9.7 Tab: Lazy Load
- [x] `TabLazyLoad.vue` — длинный список изображений (20+) для скролла
- [x] Индикатор статуса рядом с каждым изображением (`idle` / `loading` / `loaded`)
- [x] Настройки `rootMargin` и `threshold` через контролы

### 9.8 Tab: Directive
- [x] `TabDirective.vue` — grid 36 карточек с `v-lazy-img` на фоновых `div`-ах
- [x] Placeholder (LQIP) → sharp image переход, toggle placeholder on/off
- [x] Индикатор статуса на каждой карточке + event log + sticky sidebar с usage

### 9.9 Tab: Error State
- [x] `TabError.vue` — намеренно сломанный `src` для показа error-состояния
- [x] Дефолтный fallback (SVG-иконка) и кастомный `#error` слот рядом
- [x] Событие `@error` с выводом в лог на экране

### 9.10 Tab: Headless
- [x] `TabHeadless.vue` + `HeadlessPreview.vue` — `useImage()` напрямую, кастомная разметка
- [x] Показать `status`, `isLoaded`, `imgAttrs` как реактивные данные на экране

### 9.11 Tab: Responsive sources *(добавлен сверх плана)*
- [x] `TabResponsive.vue` — art direction через именованные брейкпоинты
- [x] Live-демо переключения `<source media="...">` при разных размерах экрана

### 9.12 Финал demo
- [x] `npm run demo` — одной командой ставит зависимости и стартует dev-сервер
- [x] `npm run demo:build` — production-сборка
- [x] Добавить раздел **Demo** в `README.md` с таблицей табов и инструкцией запуска

---

## 11. Сборка и проверка

- [x] `vite build` — собирает ESM + CJS без ошибок
- [x] TypeScript `tsc --noEmit` — нет ошибок типизации
- [x] Проверить `dist/` содержит `.d.ts` файлы
- [x] Проверить размер бандла: полный < 8kb gzip (3.80 kB ✓)
- [x] Проверить tree-shaking: без blurhash < 3kb gzip (3.29 kB CJS ✓)
- [x] Запустить все тесты `vitest run` — все проходят (57/57 ✓)
