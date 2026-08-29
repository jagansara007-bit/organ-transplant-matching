import React, { useState, useEffect } from 'react';
import { Donor, Recipient } from '../types';
import { apiClient } from '../services/apiClient';

interface RegistryViewProps {
  onNotification: (msg: string, type: 'success' | 'error') => void;
}

export const RegistryView: React.FC<RegistryViewProps> = ({ onNotification }) => {
  const [donors, setDonors] = useState<Donor[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrganFilter, setSelectedOrganFilter] = useState('ALL');
  const [selectedBloodFilter, setSelectedBloodFilter] = useState('ALL');

  // New Entry Drawer State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [entryType, setEntryType] = useState<'candidate' | 'donor'>('candidate');

  // Candidate Form
  const [recipientName, setRecipientName] = useState('');
  const [recipientBlood, setRecipientBlood] = useState('O+');
  const [recipientOrgan, setRecipientOrgan] = useState('Kidney');
  const [recipientUrgency, setRecipientUrgency] = useState<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('CRITICAL');
  const [recipientWaitDays, setRecipientWaitDays] = useState(180);
  const [recipientNottoReg, setRecipientNottoReg] = useState('');
  const [submittingCandidate, setSubmittingCandidate] = useState(false);

  // Donor Form
  const [donorName, setDonorName] = useState('');
  const [donorBlood, setDonorBlood] = useState('O+');
  const [donorOrgan, setDonorOrgan] = useState('Kidney');
  const [donorTissue, setDonorTissue] = useState('HLA-A2, HLA-B44, HLA-DR4');
  const [donorType, setDonorType] = useState<'DECEASED' | 'LIVING_FAMILY'>('DECEASED');
  const [donorAadhaar, setDonorAadhaar] = useState('');
  const [submittingDonor, setSubmittingDonor] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [donorsRes, recipientsRes] = await Promise.all([
        apiClient.get<{ donors: Donor[] }>('/donors'),
        apiClient.get<{ recipients: Recipient[] }>('/recipients')
      ]);

      if (donorsRes.ok && donorsRes.data) {
        setDonors(donorsRes.data.donors || []);
      }
      if (recipientsRes.ok && recipientsRes.data) {
        setRecipients(recipientsRes.data.recipients || []);
      }
    } catch (err) {
      console.error('Failed to fetch registry data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRegisterDonor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!donorName.trim()) {
      onNotification('Donor full name is required', 'error');
      return;
    }

    setSubmittingDonor(true);
    try {
      const res = await apiClient.post('/donors', {
        fullName: donorName,
        bloodType: donorBlood,
        organType: donorOrgan,
        tissueType: donorTissue,
        donorType,
        maskedAadhaar: donorAadhaar || 'XXXX-XXXX-' + Math.floor(1000 + Math.random() * 9000)
      });

      if (res.ok) {
        onNotification(`Donor ${donorName} registered into NOTTO database successfully!`, 'success');
        setDonorName('');
        setDonorAadhaar('');
        setDrawerOpen(false);
        fetchData();
      } else {
        onNotification((res.data as any)?.message || 'Failed to register donor', 'error');
      }
    } catch (err) {
      onNotification('Network error registering donor', 'error');
    } finally {
      setSubmittingDonor(false);
    }
  };

  const handleRegisterRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName.trim()) {
      onNotification('Recipient candidate name is required', 'error');
      return;
    }

    setSubmittingCandidate(true);
    try {
      const res = await apiClient.post('/recipients', {
        fullName: recipientName,
        bloodType: recipientBlood,
        organNeeded: recipientOrgan,
        urgencyLevel: recipientUrgency,
        waitTimeDays: Number(recipientWaitDays) || 0,
        nottoRegNumber: recipientNottoReg || `NOTTO-REC-2026-${Math.floor(100 + Math.random() * 900)}`
      });

      if (res.ok) {
        onNotification(`Candidate ${recipientName} enrolled into NOTTO waitlist successfully!`, 'success');
        setRecipientName('');
        setRecipientNottoReg('');
        setDrawerOpen(false);
        fetchData();
      } else {
        onNotification((res.data as any)?.message || 'Failed to register recipient', 'error');
      }
    } catch (err) {
      onNotification('Network error enrolling candidate', 'error');
    } finally {
      setSubmittingCandidate(false);
    }
  };

  const filteredRecipients = recipients.filter(r => {
    const matchesSearch = searchQuery === '' || 
      r.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.notto_reg_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.blood_type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesOrgan = selectedOrganFilter === 'ALL' || r.organ_needed.toLowerCase() === selectedOrganFilter.toLowerCase();
    const matchesBlood = selectedBloodFilter === 'ALL' || r.blood_type === selectedBloodFilter;
    return matchesSearch && matchesOrgan && matchesBlood;
  });

  const filteredDonors = donors.filter(d => {
    const matchesSearch = searchQuery === '' || 
      d.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.masked_aadhaar?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.blood_type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesOrgan = selectedOrganFilter === 'ALL' || d.organ_type.toLowerCase() === selectedOrganFilter.toLowerCase();
    const matchesBlood = selectedBloodFilter === 'ALL' || d.blood_type === selectedBloodFilter;
    return matchesSearch && matchesOrgan && matchesBlood;
  });

  return (
    <div className="space-y-lg animate-fadeIn relative">
      {/* Page Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="font-headline-lg text-headline-lg font-bold text-on-background">
            Clinical Registry
          </h2>
          <p className="font-body-md text-body-md text-outline mt-1 max-w-2xl">
            Manage verified organ donors and waitlisted candidates across the Indian NOTTO regional network.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm">
              search
            </span>
            <input
              className="pl-10 pr-4 py-2 rounded-full bg-surface-container-low border border-outline-variant/50 font-label-md text-sm text-on-surface focus:border-secondary-container input-glow transition-all w-full md:w-64"
              placeholder="Search registry ID..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <button
            onClick={() => setDrawerOpen(true)}
            className="btn-primary-gradient px-5 py-2.5 rounded-full font-label-md text-sm font-bold flex items-center gap-2 whitespace-nowrap cursor-pointer shadow-sm active:scale-98"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            <span>New Entry</span>
          </button>
        </div>
      </div>

      {/* Filter Badge Chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-label-sm text-xs text-outline mr-2 font-semibold">Filters:</span>
        {['ALL', 'Kidney', 'Liver', 'Heart', 'Lungs'].map(organ => (
          <button
            key={organ}
            onClick={() => setSelectedOrganFilter(organ)}
            className={`px-3.5 py-1 rounded-full font-label-sm text-xs font-semibold cursor-pointer transition-all ${
              selectedOrganFilter === organ
                ? 'bg-secondary-container text-on-secondary-container border border-secondary-container shadow-xs'
                : 'bg-white text-outline border border-outline-variant/30 hover:bg-surface-container'
            }`}
          >
            {organ}
          </button>
        ))}

        <div className="w-px h-5 bg-outline-variant/40 mx-2 hidden sm:block"></div>

        {['ALL', 'O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+'].map(blood => (
          <button
            key={blood}
            onClick={() => setSelectedBloodFilter(blood)}
            className={`px-3 py-1 rounded-full font-label-sm text-xs font-semibold cursor-pointer transition-all ${
              selectedBloodFilter === blood
                ? 'bg-primary text-white border border-primary shadow-xs'
                : 'bg-white text-outline border border-outline-variant/30 hover:bg-surface-container'
            }`}
          >
            {blood}
          </button>
        ))}
      </div>

      {/* Bento Grid: Candidates (8 cols) & Donors (4 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Waitlisted Candidates Column */}
        <div className="xl:col-span-8 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-headline-md text-lg font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">groups</span>
              Waitlisted Candidates ({filteredRecipients.length})
            </h3>
            <span className="text-xs font-label-md text-outline">Sorted by Clinical Urgency</span>
          </div>

          {filteredRecipients.length === 0 ? (
            <div className="glass-panel rounded-2xl p-8 text-center text-outline">
              No candidates matching current filter criteria.
            </div>
          ) : (
            filteredRecipients.map((rec) => {
              const isCrit = rec.urgency_level === 'CRITICAL';
              const initials = rec.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

              return (
                <div
                  key={rec.id}
                  className="glass-panel rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-surface-container-high flex items-center justify-center text-primary font-bold font-label-md shrink-0 border border-outline-variant/30">
                      {initials}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-headline-md text-base font-bold text-on-background">
                          {rec.full_name}
                        </h4>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isCrit
                              ? 'bg-error/10 text-error border border-error/20'
                              : 'bg-secondary-container/40 text-on-secondary-container border border-secondary-container'
                          }`}
                        >
                          {rec.urgency_level}
                        </span>
                      </div>
                      <p className="font-body-md text-xs text-outline mt-0.5">
                        NOTTO ID: <span className="font-mono text-on-surface font-semibold">{rec.notto_reg_number || 'NOTTO-REC'}</span> • Hospital: {rec.hospital_name || 'AIIMS Delhi'}
                      </p>
                      <div className="flex gap-2 mt-2 flex-wrap text-xs">
                        <span className="inline-flex items-center gap-1 font-label-sm text-on-surface-variant bg-surface-container px-2.5 py-0.5 rounded-md font-bold">
                          <span className="material-symbols-outlined text-[14px]">water_drop</span> ABO: {rec.blood_type}
                        </span>
                        <span className="inline-flex items-center gap-1 font-label-sm text-on-surface-variant bg-surface-container px-2.5 py-0.5 rounded-md font-bold">
                          <span className="material-symbols-outlined text-[14px]">favorite</span> {rec.organ_needed}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1 border-t sm:border-t-0 sm:border-l border-outline-variant/30 pt-3 sm:pt-0 sm:pl-4">
                    <div className="text-left sm:text-right">
                      <p className="font-label-sm text-[10px] uppercase text-outline font-bold">Time On List</p>
                      <p className="font-body-md text-sm font-bold text-on-surface">{rec.wait_time_days} Days</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Active Donors Column */}
        <div className="xl:col-span-4 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-headline-md text-lg font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-tertiary-container">volunteer_activism</span>
              Active Donors ({filteredDonors.length})
            </h3>
          </div>

          {filteredDonors.length === 0 ? (
            <div className="glass-panel rounded-2xl p-8 text-center text-outline">
              No donors found.
            </div>
          ) : (
            filteredDonors.map((d) => (
              <div
                key={d.id}
                className="glass-panel rounded-2xl p-5 border-l-4 border-l-tertiary-container flex flex-col justify-between"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-tertiary-container/10 text-tertiary-container mb-2 inline-block border border-tertiary-container/20">
                      {d.donor_type}
                    </span>
                    <h4 className="font-headline-md text-base font-bold text-on-background">{d.full_name}</h4>
                    <p className="font-body-md text-xs text-outline mt-0.5 font-mono">
                      Aadhaar: {d.masked_aadhaar || 'XXXX-XXXX-8921'}
                    </p>
                    <p className="text-[11px] text-outline mt-0.5">
                      Node: {d.hospital_name || 'Verified Hospital Network'}
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-tertiary-container text-2xl">medical_services</span>
                </div>

                <div className="mt-4 pt-3 border-t border-outline-variant/30 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="font-label-sm text-[10px] uppercase text-outline font-bold">Blood Group</p>
                    <p className="font-body-md text-sm font-bold text-primary">{d.blood_type}</p>
                  </div>
                  <div>
                    <p className="font-label-sm text-[10px] uppercase text-outline font-bold">Organ Type</p>
                    <p className="font-body-md text-sm font-bold text-on-surface">{d.organ_type}</p>
                  </div>
                </div>

                <div className="mt-2 text-[11px] font-mono text-outline truncate">
                  HLA: {d.tissue_type}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Streamlined Frosted Glass Drawer for "New Entry" */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-[60] transition-opacity duration-300"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white/95 backdrop-blur-2xl shadow-2xl z-[70] border-l border-outline-variant/30 flex flex-col animate-slideLeft">
            {/* Drawer Header */}
            <div className="px-6 py-5 border-b border-outline-variant/20 flex items-center justify-between bg-surface-bright/50">
              <h3 className="font-headline-md text-xl font-bold text-on-background">New Registry Entry</h3>
              <button
                className="p-2 rounded-full hover:bg-surface-variant text-outline transition-colors cursor-pointer"
                onClick={() => setDrawerOpen(false)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Drawer Content Form */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Entry Type Selection */}
              <div>
                <label className="font-label-md text-xs font-bold text-outline block mb-2 uppercase tracking-wider">
                  Entry Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEntryType('candidate')}
                    className={`p-3.5 rounded-xl border text-center transition-all cursor-pointer ${
                      entryType === 'candidate'
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-outline-variant/40 bg-white hover:bg-surface-container'
                    }`}
                  >
                    <span className="material-symbols-outlined text-primary text-xl mb-1 block mx-auto">
                      patient_list
                    </span>
                    <div className="font-label-md text-sm font-bold text-on-surface">Candidate</div>
                    <div className="font-body-md text-[10px] text-outline mt-0.5">Waitlist addition</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEntryType('donor')}
                    className={`p-3.5 rounded-xl border text-center transition-all cursor-pointer ${
                      entryType === 'donor'
                        ? 'border-tertiary-container bg-tertiary-container/5 ring-1 ring-tertiary-container'
                        : 'border-outline-variant/40 bg-white hover:bg-surface-container'
                    }`}
                  >
                    <span className="material-symbols-outlined text-tertiary-container text-xl mb-1 block mx-auto">
                      volunteer_activism
                    </span>
                    <div className="font-label-md text-sm font-bold text-on-surface">Donor</div>
                    <div className="font-body-md text-[10px] text-outline mt-0.5">Organ availability</div>
                  </button>
                </div>
              </div>

              {entryType === 'candidate' ? (
                /* Candidate Intake Form */
                <form onSubmit={handleRegisterRecipient} className="space-y-4">
                  <div>
                    <label className="font-label-md text-xs text-outline block mb-1">Candidate Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh Chandra"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      required
                      className="input-mist w-full rounded-xl px-4 py-2.5 text-sm text-on-surface"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-label-md text-xs text-outline block mb-1">Blood Group</label>
                      <select
                        value={recipientBlood}
                        onChange={(e) => setRecipientBlood(e.target.value)}
                        className="input-mist w-full rounded-xl px-4 py-2.5 text-sm text-on-surface appearance-none font-bold"
                      >
                        {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="font-label-md text-xs text-outline block mb-1">Organ Needed</label>
                      <select
                        value={recipientOrgan}
                        onChange={(e) => setRecipientOrgan(e.target.value)}
                        className="input-mist w-full rounded-xl px-4 py-2.5 text-sm text-on-surface appearance-none"
                      >
                        {['Kidney', 'Liver', 'Heart', 'Lungs', 'Pancreas'].map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-label-md text-xs text-outline block mb-1">Urgency Status</label>
                      <select
                        value={recipientUrgency}
                        onChange={(e) => setRecipientUrgency(e.target.value as any)}
                        className="input-mist w-full rounded-xl px-4 py-2.5 text-sm text-error font-bold appearance-none"
                      >
                        <option value="CRITICAL">CRITICAL (Status 1)</option>
                        <option value="HIGH">HIGH (Urgent)</option>
                        <option value="MEDIUM">MEDIUM (Standard)</option>
                        <option value="LOW">LOW</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-label-md text-xs text-outline block mb-1">Wait Time (Days)</label>
                      <input
                        type="number"
                        value={recipientWaitDays}
                        onChange={(e) => setRecipientWaitDays(Number(e.target.value))}
                        className="input-mist w-full rounded-xl px-4 py-2.5 text-sm text-on-surface"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-label-md text-xs text-outline block mb-1">NOTTO Registration Number</label>
                    <input
                      type="text"
                      placeholder="NOTTO-REC-2026-XXX"
                      value={recipientNottoReg}
                      onChange={(e) => setRecipientNottoReg(e.target.value)}
                      className="input-mist w-full rounded-xl px-4 py-2.5 text-sm text-on-surface font-mono"
                    />
                  </div>

                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={submittingCandidate}
                      className="btn-primary-gradient w-full py-3 rounded-xl font-label-md text-sm font-bold shadow-md cursor-pointer flex items-center justify-center gap-2"
                    >
                      <span>{submittingCandidate ? 'Saving Candidate...' : 'Save Candidate to Waitlist'}</span>
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </button>
                  </div>
                </form>
              ) : (
                /* Donor Intake Form */
                <form onSubmit={handleRegisterDonor} className="space-y-4">
                  <div>
                    <label className="font-label-md text-xs text-outline block mb-1">Donor Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Priya Sundaram"
                      value={donorName}
                      onChange={(e) => setDonorName(e.target.value)}
                      required
                      className="input-mist w-full rounded-xl px-4 py-2.5 text-sm text-on-surface"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-label-md text-xs text-outline block mb-1">Blood Group</label>
                      <select
                        value={donorBlood}
                        onChange={(e) => setDonorBlood(e.target.value)}
                        className="input-mist w-full rounded-xl px-4 py-2.5 text-sm text-on-surface appearance-none font-bold"
                      >
                        {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="font-label-md text-xs text-outline block mb-1">Organ Available</label>
                      <select
                        value={donorOrgan}
                        onChange={(e) => setDonorOrgan(e.target.value)}
                        className="input-mist w-full rounded-xl px-4 py-2.5 text-sm text-on-surface appearance-none"
                      >
                        {['Kidney', 'Liver', 'Heart', 'Lungs', 'Pancreas'].map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-label-md text-xs text-outline block mb-1">Donor Type</label>
                      <select
                        value={donorType}
                        onChange={(e) => setDonorType(e.target.value as any)}
                        className="input-mist w-full rounded-xl px-4 py-2.5 text-sm text-on-surface appearance-none"
                      >
                        <option value="DECEASED">DECEASED</option>
                        <option value="LIVING_FAMILY">LIVING FAMILY</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-label-md text-xs text-outline block mb-1">Masked Aadhaar</label>
                      <input
                        type="text"
                        placeholder="XXXX-XXXX-1234"
                        value={donorAadhaar}
                        onChange={(e) => setDonorAadhaar(e.target.value)}
                        className="input-mist w-full rounded-xl px-4 py-2.5 text-sm text-on-surface font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-label-md text-xs text-outline block mb-1">HLA Loci Antigens</label>
                    <input
                      type="text"
                      placeholder="HLA-A2, HLA-B44, HLA-DR4"
                      value={donorTissue}
                      onChange={(e) => setDonorTissue(e.target.value)}
                      className="input-mist w-full rounded-xl px-4 py-2.5 text-sm text-on-surface font-mono"
                    />
                  </div>

                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={submittingDonor}
                      className="btn-primary-gradient w-full py-3 rounded-xl font-label-md text-sm font-bold shadow-md cursor-pointer flex items-center justify-center gap-2"
                    >
                      <span>{submittingDonor ? 'Registering Donor...' : 'Register Organ Donor'}</span>
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
