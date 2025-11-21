const express = require('express');
const cors = require('cors');
const stripe = require('stripe');
const mongoose = require('mongoose');
const Mailgun = require('mailgun.js');
const FormData = require('form-data');
require('dotenv').config();

// Инициализация Mailgun
const mailgun = new Mailgun(FormData);
const mg = mailgun.client({
    username: 'api',
    key: process.env.MAILGUN_API_KEY,
});

// Подключение к MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB подключён: ${conn.connection.host}`);
  } catch (error) {
    console.error('Ошибка подключения к MongoDB:', error.message);
    process.exit(1);
  }
};

// Модель пользователя
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: false,
    minlength: 6
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    required: true,
    enum: ['lead', 'customer'],
    default: 'lead'
  },
  goals: {
    type: [String],
    default: []
  },
  issueAreas: {
    type: [String], 
    default: []
  },
  viewedLessons: {
    type: Object,
    default: {}
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const User = mongoose.model('User', userSchema);

// Генерация пароля
const generatePassword = (length = 8) => {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let password = '';
  
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }
  
  return password;
};

// Подключение к базе данных
connectDB();

const app = express();

// Проверка и инициализация Stripe
console.log('=== ИНИЦИАЛИЗАЦИЯ STRIPE ===');
console.log('STRIPE_SECRET_KEY существует:', !!process.env.STRIPE_SECRET_KEY);
console.log('STRIPE_SECRET_KEY начинается с sk_:', process.env.STRIPE_SECRET_KEY?.startsWith('sk_'));

if (!process.env.STRIPE_SECRET_KEY) {
    console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: STRIPE_SECRET_KEY не установлен!');
    console.error('Установите переменную окружения STRIPE_SECRET_KEY на Railway');
    process.exit(1);
}

const stripeInstance = stripe(process.env.STRIPE_SECRET_KEY);
console.log('✅ Stripe инициализирован успешно');

// Middleware для CORS - должен быть ПЕРВЫМ
app.use((req, res, next) => {
    // Разрешить запросы с любого origin
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    
    // Обработка preflight запросов
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    next();
});

app.use(express.json());

// Тарифные планы для одноразовых платежей
const PLANS = {
    basic: {
        name: 'Базовый план (4-Week)',
        fallbackPrice: 699, // $6.99 в центах
        currency: 'usd'
    },
    premium: {
        name: 'Премиум план (8-Week)',
        fallbackPrice: 1599, // $15.99 в центах
        currency: 'usd'
    },
    pro: {
        name: 'Про план (12-Week)',
        fallbackPrice: 2599, // $25.99 в центах
        currency: 'usd'
    }
};

// Создание сессии оплаты
app.post('/create-checkout-session', async (req, res) => {
    try {
        const { planId } = req.body;
        console.log('=== СОЗДАНИЕ CHECKOUT СЕССИИ ===');
        console.log('Получен запрос на создание сессии для плана:', planId);
        console.log('CLIENT_URL:', process.env.CLIENT_URL);
        console.log('STRIPE_SECRET_KEY существует:', !!process.env.STRIPE_SECRET_KEY);

        if (!planId) {
            console.log('❌ planId не передан');
            return res.status(400).json({ error: 'Plan ID is required' });
        }

        if (!PLANS[planId]) {
            console.log('❌ Неверный план:', planId);
            console.log('Доступные планы:', Object.keys(PLANS));
            return res.status(400).json({ error: 'Invalid pricing plan' });
        }

        const plan = PLANS[planId];
        console.log('✅ Выбранный план:', plan);

        if (!process.env.CLIENT_URL) {
            console.log('❌ CLIENT_URL не установлен');
            return res.status(500).json({ error: 'Server configuration error: CLIENT_URL not set' });
        }

        let sessionConfig = {
            payment_method_types: ['card'],
            mode: 'payment',
            success_url: `${process.env.CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.CLIENT_URL}/paywall`,
        };

        console.log('Success URL:', sessionConfig.success_url);
        console.log('Cancel URL:', sessionConfig.cancel_url);

        // Всегда создаем цену на лету для одноразовых платежей
        console.log('Создаем цену на лету, fallback price:', plan.fallbackPrice);
        sessionConfig.line_items = [
            {
                price_data: {
                    currency: plan.currency,
                    product_data: {
                        name: plan.name,
                    },
                    unit_amount: plan.fallbackPrice,
                },
                quantity: 1,
            }
        ];

        console.log('Конфигурация сессии:', JSON.stringify(sessionConfig, null, 2));
        console.log('Создание Stripe сессии...');
        
        const session = await stripeInstance.checkout.sessions.create(sessionConfig);
        
        console.log('✅ Сессия создана успешно:', session.id);
        console.log('URL сессии:', session.url);

        res.json({ url: session.url });
    } catch (error) {
        console.error('❌ ОШИБКА создания сессии:', error);
        console.error('Тип ошибки:', error.type);
        console.error('Код ошибки:', error.code);
        console.error('Сообщение:', error.message);
        console.error('Полный стек:', error.stack);
        
        res.status(500).json({ 
            error: 'Internal server error', 
            details: error.message,
            type: error.type,
            code: error.code
        });
    }
});

// Проверка статуса платежа
app.get('/payment-status/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;

        const session = await stripeInstance.checkout.sessions.retrieve(sessionId);

        res.json({
            status: session.payment_status,
            customerEmail: session.customer_details?.email,
            amountTotal: session.amount_total
        });
    } catch (error) {
        console.error('Ошибка получения статуса:', error);
        res.status(500).json({ error: 'Failed to retrieve payment status' });
    }
});

// Создание подписки (альтернативный endpoint)
app.post('/create-subscription-session', async (req, res) => {
    try {
        console.log('=== СОЗДАНИЕ ПОДПИСКИ ===');
        console.log('Тело запроса:', req.body);
        
        const { planId } = req.body;
        console.log('Plan ID:', planId);

        if (!PLANS[planId]) {
            console.log('❌ Неверный план:', planId);
            return res.status(400).json({ error: 'Invalid pricing plan' });
        }

        const plan = PLANS[planId];
        console.log('✅ Выбранный план:', plan);

        // Для подписок создаем recurring цену
        const sessionConfig = {
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: plan.currency,
                        product_data: {
                            name: plan.name,
                        },
                        unit_amount: plan.fallbackPrice,
                        recurring: {
                            interval: 'month', // ежемесячная подписка
                        },
                    },
                    quantity: 1,
                }
            ],
            mode: 'subscription', // режим подписки
            success_url: `${process.env.CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.CLIENT_URL}/paywall`,
        };

        console.log('Создание сессии подписки...');
        const session = await stripeInstance.checkout.sessions.create(sessionConfig);
        console.log('✅ Сессия подписки создана:', session.id);

        res.json({ url: session.url });
    } catch (error) {
        console.error('❌ Ошибка создания сессии подписки:', error);
        console.error('Сообщение:', error.message);
        res.status(500).json({ 
            error: 'Internal server error', 
            details: error.message 
        });
    }
});

// Данные уроков
const LESSONS = {
    1: {
        id: 1,
        category: 'Body & Posture',
        title: '5-Minute Flow for Daily Rejuvenation',
        duration: '5 min',
        videoUrl: '/image/videoplayback.mp4',
        thumbnailUrl: '/image/body-posture.png',
        videoPreview: '/image/Lesson1.png',
        description: 'Refresh your body in just 5 minutes! Gentle exercises to improve posture, loosen your back, and boost daily energy.',
        tipTitle: 'Remember',
        tipText: 'Take deep breaths with each movement to relax your muscles and maximize posture benefits.'
    },
    2: {
        id: 2,
        category: 'Belly & Waist',
        title: '5-Minute Activation for a Younger Waistline',
        duration: '5 min',
        videoUrl: '/image/videoplayback3.mp4',
        thumbnailUrl: '/image/belly-waist.png',
        videoPreview: '/image/Lesson1.png',
        description: 'Targeted exercises to strengthen your core, reduce belly tension, and improve waistline definition in just 5 minutes.',
        tipTitle: 'Remember',
        tipText: 'Focus on controlled movements and engage your core throughout each exercise for maximum effectiveness.'
    },
    3: {
        id: 3,
        category: 'Face & Neck',
        title: 'Get rid of swellness: 5 min massage technique',
        duration: '5 min',
        videoUrl: '/image/videoplayback2.mp4',
        thumbnailUrl: '/image/face-neck.png',
        videoPreview: '/image/Lesson1.png',
        description: 'Gentle massage techniques to reduce facial swelling, improve circulation, and restore natural glow to your skin.',
        tipTitle: 'Remember',
        tipText: 'Apply gentle pressure and use upward motions to boost circulation and achieve the best anti-aging results.'
    }
};

// Получение данных конкретного урока
app.get('/lesson/:id', (req, res) => {
    const lessonId = parseInt(req.params.id);
    const lesson = LESSONS[lessonId];
    
    if (!lesson) {
        return res.status(404).json({ error: 'Lesson not found' });
    }
    
    res.json(lesson);
});

// Получение списка всех уроков
app.get('/lessons', (req, res) => {
    res.json(LESSONS);
});

// Получение списка доступных планов
app.get('/plans', (req, res) => {
    res.json(PLANS);
});

// Маршрут для авторизации
app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Проверяем наличие данных
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and password are required' 
      });
    }
    
    // Ищем пользователя в базе данных
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    // Проверяем, что пользователь имеет роль customer
    if (user.role !== 'customer') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access is allowed only for users with paid subscription' 
      });
    }
    
    // Проверяем наличие пароля
    if (!user.password) {
      return res.status(403).json({ 
        success: false, 
        message: 'Password is not set. Please contact administrator.' 
      });
    }
    
    // Проверяем пароль (простое сравнение без шифрования)
    if (user.password !== password) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid password' 
      });
    }
    
    // Успешная авторизация
    res.json({
      success: true,
      message: 'Authorization successful',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
    
  } catch (error) {
    console.error('Ошибка авторизации:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// API для создания пользователя с ролью lead
app.post('/api/users/create-lead', async (req, res) => {
  try {
    const { name, email, goals, issueAreas } = req.body;
    
    // Проверяем наличие данных
    if (!name || !email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name and email are required' 
      });
    }
    
    // Проверяем, не существует ли уже пользователь с таким email
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    
    if (existingUser) {
      return res.status(409).json({ 
        success: false, 
        message: 'User with this email already exists' 
      });
    }
    
    // Создаем нового пользователя с ролью lead
    const newUser = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      role: 'lead',
      goals: goals || [],
      issueAreas: issueAreas || [],
      isEmailVerified: false
    });
    
    await newUser.save();
    
    res.json({
      success: true,
      message: 'Lead user created successfully',
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role
      }
    });
    
  } catch (error) {
    console.error('Ошибка создания лида:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// API для обновления пользователя до customer после оплаты
app.post('/api/users/upgrade-to-customer', async (req, res) => {
  try {
    const { email, sessionId } = req.body;
    
    // Проверяем наличие данных
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'User email is required' 
      });
    }
    
    // Находим пользователя по email
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    // Проверяем, что пользователь является lead
    if (user.role !== 'lead') {
      return res.status(400).json({ 
        success: false, 
        message: 'User already has customer role or invalid role' 
      });
    }
    
    // Генерируем пароль
    const password = generatePassword(10);
    
    // Обновляем пользователя
    user.role = 'customer';
    user.password = password;
    user.isEmailVerified = true;
    // Инициализируем просмотренные уроки (все непросмотренные)
    user.viewedLessons = {
      1: false,
      2: false,
      3: false
    };
    
    await user.save();
    
    res.json({
      success: true,
      message: 'User upgraded to customer',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      password: password // Возвращаем пароль для отображения пользователю
    });
    
  } catch (error) {
    console.error('Ошибка обновления пользователя:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// API для обработки успешной оплаты с email из localStorage
app.post('/api/payment/success', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }
    
    // Находим пользователя по email
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    // Проверяем, что пользователь является lead
    if (user.role !== 'lead') {
      return res.status(400).json({ 
        success: false, 
        message: 'User already has customer role' 
      });
    }
    
    // Генерируем пароль
    const password = generatePassword(10);
    
    // Обновляем пользователя
    user.role = 'customer';
    user.password = password;
    user.isEmailVerified = true;
    // Инициализируем просмотренные уроки (все непросмотренные)
    user.viewedLessons = {
      1: false,
      2: false,
      3: false
    };
    
    await user.save();
    
    // Отправляем письмо с паролем
    const emailResult = await sendPasswordEmail(user.email, password, user.name);
    
    if (!emailResult.success) {
      console.error('Ошибка отправки письма:', emailResult.error);
    }
    
    res.json({
      success: true,
      message: 'Password generated and user updated',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      password: password,
      emailSent: emailResult.success
    });
    
  } catch (error) {
    console.error('Ошибка обработки оплаты:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// API для обновления статуса просмотренного урока
app.post('/api/users/mark-lesson-viewed', async (req, res) => {
  try {
    const { email, lessonId } = req.body;
    
    // Проверяем наличие данных
    if (!email || !lessonId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and lesson ID are required' 
      });
    }
    
    // Находим пользователя по email
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    // Проверяем, что пользователь имеет роль customer
    if (user.role !== 'customer') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access is allowed only for customers' 
      });
    }
    
    // Обновляем статус урока
    user.viewedLessons[lessonId] = true;
    user.markModified('viewedLessons'); // Обязательно для Object типа
    
    await user.save();
    
    res.json({
      success: true,
      message: `Lesson ${lessonId} marked as viewed`,
      viewedLessons: user.viewedLessons
    });
    
  } catch (error) {
    console.error('Ошибка обновления статуса урока:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// API для получения данных пользователя
app.get('/api/users/profile/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    // Находим пользователя по email
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        goals: user.goals || [],
        issueAreas: user.issueAreas || [],
        viewedLessons: user.viewedLessons || {}
      }
    });
    
  } catch (error) {
    console.error('Ошибка получения профиля:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// Админские эндпоинты
// Получение всех пользователей для админки
app.get('/api/admin/users', async (req, res) => {
  try {
    // Получаем всех пользователей из базы данных
    const users = await User.find({}, {
      _id: 1,
      name: 1,
      email: 1,
      role: 1,
      password: 1,
      createdAt: 1
    }).sort({ createdAt: -1 }); // Сортируем по дате создания (новые сначала)

    // Преобразуем данные для фронтенда
    const formattedUsers = users.map(user => ({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role || 'lead',
      hasPassword: !!user.password,
      password: user.password, // Добавляем пароль для админки
      createdAt: user.createdAt
    }));

    res.json({
      success: true,
      users: formattedUsers
    });
  } catch (error) {
    console.error('Ошибка получения пользователей:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения пользователей'
    });
  }
});

// Изменение подписки пользователя
app.post('/api/admin/users/:id/subscription', async (req, res) => {
  try {
    const userId = req.params.id;
    const { role } = req.body;

    // Проверяем валидность роли
    if (!role || !['lead', 'customer'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Неверная роль. Допустимые значения: lead, customer'
      });
    }

    // Находим пользователя
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден'
      });
    }

    // Обновляем роль
    user.role = role;

    // Если меняем на customer и у пользователя нет пароля - генерируем
    if (role === 'customer' && !user.password) {
      const newPassword = generatePassword(10);
      user.password = newPassword;
      user.isEmailVerified = true;
      // Инициализируем просмотренные уроки
      user.viewedLessons = {
        1: false,
        2: false,
        3: false
      };
      console.log(`Сгенерирован пароль для пользователя ${user.email}: ${newPassword}`);
    }

    // Если меняем на lead - можем оставить пароль или удалить (на ваш выбор)
    // user.password = null; // раскомментировать если нужно удалять пароль у leads

    await user.save();

    res.json({
      success: true,
      message: `Роль пользователя изменена на ${role}`,
      user: {
        id: user._id,
        role: user.role,
        hasPassword: !!user.password,
        password: user.password // Добавляем пароль для копирования
      }
    });
  } catch (error) {
    console.error('Ошибка изменения подписки:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка изменения подписки'
    });
  }
});

// Функция отправки письма с паролем
async function sendPasswordEmail(userEmail, password, userName = 'Пользователь') {
  const messageData = {
    from: `AgeBack Coach <postmaster@mg.ageback.coach>`,
    to: [userEmail],
    subject: 'Добро пожаловать!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Здравствуйте, ${userName}!</h2>
        <p>Благодарим за регистрацию.</p>
        <p>Ваш код для входа:</p>
        <div style="background-color: #f0f8ff; padding: 20px; border-radius: 8px; margin: 25px 0; text-align: center; border: 2px solid #4a90e2;">
          <span style="font-size: 24px; font-weight: bold; color: #2c3e50; letter-spacing: 2px;">${password}</span>
        </div>
        <p>Сохраните этот код.</p>
        <p>С уважением,<br>AgeBack Coach</p>
      </div>
    `,
    text: `Здравствуйте, ${userName}! Благодарим за регистрацию. Ваш код: ${password}`
  };

  try {
    const result = await mg.messages.create('mg.ageback.coach', messageData);
    return { success: true, messageId: result.id };
  } catch (error) {
    console.error('Ошибка отправки письма:', error);
    return { success: false, error: error.message };
  }
}

// Тестовый эндпоинт для отправки писем
app.post('/api/test-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email обязателен'
      });
    }

    // Генерируем тестовый пароль
    const testPassword = generatePassword(8);
    
    // Отправляем письмо
    const result = await sendPasswordEmail(email, testPassword, 'Тестовый пользователь');
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Тестовое письмо успешно отправлено!',
        password: testPassword, // Возвращаем пароль для проверки
        messageId: result.messageId
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Ошибка отправки письма',
        error: result.error
      });
    }
    
  } catch (error) {
    console.error('Ошибка в тестовом эндпоинте:', error);
    res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера'
    });
  }
});

// Проверка состояния сервера
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log('=================================');
    console.log(`✅ Сервер запущен на порту ${PORT}`);
    console.log('=================================');
    console.log('Переменные окружения:');
    console.log('- PORT:', PORT);
    console.log('- CLIENT_URL:', process.env.CLIENT_URL);
    console.log('- STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? '✅ Установлен' : '❌ НЕ установлен');
    console.log('- MONGODB_URI:', process.env.MONGODB_URI ? '✅ Установлен' : '❌ НЕ установлен');
    console.log('- MAILGUN_API_KEY:', process.env.MAILGUN_API_KEY ? '✅ Установлен' : '❌ НЕ установлен');
    console.log('=================================');
});