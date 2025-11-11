const stripe = require('stripe');
require('dotenv').config();

console.log('Тестирование подключения к Stripe...');
console.log('STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? 'Установлен' : 'НЕ УСТАНОВЛЕН');

if (!process.env.STRIPE_SECRET_KEY) {
    console.error('❌ STRIPE_SECRET_KEY не найден в .env файле');
    process.exit(1);
}

const stripeInstance = stripe(process.env.STRIPE_SECRET_KEY);

async function testStripe() {
    try {
        // Тестируем создание простой сессии
        const session = await stripeInstance.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'rub',
                        product_data: {
                            name: 'Тестовый продукт',
                        },
                        unit_amount: 1000, // 10.00 руб
                    },
                    quantity: 1,
                }
            ],
            mode: 'payment',
            success_url: 'http://localhost:3000/success',
            cancel_url: 'http://localhost:3000/cancel',
        });

        console.log('✅ Stripe работает корректно!');
        console.log('Тестовая сессия создана:', session.id);
        
    } catch (error) {
        console.error('❌ Ошибка Stripe:', error.message);
        console.error('Тип ошибки:', error.type);
        console.error('Код ошибки:', error.code);
    }
}

testStripe();