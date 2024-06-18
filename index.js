const express = require('express');
const app = express();
const swaggerUi = require('swagger-ui-express');
const fs = require("fs");
const YAML = require('yaml');
const path = require('path');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const multer = require('multer');
const session = require('express-session');
const { Devices, Users, Images } = require('./models');

const port = 8000;

const file = fs.readFileSync(path.join(__dirname, 'swagger.yaml'), 'utf8');
const swaggerDocument = YAML.parse(file);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  session({
    secret: 'scrtky',
    resave: false,
    saveUninitialized: true,
  })
);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

mongoose.connect('mongodb://localhost:27017/lab6');
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => console.log('Connected to MongoDB'));

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const authenticateUser = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
};

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the main page' });
});

app.get('/devices', async (req, res) => {
  try {
    const devices = await Devices.find();
    res.json(devices);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

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

app.post('/devices', async (req, res) => {
  try {
    const newDevice = await Devices.create(req.body);
    res.status(201).json(newDevice);
  } catch (error) {
    console.error('Error creating device:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

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

app.delete('/devices/:serialNumber/delete-image', async (req, res) => {
  try {
    const serialNumber = req.params.serialNumber;
    const image = await Images.findOne({ serialNumber });

    if (!image) {
      res.status(404).json({ message: 'Image not found' });
      return;
    }

    await Images.findOneAndDelete({ serialNumber });

    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.get('/devices/:serialNumber/view-image', async (req, res) => {
  try {
    const serialNumber = req.params.serialNumber;
    const images = await Images.findOne({ serialNumber });

    if (!images || !images.data) {
      res.status(404).json({ message: 'Image not found' });
      return;
    }

    res.set('Content-Type', 'image/jpeg');
    res.send(Buffer.from(images.data, 'base64'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

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

app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await Users.findOne({ username, password });

    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    req.session.userId = user._id;

    res.json({ message: 'Login successful' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

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

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
