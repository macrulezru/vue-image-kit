Вот полное ТЗ текстом, готово к копированию в любой ИИ:

---

# Техническое задание: vue-image-kit v1.0

## Обзор

Разработать npm-пакет `vue-image-kit` — zero-dependency библиотеку для Vue 3, которая решает задачу оптимизированной загрузки изображений. Пакет предоставляет три точки входа: компонент `<VImage>`, composable `useImage()` и директиву `v-lazy-img`.

Единственная peer-зависимость — Vue 3. Никаких внешних npm-пакетов, включая пакет `blurhash` — всё реализуется самостоятельно.

---

## Стек и инструменты

- Vue 3 (Composition API, `<script setup>`)
- TypeScript (strict mode, никаких `any`, никаких `as unknown`)
- Vite (lib mode для сборки)
- Vitest + Vue Test Utils (тесты)
- Выходной формат: tree-shakeable ESM + CJS

---

## Фичи v1.0

### 1. Blurhash placeholder
Декодирование blurhash-строки в canvas-placeholder без внешних библиотек. Реализовать алгоритм декодирования самостоятельно в файле `src/utils/blurhash-decode.ts` на основе открытой спецификации blurhash. Canvas создаётся только внутри `onMounted` — на сервере рендерится пустой блок с сохранённым aspect-ratio.

### 2. LQIP (base64 preview)
Принимает base64-строку как проп `placeholder` (формат `data:image/...`). Показывает размытый preview через CSS `filter: blur()` пока грузится основное изображение. После загрузки — плавный transition к оригиналу.

### 3. srcset + sizes автогенерация
Принимает массив ширин `widths: number[]` (например `[400, 800, 1200]`) и автоматически генерирует `srcset`-строку. Принимает проп `sizes` как готовую строку (например `"(max-width: 768px) 100vw, 50vw"`). Логика генерации вынесена в `src/utils/srcset.ts`.

### 4. WebP / AVIF source switching
Компонент рендерит `<picture>` с вложенными `<source>` элементами для WebP и AVIF форматов. Проп `src` может быть строкой или объектом вида `{ avif?: string, webp?: string, fallback: string }`. Если переданы форматы — генерируются соответствующие `<source type="image/avif">` и `<source type="image/webp">` перед основным `<img>`.

### 5. Error state + fallback slot
Именованный слот `#error` для кастомного fallback UI при ошибке загрузки. Событие `@error` с объектом `Event`. Встроенный дефолтный fallback — серый прямоугольник с иконкой, если слот не передан.

### 6. Lazy loading через IntersectionObserver
Использовать нативный `IntersectionObserver` вместо атрибута `loading="lazy"` для полного контроля. Пропы `rootMargin` (default: `"200px"`) и `threshold` (default: `0`) конфигурируют поведение. SSR-safe: при отсутствии `window` — fallback на `loading="lazy"` атрибут.

---

## API компонента VImage

```vue
<VImage
  src="/photo.jpg"
  alt="Описание"
  :width="1200"
  :height="600"
  blurhash="LKO2?U%2Tw=w]~RBVZRi"
  placeholder="data:image/jpeg;base64,..."
  :widths="[400, 800, 1200]"
  sizes="(max-width: 768px) 100vw, 50vw"
  :sources="{ mobile: '/photo-mobile.jpg', tablet: '/photo-tablet.jpg' }"
  :lazy="true"
  root-margin="300px"
  fit="cover"
  @load="onLoad"
  @error="onError"
>
  <template #error>
    <div>Изображение не загрузилось</div>
  </template>
</VImage>
```

Полный список пропов:

| Проп | Тип | Дефолт | Описание |
|---|---|---|---|
| `src` | `string \| SrcSet` | — | URL или объект с форматами |
| `alt` | `string` | — | Обязателен (TypeScript required) |
| `width` | `number` | — | Ширина для aspect-ratio резервирования |
| `height` | `number` | — | Высота для aspect-ratio резервирования |
| `blurhash` | `string` | — | Строка blurhash |
| `placeholder` | `string` | — | Base64 LQIP |
| `widths` | `number[]` | — | Ширины для srcset |
| `sizes` | `string` | — | HTML sizes атрибут |
| `sources` | `ResponsiveSrc` | — | Адаптивные источники по брейкпоинтам |
| `lazy` | `boolean` | `true` | Включить IntersectionObserver |
| `rootMargin` | `string` | `"200px"` | IO rootMargin |
| `threshold` | `number` | `0` | IO threshold |
| `fit` | `ObjectFit` | `"cover"` | CSS object-fit |

---

## API composable useImage()

```ts
const {
  status,      // Ref<'idle' | 'loading' | 'loaded' | 'error'>
  isLoaded,    // ComputedRef<boolean>
  isError,     // ComputedRef<boolean>
  imgAttrs,    // ComputedRef<object> — готовые атрибуты для v-bind на img
  observe,     // (el: Ref<HTMLElement | null>) => void
} = useImage(options)
```

Машина состояний: `idle → loading → loaded | error`. Переход в `loading` происходит когда элемент входит во viewport (через `observe`) или сразу при `lazy: false`.

---

## API директивы v-lazy-img

```vue
<!-- Простая строка -->
<div v-lazy-img="'/background.jpg'" />

<!-- Объект с опциями -->
<div v-lazy-img="{
  src: '/background.jpg',
  placeholder: 'data:image/jpeg;base64,...',
  rootMargin: '100px',
  onLoad: () => {},
  onError: () => {}
}" />
```

Директива устанавливает `background-image` на элемент после того как он входит во viewport. Подходит для случаев когда нельзя использовать компонент.

---

## Структура файлов

```
src/
  components/
    VImage.vue           — основной компонент
  composables/
    useImage.ts          — headless логика состояния
    useBlurhash.ts       — декодирование blurhash в canvas
    useLazyLoad.ts       — IntersectionObserver обёртка, SSR-safe
  directives/
    vLazyImg.ts          — директива для background-image
  utils/
    srcset.ts            — генерация srcset/sizes строк
    blurhash-decode.ts   — чистый алгоритм декодирования, без deps
  types/
    index.ts             — все публичные типы
  index.ts               — публичный экспорт
```

---

## Публичные типы (экспортировать все)

```ts
type ImageStatus = 'idle' | 'loading' | 'loaded' | 'error'

interface SrcSet {
  avif?: string
  webp?: string
  fallback: string
}

interface ResponsiveSrc {
  mobile?: string
  tablet?: string
  desktop?: string
}

interface LazyImgOptions {
  src: string
  placeholder?: string
  rootMargin?: string
  threshold?: number
  onLoad?: () => void
  onError?: (e: Event) => void
}

type ObjectFit = 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'
```

---

## SSR / Nuxt поведение

**IntersectionObserver:** обернуть в проверку `typeof window !== 'undefined'`. На сервере — рендерить `<img>` с `loading="lazy"` напрямую без IO.

**Blurhash / Canvas:** весь canvas-код только внутри `onMounted`. На сервере — рендерить пустой `<div>` с `aspect-ratio` вычисленным из `width` и `height` пропов.

**Hydration:** `status` начинается с `'idle'`. После гидрации `onMounted` запускает IO или сразу переходит в `'loading'` если `lazy: false`.

**Nuxt plugin:** экспортировать `VImageKitPlugin` для `app.use()`. Плагин регистрирует компонент `<VImage>` и директиву `v-lazy-img` глобально.

---

## Требования к тестам

Vitest + Vue Test Utils. Минимальное покрытие:
- `blurhash-decode.ts` — 100%
- `srcset.ts` — 100%
- `useLazyLoad.ts` — 90%+
- `useImage.ts` — 90%+
- `VImage.vue` — 80%+

Тесты для SSR-сценариев: убедиться что компоненты рендерятся без ошибок при `typeof window === 'undefined'`.

---

## Требования к бандлу

- Цель: менее 8kb gzip (полный пакет с blurhash)
- Цель: менее 3kb gzip (без blurhash — tree-shaking)
- Никаких side effects в корневом экспорте
- `sideEffects: false` в package.json

---

## Порядок реализации

1. `blurhash-decode.ts` и `srcset.ts` — чистые утилиты без Vue
2. `useLazyLoad.ts` — IO обёртка с SSR-safe логикой
3. `useBlurhash.ts` — canvas рендеринг через декодер
4. `useImage.ts` — composable, объединяет состояние и IO
5. `VImage.vue` — компонент на основе composable
6. `vLazyImg.ts` — директива
7. `index.ts` — экспорт + плагин
8. Тесты для каждого модуля
9. Проверка бандл-сайза