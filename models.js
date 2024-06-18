const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  deviceName: String,
  description: String,
  serialNumber: String,
  manufacturer: String,
  qrCode: String,
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'Users' },
});

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  devices: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Devices' }],
});

const Devices = mongoose.model('Devices', deviceSchema);
const Users = mongoose.model('User', userSchema);

const imagesSchema = new mongoose.Schema({
  serialNumber: String,
  data: String, // Base64-кодоване зображення
});

const Images = mongoose.model('Images', imagesSchema);

module.exports = { Devices, Users, Images };
 
