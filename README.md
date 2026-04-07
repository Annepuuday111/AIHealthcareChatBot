# AIHealthcareChatBot 🩺

**AIHealthcareChatBot** is a premium, full-stack healthcare ecosystem designed to bridge the gap between patients and clinical providers using a high-precision AI diagnostic engine, real-time health analytics, and seamless appointment management.

---

## 🚀 Live Demo & Deployment
- **Frontend**: [Deployed on Vercel](https://ai-healthcare-chat-bot-annepu-uday-kumars-projects.vercel.app)
- **Backend**: [Deployed on Render](https://aihealthcarechatbot.onrender.com)
- **Database**: [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)

---

## ✨ Key Features & Modules

### 1. 🧬 AI Diagnostic & Symptom Analysis
- **Keyword-Driven Intelligence**: Analyzes patient symptoms (e.g., headache, fever, chest pain) to provide preliminary clinical assessments.
- **Media-Aware Diagnostics**: Supports uploading medical reports (PDF/JPG/PNG). The AI validates the content and extracts medical context (e.g., HbA1c levels for Diabetes, BP for Hypertension).
- **Specialist Matching**: Automatically matches patients with the correct department (Cardiologist, Neurologist, etc.) based on symptoms or report data.

### 2. 📅 Clinical Appointment Ecosystem
- **Smart Scheduling**: Real-time booking with specialized doctors.
- **Role-Based Portals**: Dedicated views for **Patients** (to book and view history) and **Doctors** (to manage their clinical queue).
- **Auto-Sync**: Appointments are immediately synced to the "My Records" timeline and backend database.

### 3. 📊 Real-time Health Insights (Dashboard)
- **Visual Analytics**: Interactive charts using **Recharts** showing:
  - Systolic/Diastolic Blood Pressure trends.
  - Medication Adherence percentages.
  - Hospital Visit vs. Emergency frequency analytics.
- **Data-Driven Suggestions**: Proactive dietary and exercise advice based on clinical vitals.

### 4. 💊 Medication & Prescription Management
- **Prescription Tracking**: View active medicines, dosages, and timings.
- **Smart Reminders**: Automated alerts for doses (Metformin, Lisinopril, etc.).
- **Interaction Safety**: Built-in logic to check for common drug-to-drug interactions.

---

## 🛠️ Technical Stack (Versions)

### Frontend (Modern Web Core)
- **React 19**: Utilizing the latest concurrent rendering and performance hooks.
- **Vite 5**: Next-generation lightning-fast frontend tooling.
- **TypeScript 6**: Strict typing for clinical data integrity.
- **Recharts 2.12**: For high-performance, responsive SVG charts.
- **Lucide React 0.46**: For a sleek, professional medical iconography system.

### Backend (Robust Server Logic)
- **Node.js 22**: High-performance runtime for asynchronous health data processing.
- **Express 5**: Lightweight and fast web framework for the API layer.
- **Mongoose 9**: ODM for MongoDB with strict schema validation for patient records.
- **CORS 2.8**: Secure cross-origin resource sharing between Vercel and Render.
- **Dotenv 17.4**: Environment security for Atlas connection strings.

### Database
- **MongoDB Atlas**: Cloud-hosted NoSQL database for scalable, high-availability medical data storage.

---

## 🔧 Installation & Local Setup

### 1. Prerequisites
- Node.js (v20+ recommended)
- npm or yarn

### 2. Clone the Repository
```bash
git clone https://github.com/Annepuuday111/AIHealthcareChatBot.git
cd AIHealthcareChatBot
```

### 3. Frontend Setup
```bash
npm install
npm run dev
```

### 4. Backend Setup
```bash
cd backend
npm install
# Ensure you have a .env file with your MONGODB_URI
node server.js
```

---

## 🛠️ Deployment Configuration

### Frontend (Vercel)
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Environment Variable**: `VITE_API_URL` (Point this to your live Render API URL)

### Backend (Render)
- **Root Directory**: `backend`
- **Build Command**: `npm install`
- **Start Command**: `node server.js`
- **Environment Variable**: `MONGODB_URI` (Your Atlas connection string)

---

## 👨‍💻 Developed By
**Annepu Uday Kumar**  
*Building the future of digital health.*

---
> **Disclaimer**: This tool is an AI assistant and should be used for informational purposes only. Always consult a qualified medical professional for health concerns.
