import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5001;

// ─── MongoDB Connection ─────────────────────────────────
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aihealthchatbot';
mongoose.connect(mongoURI)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// ─── Schemas ───────────────────────────────────────────

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['patient', 'doctor'], default: 'patient' }
});

const appointmentSchema = new mongoose.Schema({
  doctorId: String,
  doctorName: String,
  patientName: String,
  patientEmail: String,
  date: String,
  time: String,
  status: { type: String, enum: ['pending', 'confirmed', 'completed'], default: 'pending' }
});

const prescriptionSchema = new mongoose.Schema({
  patientName: String,
  patientEmail: String,
  doctorName: String,
  medicineName: String,
  dosage: String,
  timing: String,
  status: String,
  date: String
});

const User = mongoose.model('User', userSchema);
const Appointment = mongoose.model('Appointment', appointmentSchema);
const Prescription = mongoose.model('Prescription', prescriptionSchema);

// ─── API Routes ────────────────────────────────────────

// 1. Register
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const newUser = new User({ name, email, password, role });
    await newUser.save();
    res.status(201).json({ message: 'User registered successfully', user: { name, email, role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    const user = await User.findOne({ email, password, role });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    res.json({ message: 'Login successful', user: { name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Book Appointment
app.post('/api/appointments', async (req, res) => {
  try {
    const appointment = new Appointment(req.body);
    await appointment.save();
    res.status(201).json(appointment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Get Appointments (for a specific user)
app.get('/api/appointments/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const { role } = req.query; // to distinguish between patient and doctor
    
    let query = {};
    if (role === 'doctor') {
        // For simplicity, we search by doctorName in this mock setup
        // Ideally we'd use doctorEmail/ID
        query = { doctorName: req.query.name };
    } else {
        query = { patientEmail: email };
    }
    
    const appointments = await Appointment.find(query).sort({ date: -1 });
    res.json(appointments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Prescriptions
app.get('/api/prescriptions/:email', async (req, res) => {
  try {
    const prescriptions = await Prescription.find({ patientEmail: req.params.email });
    res.json(prescriptions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/prescriptions', async (req, res) => {
  try {
    const p = new Prescription(req.body);
    await p.save();
    res.status(201).json(p);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 AIHealthChatBot Server running on http://localhost:${PORT}`);
});
