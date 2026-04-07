import { Message, InsightData } from './types';

// Mock data generator for insights
const generateVitalsData = (): InsightData => ({
  title: 'Patient Vitals (Last 7 Days)',
  type: 'line',
  data: [
    { name: 'Mon', value: 120, uv: 80 },
    { name: 'Tue', value: 118, uv: 79 },
    { name: 'Wed', value: 122, uv: 82 },
    { name: 'Thu', value: 119, uv: 80 },
    { name: 'Fri', value: 125, uv: 85 },
    { name: 'Sat', value: 121, uv: 81 },
    { name: 'Sun', value: 118, uv: 78 }
  ]
});

const generateAdherenceData = (): InsightData => ({
  title: 'Medication Adherence',
  type: 'bar',
  data: [
    { name: 'Week 1', value: 95 },
    { name: 'Week 2', value: 90 },
    { name: 'Week 3', value: 100 },
    { name: 'Week 4', value: 85 }
  ]
});

export const processUserMessage = async (content: string, scenario: string): Promise<Message> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

  const lowerContent = content.toLowerCase();
  
  const botMessage: Message = {
    id: Date.now().toString(),
    type: 'bot',
    content: ''
  };

  // Determine response based on keywords and scenario
  if (lowerContent.includes('insight') || lowerContent.includes('chart') || lowerContent.includes('graph') || lowerContent.includes('data')) {
    botMessage.content = "Here are the data insights you requested based on the current context.";
    botMessage.isDataInsight = true;
    botMessage.insightData = lowerContent.includes('medication') ? generateAdherenceData() : generateVitalsData();
    return botMessage;
  }

  switch (scenario) {
    case 'records':
      if (lowerContent.includes('history') || lowerContent.includes('record')) {
        botMessage.content = "Patient John Doe has a history of mild hypertension and type 2 diabetes. Last HbA1c was 6.8%. No known allergies. Would you like to see recent lab results or vitals data?";
      } else {
        botMessage.content = "I can help you retrieve patient records, check medical histories, or analyze past lab results. What specifically are you looking for?";
      }
      break;

    case 'symptoms':
      if (lowerContent.includes('headache') || lowerContent.includes('fever')) {
        botMessage.content = "Based on the symptoms of headache and fever, this could indicate a viral infection, migraine, or sinus issue. Please advise the patient to stay hydrated and monitor their temperature. If it exceeds 103°F or lasts more than 3 days, an urgent consultation is recommended.";
      } else {
        botMessage.content = "Please describe the symptoms in detail. I can provide a preliminary assessment and suggest whether urgent care is needed.";
      }
      break;

    case 'appointments':
      if (lowerContent.includes('schedule') || lowerContent.includes('book')) {
        botMessage.content = "I have scheduled an appointment with Dr. Smith for next Tuesday at 10:00 AM. I have also set up an SMS reminder for the patient 24 hours prior.";
      } else if (lowerContent.includes('cancel')) {
        botMessage.content = "The appointment has been successfully canceled. Would you like to reschedule?";
      } else {
        botMessage.content = "I can help schedule, reschedule, or cancel patient appointments. You can also ask me to set up reminders.";
      }
      break;

    case 'medication':
      if (lowerContent.includes('reminder') || lowerContent.includes('alert')) {
        botMessage.content = "Medication alert set: Metformin 500mg twice daily with meals. I will notify the patient via the mobile app.";
      } else {
        botMessage.content = "I can track prescriptions, check drug interactions, or set up medication alerts. How can I assist you with medications today?";
      }
      break;

    default:
      botMessage.content = "I am your AI Healthcare Assistant. Please select a specific scenario from the sidebar to get customized assistance.";
  }

  return botMessage;
};
