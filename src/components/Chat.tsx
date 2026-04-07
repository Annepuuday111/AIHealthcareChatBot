import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Paperclip, Bot, User } from 'lucide-react';
import { Message, InsightData } from '../types';
import { processUserMessage } from '../appLogic';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer 
} from 'recharts';

interface ChatProps {
  scenario: string;
}

const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;

if (recognition) {
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';
}

const InsightRenderer: React.FC<{ data: InsightData }> = ({ data }) => {
  return (
    <div className="insights-card animate-slide-up">
      <h4 style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem' }}>{data.title}</h4>
      <div className="insights-chart">
        <ResponsiveContainer width="100%" height="100%">
          {data.type === 'line' ? (
            <LineChart data={data.data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis fontSize={12} tickLine={false} axisLine={false} />
              <RechartsTooltip />
              <Line type="monotone" dataKey="value" stroke="#0066FF" strokeWidth={2} dot={{r:3}} />
              {data.data[0]?.uv !== undefined && <Line type="monotone" dataKey="uv" stroke="#10B981" strokeWidth={2} dot={{r:3}} />}
            </LineChart>
          ) : (
            <BarChart data={data.data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis fontSize={12} tickLine={false} axisLine={false} />
              <RechartsTooltip />
              <Bar dataKey="value" fill="#4F46E5" radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const Chat: React.FC<ChatProps> = ({ scenario }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'bot',
      content: `Welcome to MediSync AI. I am your healthcare assistant. You are currently in the ${scenario} view. How can I help you today?`
    }
  ]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Reset welcome message on scenario change
    setMessages([{
      id: Date.now().toString(),
      type: 'bot',
      content: `Switched to ${scenario} view. How can I assist you with this?`
    }]);
  }, [scenario]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (!recognition) return;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => prev + ' ' + transcript);
      setIsRecording(false);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };
  }, []);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input.trim()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    const botMsg = await processUserMessage(userMsg.content, scenario);
    
    setIsTyping(false);
    setMessages(prev => [...prev, botMsg]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleRecording = () => {
    if (!recognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    if (isRecording) {
      recognition.stop();
      setIsRecording(false);
    } else {
      try {
        recognition.start();
        setIsRecording(true);
      } catch (e) {
        console.error(e);
      }
    }
  };

  return (
    <div className="chat-container">
      <div className="messages-area">
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.type} animate-slide-up`}>
            <div className="message-avatar">
              {msg.type === 'bot' ? <Bot size={20} /> : <User size={20} />}
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: msg.type === 'user' ? 'flex-end' : 'flex-start' }}>
               <div className={`message-bubble ${msg.isDataInsight ? 'glass' : ''}`}>
                 {msg.content}
               </div>
               {msg.isDataInsight && msg.insightData && (
                 <InsightRenderer data={msg.insightData} />
               )}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="message bot animate-slide-up">
            <div className="message-avatar"><Bot size={20} /></div>
            <div className="message-bubble typing-indicator">
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        <div className="input-container">
          <button className="action-btn">
            <Paperclip size={20} />
          </button>
          
          <textarea
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message or use voice input..."
            rows={1}
          />
          
          <div className="input-actions">
            <button 
              className={`action-btn ${isRecording ? 'recording' : ''}`} 
              onClick={toggleRecording}
              title="Voice Input"
            >
              {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
            <button className="action-btn send-btn" onClick={handleSend} disabled={!input.trim()}>
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
