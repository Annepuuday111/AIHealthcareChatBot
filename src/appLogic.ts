import type { Message, InsightData } from './types';
import { API_URL } from './config';

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

  try {
    const response = await fetch(`${API_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: content, scenario }),
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const data = await response.json();
    botMessage.content = data.reply || "I'm sorry, I couldn't understand that.";
  } catch (error) {
    console.error("Error communicating with backend:", error);
    botMessage.content = "I'm sorry, I am having trouble connecting to the server. Please try again later.";
  }

  return botMessage;
};
