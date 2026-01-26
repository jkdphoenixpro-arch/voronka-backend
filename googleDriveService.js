const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

class GoogleDriveService {
  constructor() {
    this.drive = null;
    this.folderId = null;
    this.initialized = false;
    // Запускаем инициализацию, но не ждем её завершения в конструкторе
    this.init().catch(error => {
      console.error('❌ Ошибка в конструкторе Google Drive Service:', error);
    });
  }

  async init() {
    try {
      console.log('🔄 Начинаем инициализацию Google Drive Service...');
      
      // Проверяем наличие переменных окружения
      if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
        throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY не установлен');
      }
      
      if (!process.env.GOOGLE_DRIVE_FOLDER_ID) {
        throw new Error('GOOGLE_DRIVE_FOLDER_ID не установлен');
      }

      // Инициализация Google Drive API с Service Account
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
      
      console.log('📧 Service Account Email:', credentials.client_email);
      console.log('📁 Folder ID:', process.env.GOOGLE_DRIVE_FOLDER_ID);
      
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive']
      });

      this.drive = google.drive({ version: 'v3', auth });
      this.folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
      
      // Проверяем подключение
      const aboutResponse = await this.drive.about.get({
        fields: 'user'
      });
      
      this.initialized = true;
      console.log('✅ Google Drive Service успешно инициализирован');
      console.log('👤 Подключен как:', aboutResponse.data.user.emailAddress);
      
    } catch (error) {
      console.error('❌ Ошибка инициализации Google Drive Service:', error.message);
      console.error('📋 Детали ошибки:', error);
      this.initialized = false;
      // Не устанавливаем this.drive = null, оставляем как есть для повторных попыток
    }
  }

  // Получить список всех видео файлов из папки lessons
  async getVideoFiles() {
    try {
      // Проверяем инициализацию
      if (!this.initialized || !this.drive || !this.folderId) {
        console.log('🔄 Сервис не готов, пытаемся инициализировать...');
        await this.init();
      }
      
      if (!this.drive || !this.folderId) {
        throw new Error('Google Drive не инициализирован');
      }

      console.log('📁 Ищем папку lessons в:', this.folderId);

      // Найти папку lessons
      const lessonsFolderQuery = `name='lessons' and parents in '${this.folderId}' and mimeType='application/vnd.google-apps.folder'`;
      const lessonsFolderResponse = await this.drive.files.list({
        q: lessonsFolderQuery,
        fields: 'files(id, name)'
      });

      console.log('📂 Найдено папок lessons:', lessonsFolderResponse.data.files.length);

      if (lessonsFolderResponse.data.files.length === 0) {
        throw new Error('Папка lessons не найдена');
      }

      const lessonsFolderId = lessonsFolderResponse.data.files[0].id;
      console.log('📁 ID папки lessons:', lessonsFolderId);

      // Получить все видео файлы из папки lessons
      const videoQuery = `parents in '${lessonsFolderId}' and (mimeType contains 'video/' or name contains '.mp4')`;
      const response = await this.drive.files.list({
        q: videoQuery,
        fields: 'files(id, name, size, createdTime, webViewLink)',
        orderBy: 'name'
      });

      console.log('🎥 Найдено видео файлов:', response.data.files.length);
      return response.data.files;
    } catch (error) {
      console.error('❌ Ошибка получения видео файлов:', error);
      throw error;
    }
  }

  // Получить прямую ссылку на любой файл (универсальный метод)
  async getDirectLink(fileId) {
    try {
      if (!this.drive) {
        throw new Error('Google Drive не инициализирован');
      }

      // Получить информацию о файле
      const file = await this.drive.files.get({
        fileId: fileId,
        fields: 'id, name, mimeType, webContentLink, webViewLink'
      });

      const mimeType = file.data.mimeType;

      // Для видео используем формат preview для iframe
      if (mimeType && mimeType.includes('video')) {
        return `https://drive.google.com/file/d/${fileId}/preview`;
      }

      // Для изображений используем прямую ссылку
      if (mimeType && mimeType.includes('image')) {
        return `https://drive.google.com/uc?export=view&id=${fileId}`;
      }

      // Для остальных файлов используем preview
      return `https://drive.google.com/file/d/${fileId}/preview`;
    } catch (error) {
      console.error(`Ошибка получения прямой ссылки для файла ${fileId}:`, error);
      throw error;
    }
  }

  // Получить прямую ссылку на видео файл
  async getVideoDirectLink(fileId) {
    try {
      if (!this.drive) {
        throw new Error('Google Drive не инициализирован');
      }

      // Получить информацию о файле
      const file = await this.drive.files.get({
        fileId: fileId,
        fields: 'id, name, webContentLink, webViewLink'
      });

      // Для iframe используем формат preview
      const embedLink = `https://drive.google.com/file/d/${fileId}/preview`;
      
      return {
        id: file.data.id,
        name: file.data.name,
        // Используем embedLink для iframe
        directLink: embedLink,
        embedLink: embedLink,
        webViewLink: file.data.webViewLink,
        // Альтернативные форматы ссылок
        streamLink: `https://drive.google.com/uc?export=view&id=${fileId}`,
        downloadLink: `https://drive.google.com/uc?export=download&id=${fileId}`
      };
    } catch (error) {
      console.error('Ошибка получения прямой ссылки:', error);
      throw error;
    }
  }

  // Получить список изображений (thumbnails/previews)
  async getImageFiles(folderName = 'thumbnails') {
    try {
      if (!this.drive || !this.folderId) {
        throw new Error('Google Drive не инициализирован');
      }

      // Найти папку с изображениями
      const imageFolderQuery = `name='${folderName}' and parents in '${this.folderId}' and mimeType='application/vnd.google-apps.folder'`;
      const imageFolderResponse = await this.drive.files.list({
        q: imageFolderQuery,
        fields: 'files(id, name)'
      });

      if (imageFolderResponse.data.files.length === 0) {
        console.warn(`Папка ${folderName} не найдена`);
        return [];
      }

      const imageFolderId = imageFolderResponse.data.files[0].id;

      // Получить все изображения из папки
      const imageQuery = `parents in '${imageFolderId}' and (mimeType contains 'image/')`;
      const response = await this.drive.files.list({
        q: imageQuery,
        fields: 'files(id, name, webViewLink)',
        orderBy: 'name'
      });

      return response.data.files.map(file => ({
        id: file.id,
        name: file.name,
        directLink: `https://drive.google.com/uc?export=view&id=${file.id}`,
        webViewLink: file.webViewLink
      }));
    } catch (error) {
      console.error(`Ошибка получения изображений из папки ${folderName}:`, error);
      return [];
    }
  }

  // Загрузить новый видео файл
  async uploadVideo(filePath, fileName, lessonId) {
    try {
      if (!this.drive || !this.folderId) {
        throw new Error('Google Drive не инициализирован');
      }

      // Найти папку lessons
      const lessonsFolderQuery = `name='lessons' and parents in '${this.folderId}' and mimeType='application/vnd.google-apps.folder'`;
      const lessonsFolderResponse = await this.drive.files.list({
        q: lessonsFolderQuery,
        fields: 'files(id, name)'
      });

      if (lessonsFolderResponse.data.files.length === 0) {
        throw new Error('Папка lessons не найдена');
      }

      const lessonsFolderId = lessonsFolderResponse.data.files[0].id;

      // Загрузить файл
      const fileMetadata = {
        name: fileName,
        parents: [lessonsFolderId]
      };

      const media = {
        mimeType: 'video/mp4',
        body: fs.createReadStream(filePath)
      };

      const response = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id, name'
      });

      console.log(`✅ Видео загружено: ${response.data.name} (ID: ${response.data.id})`);
      return response.data;
    } catch (error) {
      console.error('Ошибка загрузки видео:', error);
      throw error;
    }
  }

  // Удалить видео файл
  async deleteVideo(fileId) {
    try {
      if (!this.drive) {
        throw new Error('Google Drive не инициализирован');
      }

      await this.drive.files.delete({
        fileId: fileId
      });

      console.log(`✅ Видео удалено: ${fileId}`);
      return true;
    } catch (error) {
      console.error('Ошибка удаления видео:', error);
      throw error;
    }
  }

  // Проверить доступность сервиса
  async checkConnection() {
    try {
      console.log('🔍 Проверяем подключение к Google Drive...');
      
      // Если не инициализирован, попробуем инициализировать
      if (!this.initialized || !this.drive) {
        console.log('🔄 Сервис не инициализирован, пытаемся инициализировать...');
        await this.init();
      }
      
      if (!this.drive) {
        console.log('❌ Google Drive не инициализирован (this.drive = null)');
        return { success: false, message: 'Google Drive не инициализирован' };
      }

      if (!this.folderId) {
        console.log('❌ GOOGLE_DRIVE_FOLDER_ID не установлен');
        return { success: false, message: 'GOOGLE_DRIVE_FOLDER_ID не установлен' };
      }

      // Попробовать получить информацию о пользователе
      console.log('📡 Отправляем запрос к Google Drive API...');
      const response = await this.drive.about.get({
        fields: 'user'
      });

      console.log('✅ Подключение успешно:', response.data.user);
      return { 
        success: true, 
        message: 'Подключение к Google Drive успешно',
        user: response.data.user
      };
    } catch (error) {
      console.error('❌ Ошибка подключения к Google Drive:', error);
      console.error('📋 Код ошибки:', error.code);
      console.error('📋 Статус:', error.status);
      
      return { 
        success: false, 
        message: `Ошибка подключения: ${error.message}`,
        errorCode: error.code,
        errorStatus: error.status
      };
    }
  }
}

module.exports = new GoogleDriveService();
