const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const multer = require('multer');
const multerS3 = require('multer-s3');
const aws = require('aws-sdk');
const path = require('path');
const cors = require('cors');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ใช้ Environment Variables จาก process.env
aws.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: 'us-west-2' // เปลี่ยนเป็น Oregon
});
const s3 = new aws.S3();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Multer Configuration for S3 Uploads
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: 'calibrationimages1234',
    acl: 'public-read',
    key: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    }
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed'), false);
    }
  }
});

const uri = process.env.MONGODB_URI || "mongodb+srv://Cluster26511:HPRRNaLTlwZAgL37@cluster26511.ugyjyqg.mongodb.net/calibrationDB?retryWrites=true&w=majority&appName=Cluster26511";
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let db;

async function connectDB() {
  try {
    await client.connect();
    db = client.db('calibrationDB');
    await db.command({ ping: 1 });
    console.log("Connected to MongoDB at", new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }));
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } catch (err) {
    console.error('MongoDB connection error at', new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }), ':', err.message);
    process.exit(1);
  }
}

app.get('/api/records', async (req, res) => {
  try {
    const records = await db.collection('records').find().sort({ date: -1 }).toArray();
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/records', upload.single('image'), async (req, res) => {
  try {
    const { machine, volume, date, status, timestamp } = req.body;
    const record = {
      machine,
      volume: parseFloat(volume),
      date: new Date(date),
      status,
      timestamp,
      image: req.file ? req.file.location : null
    };
    const result = await db.collection('records').insertOne(record);
    record._id = result.insertedId;
    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/records/:id', async (req, res) => {
  try {
    const result = await db.collection('records').deleteOne({ _id: new ObjectId(req.params.id) });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Record not found' });
    res.json({ message: 'Record deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, async () => {
  await connectDB();
  console.log(`Server running on port ${PORT} at ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`);
});

process.on('SIGINT', async () => {
  await client.close();
  console.log('MongoDB connection closed at', new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }));
  process.exit(0);
});