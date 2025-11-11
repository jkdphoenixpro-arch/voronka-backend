const express = require('express');
const cors = require('cors');
const stripe = require('stripe');
require('dotenv').config();

console.log('Запуск сервера...');
console.log('STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? 'Установлен' : 'НЕ УСТАНОВЛЕН');

const app = express();
const stripeInstance = stripe(process.env.STRIPE_SECRET_KEY);

// Middleware
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000'
}));
app.use(express.json());

// Простой тест endpoint
app.get('/test', (req, res) => {
    res.json({ message: 'Сервер работает!', timestamp: new Date().toISOString() });
});

// Тарифные планы (упрощенные) - используем USD для тестирования
const PLANS = {
    basic: {
        name: 'Базовый план (4-Week)',
        price: 699, // $6.99 в центах
        currency: 'usd'
    },
    premium: {
        name: 'Премиум план (8-Week)',
        price: 1599, // $15.99 в центах
        currency: 'usd'
    },
    pro: {
        name: 'Про план (12-Week)',
        price: 2599, // $25.99 в центах
        currency: 'usd'
    }
};

// Создание сессии оплаты (упрощенная версия)
app.post('/create-checkout-session', async (req, res) => {
    try {
        console.log('=== НОВЫЙ ЗАПРОС ===');
        console.log('Тело запроса:', req.body);
        
        const { planId } = req.body;
        console.log('Plan ID:', planId);

        if (!PLANS[planId]) {
            console.log('❌ Неверный план:', planId);
            console.log('Доступные планы:', Object.keys(PLANS));
            return res.status(400).json({ error: 'Неверный тарифный план' });
        }

        const plan = PLANS[planId];
        console.log('✅ Выбранный план:', plan);

        const sessionConfig = {
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: plan.currency,
                        product_data: {
                            name: plan.name,
                        },
                        unit_amount: plan.price,
                    },
                    quantity: 1,
                }
            ],
            mode: 'payment',
            success_url: `${process.env.CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.CLIENT_URL}/paywall`,
        };

        console.log('Создание сессии Stripe...');
        const session = await stripeInstance.checkout.sessions.create(sessionConfig);
        console.log('✅ Сессия создана:', session.id);

        res.json({ url: session.url });
    } catch (error) {
        console.error('❌ Ошибка создания сессии:', error);
        console.error('Сообщение:', error.message);
        console.error('Тип:', error.type);
        console.error('Код:', error.code);
        res.status(500).json({ 
            error: 'Внутренняя ошибка сервера', 
            details: error.message,
            type: error.type 
        });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📍 Тестовый endpoint: http://localhost:${PORT}/test`);
});