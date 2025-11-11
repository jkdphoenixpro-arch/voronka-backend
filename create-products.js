const stripe = require('stripe');
require('dotenv').config();

const stripeInstance = stripe(process.env.STRIPE_SECRET_KEY);

async function createProducts() {
    try {
        console.log('Создание продуктов в Stripe...');

        // Базовый план
        const basicProduct = await stripeInstance.products.create({
            name: 'Age Back - Базовый план (4 недели)',
            description: 'Персонализированная программа омоложения на 4 недели'
        });

        const basicPrice = await stripeInstance.prices.create({
            product: basicProduct.id,
            unit_amount: 699, // $6.99 в центах
            currency: 'usd',
            // НЕ указываем recurring - это делает цену разовой (one-time)
        });

        // Премиум план
        const premiumProduct = await stripeInstance.products.create({
            name: 'Age Back - Премиум план (8 недель)',
            description: 'Персонализированная программа омоложения на 8 недель'
        });

        const premiumPrice = await stripeInstance.prices.create({
            product: premiumProduct.id,
            unit_amount: 1599, // $15.99 в центах
            currency: 'usd',
        });

        // Про план
        const proProduct = await stripeInstance.products.create({
            name: 'Age Back - Про план (12 недель)',
            description: 'Персонализированная программа омоложения на 12 недель'
        });

        const proPrice = await stripeInstance.prices.create({
            product: proProduct.id,
            unit_amount: 2599, // $25.99 в центах
            currency: 'usd',
        });

        console.log('\n✅ Продукты созданы успешно!');
        console.log('\nДобавьте эти Price ID в ваш .env файл:');
        console.log(`STRIPE_BASIC_PRICE_ID=${basicPrice.id}`);
        console.log(`STRIPE_PREMIUM_PRICE_ID=${premiumPrice.id}`);
        console.log(`STRIPE_PRO_PRICE_ID=${proPrice.id}`);

    } catch (error) {
        console.error('Ошибка создания продуктов:', error);
    }
}

createProducts();