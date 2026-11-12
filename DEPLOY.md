# Деплой photo.nexcel.kz на Cloudflare Pages

Проект настроен для статического хостинга на **Cloudflare Pages**. Все заголовки безопасности, CSP и SPA-роутинг сконфигурированы в `public/_headers` и `public/_redirects`.

---

## 1. Деплой через GitHub (рекомендуемый способ)

### Шаг 1. Создание репозитория и пуш
```bash
git init
git add .
git commit -m "feat: initial photo.nexcel.kz"
git branch -M main
git remote add origin https://github.com/<ваш-аккаунт>/photo-nexcel.git
git push -u origin main
```

### Шаг 2. Подключение в Cloudflare Pages
1. Откройте [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Compute (Workers & Pages)** → **Create application** → вкладка **Pages**.
2. Нажмите **Connect to Git** и выберите репозиторий `photo-nexcel`.
3. Задайте параметры сборки:
   - **Project name:** `photo-nexcel`
   - **Production branch:** `main`
   - **Framework preset:** `Vite`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** *(оставить пустым)*
4. Нажмите **Save and Deploy**. Cloudflare автоматически соберёт и опубликует сайт на домене вида `photo-nexcel.pages.dev`.

---

## 2. Альтернатива: Деплой через Cloudflare Wrangler CLI

```bash
# Локальная сборка
npm run build

# Деплой напрямую в Pages
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

## 4. Заголовки безопасности и CSP

Файл `public/_headers` автоматически копируется в `dist/_headers` при сборке и применяет:
- **Content-Security-Policy (CSP):**
  - Разрешает выполнение локального WebAssembly (`wasm-unsafe-eval`).
  - Локальные скрипты, шрифты и стили без сторонних CDN.
  - Обработка изображений в `blob:` и `data:`.
- **Защита от встраивания:** `X-Frame-Options: DENY`, `frame-ancestors 'none'`.
- **Долговечное кэширование:** для статических шрифтов, wasm и модели `max-age=31536000, immutable`.
