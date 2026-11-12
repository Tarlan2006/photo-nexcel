# Деплой photo.nexcel.kz на Cloudflare Pages

Проект полностью настроен для статического хостинга на **Cloudflare Pages**. Все заголовки безопасности, CSP и SPA-роутинг сконфигурированы в `public/_headers` и `public/_redirects`.

---

## 1. Деплой через GitHub (рекомендуемый способ)

### Шаг 1. Создание репозитория и пуш
```bash
git branch -M master
git remote add origin https://github.com/<ваш-аккаунт>/photo-nexcel.git
git push -u origin master
```

### Шаг 2. Подключение в Cloudflare Pages
1. Откройте [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Compute (Workers & Pages)** → **Create application** → вкладка **Pages**.
2. Нажмите **Connect to Git** и выберите репозиторий `photo-nexcel`.
3. Задайте параметры сборки:
   - **Project name:** `photo-nexcel`
   - **Production branch:** `master`
   - **Framework preset:** `Vite`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** *(оставить пустым)*
4. Нажмите **Save and Deploy**. Cloudflare автоматически соберёт и опубликует сайт на домене вида `photo-nexcel.pages.dev`.

---

## 2. Альтернатива: Деплой через Cloudflare Wrangler CLI

```bash
# Тесты перед деплоем
npm test

# Сборка
npm run build

# Деплой напрямую в Cloudflare Pages
npx wrangler pages deploy dist --project-name=photo-nexcel
```

---

## 3. Привязка поддомена photo.nexcel.kz

1. В Cloudflare Dashboard перейдите в проект **Pages** → `photo-nexcel`.
2. Откройте вкладку **Custom domains** и нажмите кнопку **Set up a custom domain**.
3. Введите `photo.nexcel.kz` и нажмите **Continue**.
4. **Если DNS-зона `nexcel.kz` находится в вашем аккаунте Cloudflare:**
   - Cloudflare автоматически создаст CNAME-запись:
     ```
     photo   CNAME   photo-nexcel.pages.dev   (Proxied / Оранжевое облако)
     ```
   - Нажмите **Activate domain**.
5. **Если DNS управляется сторонним регистратором:**
   - Добавьте в панели регистратора CNAME-запись:
     - Имя / Subdomain: `photo`
     - Тип: `CNAME`
     - Значение: `photo-nexcel.pages.dev`
6. SSL/TLS сертификат выпускается Cloudflare автоматически (Universal SSL) в течение 5–15 минут.

---

## 4. Проверка сжатия Wasm и заголовков после деплоя

После публикации проверьте ответ Cloudflare через curl:

```bash
# Проверка заголовков безопасности (CSP, HSTS, Permissions-Policy)
curl -s -I https://photo.nexcel.kz/

# Проверка сжатия Brotli / Gzip для Wasm (14.6 МБ сжимается до ~4.1 МБ)
vision_version=$(node -p "require('./node_modules/@mediapipe/tasks-vision/package.json').version")
curl -s -I -H "Accept-Encoding: gzip, br" "https://photo.nexcel.kz/wasm/$vision_version/vision_wasm_internal.wasm"
```

В ответе для wasm-файла должны присутствовать:
- `Content-Type: application/wasm`
- `Content-Encoding: br` (или `gzip`)
- `Cache-Control: public, max-age=31536000, immutable`

Ответ HTML мастера использует `Cache-Control: no-transform`, чтобы Cloudflare не подставлял внешний скрипт Web Analytics. Кэширование и сжатие ресурсов настраиваются отдельно.

Vite берёт загрузчик и бинарник WASM из установленной версии `@mediapipe/tasks-vision` и публикует их по `/wasm/<версия>/`. Для распознавания лица браузеру нужна поддержка WebAssembly SIMD. Для автоматического фона и костюма также требуется WebGL 2.

Проверьте контактные данные в `public/.well-known/security.txt` до даты `Expires` и обновите срок действия.

## 5. Редактор фото

Модель [MediaPipe SelfieMulticlass 256×256](https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter#multi-class_selfie_segmentation_model) от Google хранится в `public/models/selfie-multiclass-v1.tflite` (16 371 837 байт, Apache 2.0). Она загружается при первом выборе автоматического фона или костюма. Для ручного контура модель не нужна. При обновлении модели меняйте имя файла, поскольку URL кэшируется с `immutable`.

`npm test` запускает юнит-тесты и проверку production-сборки в Chromium. Для браузерных тестов установите Chromium через `npx playwright install chromium` или задайте `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` для установленного Chrome. Тесты с фото используют локальные файлы из `tests/fixtures/`, исключённые из Git. При отсутствии файла соответствующая проверка пропускается. Исходники для локального прогона: [portrait.jpg](https://raw.githubusercontent.com/opencv/opencv/master/samples/data/lena.jpg) и [astronaut.png](https://raw.githubusercontent.com/scikit-image/scikit-image/v0.25.2/skimage/data/astronaut.png).
