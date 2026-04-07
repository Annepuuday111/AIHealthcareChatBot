import React from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, Legend
} from 'recharts';
import { Activity, Users, ShieldAlert, CheckCircle2 } from 'lucide-react';

const visitData = [
  { name: 'Mon', visits: 400, emergency: 24 },
  { name: 'Tue', visits: 300, emergency: 13 },
  { name: 'Wed', visits: 550, emergency: 45 },
  { name: 'Thu', visits: 200, emergency: 56 },
  { name: 'Fri', visits: 278, emergency: 39 },
  { name: 'Sat', visits: 189, emergency: 48 },
  { name: 'Sun', visits: 239, emergency: 38 },
];

const adherenceData = [
  { name: 'Cardiac', value: 85 },
  { name: 'Diabetes', value: 72 },
  { name: 'Hypertension', value: 90 },
  { name: 'Asthma', value: 65 },
];

const Dashboard: React.FC = () => {
  return (
    <div className="dashboard-view animate-slide-up">
      <div className="dashboard-header">
        <h2>Hospital Insights Dashboard</h2>
        <p>Overview of patient statistics, appointments, and general analytics.</p>
      </div>

      <div className="dashboard-grid">
        <div className="stat-card glass">
          <div className="stat-icon"><Users size={24} /></div>
          <div className="stat-content">
            <h3>Total Patients</h3>
            <div className="value">2,845</div>
          </div>
        </div>
        
        <div className="stat-card glass">
          <div className="stat-icon"><Activity size={24} /></div>
          <div className="stat-content">
            <h3>Active Cases</h3>
            <div className="value">412</div>
          </div>
        </div>
        
        <div className="stat-card glass">
          <div className="stat-icon"><ShieldAlert size={24} /></div>
          <div className="stat-content">
            <h3>Critical Alerts</h3>
            <div className="value" style={{ color: 'var(--danger)' }}>18</div>
          </div>
        </div>

        <div className="stat-card glass">
          <div className="stat-icon"><CheckCircle2 size={24} /></div>
          <div className="stat-content">
            <h3>Appointments Today</h3>
            <div className="value">156</div>
          </div>
        </div>

        <div className="chart-card glass">
          <h3>Patient Visits & Emergencies (Weekly)</h3>
          <div className="insights-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={visitData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748B'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B'}} />
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend />
                <Line type="monotone" dataKey="visits" name="Total Visits" stroke="#0066FF" strokeWidth={3} dot={{r:4}} activeDot={{r: 6}} />
                <Line type="monotone" dataKey="emergency" name="Emergencies" stroke="#EF4444" strokeWidth={3} dot={{r:4}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-card glass">
          <h3>Medication Adherence by Condition</h3>
          <div className="insights-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={adherenceData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E2E8F0" />
                <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={{fill: '#64748B'}} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#0F172A', fontWeight: 500}} />
                <RechartsTooltip 
                  cursor={{fill: '#F1F5F9'}}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" name="Adherence %" fill="#10B981" radius={[0, 4, 4, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
