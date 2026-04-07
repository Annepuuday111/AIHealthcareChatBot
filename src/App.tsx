import React, {
  useState, useEffect, useRef, useCallback
} from 'react';
import './App.css';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

interface Prescription {
  id: string;
  patientName: string;
  doctorName: string;
  medicineName: string;
  dosage: string;
  timing: string;
  status: 'active' | 'completed' | 'as-needed';
  date: string;
}

// ─── Types ────────────────────────────────────────────────
type Scenario = 'none' | 'records' | 'symptoms' | 'appointments' | 'medication' | 'dashboard' | 'doctorView' | 'login' | 'health_queries';

interface UserAccount {
  name: string;
  email: string;
  role: 'patient' | 'doctor';
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
  doctorId: string;
  doctorName: string;
  patientName: string;
  time: string;
  date: string;
  status: 'confirmed' | 'pending' | 'completed';
}

interface ChartData {
  title: string;
  type: 'line' | 'bar';
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
      return `🩺 **AIHealthChatBot — Health Suggestion**\n\nI have reviewed your concern about **"${text.length > 50 ? text.substring(0, 50) + '...' : text}"**. Based on this clinical query, here are my initial suggestions:\n\n✅ **Actionable Recommendations:**\n1. Monitor for any red-flag symptoms like sudden pain, high fever, or dizziness\n2. Maintain a balanced diet and stay adequately hydrated\n3. Rest is critical for recovery; aim for 7–8 hours of quality sleep\n4. For a definitive clinical plan, please **upload your medical reports** for my verification\n\n⚠️ **Guidance:** This is an automated suggestion for primary care. Please consult our on-duty doctors by **booking an appointment** for a professional physical examination.`;
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
  return `Hello! I'm **AIHealthChatBot** 👋\n\nI'm your intelligent healthcare assistant. Please select one of the specialised modes above or type your health question.\n\nYou can also:\n• 📎 **Upload a medical report** or prescription for analysis\n• 🎤 Use **voice input** to speak your symptoms\n• 📊 Ask for **"data insights"** for visual analytics`;
}

function getBotResponse(
  text: string,
  scenario: Scenario,
  fileContent?: string
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
      interactive: { type: 'specializations', data: SPECIALIZATIONS }
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
        ) : (
          <BarChart data={data.data} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }} />
            <Bar dataKey="value" name="%" fill="#4F46E5" radius={[4, 4, 0, 0]} barSize={28} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  </div>
);

// ─── Dashboard ────────────────────────────────────────────
// ─── DASHBOARD ────────────────────────────────────────────
const Dashboard: React.FC = () => (
  <div className="dashboard-page">
    <div className="dash-header">
      <h2 className="page-title">Hospital Insights Dashboard</h2>
      <p className="page-sub">Real-time analytics and patient health metrics</p>
    </div>
    <div className="stat-grid">
      {[
        { label: 'Total Patients', value: '2,845', color: '#0066FF', icon: '👥' },
        { label: 'Active Cases', value: '412', color: '#10B981', icon: '🩺' },
        { label: 'Critical Alerts', value: '18', color: '#EF4444', icon: '🚨' },
        { label: "Today's Appointments", value: '156', color: '#F59E0B', icon: '📅' },
      ].map(s => (
        <div className="stat-card" key={s.label}>
          <span className="stat-icon">{s.icon}</span>
          <span className="stat-value" style={{ color: s.color }}>{s.value}</span>
          <span className="stat-label">{s.label}</span>
        </div>
      ))}
    </div>
    <div className="chart-grid">
      <div className="chart-panel"><InlineChart data={CHART_VISITS} /></div>
      <div className="chart-panel"><InlineChart data={CHART_ADHERENCE} /></div>
      <div className="chart-panel full-col"><InlineChart data={CHART_BP} /></div>
    </div>
  </div>
);

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
  prescriptions: Prescription[]
}> = ({
  scenario, setScenario, addAppointment, currentUser, appointments, prescriptions
}) => {
  const WELCOME: Message = {
    id: 'welcome',
    role: 'bot',
    text: 'Hello! I\'m **MediSync AI** 👋\n\nPlease select a topic below to get started, or type your health question directly. You can also **📎 upload a medical report / prescription.**',
  };
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [selectedSpecialization, setSelectedSpecialization] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = (message: string, type: Toast['type'] = 'info', icon?: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type, icon }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

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
      const { reply, chart, interactive } = getBotResponse(text || fileName || '', scenario, fileContent);
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
        const response = await fetch('http://localhost:5001/api/analyze-report', {
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
          text: "⚠️ **Connection Error**\n\nUnable to analyze the file. Please make sure the backend is running on port 5001."
        }]);
      }
      return;
    }

    // ── Text messages → Gemini chat ────────────────────────────────
    try {
      const response = await fetch('http://localhost:5001/api/chat', {
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
        interactive = { type: 'specializations', data: SPECIALIZATIONS };
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
        text: "⚠️ **Connection Error**\n\nUnable to reach the AI server. Please make sure the backend is running on port 5001."
      }]);
    }
  }, [scenario]);



  const handleInteractiveClick = (type: string, value: any) => {
    if (type === 'specializations') {
      setSelectedSpecialization(value);
      const doctors = MOCK_DOCTORS.filter(d => d.specialization === value);
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
        date: appDate,
        time: appTime,
        status: 'pending'
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
        interactive: { type: 'specializations', data: SPECIALIZATIONS }
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
      {/* Real-time Notifications */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span className="toast-icon">{t.icon || '🔔'}</span>
            <div className="toast-content">{t.message}</div>
            <button className="toast-close" onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}>✕</button>
          </div>
        ))}
      </div>

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
                      📋 Go to My Records
                    </button>
                  )}
                </div>
              )}

              {/* Quick Actions (Text/Voice options requested) */}
              {msg.role === 'bot' && msg.id !== 'welcome' && (
                <div className="quick-actions">
                  <button className="action-chip" onClick={() => setInput('Tell me more')}>Any other?</button>
                  <button className="action-chip" onClick={() => { setInput(''); fileInputRef.current?.click(); }}>📎 Upload</button>
                  <button className="action-chip voice" onClick={toggleVoiceInput}>🎤 Voice</button>
                </div>
              )}

              {/* Show scenario chips specifically for welcome message */}
              {msg.id === 'welcome' && (
                <div className="scenario-chips">
                  {SCENARIO_CHIPS.map(chip => (
                    <button
                      key={chip.id}
                      className={`chip ${scenario === chip.id ? 'chip-active' : ''}`}
                      onClick={() => handleScenarioClick(chip.id)}
                    >
                      {chip.icon} {chip.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="msg-row bot">
            <div className="msg-avatar">🩺</div>
            <div className="msg-bubble bot">
              <div className="typing-dots"><span /><span /><span /></div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Active scenario - Fixed Context Box */}
      {scenario !== 'none' && scenario !== 'health_queries' && scenario !== 'dashboard' && scenario !== 'login' && (
        <div className="fixed-scenario-box">
          <span className="fixed-context-label">
            {SCENARIO_CHIPS.find(c => c.id === scenario)?.icon} {SCENARIO_CHIPS.find(c => c.id === scenario)?.label}
          </span>
        </div>
      )}

      <div className="input-bar">
        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept=".txt,.pdf,.csv,.json,.xml,.doc,.docx,.png,.jpg,.jpeg"
          onChange={handleFileChange}
        />

        {/* Attach */}
        <button
          className="icon-btn"
          title="Upload medical report / prescription"
          onClick={() => fileInputRef.current?.click()}
        >
          📎
        </button>

        <textarea
          className="chat-textarea"
          rows={1}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={listening ? '🎤 Listening…' : 'Type a message, or upload a document…'}
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
          onClick={handleSend}
          disabled={!input.trim() && !loading}
          title="Send"
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
        
        alert("Clinical Record Success: Your account has been created in AIHealthChatBot database.");
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
            <h1>AIHealthChatBot</h1>
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
              {isRegistering && (
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
              <button type="submit" disabled={!selectedRole} className="auth-submit-btn">
                {isRegistering ? 'Register' : 'Login'}
              </button>
            </form>

            <div className="auth-toggle">
              {isRegistering ? (
                <p>Already have an account? <button onClick={() => setIsRegistering(false)}>Login now</button></p>
              ) : selectedRole === 'patient' ? (
                <p>Don't have an account? <button onClick={() => setIsRegistering(true)}>Register for free</button></p>
              ) : selectedRole === 'doctor' ? (
                <p className="auth-note">Clinical staff can only login with hospital credentials.</p>
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
  onSuggestMedicine: (p: Prescription) => void,
  doctorName?: string
}> = ({ appointments, onSuggestMedicine, doctorName }) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'confirmed' | 'completed' | 'history'>('pending');
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  
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
    });
    
    setMedicine(''); setDosage(''); setTiming('');
    setShowForm(false);
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
            <p>Patient ID: PID-8821 • John.D@example.com</p>
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
                <button className="action-btn-main" onClick={() => setSelectedPatient(app.patientName)}>View Records</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ─── Patient Records (Detail View) ────────────────────────
const PatientRecords: React.FC<{ appointments: UserAppointment[] }> = ({ appointments }) => (
  <div className="records-detail">
    <div className="records-header">
      <h2>My Medical Records & History</h2>
      <p>Comprehensive health data and clinical insights</p>
    </div>

    <div className="records-grid">
      {/* Active Health Issues Card */}
      <div className="record-card issues">
        <h3>Active Health Issues</h3>
        <p className="empty-msg-small">No chronic conditions recorded.</p>
      </div>

      {/* My Appointments Detail */}
      <div className="record-card appts">
        <h3>Scheduled Appointments</h3>
        {appointments.length === 0 ? (
          <p className="empty-msg">No upcoming appointments.</p>
        ) : (
          <>
            <div className="appt-list-header">
              <div className="appt-date-box"><span>Date</span></div>
              <div className="appt-info-box">
                <span className="appt-doc-header">Attending Doctor</span>
                <span className="appt-status-header">Status</span>
              </div>
            </div>
            <div className="app-rows">
              {appointments.map(a => (
                <div key={a.id} className="app-detail-row">
                  <div className="appt-date-box">
                    <span className="appt-date-text">{a.date}</span>
                  </div>
                  <div className="appt-info-box">
                    <span className="appt-doc-name">{a.doctorName}</span>
                    <span className="appt-status-tag">{a.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  </div>
);

// ─── Medication View ──────────────────────────────────────
const MedicationView: React.FC<{ prescriptions: Prescription[] }> = ({ prescriptions }) => (
  <div className="medication-detail">
    <div className="meds-header">
      <h2>Prescriptions & Medications</h2>
      <p>Active treatment plan and dosage instructions</p>
    </div>

    <div className="meds-list">
      {prescriptions.length === 0 ? (
        <div className="empty-state">No active prescriptions.</div>
      ) : (
        prescriptions.map(p => (
          <div key={p.id} className={`med-card ${p.status}`}>
            <div className="med-card-side">{p.status === 'active' ? '💊' : '💉'}</div>
            <div className="med-info">
              <div className="med-top">
                <h3>{p.medicineName}</h3>
                <span className={`med-badge ${p.status}`}>{p.status}</span>
              </div>
              <p className="med-desc">{p.dosage} - {p.timing}</p>
              <div className="med-schedule">
                <span className="sched-pill last">✅ {p.date}</span>
              </div>
              <div className="med-doctor">{p.doctorName}</div>
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);

// ─── Doctor Home (Overall Dashboard) ──────────────────────
const DoctorOverallDashboard: React.FC<{ 
  appointments: UserAppointment[] 
}> = ({ appointments }) => (
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

    <div className="medical-history">
      <h3>Quick Actions</h3>
      <div className="app-list" style={{ marginTop: '1rem' }}>
        <p style={{ color: '#64748B', fontSize: '0.9rem' }}>Recent system activity and doctor alerts will appear here.</p>
        <div className="history-item" style={{ marginTop: '1rem' }}>
           <span className="h-date">Alert</span>
           <p>System update scheduled for maintenance tonight at 12:00 AM.</p>
        </div>
      </div>
    </div>
  </div>
);

// ─── Root App ─────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState<'patient' | 'doctor'>('patient');
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [scenario, setScenario] = useState<Scenario>('login');
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  // Database Persistence Logic
  useEffect(() => {
    if (currentUser) {
      const fetchData = async () => {
        try {
          const appRes = await axios.get(`${API_URL}/appointments/${currentUser.email}?role=${currentUser.role}&name=${currentUser.name}`);
          setAppointments(appRes.data);

          const presRes = await axios.get(`${API_URL}/prescriptions/${currentUser.email}`);
          setPrescriptions(presRes.data);
        } catch (err) {
          console.error("Error fetching data from MongoDB:", err);
        }
      };
      fetchData();
    }
  }, [currentUser]);

  const addAppointment = async (app: UserAppointment) => {
    try {
      const res = await axios.post(`${API_URL}/appointments`, { 
        ...app, 
        patientEmail: currentUser?.email,
        patientName: currentUser?.name || 'Unknown' 
      });
      setAppointments(prev => [res.data, ...prev]);
    } catch (err) {
      console.error("Failed to book appointment:", err);
    }
  };

  const addPrescription = async (pres: Prescription) => {
    try {
      const res = await axios.post(`${API_URL}/prescriptions`, {
        ...pres,
        patientEmail: pres.patientName === currentUser?.name ? currentUser?.email : 'patient@example.com'
      });
      setPrescriptions(prev => [res.data, ...prev]);
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
    return true;
  });

  if (scenario === 'login') return <LoginPage onLogin={(user) => { 
    localStorage.setItem('mediSync_session', JSON.stringify(user));
    setCurrentUser(user); 
    setView(user.role); 
    setScenario('none'); 
  }} />;

  const activeLabel = getNavLabel(scenario) || 'General Chat';

  return (
    <div className="app">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <span className="brand-icon">⚕️</span>
          <span className="brand-name">AIHealthChatBot</span>
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
          {filteredNavItems.map(n => (
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
          ))}
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
            {view === 'doctor' ? '👨‍⚕️ Doctor Treatment Portal' : `${NAV_ITEMS.find(n => n.id === scenario)?.icon || '💬'} ${activeLabel}`}
          </div>
          <div className="topbar-right">
             <div className="user-pill">
              <span className="user-name">
                {currentUser?.name || (view === 'doctor' ? 'Medical Professional' : 'Patient User')}
              </span>
              <div className="user-ava">
                {currentUser?.name.charAt(0) || (view === 'doctor' ? 'D' : 'P')}
              </div>
            </div>
          </div>
        </header>

        <main className="content-scroll">
          {view === 'doctor' && scenario === 'none' ? (
            <DoctorOverallDashboard 
              appointments={appointments.filter(a => a.doctorName === currentUser?.name)} 
            />
          ) : view === 'doctor' && scenario === 'appointments' ? (
            <DoctorDashboard 
              appointments={appointments.filter(a => a.doctorName === currentUser?.name)} 
              doctorName={currentUser?.name}
              onSuggestMedicine={(p) => addPrescription({...p, doctorName: currentUser?.name || 'Attending Physician'})} 
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
            <Dashboard />
          ) : (
            <Chat 
              scenario={scenario} 
              setScenario={setScenario} 
              addAppointment={addAppointment} 
              currentUser={currentUser}
              appointments={appointments}
              prescriptions={prescriptions}
            />
          )}
        </main>
      </div>
    </div>
  );
}
