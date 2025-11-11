# Настройка Mailgun для бесплатного плана

## Шаг 1: Получение данных из Mailgun Dashboard

1. Войдите в [Mailgun Dashboard](https://app.mailgun.com/)
2. Перейдите в **Sending** → **Domains**
3. Выберите ваш **Sandbox domain** (например: `sandbox12345678.mailgun.org`)

## Шаг 2: Получение API ключа

1. В Dashboard перейдите в **Settings** → **API Keys**
2. Скопируйте **Private API key** (начинается с `key-`)

## Шаг 3: Настройка авторизованных получателей (ВАЖНО!)

**На бесплатном плане можно отправлять письма только авторизованным получателям.**

1. В Dashboard перейдите к вашему Sandbox domain
2. Найдите раздел **Authorized Recipients**
3. Нажмите **Add Recipient**
4. Добавьте email адреса, на которые хотите отправлять тестовые письма
5. Подтвердите email адреса (проверьте почту и нажмите на ссылку подтверждения)

## Шаг 4: Создание .env файла

Создайте файл `.env` в папке `backend/`:

```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/your-database-name

# Stripe
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
CLIENT_URL=http://localhost:3000

# Mailgun настройки
MAILGUN_API_KEY=key-your-private-api-key-here
MAILGUN_SANDBOX_DOMAIN=sandbox12345678.mailgun.org

# Порт сервера
PORT=3001
```

## Шаг 5: Тестирование

1. Запустите backend: `npm start`
2. Запустите frontend и откройте `/testmail`
3. Введите email, который добавили в Authorized Recipients
4. Отправьте письмо

## Ограничения бесплатного плана

- ✅ 5,000 писем в месяц бесплатно
- ⚠️  Можно отправлять только на авторизованные email адреса
- ⚠️  В теме письма будет добавлен префикс из sandbox домена
- ⚠️  Ограничены некоторые функции (webhooks, статистика)

## Переход на платный план

Для отправки на любые email адреса без ограничений нужно:
1. Добавить банковскую карту в Mailgun
2. Верифицировать собственный домен
3. Настроить DNS записи (SPF, DKIM, DMARC)

## Альтернативы для тестирования

Если нужно тестировать с разными email адресами:
- Используйте сервисы типа [Temp Mail](https://temp-mail.org)
- Добавляйте тестовые адреса в Authorized Recipients
- Рассмотрите другие сервисы: Resend, SendGrid, Brevo