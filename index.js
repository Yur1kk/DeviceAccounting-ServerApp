// Підключення модулів та створення серверу Express
const express = require('express');  // Підключення бібліотеки Express для обробки HTTP-запитів
const app = express();  // Створення екземпляру додатку Express
const swaggerUi = require('swagger-ui-express');  // Підключення Swagger UI для відображення документації API
const fs = require("fs");  // Підключення модулю fs для роботи з файловою системою
const YAML = require('yaml');  // Підключення бібліотеки YAML для роботи з YAML-файлами
const path = require('path')  // Підключення модулю path для роботи з шляхами
const bodyParser = require('body-parser');  // Підключення middleware для обробки даних запитів
const mongoose = require('mongoose');  // Підключення бібліотеки mongoose для роботи з MongoDB
const multer = require('multer');  // Підключення middleware для обробки файлів, завантажених користувачем
const session = require('express-session');  // Підключення middleware для роботи з сесіями
const { Devices, Users, Images } = require('./models');  // Підключення моделей MongoDB

const port = 8000;  // Визначення порту, на якому запускатиметься сервер

// Зчитуємо специфікацію Swagger з файлу YAML
const file = fs.readFileSync(path.join(__dirname, 'swagger.yaml'), 'utf8');
const swaggerDocument = YAML.parse(file);

// Налаштування Express та підключення Swagger UI
app.use(bodyParser.json());  // Використання middleware для обробки JSON-даних
app.use(bodyParser.urlencoded({ extended: true }));  // Використання middleware для обробки форм
app.use(
  session({
    secret: 'scrtky',  // Ключ для шифрування сесій
    resave: false,
    saveUninitialized: true,
  })
);

// Встановлюємо шлях для Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Підключення до бази даних MongoDB
mongoose.connect('mongodb://localhost:27017/lab6');  // З'єднання з локальною базою даних MongoDB
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => console.log('Connected to MongoDB'));  // Виведення повідомлення при успішному з'єднанні

// Налаштування Multer для завантаження файлів у пам'ять
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Middleware для перевірки аутентифікації користувача
const authenticateUser = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
};

// Роути та обробники запитів

// Метод для отримання головної сторінки
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the main page' });
});

// Метод для отримання списку пристроїв
app.get('/devices', async (req, res) => {
  try {
    const devices = await Devices.find();  // Отримання всіх пристроїв з бази даних
    res.json(devices);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Метод для отримання пристрою за серійним номером
app.get('/devices/:serialNumber', async (req, res) => {
  try {
    const serialNumber = req.params.serialNumber;
    const device = await Devices.findOne({ serialNumber });

    if (!device) {
      res.status(404).json({ message: 'Device not found' });
      return;
    }

    res.json(device);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Метод для редагування пристрою за серійним номером
app.put('/edit-devices/:serialNumber', async (req, res) => {
  try {
    const serialNumber = req.params.serialNumber;
    const updatedDevice = await Devices.findOneAndUpdate(
      { serialNumber },
      {
        deviceName: req.body.deviceName,
        description: req.body.description,
        serialNumber: req.body.serialNumber,
        manufacturer: req.body.manufacturer,
        qrCode: req.body.qrCode,
      },
      { new: true }
    );
    res.json(updatedDevice);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Метод для видалення пристрою за серійним номером
app.delete('/delete-device/:serialNumber', async (req, res) => {
  try {
    const serialNumber = req.params.serialNumber;
    await Devices.findOneAndDelete({ serialNumber });
    res.json({ message: 'Device deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Метод для створення нового пристрою
app.post('/devices', async (req, res) => {
  try {
    const newDevice = await Devices.create(req.body);
    res.status(201).json(newDevice);
  } catch (error) {
    console.error('Error creating device:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Метод для завантаження зображення для пристрою
app.post('/devices/:serialNumber/upload-image', upload.single('Images'), async (req, res) => {
  try {
    const serialNumber = req.params.serialNumber;
    const device = await Devices.findOne({ serialNumber });

    if (!device) {
      res.status(404).json({ message: 'Device not found' });
      return;
    }

    const imagesBuffer = req.file.buffer.toString('base64');

    await Images.create({ serialNumber, data: imagesBuffer });

    res.json({ message: 'Image uploaded successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Метод для видалення зображення пристрою
app.delete('/devices/:serialNumber/delete-image', async (req, res) => {
  try {
    const serialNumber = req.params.serialNumber;

    // Знайти зображення в колекції images за серійним номером
    const image = await Images.findOne({ serialNumber });

    if (!image) {
      res.status(404).json({ message: 'Image not found' });
      return;
    }

    // Видалити зображення
    await Images.findOneAndDelete({ serialNumber });

    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Метод для перегляду зображення пристрою
app.get('/devices/:serialNumber/view-image', async (req, res) => {
  try {
    const serialNumber = req.params.serialNumber;

    // Знайдіть зображення в колекції images за серійним номером
    const images = await Images.findOne({ serialNumber });

    if (!images || !images.data) {
      res.status(404).json({ message: 'Image not found' });
      return;
    }

    // Встановлюємо тип контенту як image/jpeg (або інший тип відповідно до формату вашого зображення)
    res.set('Content-Type', 'image/jpeg');

    // Відправляємо base64-кодоване зображення як тіло відповіді
    res.send(Buffer.from(images.data, 'base64'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Метод для реєстрації нового користувача
app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const existingUser = await Users.findOne({ username });

    if (existingUser) {
      return res.status(400).json({ message: 'User with this username already exists' });
    }

    const newUser = await Users.create({ username, password });
    res.status(201).json(newUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Метод для входу користувача
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await Users.findOne({ username, password });

    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Встановлюємо ідентифікатор користувача в сесію
    req.session.userId = user._id;

    res.json({ message: 'Login successful' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Метод для взяття пристрою у користування
app.post('/devices/:serialNumber/take', authenticateUser, async (req, res) => {
  try {
    const serialNumber = req.params.serialNumber;
    const { userId } = req.session;

    const device = await Devices.findOne({ serialNumber });

    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    if (device.user) {
      return res.status(400).json({ message: 'Device is already taken' });
    }

    if (device.user && device.user.toString() !== userId) {
      return res.status(403).json({ message: 'You are not allowed to take this device' });
    }

    device.user = userId;
    await device.save();

    const user = await Users.findById(userId);
    user.devices.push(device._id);
    await user.save();

    res.json({ message: 'Device taken successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Метод для повернення пристрою на зберігання
app.post('/devices/:serialNumber/return', authenticateUser, async (req, res) => {
  try {
    const serialNumber = req.params.serialNumber;
    const { userId } = req.session;

    const device = await Devices.findOne({ serialNumber });

    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    if (!device.user) {
      return res.status(400).json({ message: 'Device is not taken' });
    }

    if (device.user.toString() !== userId) {
      return res.status(403).json({ message: 'You are not allowed to return this device' });
    }

    device.user = null;
    await device.save();

    const user = await Users.findById(userId);
    user.devices = user.devices.filter(deviceId => deviceId.toString() !== device._id.toString());
    await user.save();

    res.json({ message: 'Device returned successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Метод для виходу користувача з системи
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
      res.status(500).json({ message: 'Error logging out' });
    } else {
      res.json({ message: 'Logout successful' });
    }
  });
});

// Запуск сервера на вказаному порту
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
