# Деплой photo.nexcel.kz на Cloudflare Pages

Проект полностью настроен для статического хостинга на **Cloudflare Pages**. Все заголовки безопасности, CSP и SPA-роутинг сконфигурированы в `public/_headers` и `public/_redirects`.

---

## 1. Деплой через GitHub (рекомендуемый способ)

### Шаг 1. Создание репозитория и пуш
```bash
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
curl -s -I -H "Accept-Encoding: gzip, br" https://photo.nexcel.kz/wasm/vision_wasm_internal.wasm
```

В ответе для wasm-файла должны присутствовать:
- `Content-Type: application/wasm`
- `Content-Encoding: br` (или `gzip`)
- `Cache-Control: public, max-age=31536000, immutable`
