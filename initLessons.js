// Скрипт для инициализации уроков в MongoDB
require('dotenv').config();
const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema({
  lessonId: {
    type: Number,
    required: true,
    unique: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true
  },
  duration: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  tipTitle: {
    type: String,
    default: 'Remember'
  },
  tipText: {
    type: String,
    required: true
  },
  driveVideoId: {
    type: String,
    default: null
  },
  driveThumbnailId: {
    type: String,
    default: null
  },
  drivePreviewId: {
    type: String,
    default: null
  },
  videoUrl: {
    type: String,
    default: ''
  },
  thumbnailUrl: {
    type: String,
    default: ''
  },
  videoPreview: {
    type: String,
    default: ''
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const LessonModel = mongoose.model('Lesson', lessonSchema);

const LESSONS_CONFIG = {
  1: {
    id: 1,
    category: 'Body & Posture',
    title: '5-Minute Flow for Daily Rejuvenation',
    duration: '5 min',
    description: 'Refresh your body in just 5 minutes! Gentle exercises to improve posture, loosen your back, and boost daily energy.',
    tipTitle: 'Remember',
    tipText: 'Take deep breaths with each movement to relax your muscles and maximize posture benefits.',
    driveVideoId: null,
    driveThumbnailId: null,
    drivePreviewId: null,
    videoUrl: '/image/videoplayback.mp4',
    thumbnailUrl: '/image/body-posture.png',
    videoPreview: '/image/Lesson1.png'
  },
  2: {
    id: 2,
    category: 'Belly & Waist',
    title: '5-Minute Activation for a Younger Waistline',
    duration: '5 min',
    description: 'Targeted exercises to strengthen your core, reduce belly tension, and improve waistline definition in just 5 minutes.',
    tipTitle: 'Remember',
    tipText: 'Focus on controlled movements and engage your core throughout each exercise for maximum effectiveness.',
    driveVideoId: null,
    driveThumbnailId: null,
    drivePreviewId: null,
    videoUrl: '/image/videoplayback3.mp4',
    thumbnailUrl: '/image/belly-waist.png',
    videoPreview: '/image/Lesson1.png'
  },
  3: {
    id: 3,
    category: 'Face & Neck',
    title: 'Get rid of swellness: 5 min massage technique',
    duration: '5 min',
    description: 'Gentle massage techniques to reduce facial swelling, improve circulation, and restore natural glow to your skin.',
    tipTitle: 'Remember',
    tipText: 'Apply gentle pressure and use upward motions to boost circulation and achieve the best anti-aging results.',
    driveVideoId: null,
    driveThumbnailId: null,
    drivePreviewId: null,
    videoUrl: '/image/videoplayback2.mp4',
    thumbnailUrl: '/image/face-neck.png',
    videoPreview: '/image/Lesson1.png'
  }
};

async function initLessons() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Подключено к MongoDB');

    for (const [id, lesson] of Object.entries(LESSONS_CONFIG)) {
      const existingLesson = await LessonModel.findOne({ lessonId: lesson.id });
      
      if (!existingLesson) {
        const newLesson = new LessonModel({
          lessonId: lesson.id,
          title: lesson.title,
          category: lesson.category,
          duration: lesson.duration,
          description: lesson.description,
          tipTitle: lesson.tipTitle,
          tipText: lesson.tipText,
          driveVideoId: lesson.driveVideoId,
          driveThumbnailId: lesson.driveThumbnailId,
          drivePreviewId: lesson.drivePreviewId,
          videoUrl: lesson.videoUrl,
          thumbnailUrl: lesson.thumbnailUrl,
          videoPreview: lesson.videoPreview
        });
        
        await newLesson.save();
        console.log(`✅ Урок ${lesson.id} создан: ${lesson.title}`);
      } else {
        console.log(`ℹ️  Урок ${lesson.id} уже существует: ${existingLesson.title}`);
      }
    }

    console.log('\n✅ Инициализация завершена');
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка инициализации:', error);
    process.exit(1);
  }
}

initLessons();
