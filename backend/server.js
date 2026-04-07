import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
    const { message, scenario, userData } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const systemInstruction = `You are AIHealthBot, a friendly and professional AI Healthcare Assistant.

Your context:
- Current User: ${userData?.profile?.name || 'Unknown'} (${userData?.profile?.role || 'Guest'})
- Medical History/Records: ${JSON.stringify(userData?.appointments || [])}
- Active Prescriptions: ${JSON.stringify(userData?.prescriptions || [])}

Your role:
- Greet users warmly.
- Use the user's data ONLY if they ask about their records, history, medications, or appointments.
- If they ask "summarize my records" or "tell me about my history", provide a concise bulleted summary of their appointments and findings.
- If they ask about medications, list their prescriptions and tell them how to take them.
- If they mention an unhealthy issue, provide assessment and append [NEEDS_APPOINTMENT] if serious.
- Answer every healthcare question clearly and empathetically.
- Never refuse to answer.`;

    const modelsToTry = [
      'gemini-3-flash',
      'gemini-3.1-flash-lite',
      'gemini-2.5-flash',
      'gemini-2.0-flash-lite',
      'gemini-flash-latest',
    ];

    const prompt = `User in "${scenario}" view asks: ${message}`;

    let lastError = null;
    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName, systemInstruction });
        const result = await model.generateContent(prompt);
        let text = result.response.text();
        
        let needsAppointment = false;
        if (text.includes('[NEEDS_APPOINTMENT]')) {
          needsAppointment = true;
          text = text.replace(/\[NEEDS_APPOINTMENT\]/g, '').trim();
          text += '\n\n📅 **I strongly recommend booking a consultation.** Please select a specialist below to schedule an appointment for your issue.';
        }

        console.log(`✅ Responded using model: ${modelName} (Needs Appointment: ${needsAppointment})`);
        return res.json({ reply: text, needsAppointment });
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
      'gemini-3-flash',
      'gemini-3.1-flash-lite',
      'gemini-2.5-flash',
      'gemini-2.0-flash-lite',
      'gemini-flash-latest',
    ];

    // Check if the file is sent as base64
    let inlineDataObj = null;
    let fileTextToAnalyze = fileContent;

    if (fileContent && fileContent.startsWith('data:')) {
      const match = fileContent.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (match && match.length === 3) {
        inlineDataObj = {
          inlineData: {
            mimeType: match[1],
            data: match[2]
          }
        };
      }
    }

    // ── Step 1: Validate if content is medical ─────────────────────
    const validationPromptText = `You are a medical document validator.

Analyze the following file and determine if it is a medical document (e.g., lab report, blood test, ECG, prescription, medical history, patient record, radiology report, pathology report, discharge summary, health insurance, etc.).

Respond with ONLY one of these two exact words:
- "MEDICAL" if it is clearly a medical or health-related document
- "NOT_MEDICAL" if it is not a medical document`;

    const validationMessage = inlineDataObj 
       ? [validationPromptText, inlineDataObj] 
       : [validationPromptText, `File name: ${fileName || 'unknown'}\nFile content: ${(fileContent || '').substring(0, 4000)}`];

    let isMedical = false;
    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(validationMessage);
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
        reply: `⚠️ **Non-Medical Document Detected**\n\nThe file you uploaded does not appear to be a medical report, prescription, or health document.\n\nPlease upload a valid document such as:\n• 🩸 Blood test / Lab report\n• 💊 Prescription\n• 📑 Health Insurance\n• 📋 Medical history`
      });
    }

    // ── Step 3: Deep medical analysis ──────────────────────────────
    const analysisPromptText = `You are AIHealthBot, an expert AI Healthcare Assistant specialized in medical report analysis.

A patient in the "${scenario}" view has uploaded a medical or health-related document. Perform a thorough clinical or practical analysis of this document.

Your response MUST include:
1. **Document Type** — What kind of document this is (e.g., Insurance, Lab Report, etc.)
2. **Key Details/Findings** — The most important values, terms, or observations from the report
3. **Interpretation** — What these details mean in plain language
4. **Important Notes/Risks** — Any abnormal values, coverage limits, or areas of concern
5. **Recommendations** — Specific actionable steps the patient should take

Use clear formatting with headers and bullet points. Be professional, empathetic, and thorough.`;

    const analysisMessage = inlineDataObj 
      ? [analysisPromptText, inlineDataObj] 
      : [analysisPromptText, `File name: ${fileName || 'unknown'}\nDocument content:\n${(fileContent || '').substring(0, 8000)}`];

    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(analysisMessage);
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
