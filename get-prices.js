const stripe = require('stripe');
require('dotenv').config();

const stripeInstance = stripe(process.env.STRIPE_SECRET_KEY);

async function getPrices() {
    try {
        console.log('Получение всех цен из Stripe...\n');

        // Получаем все цены
        const prices = await stripeInstance.prices.list({
            limit: 100,
        });

        console.log('Найдено цен:', prices.data.length);
        console.log('\n=== СПИСОК ВСЕХ ЦЕН ===\n');

        prices.data.forEach((price, index) => {
            console.log(`${index + 1}. Price ID: ${price.id}`);
            console.log(`   Продукт: ${price.product}`);
            console.log(`   Цена: ${price.unit_amount / 100} ${price.currency.toUpperCase()}`);
            console.log(`   Активна: ${price.active ? 'Да' : 'Нет'}`);
            console.log('   ---');
        });

        // Ищем цены для вашего продукта
        const yourProductId = 'prod_TDEaf5qXTmFn59';
        const productPrices = prices.data.filter(price => price.product === yourProductId);

        if (productPrices.length > 0) {
            console.log(`\n🎯 ЦЕНЫ ДЛЯ ВАШЕГО ПРОДУКТА (${yourProductId}):\n`);
            productPrices.forEach((price, index) => {
                console.log(`${index + 1}. Price ID: ${price.id}`);
                console.log(`   Цена: ${price.unit_amount / 100} ${price.currency.toUpperCase()}`);
                console.log(`   Тип: ${price.type}`);
                console.log('   ---');
            });

            console.log('\n📋 ДОБАВЬТЕ В .ENV ФАЙЛ:');
            if (productPrices[0]) {
                console.log(`STRIPE_BASIC_PRICE_ID=${productPrices[0].id}`);
            }
        } else {
            console.log(`\n❌ Цены для продукта ${yourProductId} не найдены`);
        }

    } catch (error) {
        console.error('❌ Ошибка получения цен:', error.message);
    }
}

getPrices();