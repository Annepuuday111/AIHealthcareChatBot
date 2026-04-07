import React from 'react';
import { 
  Stethoscope, 
  UserRound, 
  Calendar, 
  Pill, 
  BarChart3,
  MessageSquare
} from 'lucide-react';

interface SidebarProps {
  scenario: string;
  setScenario: (scenario: string) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const scenarios = [
  { id: 'records', icon: <UserRound size={18} />, label: 'Patient Records' },
  { id: 'symptoms', icon: <Stethoscope size={18} />, label: 'Symptom Analysis' },
  { id: 'appointments', icon: <Calendar size={18} />, label: 'Appointments' },
  { id: 'medication', icon: <Pill size={18} />, label: 'Medications' },
];

const Sidebar: React.FC<SidebarProps> = ({ scenario, setScenario, isOpen, setIsOpen }) => {
  return (
    <>
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="avatar">Medi</div>
          <h1>MediSync AI</h1>
        </div>
        
        <div className="sidebar-content">
          <div className="nav-section">
            <div className="nav-section-title">Views</div>
            <button 
              className={`nav-item ${scenario === 'general' ? 'active' : ''}`}
              onClick={() => { setScenario('general'); setIsOpen(false); }}
            >
              <div className="icon"><MessageSquare size={18} /></div>
              General Chat
            </button>
            <button 
              className={`nav-item ${scenario === 'dashboard' ? 'active' : ''}`}
              onClick={() => { setScenario('dashboard'); setIsOpen(false); }}
            >
              <div className="icon"><BarChart3 size={18} /></div>
              Insights Dashboard
            </button>
          </div>

          <div className="nav-section">
            <div className="nav-section-title">Specialized Scenarios</div>
            {scenarios.map((item) => (
              <button
                key={item.id}
                className={`nav-item ${scenario === item.id ? 'active' : ''}`}
                onClick={() => { setScenario(item.id); setIsOpen(false); }}
              >
                <div className="icon">{item.icon}</div>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </aside>
      
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 5 }}
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

export default Sidebar;
