import React, {
  useState, useEffect, useRef, useCallback
} from 'react';
import './App.css';
import './admin.css';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell
} from 'recharts';

import axios from 'axios';
import { API_URL } from './config';

interface Prescription {
  id: string;
  _id?: string;
  patientName: string;
  doctorName: string;
  medicineName: string;
  dosage: string;
  timing: string;
  status: 'active' | 'completed' | 'as-needed';
  date: string;
}

// ─── Types ────────────────────────────────────────────────
type Scenario = 'none' | 'records' | 'symptoms' | 'appointments' | 'medication' | 'dashboard' | 'doctorView' | 'adminDashboard' | 'login' | 'health_queries' | 'notifications' | 'admin_doctors' | 'admin_patients' | 'admin_specializations';

interface UserAccount {
  _id?: string;
  name: string;
  email: string;
  role: 'patient' | 'doctor' | 'admin';
  specialization?: string;
}

interface Doctor {
  id: string;
  name: string;
  specialization: string;
  avatar: string;
  available: boolean;
}

interface UserAppointment {
  id: string;
  _id?: string;
  doctorId: string;
  doctorName: string;
  patientName: string;
  patientEmail: string;
  time: string;
  date: string;
  status: 'confirmed' | 'pending' | 'completed';
  specialization?: string;
}

interface ChartData {
  title: string;
  type: 'line' | 'bar' | 'pie';
  data: Array<{ name: string; value: number; secondary?: number }>;
}

interface Message {
  id: string;
  role: 'user' | 'bot';
  text: string;
  chart?: ChartData;
  attachment?: string;
  interactive?: any; // For doctor selection buttons etc
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  icon?: string;
  date: string;
}

// ─── Mock Data ────────────────────────────────────────────
const SPECIALIZATIONS = [
  'General Physician',
  'Cardiologist',
  'Dermatologist',
  'Neurologist',
  'Pediatrician',
  'Psychiatrist'
];

const MOCK_DOCTORS: Doctor[] = [
  { id: '1', name: 'Dr. Aisha Patel', specialization: 'General Physician', avatar: '👩‍⚕️', available: true },
  { id: '2', name: 'Dr. Raj Kumar', specialization: 'Cardiologist', avatar: '👨‍⚕️', available: true },
  { id: '3', name: 'Dr. Sarah Smith', specialization: 'Dermatologist', avatar: '👩‍⚕️', available: true },
  { id: '4', name: 'Dr. Elena Vanya', specialization: 'Neurologist', avatar: '👩‍⚕️', available: false },
  { id: '5', name: 'Dr. Amit Shah', specialization: 'Pediatrician', avatar: '👨‍⚕️', available: true },
  { id: '6', name: 'Dr. Maya Angel', specialization: 'Psychiatrist', avatar: '👩‍⚕️', available: true },
  { id: '7', name: 'Dr. James Ford', specialization: 'General Physician', avatar: '👨‍⚕️', available: true },
];

// INITIAL_PRESCRIPTIONS and INITIAL_APPOINTMENTS removed as they are no longer needed.

// ─── Mock chart data ──────────────────────────────────────
const CHART_BP: ChartData = { 
  title: 'Systolic Blood Pressure (mmHg)', 
  type: 'line', 
  data: [
    { name: 'Mon', value: 125 },
    { name: 'Tue', value: 132 },
    { name: 'Wed', value: 128 },
    { name: 'Thu', value: 135 },
    { name: 'Fri', value: 130 },
    { name: 'Sat', value: 142 },
    { name: 'Sun', value: 138 },
  ] 
};
const CHART_ADHERENCE: ChartData = { 
  title: 'Medication Adherence %', 
  type: 'bar', 
  data: [
    { name: 'Week 1', value: 85 },
    { name: 'Week 2', value: 92 },
    { name: 'Week 3', value: 78 },
    { name: 'Week 4', value: 95 },
  ] 
};
const CHART_VISITS: ChartData = { 
  title: 'Checkups vs Emergencies', 
  type: 'line', 
  data: [
    { name: 'Jan', value: 2, secondary: 0 },
    { name: 'Feb', value: 1, secondary: 1 },
    { name: 'Mar', value: 3, secondary: 0 },
    { name: 'Apr', value: 2, secondary: 0 },
  ] 
};

// ─── Keyword-based AI response engine ────────────────────
function analyzeText(text: string, scenario: Scenario, isMedia: boolean = false): string {
  const t = text.toLowerCase();

  // ─ Media Validation ─
  const healthKeywords = /diabetes|hba1c|glucose|insulin|metformin|hypertension|blood pressure|bp|systolic|diastolic|cholesterol|ldl|hdl|triglyceride|lipid|ecg|ekg|arrhythmia|cardiac|heart|palpitation|kidney|creatinine|gfr|renal|urine|protein|doctor|patient|medical|symptom|pain|fever|cough|cold|infection|medicine|headache|migraine|injury|hurt|ache|fatigue|sleep|diet|nutrition|weight|scan|xray|report|mri|blood/;

  if (isMedia && !healthKeywords.test(t)) {
    return `⚠️ **Media Verification Failed**\n\nit is not proper medical recipt or things pls upload proper medical recipt`;
  }

  // ─ Symptom-Specific Media Logic ─
  if (isMedia && (scenario === 'symptoms' || scenario === 'none')) {
    if (/heart|cardiac|palpitation|ecg|ekg|bp|blood pressure/.test(t)) return '__CARDIOLOGIST_MATCH__';
    if (/brain|headache|migraine|nerves|numbness/.test(t)) return '__NEUROLOGIST_MATCH__';
    if (/skin|rash|acne|itch|dermat/.test(t)) return '__DERMATOLOGIST_MATCH__';
    if (/fever|cough|cold|infection|stomach|pain/.test(t)) return '__GP_MATCH__';
    return '__GENERAL_CLINICAL_MATCH__';
  }

  // ─ Document / report analysis & Health Queries ─
  if (scenario === 'records' || scenario === 'none' || scenario === 'health_queries' || isMedia) {
    if (/diabetes|hba1c|glucose|insulin|metformin/.test(t))
      return `📋 **Medical Report Analysis — Diabetes Indicators Detected**\n\n• **Condition:** Type 2 Diabetes suspected or confirmed\n• **HbA1c** monitoring is critical (target < 7%)\n• **Fasting blood glucose** should be maintained between 80–130 mg/dL\n\n✅ **Recommendations:**\n1. Continue/initiate **Metformin** if not already prescribed\n2. Low-glycaemic diet: avoid refined carbs, sugary drinks\n3. 30 minutes of moderate exercise 5 days/week\n4. Follow-up HbA1c test in 3 months\n\n⚠️ **Alert:** If glucose > 300 mg/dL accompanied by vomiting/confusion — seek emergency care.`;
    if (/hypertension|blood pressure|systolic|diastolic|bp/.test(t))
      return `📋 **Medical Report Analysis — Hypertension Indicators Detected**\n\n• **Condition:** High Blood Pressure (Hypertension)\n• Normal **BP target:** < 130/80 mmHg for most adults\n\n✅ **Recommendations:**\n1. Reduce sodium intake (< 2,300 mg/day)\n2. **DASH diet:** fruits, vegetables, whole grains\n3. Limit alcohol; quit smoking\n4. Daily monitoring with a home BP cuff\n5. Consider ACE inhibitor or ARB if BP > 140/90 persistently\n\n📊 Type **"show BP chart"** to view recent trends.`;
    if (/cholesterol|ldl|hdl|triglyceride|lipid/.test(t))
      return `📋 **Medical Report Analysis — Lipid Profile Detected**\n\n• **LDL (bad cholesterol)** target: < 100 mg/dL (< 70 for high risk)\n• **HDL (good cholesterol)** target: > 40 mg/dL (men), > 50 mg/dL (women)\n• **Triglycerides** target: < 150 mg/dL\n\n✅ **Recommendations:**\n1. Initiate **statin therapy** if LDL > 190 mg/dL or moderate-high risk\n2. Mediterranean diet — olive oil, fish, nuts, legumes\n3. Avoid saturated fats, trans fats, processed food\n4. Recheck lipid panel in 3–6 months`;
    if (/ecg|ekg|arrhythmia|cardiac|heart|palpitation/.test(t))
      return `📋 **Medical Report Analysis — Cardiac Indicators Detected**\n\n⚠️ **Cardiac abnormalities require prompt medical attention.**\n\n• Possible findings: arrhythmia, ischaemia, or structural changes\n\n✅ **Immediate Recommendations:**\n1. Consult a **Cardiologist** within 48–72 hours\n2. Avoid strenuous exercise until cleared\n3. Monitor for chest pain, dizziness, or shortness of breath\n4. 24-hour Holter monitor may be required\n\n🚨 If experiencing chest pain right now — call emergency services (112/911) immediately.`;
    if (/kidney|creatinine|gfr|renal|urine|protein/.test(t))
      return `📋 **Medical Report Analysis — Kidney Function Indicators Detected**\n\n• **Creatinine** elevated or **GFR** reduced — signs of CKD possible\n\n✅ **Recommendations:**\n1. Fluid intake: 2–3 litres water/day\n2. Low-protein, low-potassium diet\n3. Avoid **NSAIDs** (ibuprofen, naproxen)\n4. Control blood pressure and blood sugar tightly\n5. **Nephrology referral** recommended`;
    
    // Detailed Health Queries
    if (/fever|temperature|hot|cold|chills/.test(t))
      return `🩺 **Health Query — Fever Management**\n\n• **Normal Range:** 36.5–37.5°C (97.7–99.5°F)\n\n✅ **Guidance:**\n1. Stay hydrated: Drink water, broth, or electrolyte solutions\n2. Rest adequately\n3. Take paracetamol (acetaminophen) if discomfort persists\n4. Monitor temperature every 4–6 hours\n\n⚠️ **See a Doctor if:** Fever > 103°F (39.4°C), lasts > 3 days, or if accompanied by a stiff neck or rash.`;
    
    if (/headache|migraine|brain|head.?pain/.test(t))
      return `🩺 **Health Query — Headache Relief**\n\n• **Common Causes:** Stress, dehydration, eye strain, or lack of sleep\n\n✅ **Relief Tips:**\n1. Rest in a dark, quiet room\n2. Apply a cold compress to the forehead\n3. Stay hydrated\n4. Limit screen time\n\n⚠️ **Warning:** Seek immediate help if the headache is sudden and "thunderclap" in intensity, or if accompanied by vision loss or confusion.`;

    if (/diet|food|eat|nutrition|weight/.test(t))
      return `🩺 **Health Query — Clinical Nutrition Guidance**\n\n• **Core Principles:** Whole foods, balanced macronutrients, and hydration\n\n✅ **Recommendations:**\n1. Increase **fiber** intake (25–30g/day) via vegetables and legumes\n2. Lean protein at every meal (fish, poultry, beans, tofu)\n3. Healthy fats: Avocado, nuts, seeds, olive oil\n4. Avoid processed sugars and trans fats\n\n📊 Type **"show diet chart"** for a sample meal plan.`;

    if (/exercise|workout|gym|run|walk|fitness/.test(t))
      return `🩺 **Health Query — Physical Activity Guidelines**\n\n• **Goal:** 150 minutes of moderate-intensity aerobic activity per week\n\n✅ **Clinical Advice:**\n1. Include strength training 2 days/week\n2. Maintain consistent hydration during workouts\n3. Warm up for 5–10 mins to prevent musculoskeletal injury\n4. Start slow if sedentary: 10 min walks daily`;

    if (/sleep|insomnia|tired|fatigue/.test(t))
      return `🩺 **Health Query — Sleep Hygiene & Fatigue**\n\n• **Goal:** 7–9 hours of restorative sleep per night\n\n✅ **Sleep Tips:**\n1. Consistent sleep/wake schedule\n2. No caffeine after 2:00 PM\n3. No blue light (screens) 1 hour before bed\n4. Ensure a cool, dark environment`;

    if (/pain|ache|sore|hurt|injury|hand|leg|back|arm|shoulder|neck/.test(t))
      return `🩺 **Health Query — Pain & Musculoskeletal Management**\n\n• **Detected Concern:** Physical pain or injury\n\n✅ **Immediate Clinical Solutions:**\n1. **R.I.C.E. Protocol:** Rest the affected area, apply Ice (15 mins), use Compression (if swollen), and Elevation\n2. **Ergonomic Adjustment:** Ensure your posture and workstation are clinically sound to avoid repetitive strain\n3. **Gentle Stretching:** If pain is chronic, light mobility exercises may help, but avoid strenuous activity\n4. **Pain Relief:** Paracetamol or Ibuprofen can be taken as per pharmacy guidance\n\n⚠️ **Urgent Warning:** Seek emergency care if the pain is accompanied by numbness, inability to move the limb, or if the pain is radiating from the chest.`;

    if (isMedia) return `📋 **Document Analysed.**\n\nI reviewed the uploaded document and detected medical context. However, I couldn't map it to a specific condition. Please ensure the document is clear or describe the issue in text.`;

    if (scenario === 'health_queries') {
      return `🩺 **AIHealthcareChatBot — Health Suggestion**\n\nI have reviewed your concern about **"${text.length > 50 ? text.substring(0, 50) + '...' : text}"**. Based on this clinical query, here are my initial suggestions:\n\n✅ **Actionable Recommendations:**\n1. Monitor for any red-flag symptoms like sudden pain, high fever, or dizziness\n2. Maintain a balanced diet and stay adequately hydrated\n3. Rest is critical for recovery; aim for 7–8 hours of quality sleep\n4. For a definitive clinical plan, please **upload your medical reports** for my verification\n\n⚠️ **Guidance:** This is an automated suggestion for primary care. Please consult our on-duty doctors by **booking an appointment** for a professional physical examination.`;
    }

    return `📋 **Healthcare Analysis System**\n\nI reviewed your query but could not detect specific medical keywords. Here's how I can help:\n\n1. Type symptoms for a diagnostic review\n2. Ask health questions (e.g., "how to manage fever")\n3. Upload medical reports for clinical analysis\n4. Switch to a specialized mode using the selector`;
  }

  // ─ SYMPTOMS ─
  if (scenario === 'symptoms') {
    if (/chest.?pain|chest.?tight|heart/.test(t))
      return `🚨 **URGENT — Chest Pain Protocol**\n\nThis could indicate a cardiac emergency.\n\n✅ **Immediate Actions:**\n1. Call emergency services **NOW** (112 / 911)\n2. Chew 325mg **aspirin** if not allergic and not contraindicated\n3. Lie down and remain calm; loosen tight clothing\n4. Do **NOT** drive yourself to hospital\n\nDo not wait — cardiac events require immediate intervention.`;
    if (/headache|head pain|migraine/.test(t) && /fever|temperature|hot/.test(t))
      return `🩺 **Preliminary Assessment — Headache + Fever**\n\nPossible causes: Viral infection, bacterial meningitis (rare), sinusitis\n\n✅ **Recommended Actions:**\n1. **Paracetamol** 500–1000mg every 6 hours (max 4g/day)\n2. **Ibuprofen** 400mg with food every 8 hours if no stomach issues\n3. Maintain hydration: 2–3 litres fluid/day\n4. Rest in a cool, quiet room\n\n⚠️ **Seek emergency care if:**\n• Fever > 39.5°C (103°F)\n• Sudden severe headache ("thunderclap")\n• Stiff neck + rash\n• Confusion or vision changes`;
    if (/headache|migraine/.test(t))
      return `🩺 **Preliminary Assessment — Headache**\n\nLikely type: Tension headache or migraine\n\n✅ **Recommendations:**\n1. Rest in a dark, quiet room\n2. **Paracetamol** 500mg or **ibuprofen** 400mg\n3. Cold/warm compress on neck or forehead\n4. Stay hydrated\n5. **Migraine diary** recommended if recurrent\n\n⚠️ **Red flags requiring urgent care:** worst headache of your life, sudden onset, neurological symptoms.`;
    if (/fever|temperature|hot/.test(t))
      return `🩺 **Preliminary Assessment — Fever**\n\nFever definition: Oral temperature > 38°C (100.4°F)\n\n✅ **Recommendations:**\n1. **Paracetamol** 500–1000mg every 6h\n2. Oral rehydration: water, ORS, clear soups\n3. Rest; avoid strenuous activity\n4. Monitor temperature every 4 hours\n\n⚠️ **Seek care if:** > 39.5°C, persists > 3 days, difficulty breathing, rash.`;
    if (/cough|cold|sore throat|congestion/.test(t))
      return `🩺 **Preliminary Assessment — Respiratory Symptoms**\n\nMost likely: Upper Respiratory Infection (viral)\n\n✅ **Recommendations:**\n1. Rest and stay warm\n2. Honey-ginger-lemon tea sooths sore throat\n3. **Steam inhalation** twice daily\n4. Antihistamines for congestion (e.g., Cetirizine 10mg)\n5. Antibiotics are **NOT** needed for viral infections\n\n⚠️ **See a doctor if:** symptoms > 10 days, coughing blood, high fever, difficulty breathing.`;
    if (/nausea|vomit|stomach|abdom|diarrhea|diarrhoea/.test(t))
      return `🩺 **Preliminary Assessment — GI Symptoms**\n\nLikely: Gastroenteritis, food poisoning, or IBS flare-up\n\n✅ **Recommendations:**\n1. Clear liquids only until vomiting stops: ORS, diluted juice, broth\n2. **BRAT diet:** Banana, Rice, Applesauce, Toast\n3. Avoid dairy, fatty, and spicy foods\n4. Probiotics may help recovery\n5. **Ondansetron** 4mg for severe nausea (prescription)\n\n🚨 **Seek emergency care if:** blood in stool/vomit, severe dehydration, high fever, severe abdominal pain.`;
    if (/breathe|breathing|breath|shortness|wheeze|asthma/.test(t))
      return `🚨 **Difficulty Breathing — Urgent Assessment Needed**\n\nPossible causes: Asthma attack, allergic reaction, COPD, pulmonary embolism\n\n✅ **Immediate Actions:**\n1. Sit upright; loosen tight clothing\n2. If asthmatic: use rescue inhaler (**Salbutamol**) immediately\n3. If symptoms are severe or worsening: call emergency (112/911)\n4. Monitor oxygen saturation if pulse oximeter available (< 94% is concerning)\n\nDo **NOT** lie flat. Keep calm and breathe slowly.`;
    if (/rash|skin|itch|hive|allergy/.test(t))
      return `🩺 **Assessment — Skin Symptoms**\n\nPossible causes: Allergic reaction, contact dermatitis, eczema, viral rash\n\n✅ **Recommendations:**\n1. **Cetirizine** 10mg (antihistamine) for itching/hives\n2. **Hydrocortisone 1% cream** for localised rash\n3. Avoid known allergens; wear loose cotton clothing\n4. Cool compress for relief\n\n🚨 **Emergency if:** rash with breathing difficulty, swollen throat (anaphylaxis — use EpiPen if available, call 112/911).`;
    return `🩺 **Symptom Analysis**\n\nPlease describe your symptoms in more detail. For example:\n• "I have a headache and fever for 2 days"\n• "Chest pain and shortness of breath"\n• "Nausea and stomach cramps after eating"\n\nThe more detail you give, the better I can assess the situation.`;
  }

  // ─ APPOINTMENTS ─
  if (scenario === 'appointments') {
    if (/book|schedule/.test(t)) return '__SPECIALIZATIONS__';
    if (/cancel/.test(t)) return `✅ Your appointment has been canceled.`;
    return `📅 **Appointment Manager**\n\nI can help you:\n• **"Book an appointment"** — schedule with a doctor\n• **"Show upcoming appointments"** — view your schedule\n• **"Cancel appointment"** — remove a booking\n\nWhat would you like to do?`;
  }

  // ─ MEDICATIONS ─
  if (scenario === 'medication') {
    if (/list|current|show|my/.test(t))
      return `💊 **Current Prescriptions:**\n\n1. **Metformin 500mg** — Twice daily with meals (Diabetes)\n2. **Lisinopril 10mg** — Once daily, morning (Hypertension)\n3. **Atorvastatin 20mg** — Once daily, night (Cholesterol)\n4. **Aspirin 75mg** — Once daily with food (Cardiac protection)\n\n📅 **Next Refill Due:** 15 April 2026\n**Phone Pharmacy:** +91-98765-43210`;
    if (/remind|alert|alarm|notification/.test(t))
      return `⏰ **Medication Alerts Activated!**\n\n• **08:00 AM** — Metformin 500mg + Lisinopril 10mg\n• **01:00 PM** — Metformin 500mg (with lunch)\n• **10:00 PM** — Atorvastatin 20mg + Aspirin 75mg\n\n📱 Push notifications, SMS, and email alerts are enabled.\n🔔 You'll receive a reminder 15 minutes before each dose.`;
    if (/refill|stock|running|out/.test(t))
      return `📦 **Refill Status:**\n\n• **Metformin 500mg** — 12 tablets remaining (⚠️ Low stock)\n• **Lisinopril 10mg** — 28 tablets remaining ✅\n• **Atorvastatin 20mg** — 21 tablets remaining ✅\n• **Aspirin 75mg** — 30 tablets remaining ✅\n\n✅ **Refill request sent to pharmacy for Metformin.**\nEstimated delivery: 2 business days.`;
    if (/interaction|safe|combine|mix/.test(t))
      return `⚠️ **Drug Interaction Check:**\n\n• **Metformin + Lisinopril:** LOW risk — monitor kidney function every 3 months\n• **Lisinopril + Atorvastatin:** ✅ No known significant interaction\n• **Aspirin + Metformin:** ✅ Generally safe\n• **Atorvastatin + Aspirin:** ✅ No interaction\n\n🚫 **Avoid combining with:** NSAIDs (ibuprofen can reduce Lisinopril effectiveness), alcohol (interferes with Metformin).\n\nAlways consult your pharmacist before adding OTC medications.`;
    if (/side effect|effect/.test(t))
      return `📋 **Common Side Effects:**\n\n• **Metformin:** GI upset, nausea (take with food to reduce)\n• **Lisinopril:** Dry cough (affects ~10%), dizziness on standing\n• **Atorvastatin:** Muscle soreness (rare), liver enzyme elevation (monitor)\n• **Aspirin:** GI bleeding risk with long-term use (take with food)\n\n⚠️ **Report severe side effects to your doctor immediately.**`;
    return `💊 **Medication Manager**\n\nWhat would you like help with?\n• **"Show my medications"** — view prescriptions\n• **"Set medication reminders"** — configure alerts\n• **"Check drug interactions"** — safety check\n• **"Refill status"** — check stock levels\n• **"Side effects"** — learn about your medicines\n\nOr upload a prescription image/PDF for me to analyse.`;
  }

  // ─ Default ─
  return `Hello! I'm **AIHealthcareChatBot** 👋\n\nI'm your intelligent healthcare assistant. Please select one of the specialised modes above or type your health question.\n\nYou can also:\n• 📎 **Upload a medical report** or prescription for analysis\n• 🎤 Use **voice input** to speak your symptoms\n• 📊 Ask for **"data insights"** for visual analytics`;
}

function getBotResponse(
  text: string,
  scenario: Scenario,
  fileContent?: string,
  dynamicSpecializations: string[] = SPECIALIZATIONS
): { reply: string; chart?: ChartData; interactive?: any } {
  const isMedia = !!fileContent;
  const combined = fileContent ? `${text} ${fileContent}` : text;
  const raw = analyzeText(combined, scenario, isMedia);

  const t = combined.toLowerCase();

  // ─ Interactive Routing ─
  if (raw === '__CHART__') {
    const chart = /bp|blood.?pressure|systolic/.test(t) ? CHART_BP
      : /adherence|medication/.test(t) ? CHART_ADHERENCE
      : CHART_VISITS;
    return { reply: `📊 **Data Insights** — ${chart.title}`, chart };
  }

  if (raw === '__SPECIALIZATIONS__') {
    return {
      reply: `📅 **Book an Appointment**\n\nPlease select a medical specialization to see available doctors:`,
      interactive: { type: 'specializations', data: dynamicSpecializations }
    };
  }

  // ─ Multimedia Symptom Matches ─
  if (raw === '__CARDIOLOGIST_MATCH__') {
    return {
      reply: `🩺 **AI Diagnostic Analysis** — Cardiac indicators detected. I recommend consulting a specialist for a physical examination.`,
      interactive: { type: 'specializations', data: ['Cardiologist'] }
    };
  }
  if (raw === '__NEUROLOGIST_MATCH__') {
    return {
      reply: `🩺 **AI Diagnostic Analysis** — Neurological context detected. Please consult our neuro-experts for further evaluation.`,
      interactive: { type: 'specializations', data: ['Neurologist'] }
    };
  }
  if (raw === '__DERMATOLOGIST_MATCH__') {
    return {
      reply: `🩺 **AI Diagnostic Analysis** — Skin-related concern detected. I've matched you with our dermatology department.`,
      interactive: { type: 'specializations', data: ['Dermatologist'] }
    };
  }
  if (raw === '__GP_MATCH__') {
    return {
      reply: `🩺 **AI Diagnostic Analysis** — Primary care symptoms detected. Please consult an on-duty General Physician.`,
      interactive: { type: 'specializations', data: ['General Physician'] }
    };
  }
  if (raw === '__GENERAL_CLINICAL_MATCH__') {
    return {
      reply: `🩺 **AI Diagnostic Analysis** — Medical context detected. I recommend starting with a General Physician consultation.`,
      interactive: { type: 'specializations', data: ['General Physician'] }
    };
  }

  return { reply: raw };
}

const PIE_COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#6366F1'];

// ─── Inline chart ─────────────────────────────────────────
const InlineChart: React.FC<{ data: ChartData }> = ({ data }) => (
  <div className="chart-card">
    <p className="chart-card-title">{data.title}</p>
    <div style={{ height: 190, width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        {data.type === 'line' ? (
          <LineChart data={data.data} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }} />
            {data.data[0]?.secondary !== undefined && <Legend iconSize={10} />}
            <Line type="monotone" dataKey="value" name="Primary" stroke="#0066FF" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            {data.data[0]?.secondary !== undefined && (
              <Line type="monotone" dataKey="secondary" name="Emergency" stroke="#EF4444" strokeWidth={2.5} dot={{ r: 3 }} />
            )}
          </LineChart>
        ) : data.type === 'bar' ? (
          <BarChart data={data.data} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }} />
            <Bar dataKey="value" name="%" fill="#4F46E5" radius={[4, 4, 0, 0]} barSize={28} />
          </BarChart>
        ) : (
          <PieChart>
            <Pie
              data={data.data}
              innerRadius={45}
              outerRadius={70}
              paddingAngle={5}
              dataKey="value"
            >
              {data.data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend verticalAlign="bottom" height={36}/>
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  </div>
);

const Dashboard: React.FC<{ appointments: UserAppointment[], prescriptions: Prescription[] }> = ({ appointments, prescriptions }) => {
  const today = new Date().toISOString().split('T')[0];
  
  const totalPatients = new Set(appointments.map(a => a.patientName)).size;
  const activeCases = appointments.filter(a => a.status !== 'completed').length;
  const criticalAlerts = prescriptions.filter(p => p.status === 'active').length;
  const todaysApps = appointments.filter(a => a.date === today).length;

  const stats = [
    { label: 'Total Patients', value: totalPatients.toString(), color: '#0066FF', icon: '👥' },
    { label: 'Active Cases', value: activeCases.toString(), color: '#10B981', icon: '🩺' },
    { label: 'Alerts', value: criticalAlerts.toString(), color: '#EF4444', icon: '🚨' },
    { label: "Today's Schedule", value: todaysApps.toString(), color: '#F59E0B', icon: '📅' },
  ];

  // Dynamic Volume Chart
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });
  
  const volumeData: ChartData = {
    title: 'Appointment Volume (Last 7 Days)',
    type: 'line',
    data: last7Days.map(d => ({
      name: d.split('-').slice(1).join('/'),
      value: appointments.filter(a => a.date === d).length || (appointments.length === 0 ? Math.floor(Math.random() * 5) : 0)
    }))
  };

  // Status Distribution Pie Chart
  const statusCounts = [
    { name: 'Pending', value: appointments.filter(a => a.status === 'pending').length },
    { name: 'Confirmed', value: appointments.filter(a => a.status === 'confirmed').length },
    { name: 'Completed', value: appointments.filter(a => a.status === 'completed').length },
  ].filter(x => x.value > 0);

  const statusData: ChartData = {
    title: 'Appointment Status',
    type: 'pie',
    data: statusCounts.length > 0 ? statusCounts : [{ name: 'No Data', value: 1 }]
  };

  // Prescription Mix Bar Chart (Mocking adherence if no data)
  const prescripData: ChartData = {
    title: 'Treatment Adherence Rate (%)',
    type: 'bar',
    data: [
      { name: 'On-Time', value: 85 },
      { name: 'Missed', value: 12 },
      { name: 'Partial', value: 3 },
    ]
  };

  return (
    <div className="dashboard-page" style={{ paddingBottom: '3rem' }}>
      <div className="dash-header">
        <h2 className="page-title">Hospital Analytics Dashboard</h2>
        <p className="page-sub">Comprehensive real-time health data synchronization</p>
      </div>
      
      <div className="stat-grid">
        {stats.map(s => (
          <div className="stat-card" key={s.label}>
            <span className="stat-icon">{s.icon}</span>
            <span className="stat-value" style={{ color: s.color }}>{s.value}</span>
            <span className="stat-label">{s.label}</span>
          </div>
        ))}
      </div>
      
      <div className="chart-grid">
        <div className="chart-panel"><InlineChart data={volumeData} /></div>
        <div className="chart-panel"><InlineChart data={statusData} /></div>
        <div className="chart-panel full-col"><InlineChart data={prescripData} /></div>
      </div>
    </div>
  );
};

// ─── Formatting Helper ──────────────────────────────────
const FormattedText: React.FC<{ text: string }> = ({ text }) => {
  // Simple markdown-style parser for **bold**, \n, and • bullet points
  const lines = text.split('\n');

  return (
    <>
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} style={{ height: '0.5rem' }} />;

        // Handle bullet points
        const isBullet = line.trim().startsWith('•');
        const content = line.trim().replace(/^•\s*/, '');

        // Handle bold text **text**
        const parts = content.split(/(\*\*.*?\*\*)/);

        const renderedContent = parts.map((part, j) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={j}>{part.slice(2, -2)}</strong>;
          }
          return part;
        });

        if (isBullet) {
          return (
            <div key={i} className="msg-bullet-item">
              <span className="msg-bullet-dot">•</span>
              <span className="msg-bullet-text">{renderedContent}</span>
            </div>
          );
        }

        // Special header style if line contains an emoji and is bold/large
        const isHeader = /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}].*Analysis|^🚨|^🩺|^📅|^💊|^📋/u.test(line);

        return (
          <div key={i} className={isHeader ? 'msg-section-header' : ''}>
            {renderedContent}
          </div>
        );
      })}
    </>
  );
};

// ─── Scenario chips ───────────────────────────────────────
const SCENARIO_CHIPS = [
  { id: 'health_queries' as Scenario, label: 'Health Queries', icon: '❓' },
  { id: 'symptoms' as Scenario, label: 'Symptom Analysis', icon: '🩺' },
  { id: 'appointments' as Scenario, label: 'Appointment Scheduling', icon: '📅' },
];

// ─── Chat ─────────────────────────────────────────────────
// ─── Chat ─────────────────────────────────────────────────
const Chat: React.FC<{
  scenario: Scenario,
  setScenario: (s: Scenario) => void,
  addAppointment: (app: UserAppointment) => void,
  currentUser: UserAccount | null,
  appointments: UserAppointment[],
  prescriptions: Prescription[],
  allDoctors: Doctor[],
  specializations: string[],
  addToast: (msg: string, type?: Toast['type'], icon?: string) => void
}> = ({
  scenario, setScenario, addAppointment, currentUser, appointments, prescriptions, allDoctors, specializations, addToast
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [selectedSpecialization, setSelectedSpecialization] = useState<string | null>(null);
  const [showQuickMenu, setShowQuickMenu] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendToBot = useCallback(async (
    text: string,
    fileContent?: string,
    fileName?: string
  ) => {
    if (!text.trim() && !fileContent) return;

    const displayText = fileName
      ? `📎 Uploaded: ${fileName}`
      : text.trim();

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: displayText,
      attachment: fileName,
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const t = (text || fileName || '').toLowerCase();

    // ── Handle local mock features (Charts, Appointments, Medication tools) ──
    const isMockFeature = 
      (/\bshow\b.*(bp|blood.?pressure|systolic|adherence|medication|visit|stats|trends)/.test(t) || /\bchart\b|\bgraph\b|\bdata insight/.test(t)) ||
      (scenario === 'medication' && /remind|alert|alarm|notification|refill|stock|interaction|safe|combine|side effect|list|current/.test(t)) ||
      (scenario === 'appointments' && /book|schedule|appointment/.test(t));
      
    if (isMockFeature) {
      await new Promise(r => setTimeout(r, 600));
      const { reply, chart, interactive } = getBotResponse(text || fileName || '', scenario, fileContent, specializations);
      setLoading(false);
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'bot', text: reply, chart, interactive }]);
      
      if (t.includes('remind') || t.includes('alert')) {
        addToast("Medication reminders activated!", "success", "🔔");
      }
      return;
    }


    // ── File upload → Gemini medical analysis ──────────────────────
    if (fileContent) {
      try {
        const response = await fetch(`${API_URL}/analyze-report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileContent, fileName, scenario }),
        });
        const data = await response.json();
        const reply = data.reply || "Unable to analyze this document.";
        setLoading(false);
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'bot', text: reply }]);
      } catch (err) {
        console.error('Analyze report error:', err);
        setLoading(false);
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'bot',
          text: "⚠️ **Connection Error**\n\nUnable to analyze the file. Please make sure the AI server is reachable."
        }]);
      }
      return;
    }

    // ── Text messages → Gemini chat ────────────────────────────────
    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: text.trim(), 
          scenario,
          userData: {
            profile: currentUser,
            appointments: appointments.filter(a => a.patientName === currentUser?.name || a.doctorName === currentUser?.name),
            prescriptions: prescriptions.filter(p => p.patientName === currentUser?.name)
          }
        }),
      });
      const data = await response.json();
      const reply = data.reply || "I'm sorry, I couldn't understand that.";
      
      let interactive = undefined;
      if (data.needsAppointment) {
        interactive = { type: 'specializations', data: specializations };
        addToast("Health issue detected. Recommended: Book Consultaion", "warning", "🩺");
      }
      
      setLoading(false);
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'bot', text: reply, interactive }]);
    } catch (err) {
      console.error('Chat API error:', err);
      setLoading(false);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        text: "⚠️ **Connection Error**\n\nUnable to reach the AI server. Please make sure the backend is running."
      }]);
    }
  }, [scenario]);



  const handleInteractiveClick = (type: string, value: any) => {
    if (type === 'specializations') {
      setSelectedSpecialization(value);
      const doctors = allDoctors.filter(d => d.specialization === value);
      const botMsg: Message = {
        id: Date.now().toString(),
        role: 'bot',
        text: `Available doctors for **${value}**:`,
        interactive: { type: 'doctors', data: doctors }
      };
      setMessages(prev => [...prev, { id: 'usr_'+Date.now(), role: 'user', text: `Selected: ${value}` }, botMsg]);
    } else if (type === 'doctors') {
      const doctor = value as Doctor;
      if (!doctor.available) {
        setMessages(prev => [...prev, { id: 'bot_'+Date.now(), role: 'bot', text: `Sorry, **${doctor.name}** is not available right now. Please select another doctor.` }]);
        return;
      }
      
      const appDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const appTime = '11:00 AM';

      const newApp: UserAppointment = {
        id: 'app_' + Date.now(),
        doctorId: doctor.id,
        doctorName: doctor.name,
        patientName: currentUser?.name || 'Unknown Patient',
        patientEmail: currentUser?.email || 'patient@example.com',
        date: appDate,
        time: appTime,
        status: 'pending',
        specialization: doctor.specialization
      };
      addAppointment(newApp);
      
      setMessages(prev => [
        ...prev,
        { id: 'usr_'+Date.now(), role: 'user', text: `Book with ${doctor.name}` },
        { 
          id: 'bot_'+Date.now(), 
          role: 'bot', 
          text: `✅ **Appointment Confirmed Automatically**\n\nYou have successfully booked an appointment with **${doctor.name}** on **${appDate}** at **${appTime}**.\n\n📋 **Record Synchronization:** Your clinical profile and "My Records" timeline have been updated with this new entry.`,
          interactive: { type: 'link_to_records' }
        }
      ]);
    }
  };

  const handleScenarioClick = (s: Scenario) => {
    setScenario(s);
    const chip = SCENARIO_CHIPS.find(c => c.id === s)!;

    if (s === 'appointments') {
      const botMsg: Message = {
        id: Date.now().toString(),
        role: 'bot',
        text: `📅 **Appointment Scheduling Initialized**\n\nPlease select a medical specialization to find available doctors:`,
        interactive: { type: 'specializations', data: specializations }
      };
      setMessages(prev => [...prev, botMsg]);
      return;
    }

    let text = `${chip.icon} **${chip.label}** mode activated!`;
    const botMsg: Message = { id: Date.now().toString(), role: 'bot', text };
    setMessages(prev => [...prev, botMsg]);
  };

  const handleSend = () => sendToBot(input);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const content = (ev.target?.result as string) || '';
      sendToBot(file.name, content, file.name);
    };
    reader.readAsDataURL(file); // Reads as base64 (supports PDF, images, etc.)
    e.target.value = '';
  };

  const toggleVoiceInput = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Voice input is not supported in this browser. Try Chrome or Edge.'); return; }

    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.onresult = (ev: any) => {
      const transcript = ev.results[0][0].transcript;
      setInput(transcript);
      // Auto-send after voice
      setTimeout(() => sendToBot(transcript), 300);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  };

  return (
    <div className="chat-page">
      {/* Real-time Notifications - Handled at App root now */}

      {messages.length === 0 && (
        <div className="welcome-empty-state">
          <div className="welcome-hero">
            <div className="hero-ico-box">🩺</div>
            <h2>Hello! I'm your AI Healthcare Assistant</h2>
            <p>How can I help you manage your health today?</p>
          </div>
          
          <div className="scenario-chips-grid">
            <button className="chip-btn" onClick={() => handleScenarioClick('health_queries')}>
              <span className="chip-ico">❓</span>
              <div className="chip-labs"><strong>General Queries</strong><span>Ask about medications or conditions</span></div>
            </button>
            
            <button className="chip-btn" onClick={() => handleScenarioClick('symptoms')}>
              <span className="chip-ico">🩺</span>
              <div className="chip-labs"><strong>Symptom Analysis</strong><span>Describe what you are feeling</span></div>
            </button>
            
            <button className="chip-btn" onClick={() => handleScenarioClick('appointments')}>
              <span className="chip-ico">📅</span>
              <div className="chip-labs"><strong>Book Appointment</strong><span>Find and schedule a doctor</span></div>
            </button>
            
            <button className="chip-btn upload" onClick={() => fileInputRef.current?.click()}>
              <span className="chip-ico">📎</span>
              <div className="chip-labs"><strong>Upload Report</strong><span>Analyze lab tests or prescriptions</span></div>
            </button>
          </div>
        </div>
      )}

      {messages.length > 0 && (
        <div className="messages-scroll">
          {messages.map(msg => (
          <div key={msg.id} className={`msg-row ${msg.role}`}>
            <div className="msg-avatar">{msg.role === 'bot' ? '🩺' : '👤'}</div>
            <div className="msg-content">
              <div className={`msg-bubble ${msg.role}`}>
                <FormattedText text={msg.text} />
              </div>
              {msg.chart && <InlineChart data={msg.chart} />}
              
              {/* Interactive buttons for specializations or doctors */}
              {msg.interactive && (
                <div className="interactive-btn-group">
                  {msg.interactive.type === 'specializations' && (
                    msg.interactive.data.map((spec: string) => (
                      <button 
                        key={spec} 
                        className={`interactive-btn ${selectedSpecialization === spec ? 'active' : ''}`}
                        onClick={() => handleInteractiveClick('specializations', spec)}
                      >
                        {spec}
                      </button>
                    ))
                  )}
                  {msg.interactive.type === 'doctors' && (
                    msg.interactive.data.map((doc: Doctor) => (
                      <button 
                        key={doc.id} 
                        className={`interactive-btn doc-btn ${!doc.available ? 'disabled' : ''}`}
                        onClick={() => doc.available && handleInteractiveClick('doctors', doc)}
                        title={!doc.available ? 'Not available' : ''}
                      >
                        <span className="doc-avatar">{doc.avatar}</span>
                        <div className="doc-info">
                          <span className="doc-name">{doc.name}</span>
                          <span className="doc-status">{doc.available ? 'Available' : 'Busy'}</span>
                        </div>
                      </button>
                    ))
                  )}
                  {msg.interactive.type === 'link_to_records' && (
                    <button 
                      className="interactive-btn active"
                      onClick={() => setScenario('records')}
                    >
                      📁 View My Records
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="msg-row bot">
            <div className="msg-avatar">🩺</div>
            <div className="msg-content">
              <div className="msg-bubble bot">
                <div className="typing-dots">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    )}

    {/* Active context bar */}
      {scenario !== 'none' && scenario !== 'login' && (
        <div className="active-mode-bar">
          <div className="fixed-context-label">
             <span>📌 Mode:</span> <strong>{NAV_ITEMS.find(n => n.id === scenario)?.label}</strong>
          </div>
          <button className="mode-clear" onClick={() => setScenario('none')}>Reset Context ✕</button>
        </div>
      )}

      {/* Quick Menu Popover */}
      {showQuickMenu && (
        <div className="quick-menu-popover">
          <div className="popover-header">
            <span>Quick Actions</span>
            <button onClick={() => setShowQuickMenu(false)}>✕</button>
          </div>
          <div className="popover-grid">
            {SCENARIO_CHIPS.map(chip => (
              <button 
                key={chip.id} 
                className="popover-item"
                onClick={() => { handleScenarioClick(chip.id); setShowQuickMenu(false); }}
              >
                <span className="pop-icon">{chip.icon}</span>
                <span className="pop-label">{chip.label}</span>
              </button>
            ))}
            <button className="popover-item" onClick={() => { fileInputRef.current?.click(); setShowQuickMenu(false); }}>
              <span className="pop-icon">📎</span>
              <span className="pop-label">Upload Report</span>
            </button>
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="input-bar">
        <button 
          className={`icon-btn menu-toggle ${showQuickMenu ? 'active' : ''}`} 
          title="Clinical Modes"
          onClick={() => setShowQuickMenu(!showQuickMenu)}
        >
          {showQuickMenu ? '✕' : '☰'}
        </button>

        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          accept="image/*,application/pdf"
          onChange={handleFileChange}
        />
        <button className="icon-btn" title="Upload report" onClick={() => fileInputRef.current?.click()}>
          📎
        </button>
        
        <textarea 
          className="chat-textarea"
          rows={1}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={listening ? '🎤 Listening…' : 'Type a Message…'}
        />

        {/* Voice input */}
        <button
          className={`icon-btn ${listening ? 'btn-recording' : ''}`}
          title="Voice input"
          onClick={toggleVoiceInput}
        >
          {listening ? '⏹' : '🎤'}
        </button>

        {/* Send */}
        <button 
          className="send-btn" 
          disabled={!input.trim() || loading}
          onClick={handleSend}
        >
          ➤
        </button>
      </div>
    </div>
  );
};

// ─── Sidebar ──────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'none' as Scenario, icon: '💬', label: 'General Chat' },
  { id: 'records' as Scenario, icon: '📋', label: 'Patient Records' },
  { id: 'symptoms' as Scenario, icon: '🩺', label: 'Symptom Analysis' },
  { id: 'appointments' as Scenario, icon: '📅', label: 'Appointments' },
  { id: 'medication' as Scenario, icon: '💊', label: 'Medications' },
  { id: 'notifications' as Scenario, icon: '🔔', label: 'Notifications' },
  { id: 'dashboard' as Scenario, icon: '📊', label: 'Insights Dashboard' },
];

// ─── Login ────────────────────────────────────────────────
const LoginPage: React.FC<{ onLogin: (user: UserAccount) => void }> = ({ onLogin }) => {
  const [selectedRole, setSelectedRole] = useState<'patient' | 'doctor' | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;

    try {
      if (isRegistering) {
        if (!name || !email || !password) return;
        
        await axios.post(`${API_URL}/register`, { 
          name, 
          email, 
          password, 
          role: selectedRole 
        });
        
        alert("Clinical Record Success: Your account has been created in AIHealthcareChatBot database.");
        setIsRegistering(false);
        setEmail(''); setPassword(''); setName('');
      } else {
        const response = await axios.post(`${API_URL}/login`, { email, password, role: selectedRole });
        onLogin(response.data.user);
      }
    } catch (err: any) {
      alert(`Authentication Error: ${err.response?.data?.message || 'Connection failed'}`);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-dual-panel">
        {/* Left Side: Role Selector */}
        <div className="login-left">
          <div className="login-hero-centered">
            <div className="logo-pulse-box">
              <div className="logo-pulse">🩺</div>
            </div>
            <h1>AIHealthcareChatBot</h1>
            <p>Premium Healthcare Ecosystem</p>
          </div>
          <div className="role-stack">
            <button 
              className={`role-item patient ${selectedRole === 'patient' ? 'active' : ''}`}
              onClick={() => { setSelectedRole('patient'); setIsRegistering(false); }}
            >
              <div className="role-ico">💊</div>
              <div className="role-txt">
                <strong>Patient Login</strong>
                <span>AI Diagnostics & Portals</span>
              </div>
            </button>
            <button 
              className={`role-item doctor ${selectedRole === 'doctor' ? 'active' : ''}`}
              onClick={() => { setSelectedRole('doctor'); setIsRegistering(false); }}
            >
              <div className="role-ico">🩺</div>
              <div className="role-txt">
                <strong>Doctor Login</strong>
                <span>Clinical Charts & Prescribing</span>
              </div>
            </button>
          </div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="login-right">
          <div className="auth-container">
            <h2>{isRegistering ? 'Create Account' : 'Welcome Back'}</h2>
            <p className={`auth-subtitle ${!selectedRole ? 'locked' : ''}`}>
              {selectedRole ? 
                `Enter your ${selectedRole} credentials below` : 
                '🔒 Locked - Select a role on the left to start'}
            </p>

            <form className={`auth-form ${!selectedRole ? 'form-locked' : ''}`} onSubmit={handleAuth}>
              <>
                {isRegistering && selectedRole !== 'doctor' && (
                  <div className="input-group">
                    <label>Full Name</label>
                    <input 
                      placeholder="John Doe" 
                      value={name} 
                      onChange={e => setName(e.target.value)} 
                      required 
                      disabled={!selectedRole}
                    />
                  </div>
                )}
                <div className="input-group">
                  <label>Email Address</label>
                  <input 
                    type="email" 
                    placeholder="user@example.com" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    required 
                    disabled={!selectedRole}
                  />
                </div>
                <div className="input-group">
                  <label>Password</label>
                  <input 
                    type="password" 
                    placeholder="••••••••" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    required 
                    disabled={!selectedRole}
                  />
                </div>
              </>
              <button type="submit" disabled={!selectedRole} className="auth-submit-btn">
                {selectedRole === 'doctor' ? 'Access Clinical Portal' : (isRegistering ? 'Register' : 'Login')}
              </button>
            </form>

            <div className="auth-toggle">
              {isRegistering ? (
                <p>Already have an account? <button onClick={() => setIsRegistering(false)}>Login now</button></p>
              ) : selectedRole === 'patient' ? (
                <p>Don't have an account? <button onClick={() => setIsRegistering(true)}>Register for free</button></p>
              ) : selectedRole === 'doctor' ? (
                <p className="auth-note">Clinical staff can only login with system credentials.</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Doctor Dashboard ─────────────────────────────────────
const DoctorDashboard: React.FC<{ 
  appointments: UserAppointment[], 
  onSuggestMedicine: (p: Prescription, appointmentId?: string) => void,
  doctorName?: string
}> = ({ appointments, onSuggestMedicine, doctorName }) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'confirmed' | 'completed' | 'history'>('pending');
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  
  // Suggested medicine form state
  const [showForm, setShowForm] = useState(false);
  const [medicine, setMedicine] = useState('');
  const [dosage, setDosage] = useState('');
  const [timing, setTiming] = useState('');

  const filtered = appointments.filter(a => a.status === (activeTab === 'history' ? 'completed' : activeTab));

  const handleSuggest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!medicine || !dosage || !selectedPatient) return;
    
    onSuggestMedicine({
      id: 'p' + Date.now(),
      patientName: selectedPatient,
      doctorName: doctorName || 'Attending Physician',
      medicineName: medicine,
      dosage,
      timing,
      status: 'active',
      date: new Date().toISOString().split('T')[0]
    }, selectedAppointmentId || undefined);
    
    setMedicine(''); setDosage(''); setTiming('');
    setShowForm(false);
    // Explicitly update appointment status before clearing view if required, 
    // but the callback handles it. We'll clear the selection to refresh the list view.
    setTimeout(() => {
      setSelectedPatient(null);
      setSelectedAppointmentId(null);
    }, 100);
    alert(`Medication suggested for ${selectedPatient}`);
  };

  if (selectedPatient) {
    return (
      <div className="doctor-panel patient-detail-view">
        <button className="back-btn" onClick={() => setSelectedPatient(null)}>← Back to Dashboard</button>
        <div className="patient-profile-header">
          <div className="p-ava-large">{selectedPatient.charAt(0)}</div>
          <div>
            <h2>{selectedPatient}</h2>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.25rem' }}>
              <p>Patient ID: PID-8821 • John.D@example.com</p>
              <span className={`status-tag ${appointments.find(a => {
                const aId = (a.id || a._id || '').toString();
                const sId = (selectedAppointmentId || '').toString();
                return aId === sId;
              })?.status || 'pending'}`}>
                {appointments.find(a => {
                  const aId = (a.id || a._id || '').toString();
                  const sId = (selectedAppointmentId || '').toString();
                  return aId === sId;
                })?.status || 'pending'}
              </span>
            </div>
          </div>
          <button className="suggest-btn" onClick={() => setShowForm(true)}>💊 Suggest Medicine</button>
        </div>

        {showForm && (
          <div className="modal-overlay">
            <form className="suggestion-form" onSubmit={handleSuggest}>
              <h3>Suggest Medicine</h3>
              <input placeholder="Medicine Name (e.g. Paracetamol)" value={medicine} onChange={e => setMedicine(e.target.value)} required />
              <input placeholder="Dosage (e.g. 500mg)" value={dosage} onChange={e => setDosage(e.target.value)} required />
              <input placeholder="Timing (e.g. Twice daily)" value={timing} onChange={e => setTiming(e.target.value)} />
              <div className="form-actions">
                <button type="button" className="cancel-pill" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="confirm-pill">Send Prescription</button>
              </div>
            </form>
          </div>
        )}

        <div className="patient-stats-grid">
           <div className="stat-card"><span>Blood Pressure</span><strong>132/88</strong></div>
           <div className="stat-card"><span>Heart Rate</span><strong>78 bpm</strong></div>
           <div className="stat-card"><span>Recent Issue</span><strong>Hypertension</strong></div>
        </div>

        <div className="medical-history">
          <h3>Recent Symptom Logs (from AI Chat)</h3>
          <div className="history-item">
             <span className="h-date">Today</span>
             <p>"Persistent headache for 2 days, feeling slightly dizzy in the mornings."</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="doctor-panel">
      <div className="doc-header">
        <div className="doc-welcome">
          <h2>Doctor Treatment Portal</h2>
          <p>Welcome, Dr. Sarah Smith. You have {appointments.filter(a => a.status === 'pending').length} pending requests.</p>
        </div>
      </div>

      <div className="doc-tabs">
        {(['pending', 'confirmed', 'completed'] as const).map(t => (
          <button key={t} className={activeTab === t ? 'active' : ''} onClick={() => setActiveTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="app-list">
        {filtered.length === 0 ? (
          <div className="empty-state">No {activeTab} appointments found.</div>
        ) : (
          filtered.map(app => (
            <div key={app.id} className="app-card">
              <div className="app-main">
                <div className="p-ava">{app.patientName.charAt(0)}</div>
                <div className="p-det">
                  <strong>{app.patientName}</strong>
                  <span>{app.date} • {app.time}</span>
                </div>
              </div>
              <div className="app-actions">
                <span className={`status-tag ${app.status}`}>{app.status}</span>
                <button className="action-btn-main" onClick={() => {
                  setSelectedPatient(app.patientName);
                  setSelectedAppointmentId(app.id || app._id || null);
                }}>View Records</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ─── Patient Records (Detail View) ────────────────────────
const PatientRecords: React.FC<{ appointments: UserAppointment[] }> = ({ appointments }) => {
  const uniqueIssues = Array.from(new Set(appointments.map(a => {
    if (a.specialization) return a.specialization;
    // Fallback for older appointments: infer from MOCK_DOCTORS
    const doc = MOCK_DOCTORS.find(d => d.name === a.doctorName);
    return doc ? doc.specialization : null;
  }).filter(Boolean)));

  return (
    <div className="records-detail">
      <div className="records-header">
        <h2>My Medical Records & History</h2>
        <p>Comprehensive health data and clinical insights</p>
      </div>

      <div className="records-grid">
        {/* Active Health Issues Card */}
        <div className="record-card issues">
          <div className="card-header-flex">
            <h3>Active Health Issues</h3>
            <span className="status-badge health">{uniqueIssues.length > 0 ? 'Active Monitoring' : 'Stable'}</span>
          </div>
          <div className="issues-list">
            {uniqueIssues.length === 0 ? (
              <p className="empty-msg-small">No active health issues recorded. Book an appointment to start tracking.</p>
            ) : (
              uniqueIssues.map(issue => (
                <div key={issue} className="issue-item">
                  <span className="issue-ico">🩺</span>
                  <div className="issue-text">
                    <strong>{issue}</strong>
                    <span>Clinical consultation history found</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* My Appointments Detail */}
        <div className="record-card appts">
          <h3>Scheduled Appointments</h3>
          {appointments.length === 0 ? (
            <p className="empty-msg">No upcoming sessions found.</p>
          ) : (
            <div className="app-rows-modern">
              {appointments.map(a => (
                <div key={a.id} className="modern-app-row">
                  <div className="modern-app-date">
                    <span className="m-date">{a.date}</span>
                    <span className="m-time">{a.time}</span>
                  </div>
                  <div className="modern-app-doc">
                    <span className="m-doc-name">{a.doctorName}</span>
                    <span className="m-doc-spec">{a.specialization}</span>
                  </div>
                  <div className="modern-app-status">
                    <span className={`m-status-tag ${a.status}`}>{a.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Medication View ──────────────────────────────────────
const MedicationView: React.FC<{ prescriptions: Prescription[] }> = ({ prescriptions }) => (
  <div className="medication-detail">
    <div className="meds-header">
      <h2>My Health Prescriptions</h2>
      <p>Active treatment plans and doctor-recommended medications</p>
    </div>

    <div className="meds-grid">
      {prescriptions.length === 0 ? (
        <div className="empty-state">No medical prescriptions found for this profile.</div>
      ) : (
        prescriptions.map(p => (
          <div key={p.id} className="modern-med-card">
            <div className={`med-status-indicator ${p.status}`}></div>
            <div className="med-main-box">
               <div className="med-row-top">
                  <div className="m-ico">💊</div>
                  <div className="m-title-area">
                     <h3>{p.medicineName}</h3>
                     <span className="m-spec">{p.dosage} • {p.timing}</span>
                  </div>
                  <span className={`m-badge ${p.status}`}>{p.status}</span>
               </div>
               <div className="med-doc-sec">
                  <div className="d-avatar">👨‍⚕️</div>
                  <div className="d-info">
                     <strong>{p.doctorName}</strong>
                     <span>Certified Practitioner</span>
                  </div>
                  <div className="m-date-v">{p.date}</div>
               </div>
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);

// ─── Doctor Home (Overall Dashboard) ──────────────────────
const DoctorOverallDashboard: React.FC<{ 
  appointments: UserAppointment[],
  currentUser: UserAccount | null,
  addToast: any
}> = ({ appointments, currentUser, addToast }) => {
  const [passData, setPassData] = useState({ currentPassword: '', newPassword: '' });

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/doctors/change-password`, {
        email: currentUser?.email,
        currentPassword: passData.currentPassword,
        newPassword: passData.newPassword
      });
      addToast('Password updated successfully', 'success', '🔒');
      setPassData({ currentPassword: '', newPassword: '' });
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Failed to update password', 'error', '⚠️');
    }
  };

  return (
    <div className="doctor-panel">
      <div className="doc-header">
        <h2>Clinical Overview</h2>
        <p>Summary of your practice and patient activity.</p>
      </div>

      <div className="patient-stats-grid">
        <div className="stat-card">
          <span>Total Patients</span>
          <strong>{new Set(appointments.map(a => a.patientName)).size}</strong>
        </div>
        <div className="stat-card">
          <span>Pending Requests</span>
          <strong>{appointments.filter(a => a.status === 'pending').length}</strong>
        </div>
        <div className="stat-card">
          <span>Completed Today</span>
          <strong>{appointments.filter(a => a.status === 'completed').length}</strong>
        </div>
      </div>

      <div className="medical-history" style={{ marginTop: '2rem' }}>
        <h3>Account & Security</h3>
        <div className="app-list" style={{ marginTop: '1rem', background: '#f8fafc', padding: '1.5rem', borderRadius: '12px' }}>
          <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span>🔐</span> Change Password</h4>
          <form onSubmit={handleChangePassword} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <input
              type="password"
              className="login-input"
              placeholder="Current Password"
              required
              value={passData.currentPassword}
              onChange={e => setPassData({...passData, currentPassword: e.target.value})}
              style={{ flex: 1, minWidth: '200px' }}
            />
            <input
              type="password"
              className="login-input"
              placeholder="New Password"
              required
              value={passData.newPassword}
              onChange={e => setPassData({...passData, newPassword: e.target.value})}
              style={{ flex: 1, minWidth: '200px' }}
            />
            <button type="submit" className="action-btn-main" style={{ whiteSpace: 'nowrap' }}>Update Password</button>
          </form>
        </div>
      </div>
    </div>
  );
};

// ─── Admin Dashboard ──────────────────────────────────────────
const AdminDashboardView: React.FC<{ addToast: any, specializations: string[], refreshGlobal: () => void, scenario: Scenario }> = ({ addToast, specializations, refreshGlobal, scenario }) => {
  const [doctors, setDoctors] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [newDoc, setNewDoc] = useState({ name: '', email: '', password: '', specialization: '' });
  const [editingDoc, setEditingDoc] = useState<any>(null);
  const [newSpec, setNewSpec] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const dRes = await axios.get(`${API_URL}/admin/doctors`);
      const pRes = await axios.get(`${API_URL}/admin/patients`);
      setDoctors(dRes.data);
      setPatients(pRes.data);
    } catch(err) { console.error(err); }
  };

  const handleAddDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/admin/doctors`, newDoc);
      addToast('Doctor added successfully', 'success', '👨‍⚕️');
      setNewDoc({ name: '', email: '', password: '', specialization: '' });
      fetchData();
      refreshGlobal();
    } catch(err: any) {
      addToast(err.response?.data?.message || err.response?.data?.error || err.message || 'Error adding doctor', 'error');
    }
  };

  const handleUpdateDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/admin/doctors/${editingDoc._id}`, editingDoc);
      addToast('Doctor updated successfully', 'success', '👨‍⚕️');
      setEditingDoc(null);
      fetchData();
      refreshGlobal();
    } catch(err: any) {
      addToast(err.response?.data?.message || err.response?.data?.error || err.message || 'Error updating doctor', 'error');
    }
  };

  const handleRemoveDoctor = async (id: string) => {
    if (!window.confirm("Are you sure you want to remove this doctor?")) return;
    try {
      await axios.delete(`${API_URL}/admin/doctors/${id}`);
      addToast('Doctor removed', 'info');
      fetchData();
      refreshGlobal();
    } catch(err: any) {
       addToast('Error removing doctor', 'error');
    }
  };

  return (
    <div className="admin-dashboard-page">
       {editingDoc && (
         <div className="modal-overlay" style={{ zIndex: 1000 }}>
           <form className="admin-edit-modal" onSubmit={handleUpdateDoctor}>
             <div className="admin-edit-modal-header">
               <h3>✏️ Edit Doctor Profile</h3>
               <button type="button" className="admin-modal-close" onClick={() => setEditingDoc(null)}>✕</button>
             </div>
             <div className="admin-form-group">
               <label className="admin-form-label">Full Name</label>
               <input className="admin-input" placeholder="Full Name" value={editingDoc.name} onChange={e=>setEditingDoc({...editingDoc, name: e.target.value})} required />
             </div>
             <div className="admin-form-group">
               <label className="admin-form-label">Email Address</label>
               <input className="admin-input" type="email" placeholder="Email" value={editingDoc.email} onChange={e=>setEditingDoc({...editingDoc, email: e.target.value})} required />
             </div>
             <div className="admin-form-group">
               <label className="admin-form-label">Update Password (optional)</label>
               <input className="admin-input" type="password" placeholder="Leave blank to keep current" value={editingDoc.password || ''} onChange={e=>setEditingDoc({...editingDoc, password: e.target.value})} />
             </div>
             <div className="admin-form-group">
               <label className="admin-form-label">Specialization</label>
               <select className="admin-input admin-select" required value={editingDoc.specialization} onChange={e=>setEditingDoc({...editingDoc, specialization: e.target.value})}>
                 <option value="">Select Specialization...</option>
                 {specializations.map(s => <option key={s} value={s}>{s}</option>)}
               </select>
             </div>
             <div className="admin-edit-modal-footer">
               <button type="button" className="admin-cancel-btn" onClick={() => setEditingDoc(null)}>Cancel</button>
               <button type="submit" className="admin-submit-btn">Update Profile</button>
             </div>
           </form>
         </div>
       )}

       <div className="admin-page-header">
         <div className="admin-page-header-icon">
           {scenario === 'admin_doctors' ? '👨‍⚕️' : scenario === 'admin_patients' ? '👥' : scenario === 'admin_specializations' ? '🔖' : '📊'}
         </div>
         <div>
           <h2 className="admin-page-title">
             {scenario === 'admin_doctors' ? 'Doctor Management' :
              scenario === 'admin_patients' ? 'Patient Registry' :
              scenario === 'admin_specializations' ? 'Specializations' : 'Admin Overview'}
           </h2>
           <p className="admin-page-sub">
             {scenario === 'admin_doctors' ? 'Add, edit and monitor healthcare provider accounts' :
              scenario === 'admin_patients' ? 'Comprehensive list of all registered patients' :
              scenario === 'admin_specializations' ? 'Define and organize medical departments' :
              'System-wide metrics and real-time statistics'}
           </p>
         </div>
       </div>

       {(scenario === 'adminDashboard' || scenario === 'none') && (
         <div className="admin-stats-grid">
           <div className="admin-stat-card admin-stat-blue">
             <div className="admin-stat-icon">👨‍⚕️</div>
             <div className="admin-stat-info">
               <span className="admin-stat-label">Doctors</span>
               <strong className="admin-stat-value">{doctors.length}</strong>
             </div>
           </div>
           <div className="admin-stat-card admin-stat-green">
             <div className="admin-stat-icon">👥</div>
             <div className="admin-stat-info">
               <span className="admin-stat-label">Patients</span>
               <strong className="admin-stat-value">{patients.length}</strong>
             </div>
           </div>
           <div className="admin-stat-card admin-stat-purple">
             <div className="admin-stat-icon">🔖</div>
             <div className="admin-stat-info">
               <span className="admin-stat-label">Dept</span>
               <strong className="admin-stat-value">{specializations.length}</strong>
             </div>
           </div>
         </div>
       )}

       {scenario !== 'adminDashboard' && scenario !== 'none' && (
         <div className={scenario === 'admin_doctors' ? 'admin-two-col-layout' : scenario === 'admin_specializations' ? 'admin-spec-layout' : ''}>
           {scenario === 'admin_specializations' && (
             <>
               <div className="admin-section-card">
                 <div className="admin-section-header">
                   <div className="admin-section-icon">➕</div>
                   <h3>Add Specialization</h3>
                 </div>
                 <form className="admin-form" onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      await axios.post(`${API_URL}/admin/specializations`, { name: newSpec });
                      addToast('Specialization added successfully', 'success', '🔖');
                      setNewSpec('');
                      fetchData();
                      refreshGlobal();
                    } catch(err: any) {
                      addToast(err.response?.data?.message || 'Error adding specialization', 'error');
                    }
                 }}>
                    <div className="admin-form-group">
                      <label className="admin-form-label">Department Name</label>
                      <input className="admin-input" placeholder="E.g., Orthopaedics" required value={newSpec} onChange={e=>setNewSpec(e.target.value)} />
                    </div>
                    <button type="submit" className="admin-submit-btn">Register Specialization</button>
                 </form>
               </div>

               <div className="admin-section-card">
                 <div className="admin-section-header">
                   <div className="admin-section-icon">🔖</div>
                   <h3>Active Specializations <span className="admin-count-badge">{specializations.length}</span></h3>
                 </div>
                 <div className="admin-spec-tags">
                    {specializations.map(s => (
                      <div key={s} className="admin-spec-tag">
                        <span className="admin-spec-tag-name">{s}</span>
                        <button className="admin-spec-tag-remove" title="Remove" onClick={async () => {
                          if(!window.confirm(`Remove ${s} from specialization list?`)) return;
                          try {
                            const sRes = await axios.get(`${API_URL}/specializations`);
                            const found = sRes.data.find((spec:any) => spec.name === s);
                            if (found) {
                              await axios.delete(`${API_URL}/admin/specializations/${found._id}`);
                              refreshGlobal();
                            }
                          } catch(err) {} 
                        }}>✕</button>
                      </div>
                    ))}
                    {specializations.length === 0 && (
                      <div className="admin-empty-state">
                        <span>🔖</span>
                        <p>No specializations defined yet.</p>
                      </div>
                    )}
                 </div>
               </div>
             </>
           )}
           
           {scenario === 'admin_doctors' && (
             <>
               <div className="admin-section-card">
                 <div className="admin-section-header">
                   <div className="admin-section-icon">➕</div>
                   <h3>Add New Doctor</h3>
                 </div>
                 <form className="admin-form" onSubmit={handleAddDoctor}>
                    <div className="admin-form-group">
                      <label className="admin-form-label">Full Name</label>
                      <input className="admin-input" placeholder="Dr. Jane Smith" required value={newDoc.name} onChange={e=>setNewDoc({...newDoc, name: e.target.value})} />
                    </div>
                    <div className="admin-form-group">
                      <label className="admin-form-label">Email Address</label>
                      <input className="admin-input" placeholder="doctor.name@hospital.com" type="email" required value={newDoc.email} onChange={e=>setNewDoc({...newDoc, email: e.target.value})} />
                    </div>
                    <div className="admin-form-group">
                      <label className="admin-form-label">Secure Password</label>
                      <input className="admin-input" placeholder="••••••••" type="password" required value={newDoc.password} onChange={e=>setNewDoc({...newDoc, password: e.target.value})} />
                    </div>
                    <div className="admin-form-group">
                      <label className="admin-form-label">Specialization</label>
                      <select className="admin-input admin-select" required value={newDoc.specialization} onChange={e=>setNewDoc({...newDoc, specialization: e.target.value})}>
                         <option value="">Choose department...</option>
                         {specializations.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <button type="submit" className="admin-submit-btn">Provision Account</button>
                 </form>
               </div>
               
               <div className="admin-section-card">
                 <div className="admin-section-header">
                   <div className="admin-section-icon">📋</div>
                   <h3>Doctor Directory <span className="admin-count-badge">{doctors.length}</span></h3>
                 </div>
                 <div className="admin-doctor-list">
                    {doctors.map(d => (
                      <div key={d._id} className="admin-doctor-item">
                        <div className="admin-doctor-avatar">
                          {d.name.split(' ').map((n:string) => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                        <div className="admin-doctor-info">
                          <strong>{d.name}</strong>
                          <span className="admin-doctor-spec">{d.specialization}</span>
                          <span className="admin-doctor-email">{d.email}</span>
                        </div>
                        <div className="admin-doctor-actions">
                          <button className="admin-edit-btn" onClick={() => setEditingDoc(d)}>Edit</button>
                          <button className="admin-revoke-btn" onClick={() => handleRemoveDoctor(d._id)}>Revoke</button>
                        </div>
                      </div>
                    ))}
                    {doctors.length === 0 && (
                      <div className="admin-empty-state">
                        <span>👨‍⚕️</span>
                        <p>No healthcare providers registered.</p>
                      </div>
                    )}
                 </div>
               </div>
             </>
           )}

           {scenario === 'admin_patients' && (
             <div className="admin-section-card">
               <div className="admin-section-header">
                 <div className="admin-section-icon">👥</div>
                 <h3>Registered Patients <span className="admin-count-badge">{patients.length}</span></h3>
               </div>
               <div className="admin-patient-grid">
                  {patients.map(p => (
                    <div key={p._id} className="admin-patient-card">
                      <div className="admin-patient-avatar">{p.name.charAt(0)}</div>
                      <div className="admin-patient-info">
                        <strong>{p.name}</strong>
                        <span>{p.email}</span>
                      </div>
                    </div>
                  ))}
                  {patients.length === 0 && (
                    <div className="admin-empty-state">
                      <span>👥</span>
                      <p>No patient records found.</p>
                    </div>
                  )}
               </div>
             </div>
           )}
       </div>
       )}
    </div>
  );
};

// ─── Root App ─────────────────────────────────────────────
export default function App() {

  // View state: 'patient', 'doctor' or 'admin'
  const [view, setView] = useState<'patient' | 'doctor' | 'admin'>('patient');
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [scenario, setScenario] = useState<Scenario>('login');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [notificationHistory, setNotificationHistory] = useState<Toast[]>([]);
  
  const addToast = (message: string, type: Toast['type'] = 'info', icon?: string) => {
    const id = Date.now().toString();
    const date = new Date().toISOString();
    const newToast = { id, message, type, icon, date };
    setToasts(prev => [...prev, newToast]);
    setNotificationHistory(prev => [newToast, ...prev].slice(0, 50)); // Keep last 50
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  // Restore session on refresh
  useEffect(() => {
    const savedSession = localStorage.getItem('mediSync_session');
    if (savedSession) {
      try {
        const user = JSON.parse(savedSession);
        setCurrentUser(user);
        setView(user.role);
        setScenario('none'); // Bypass login page
      } catch (e) {
        localStorage.removeItem('mediSync_session');
      }
    }
  }, []);
  const [appointments, setAppointments] = useState<UserAppointment[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [appSpecializations, setAppSpecializations] = useState<string[]>([]);
  const [appDoctors, setAppDoctors] = useState<Doctor[]>([]);

  const fetchGlobalData = async () => {
    try {
      const dRes = await axios.get(`${API_URL}/doctors`);
      if (dRes.data) {
        setAppDoctors(dRes.data.map((d: any) => ({
          id: d._id,
          name: d.name,
          specialization: d.specialization,
          avatar: d.avatar || '👨‍⚕️',
          available: d.available
        })));
      }
      const sRes = await axios.get(`${API_URL}/specializations`);
      if (sRes.data) {
        setAppSpecializations(sRes.data.map((s: any) => s.name));
      }
    } catch (err) {}
  };

  useEffect(() => {
    fetchGlobalData();
  }, []);

  // Database Persistence Logic
  useEffect(() => {
    if (currentUser) {
      const fetchData = async () => {
        try {
          const appRes = await axios.get(`${API_URL}/appointments/${currentUser.email}?role=${currentUser.role}&name=${currentUser.name}`);
          setAppointments(appRes.data.map((a: any) => ({ ...a, id: a.id || a._id })));

          const presRes = await axios.get(`${API_URL}/prescriptions/${currentUser.email}`);
          setPrescriptions(presRes.data.map((p: any) => ({ ...p, id: p.id || p._id })));

          // Fetch Persistent Notifications
          const notifRes = await axios.get(`${API_URL}/notifications/${currentUser.email}`);
          const fetchedNotifs = notifRes.data.map((n: any) => ({
            id: n._id,
            message: n.message,
            type: n.type,
            icon: n.icon || '🔔',
            date: n.date
          }));

          // Check for new notifications to trigger toast
          if (notificationHistory.length > 0 && fetchedNotifs.length > 0) {
            const latestOld = notificationHistory[0].id;
            const newOnes = fetchedNotifs.filter((fn: any) => fn.id !== latestOld && new Date(fn.date) > new Date(notificationHistory[0].date));
            newOnes.forEach((n: any) => {
              addToast(n.message, n.type, n.icon);
            });
          }

          setNotificationHistory(fetchedNotifs);
        } catch (err) {
          console.error("Error fetching data from MongoDB:", err);
        }
      };
      
      fetchData();
      const pollTimer = setInterval(fetchData, 30000); // Poll every 30s
      return () => clearInterval(pollTimer);
    }
  }, [currentUser]);

  const addAppointment = async (app: UserAppointment) => {
    try {
      const res = await axios.post(`${API_URL}/appointments`, { 
        ...app, 
        patientEmail: currentUser?.email || 'patient@example.com'
      });
      const savedApp = { ...res.data, id: res.data.id || res.data._id };
      setAppointments(prev => [savedApp, ...prev]);
    } catch (err) {
      console.error("Failed to book appointment:", err);
    }
  };

  const updateAppointmentStatus = async (id: string, status: UserAppointment['status']) => {
    try {
      const targetApp = appointments.find(a => a.id === id || a._id === id);
      const res = await axios.patch(`${API_URL}/appointments/${id}`, { status });
      const updatedApp = { ...res.data, id: res.data.id || res.data._id };
      
      setAppointments(prev => prev.map(a => {
        const aId = (a.id || a._id || '').toString();
        const targetId = (id || '').toString();
        return aId === targetId ? updatedApp : a;
      }));

      // Create persistent notification for patient
      if (targetApp) {
        await axios.post(`${API_URL}/notifications`, {
          patientEmail: targetApp.patientEmail,
          message: `Your appointment with Dr. ${targetApp.doctorName} is now ${status}.`,
          type: status === 'completed' ? 'success' : 'info',
          icon: '📅'
        });
      }
      
      addToast(`Appointment status updated to ${status}`, 'success', '📅');
    } catch (err: any) {
      console.error("Failed to update status:", err);
      addToast(`Fail to update status: ${err.response?.data?.error || err.message}`, 'error', '❌');
    }
  };

  const addPrescription = async (pres: Prescription, appointmentId?: string) => {
    try {
        const appRef = appointmentId 
          ? appointments.find(a => a.id === appointmentId || a._id === appointmentId)
          : appointments.find(a => a.patientName === pres.patientName && a.status !== 'completed');
          
        const ptEmail = appRef?.patientEmail || 'patient@example.com';
        const payload = {
          ...pres,
          patientEmail: ptEmail
        };

        const res = await axios.post(`${API_URL}/prescriptions`, payload);
        const savedPres = { ...res.data, id: res.data.id || res.data._id };
        setPrescriptions(prev => [savedPres, ...prev]);

        // Persistent notification for patient
        await axios.post(`${API_URL}/notifications`, {
          patientEmail: ptEmail,
          message: `Dr. ${pres.doctorName} suggested a new medication: ${pres.medicineName}`,
          type: 'success',
          icon: '💊'
        });

        // Automatically complete the appointment if one exists
        if (appRef) {
          const appID = appRef.id || appRef._id;
          if (appID) {
            await updateAppointmentStatus(appID, 'completed');
          }
        }
        
        addToast(`Prescription saved & Notification sent`, 'success', '💊');
    } catch (err) {
        console.error("Failed to save prescription:", err);
    }
  };

  const getNavLabel = (id: Scenario) => {
    if (id === 'records') return view === 'doctor' ? 'Patient Records' : 'My Records';
    if (id === 'appointments') return view === 'doctor' ? 'My Appointments' : 'Book Appointments';
    return NAV_ITEMS.find(n => n.id === id)?.label || '';
  };

  const filteredNavItems = NAV_ITEMS.filter(item => {
    if (view === 'patient') {
      return item.id !== 'dashboard' && item.id !== 'symptoms' && item.id !== 'appointments';
    }
    if (view === 'doctor') {
      return item.id === 'appointments' || item.id === 'records' || item.id === 'dashboard';
    }
    if (view === 'admin') {
      return false; // Admin uses a specific layout without standard nav items
    }
    return true;
  });


  if (scenario === 'login') return (
    <LoginPage onLogin={(user) => { 
      setCurrentUser(user); 
      setView(user.role); 
      setScenario('none'); 
      localStorage.setItem('mediSync_session', JSON.stringify(user));
    }} />
  );

  const activeLabel = getNavLabel(scenario) || 'General Chat';

  return (
    <div className="app">
      {/* Global Toast Notifications */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span className="toast-icon">{t.icon || '🔔'}</span>
            <div className="toast-content">{t.message}</div>
            <button className="toast-close" onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}>✕</button>
          </div>
        ))}
      </div>

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <span className="brand-icon">⚕️</span>
          <span className="brand-name">AIHealthcareChatBot</span>
        </div>
        <nav className="sidebar-nav">
          <p className="nav-group-label">NAVIGATION</p>
          {view === 'doctor' && (
            <button 
              className={`nav-btn ${scenario === 'none' && view === 'doctor' ? 'active' : ''}`}
              onClick={() => { setScenario('none'); setSidebarOpen(false); }}
            >
              <span className="nav-icon">🏠</span>
              Dashboard
            </button>
          )}
          {view === 'admin' ? (
            [
              { id: 'adminDashboard' as Scenario, icon: '📊', label: 'Dashboard Overview' },
              { id: 'admin_doctors' as Scenario, icon: '👨‍⚕️', label: 'Manage Doctors' },
              { id: 'admin_patients' as Scenario, icon: '👥', label: 'View Patients' },
              { id: 'admin_specializations' as Scenario, icon: '🔖', label: 'Specializations' },
            ].map(n => (
              <button
                key={n.id}
                className={`nav-btn ${scenario === n.id || (scenario === 'none' && n.id === 'adminDashboard') ? 'active' : ''}`}
                onClick={() => { setScenario(n.id); setSidebarOpen(false); }}
              >
                <span className="nav-icon">{n.icon}</span>
                {n.label}
              </button>
            ))
          ) : (
            filteredNavItems.map(n => (
              <button
                key={n.id}
                className={`nav-btn ${scenario === n.id ? 'active' : ''}`}
                onClick={() => { 
                  setScenario(n.id); 
                  setSidebarOpen(false); 
                }}
              >
                <span className="nav-icon">{n.icon}</span>
                {getNavLabel(n.id)}
              </button>
            ))
          )}
        </nav>
        <div className="sidebar-footer">
          <button className="logout-action" onClick={() => { 
            localStorage.removeItem('mediSync_session');
            setView('patient'); 
            setScenario('login'); 
            setCurrentUser(null); 
          }}>
            <span>🚪</span> Logout
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="overlay" onClick={() => setSidebarOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="hamburger" onClick={() => setSidebarOpen(o => !o)}>☰</button>
          <div className="topbar-title">
            {view === 'admin' ? '🛡️ Administration Console' : view === 'doctor' ? '👨‍⚕️ Doctor Treatment Portal' : `${NAV_ITEMS.find(n => n.id === scenario)?.icon || '💬'} ${activeLabel}`}
          </div>
          <div className="topbar-right">
             <div className="user-pill">
              <span className="user-name">
                {currentUser?.name || (view === 'admin' ? 'Administrator' : view === 'doctor' ? 'Medical Professional' : 'Patient User')}
              </span>
              <div className="user-ava">
                {currentUser?.name.charAt(0) || (view === 'admin' ? 'A' : view === 'doctor' ? 'D' : 'P')}
              </div>
            </div>
          </div>
        </header>


        <main className="content-scroll">
          {scenario === 'notifications' ? (
            <div className="doctor-panel">
              <div className="doc-header">
                <h2>Notifications Center</h2>
                <p>Stay updated with your latest health alerts and system activity.</p>
              </div>
              <div className="notifications-modern-list">
                {notificationHistory.length === 0 ? (
                   <div className="empty-state">No recent health alerts.</div>
                ) : (
                  notificationHistory.map(n => (
                    <div key={n.id} className={`modern-notif-row ${n.type}`}>
                       <div className="notif-ico">{n.icon || '🔔'}</div>
                       <div className="notif-main">
                          <strong>{n.message}</strong>
                          <span className="notif-time">
                            {new Date(n.date).toLocaleTimeString()} • {new Date(n.date).toLocaleDateString()}
                          </span>
                       </div>
                       <div className="notif-badge">{n.type}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (view as string) === 'admin' || ((view as string) === 'admin' && scenario === 'adminDashboard') ? (
            <AdminDashboardView addToast={addToast} specializations={appSpecializations} refreshGlobal={fetchGlobalData} scenario={scenario === 'none' ? 'adminDashboard' : scenario} />
          ) : view === 'doctor' && scenario === 'none' ? (

            <DoctorOverallDashboard 
              appointments={appointments.filter(a => a.doctorName === currentUser?.name)} 
              currentUser={currentUser}
              addToast={addToast}
            />
          ) : view === 'doctor' && scenario === 'appointments' ? (
            <DoctorDashboard 
              appointments={appointments.filter(a => a.doctorName === currentUser?.name)} 
              doctorName={currentUser?.name}
              onSuggestMedicine={(p, appId) => addPrescription({...p, doctorName: currentUser?.name || 'Attending Physician'}, appId)} 
            />
          ) : view === 'doctor' && scenario === 'records' ? (
            <div className="doctor-panel">
               <div className="doc-header">
                <h2>Patient Records</h2>
                <p>Search and manage patient health documentation.</p>
               </div>
               <div className="app-list">
                 {Array.from(new Set(appointments.filter(a => a.doctorName === currentUser?.name).map(a => a.patientName))).map(pName => (
                   <div key={pName} className="app-card">
                      <div className="app-main">
                        <div className="p-ava">{pName.charAt(0)}</div>
                        <div className="p-det"><strong>{pName}</strong><span>Verified Patient</span></div>
                      </div>
                      <button className="action-btn-main" onClick={() => setScenario('appointments')}>View Profile</button>
                   </div>
                 ))}
               </div>
            </div>
          ) : scenario === 'records' && view === 'patient' ? (
            <PatientRecords appointments={appointments.filter(a => a.patientName === currentUser?.name)} />
          ) : scenario === 'medication' && view === 'patient' ? (
            <MedicationView prescriptions={prescriptions.filter(p => p.patientName === currentUser?.name)} />
          ) : scenario === 'dashboard' ? (
            <Dashboard appointments={appointments} prescriptions={prescriptions} />
          ) : (
            <Chat 
              scenario={scenario} 
              setScenario={setScenario} 
              addAppointment={addAppointment} 
              currentUser={currentUser}
              appointments={appointments}
              prescriptions={prescriptions}
              allDoctors={appDoctors}
              specializations={appSpecializations}
              addToast={addToast}
            />
          )}
        </main>
      </div>
    </div>
  );
}
