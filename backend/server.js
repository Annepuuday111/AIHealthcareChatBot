import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

// 6. Chatbot
app.post('/api/chat', async (req, res) => {
  try {
    const { message, scenario, history } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const systemInstruction = `You are AIHealthBot, a friendly and professional AI Healthcare Assistant built for the AIHealthChatBot platform.

Your role:
- Greet users warmly when they say hi, hello, hey, or any greeting.
- Answer every healthcare-related question clearly, professionally, and empathetically.
- When the user is in a specific view/scenario, tailor your response to that context.
- Always be helpful, concise, and easy to understand.
- If asked about symptoms, provide a preliminary assessment and recommend professional consultation.
- If asked about appointments, help the user understand how to book, reschedule, or cancel.
- If asked about medication, provide general safe information and always advise consulting a doctor for prescriptions.
- If asked about patient records, help explain what they mean in simple terms.
- For greetings like "hi" or "hello", respond warmly and introduce yourself briefly.
- For general questions outside healthcare, still be helpful but gently guide back to healthcare topics.
- Never refuse to answer a question. Always provide a helpful, thoughtful response.`;

    const modelsToTry = [
      'gemini-2.5-flash',
      'gemini-2.0-flash-lite',
      'gemini-flash-latest',
      'gemini-2.0-flash',
    ];

    const prompt = `User is in "${scenario}" view.\n\nUser message: ${message}`;

    let lastError = null;
    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName, systemInstruction });
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        console.log(`✅ Responded using model: ${modelName}`);
        return res.json({ reply: text });
      } catch (err) {
        console.warn(`⚠️  Model ${modelName} failed: ${err.message}`);
        lastError = err;
      }
    }

    // All models failed
    res.status(500).json({ error: lastError?.message || 'All models failed.' });
  } catch (err) {
    console.error('Gemini API Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 7. Medical Report / Image Analysis
app.post('/api/analyze-report', async (req, res) => {
  try {
    const { fileContent, fileName, scenario } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const modelsToTry = [
      'gemini-2.5-flash',
      'gemini-2.0-flash-lite',
      'gemini-flash-latest',
      'gemini-2.0-flash',
    ];

    // ── Step 1: Validate if content is medical ─────────────────────
    const validationPrompt = `You are a medical document validator.

Analyze the following file content and determine if it is a medical document (e.g., lab report, blood test, ECG, prescription, medical history, patient record, radiology report, pathology report, discharge summary, etc.).

Respond with ONLY one of these two exact words:
- "MEDICAL" if it is clearly a medical document
- "NOT_MEDICAL" if it is not a medical document

File name: ${fileName || 'unknown'}
File content (first 2000 chars):
${(fileContent || '').substring(0, 2000)}`;

    let isMedical = false;
    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(validationPrompt);
        const verdict = result.response.text().trim().toUpperCase();
        console.log(`🔍 Medical validation (${modelName}): ${verdict}`);
        isMedical = verdict.includes('MEDICAL') && !verdict.includes('NOT_MEDICAL');
        lastError = null;
        break;
      } catch (err) {
        console.warn(`⚠️  Validation model ${modelName} failed: ${err.message}`);
        lastError = err;
      }
    }

    if (lastError) {
      return res.status(500).json({ error: lastError.message });
    }

    // ── Step 2: Reject if not medical ──────────────────────────────
    if (!isMedical) {
      return res.json({
        isMedical: false,
        reply: `⚠️ **Non-Medical Document Detected**\n\nThe file you uploaded does not appear to be a medical report or prescription.\n\nPlease upload a valid medical document such as:\n• 🩸 Blood test / Lab report\n• 💊 Prescription or discharge summary\n• 🫀 ECG / Cardiology report\n• 🧪 Pathology or radiology report\n• 📋 Medical history or patient record\n\nFor symptom analysis, you can also simply type your symptoms in the chat.`
      });
    }

    // ── Step 3: Deep medical analysis ──────────────────────────────
    const analysisPrompt = `You are AIHealthBot, an expert AI Healthcare Assistant specialized in medical report analysis.

A patient in the "${scenario}" view has uploaded a medical document. Perform a thorough clinical analysis of this document.

Your response MUST include:
1. **Document Type** — What kind of medical report this is
2. **Key Findings** — The most important values, results, or observations from the report
3. **Clinical Interpretation** — What these findings mean in plain language
4. **Risk Assessment** — Any abnormal values, warning signs, or areas of concern
5. **Recommendations** — Specific actionable steps the patient should take
6. **Specialist Referral** — Which type of doctor to consult if needed
7. **Follow-up** — When to retest or schedule a follow-up

Use clear formatting with headers and bullet points. Be professional, empathetic, and thorough.

File name: ${fileName || 'unknown'}
Document content:
${(fileContent || '').substring(0, 4000)}`;

    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(analysisPrompt);
        const analysis = result.response.text();
        console.log(`✅ Medical analysis done using model: ${modelName}`);
        return res.json({ isMedical: true, reply: analysis });
      } catch (err) {
        console.warn(`⚠️  Analysis model ${modelName} failed: ${err.message}`);
        lastError = err;
      }
    }

    res.status(500).json({ error: lastError?.message || 'Analysis failed.' });
  } catch (err) {
    console.error('Analyze Report Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 AIHealthChatBot Server running on http://localhost:${PORT}`);
});
