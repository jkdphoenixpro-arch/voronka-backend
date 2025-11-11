# Backend для интеграции со Stripe

## Установка и запуск

1. Установите зависимости:
```bash
cd backend
npm install
```

2. Создайте файл `.env` на основе `.env.example`:
```bash
cp .env.example .env
```

3. Заполните `.env` файл вашими ключами Stripe

4. Запустите сервер:
```bash
npm run dev
```

## API Endpoints

### POST /create-checkout-session
Создает сессию оплаты в Stripe

**Тело запроса:**
```json
{
  "planId": "basic" // или "premium", "pro"
}
```

**Ответ:**
```json
{
  "url": "https://checkout.stripe.com/pay/..."
}
```

### GET /payment-status/:sessionId
Проверяет статус платежа

**Ответ:**
```json
{
  "status": "paid",
  "customerEmail": "user@example.com",
  "amountTotal": 990
}
```

### GET /plans
Возвращает доступные тарифные планы

## Настройка Stripe

1. Зарегистрируйтесь на https://stripe.com
2. Перейдите в Dashboard
3. Скопируйте тестовые ключи из раздела "Developers" > "API keys"
4. Вставьте их в файл `.env`