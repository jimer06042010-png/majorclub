const express = require('express');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const FormData = require('form-data');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Данные бота и единый пароль админа
const BOT_TOKEN = process.env.BOT_TOKEN || '8193526088:AAHRFhKQrIId6cXMQTzgmFry_2DvzFZNdk4';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '6767';

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

const DB_FILE = path.join(__dirname, 'db.json');

function getDB() {
  if (fs.existsSync(DB_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DB_FILE));
    } catch (e) {
      console.error('Ошибка чтения db.json:', e);
    }
  }
  return { authenticatedAdmins: [], groupMembers: {} };
}

// 1. Прием заявки с фото из App и отправка в Telegram админам
app.post('/api/send-request', async (req, res) => {
  try {
    const { username, pcNumber, hours, price, paymentType, photo } = req.body;

    if (!photo) {
      return res.status(400).json({ success: false, message: 'Фото отсутствует' });
    }

    const captionText = 
      `📥 *НОВАЯ ЗАЯВКА ИЗ APP*\n\n` +
      `👤 *Пользователь:* @${username || 'не указан'}\n` +
      `🖥 *ПК:* №${pcNumber}\n` +
      `⏱ *Время:* ${hours} час(ов)\n` +
      `💰 *Сумма:* ${price} сум\n` +
      `💳 *Оплата:* ${paymentType === 'card' ? 'Карта' : 'Наличные'}`;

    const db = getDB();
    const admins = db.authenticatedAdmins || [];

    if (admins.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Нет авторизованных админов! Напишите /admin и введите пароль в Telegram-боте.' 
      });
    }

    // Отправляем фото каждому админу
    for (const adminId of admins) {
      const base64Data = photo.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      const form = new FormData();
      form.append('chat_id', adminId);
      form.append('photo', buffer, { filename: 'receipt.jpg' });
      form.append('caption', captionText);
      form.append('parse_mode', 'Markdown');

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
        method: 'POST',
        body: form
      });
    }

    res.json({ success: true, message: 'Заявка отправлена администраторам!' });
  } catch (error) {
    console.error('Ошибка при отправке заявки:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера при отправке' });
  }
});

// 2. Получение списка юзеров из db.json
app.get('/api/users', (req, res) => {
  try {
    const db = getDB();
    const members = db.groupMembers || {};
    res.json({ success: true, users: Object.values(members) });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Ошибка получения пользователей' });
  }
});

// 3. Проверка пароля админа
app.post('/api/admin-auth', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: 'Неверный пароль' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
