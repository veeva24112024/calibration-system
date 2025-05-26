const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const multer = require('multer');
const path = require('path');
const cors = require('cors');

// เพิ่ม dotenv
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ใช้ URI จาก .env
const uri = process.env.MONGODB_URI || "mongodb+srv://Cluster26511:HPRRNaLTlwZAgL37@cluster26511.ugyjyqg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster26511";
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let db; // ตัวแปรสำหรับเก็บการเชื่อมต่อฐานข้อมูล

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));
app.use(express.static('public'));

// Multer Configuration for Image Uploads
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed'), false);
    }
  }
});

// Connect to MongoDB
async function connectDB() {
  try {
    await client.connect();
    db = client.db('calibrationDB'); // ใช้ชื่อฐานข้อมูล calibrationDB
    console.log("Connected to MongoDB!");
  } catch (err) {
    console.error('MongoDB connection error:', err);
  }
}

// API Endpoints
// ดึงข้อมูลทั้งหมด
app.get('/api/records', async (req, res) => {
  try {
    const records = await db.collection('records').find().sort({ date: -1 }).toArray();
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// เพิ่มข้อมูลใหม่
app.post('/api/records', upload.single('image'), async (req, res) => {
  try {
    const { machine, volume, date, status, timestamp } = req.body;
    const record = {
      machine,
      volume: parseFloat(volume),
      date: new Date(date),
      status,
      timestamp,
      image: req.file ? `/uploads/${req.file.filename}` : null
    };
    const result = await db.collection('records').insertOne(record);
    record._id = result.insertedId; // เพิ่ม _id ให้กับ record เพื่อส่งกลับ
    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ลบข้อมูล
app.delete('/api/records/:id', async (req, res) => {
  try {
    const result = await db.collection('records').deleteOne({ _id: new ObjectId(req.params.id) });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Record not found' });
    res.json({ message: 'Record deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// เริ่มเซิร์ฟเวอร์
app.listen(PORT, async () => {
  await connectDB();
  console.log(`Server running on port ${PORT}`);
});

// ปิดการเชื่อมต่อเมื่อเซิร์ฟเวอร์หยุดทำงาน
process.on('SIGINT', async () => {
  await client.close();
  console.log('MongoDB connection closed');
  process.exit(0);
});