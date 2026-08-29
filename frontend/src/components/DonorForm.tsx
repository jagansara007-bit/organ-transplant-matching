import React, { useState, useEffect } from 'react';
import { Donor } from '../types';
import { UserPlus, UserCheck, Heart, Dna, Droplet } from 'lucide-react';

interface DonorFormProps {
  onNotification: (msg: string, type: 'success' | 'error') => void;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const DonorForm: React.FC<DonorFormProps> = ({ onNotification }) => {
  const [donors, setDonors] = useState<Donor[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Form State
  const [fullName, setFullName] = useState('');
  const [bloodType, setBloodType] = useState('O+');
  const [organType, setOrganType] = useState('Kidney');
  const [tissueType, setTissueType] = useState('HLA-A2, HLA-B7, HLA-DR4');

  const fetchDonors = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/donors`);
      if (res.ok) {
        const data = await res.json();
        setDonors(data.donors || []);
      }
    } catch (err) {
      console.error('Failed to fetch donors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDonors();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      onNotification('Full name is required', 'error');
      return;
    }
    if (!tissueType.trim()) {
      onNotification('Tissue type HLA markers are required', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/donors/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, bloodType, organType, tissueType })
      });

      const data = await res.json();
      if (res.ok && data.status === 'success') {
        onNotification(`Donor ${fullName} registered successfully!`, 'success');
        setFullName('');
        fetchDonors();
      } else {
        onNotification(data.message || 'Failed to register donor', 'error');
      }
    } catch (err) {
      onNotification('Network error registering donor', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Registration Card */}
      <div className="glass-card">
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <UserPlus style={{ color: 'var(--accent-cyan)' }} size={22} /> Donor Registration Portal
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.2rem', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
              Full Name *
            </label>
            <input 
              type="text" 
              placeholder="e.g. Dr. Alex Vance"
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
              Organ Type *
            </label>
            <select
              value={organType}
              onChange={(e) => setOrganType(e.target.value)}
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
              Tissue Type (HLA Antigens) *
            </label>
            <input 
              type="text" 
              placeholder="e.g. HLA-A2, HLA-B7, HLA-DR4"
              value={tissueType}
              onChange={(e) => setTissueType(e.target.value)}
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
              {submitting ? 'Registering...' : 'Register Donor'}
            </button>
          </div>
        </form>
      </div>

      {/* Live Donor Table Card */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <UserCheck style={{ color: 'var(--accent-teal)' }} size={20} /> Registered Donors Registry ({donors.length})
          </h3>
          <button className="btn" onClick={fetchDonors} disabled={loading} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
            {loading ? 'Refreshing...' : 'Refresh List'}
          </button>
        </div>

        {donors.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No donors registered yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem' }}>ID</th>
                  <th style={{ padding: '0.75rem' }}>Full Name</th>
                  <th style={{ padding: '0.75rem' }}>Blood Group</th>
                  <th style={{ padding: '0.75rem' }}>Organ</th>
                  <th style={{ padding: '0.75rem' }}>HLA Antigens</th>
                  <th style={{ padding: '0.75rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {donors.map(donor => (
                  <tr key={donor.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
                      {donor.id.slice(0, 8)}...
                    </td>
                    <td style={{ padding: '0.75rem', fontWeight: 500 }}>{donor.full_name}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span className="badge" style={{ background: 'rgba(255,255,255,0.08)', color: '#fff' }}>
                        <Droplet size={12} style={{ color: 'var(--accent-rose)' }} /> {donor.blood_type}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <span className="badge badge-success">
                        <Heart size={12} /> {donor.organ_type}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      <Dna size={12} style={{ display: 'inline', marginRight: '4px' }} /> {donor.tissue_type}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <span className="badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: 'var(--accent-cyan)' }}>
                        {donor.registration_status}
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
