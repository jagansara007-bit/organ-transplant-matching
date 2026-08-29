import React, { useState, useEffect } from 'react';
import { Recipient } from '../types';
import { UserPlus, Clock, ShieldAlert, Heart, Droplet } from 'lucide-react';

interface RecipientFormProps {
  onNotification: (msg: string, type: 'success' | 'error') => void;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const RecipientForm: React.FC<RecipientFormProps> = ({ onNotification }) => {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Form State
  const [fullName, setFullName] = useState('');
  const [bloodType, setBloodType] = useState('O+');
  const [organNeeded, setOrganNeeded] = useState('Kidney');
  const [urgencyLevel, setUrgencyLevel] = useState<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('HIGH');
  const [waitTimeDays, setWaitTimeDays] = useState<number>(120);

  const fetchRecipients = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/recipients`);
      if (res.ok) {
        const data = await res.json();
        setRecipients(data.recipients || []);
      }
    } catch (err) {
      console.error('Failed to fetch recipients:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipients();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      onNotification('Full name is required', 'error');
      return;
    }
    if (waitTimeDays < 0) {
      onNotification('Wait time cannot be negative', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/recipients/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          bloodType,
          organNeeded,
          urgencyLevel,
          waitTimeDays: Number(waitTimeDays)
        })
      });

      const data = await res.json();
      if (res.ok && data.status === 'success') {
        onNotification(`Recipient ${fullName} added to waitlist!`, 'success');
        setFullName('');
        setWaitTimeDays(0);
        fetchRecipients();
      } else {
        onNotification(data.message || 'Failed to register recipient', 'error');
      }
    } catch (err) {
      onNotification('Network error registering recipient', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getUrgencyBadge = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return <span className="badge badge-danger"><ShieldAlert size={12} /> Critical</span>;
      case 'HIGH':
        return <span className="badge badge-warning">High Priority</span>;
      case 'MEDIUM':
        return <span className="badge badge-success">Medium</span>;
      case 'LOW':
      default:
        return <span className="badge" style={{ background: 'rgba(255,255,255,0.08)' }}>Standard</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Registration Card */}
      <div className="glass-card">
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <UserPlus style={{ color: 'var(--accent-rose)' }} size={22} /> Recipient Waitlist Entry
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.2rem', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
              Full Name *
            </label>
            <input 
              type="text" 
              placeholder="e.g. Maria Santos"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              style={{
                width: '100%',
                padding: '0.65rem 0.9rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'rgba(0, 0, 0, 0.25)',
                color: '#fff',
                outline: 'none'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
              Blood Type *
            </label>
            <select
              value={bloodType}
              onChange={(e) => setBloodType(e.target.value)}
              style={{
                width: '100%',
                padding: '0.65rem 0.9rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'rgba(15, 23, 42, 0.95)',
                color: '#fff',
                outline: 'none'
              }}
            >
              {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(bt => (
                <option key={bt} value={bt}>{bt}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
              Organ Needed *
            </label>
            <select
              value={organNeeded}
              onChange={(e) => setOrganNeeded(e.target.value)}
              style={{
                width: '100%',
                padding: '0.65rem 0.9rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'rgba(15, 23, 42, 0.95)',
                color: '#fff',
                outline: 'none'
              }}
            >
              {['Kidney', 'Liver', 'Heart', 'Lung', 'Pancreas'].map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
              Urgency Level *
            </label>
            <select
              value={urgencyLevel}
              onChange={(e) => setUrgencyLevel(e.target.value as any)}
              style={{
                width: '100%',
                padding: '0.65rem 0.9rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'rgba(15, 23, 42, 0.95)',
                color: '#fff',
                outline: 'none'
              }}
            >
              <option value="CRITICAL">CRITICAL</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
              Wait Time (Days)
            </label>
            <input 
              type="number" 
              value={waitTimeDays}
              onChange={(e) => setWaitTimeDays(parseInt(e.target.value || '0', 10))}
              style={{
                width: '100%',
                padding: '0.65rem 0.9rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'rgba(0, 0, 0, 0.25)',
                color: '#fff',
                outline: 'none'
              }}
            />
          </div>

          <div>
            <button className="btn" type="submit" disabled={submitting} style={{ width: '100%', justifyContent: 'center' }}>
              {submitting ? 'Registering...' : 'Add to Waitlist'}
            </button>
          </div>
        </form>
      </div>

      {/* Live Recipients Table Card */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock style={{ color: 'var(--accent-cyan)' }} size={20} /> Active Waitlist Candidates ({recipients.length})
          </h3>
          <button className="btn" onClick={fetchRecipients} disabled={loading} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
            {loading ? 'Refreshing...' : 'Refresh List'}
          </button>
        </div>

        {recipients.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No recipients on waitlist.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem' }}>ID</th>
                  <th style={{ padding: '0.75rem' }}>Recipient Name</th>
                  <th style={{ padding: '0.75rem' }}>Blood Group</th>
                  <th style={{ padding: '0.75rem' }}>Organ Needed</th>
                  <th style={{ padding: '0.75rem' }}>Urgency Level</th>
                  <th style={{ padding: '0.75rem' }}>Wait Time</th>
                  <th style={{ padding: '0.75rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
                      {r.id.slice(0, 8)}...
                    </td>
                    <td style={{ padding: '0.75rem', fontWeight: 500 }}>{r.full_name}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span className="badge" style={{ background: 'rgba(255,255,255,0.08)', color: '#fff' }}>
                        <Droplet size={12} style={{ color: 'var(--accent-rose)' }} /> {r.blood_type}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <span className="badge badge-warning">
                        <Heart size={12} /> {r.organ_needed}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      {getUrgencyBadge(r.urgency_level)}
                    </td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>
                      {r.wait_time_days} days
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <span className="badge" style={{ background: r.status === 'matched' ? 'rgba(52, 211, 153, 0.2)' : 'rgba(255,255,255,0.08)', color: r.status === 'matched' ? '#34d399' : 'var(--text-muted)' }}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
