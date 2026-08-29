import React, { useState } from 'react';
import { EvaluatedMatch, MatchesSearchResponse } from '../types';
import { apiClient } from '../services/apiClient';

interface MatchingDashboardProps {
  onNotification: (msg: string, type: 'success' | 'error') => void;
  onNavigateToAllocations: () => void;
}

export const MatchingDashboard: React.FC<MatchingDashboardProps> = ({ onNotification, onNavigateToAllocations }) => {
  const [matches, setMatches] = useState<EvaluatedMatch[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  // Dynamic Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrganFilter, setSelectedOrganFilter] = useState('ALL');

  // Selected Detail Modal State
  const [activeModalMatch, setActiveModalMatch] = useState<EvaluatedMatch | null>(null);

  // Interactive HLA Simulator State
  const [showSimulator, setShowSimulator] = useState(false);
  const [simBloodDonor, setSimBloodDonor] = useState('O+');
  const [simBloodRecipient, setSimBloodRecipient] = useState('O+');
  const [simHlaMatches, setSimHlaMatches] = useState(3);
  const [simUrgency, setSimUrgency] = useState<'CRITICAL' | 'HIGH' | 'MEDIUM'>('CRITICAL');

  const runMatchingEngine = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<MatchesSearchResponse>('/matches/find');
      if (res.ok && res.data) {
        setMatches(res.data.matches || []);
        onNotification(`NOTTO matching engine evaluated ${res.data.totalEvaluated || 0} candidate pairs.`, 'success');
      } else {
        onNotification((res.data as any)?.message || 'Failed to execute matching engine', 'error');
      }
    } catch (err) {
      console.error('Error running matching engine:', err);
      onNotification('Network error executing matching engine', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptMatch = async (matchId: string) => {
    setAcceptingId(matchId);
    try {
      const acceptRes = await apiClient.post(`/matches/${matchId}/accept`);
      if (!acceptRes.ok) {
        throw new Error((acceptRes.data as any)?.message || 'Match acceptance failed');
      }

      const allocRes = await apiClient.post('/allocations/allocate', {
        matchId,
        logisticsStatus: 'pending',
        regulatoryApproval: false,
        coldChainParams: {
          temperatureCelsius: 4.0,
          etaMinutes: 45,
          coldIschemiaLimitHours: 24
        }
      });

      if (allocRes.ok) {
        onNotification('Match accepted and organ allocation shipment initiated!', 'success');
        runMatchingEngine();
        onNavigateToAllocations();
      } else {
        const errDetail = (allocRes.data as any)?.message || 'Failed to create allocation record';
        onNotification(`Match accepted, but allocation pipeline note: ${errDetail}`, 'error');
      }
    } catch (err: any) {
      console.error('Error accepting match:', err);
      onNotification(err.message || 'Error accepting match', 'error');
    } finally {
      setAcceptingId(null);
    }
  };

  // Compute live simulated score
  const calculateSimulatedScore = () => {
    let bloodScore = simBloodDonor === simBloodRecipient ? 40 : 30;
    let organScore = 40;
    let tissueScore = (simHlaMatches / 3) * 10;
    let urgencyScore = simUrgency === 'CRITICAL' ? 10 : simUrgency === 'HIGH' ? 8 : 5;

    return (bloodScore + organScore + tissueScore + urgencyScore).toFixed(1);
  };

  // Filter matches dynamically
  const filteredMatches = matches.filter(m => {
    const matchesOrgan = selectedOrganFilter === 'ALL' || m.donor.organType.toLowerCase() === selectedOrganFilter.toLowerCase();
    const matchesSearch = searchQuery === '' || 
      m.donor.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.recipient.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.donor.bloodType.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesOrgan && matchesSearch;
  });

  return (
    <div className="space-y-lg animate-fadeIn">
      {/* Header Section */}
      <header className="mb-margin flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg font-bold text-on-background">
            Match Overview
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1 max-w-2xl">
            Review urgent organ matches and NOTTO compatibility scores. Priority is given to HLA crossmatch precision and critical recipient status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowSimulator(!showSimulator)}
            className="px-4 py-2 rounded-xl border border-outline-variant/60 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-high transition-colors flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">tune</span>
            <span>{showSimulator ? 'Close Simulator' : 'HLA Simulator'}</span>
          </button>

          <button
            onClick={runMatchingEngine}
            disabled={loading}
            className="btn-primary-gradient px-5 py-2.5 rounded-xl font-label-md text-label-md flex items-center gap-2 cursor-pointer shadow-sm active:scale-98"
          >
            <span className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`}>
              {loading ? 'sync' : 'play_arrow'}
            </span>
            <span>{loading ? 'Evaluating...' : 'Run NOTTO Matching Engine'}</span>
          </button>
        </div>
      </header>

      {/* Interactive Simulator Drawer / Panel */}
      {showSimulator && (
        <div className="glass-card rounded-2xl p-6 border border-primary/30 animate-fadeIn">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 border-b border-outline-variant/20 pb-3">
            <h3 className="font-headline-md text-headline-md text-primary flex items-center gap-2 font-bold">
              <span className="material-symbols-outlined text-2xl">science</span>
              Interactive HLA Compatibility Simulator
            </h3>
            <span className="font-headline-md text-headline-md text-primary font-bold font-tabular-nums bg-primary/10 px-3 py-1 rounded-xl">
              Simulated Viability: {calculateSimulatedScore()}%
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block font-label-sm text-xs text-outline mb-1 font-semibold">Donor Blood Group</label>
              <select
                value={simBloodDonor}
                onChange={(e) => setSimBloodDonor(e.target.value)}
                className="input-mist w-full rounded-xl py-2 px-3 text-sm text-on-surface appearance-none"
              >
                {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            <div>
              <label className="block font-label-sm text-xs text-outline mb-1 font-semibold">Recipient Blood Group</label>
              <select
                value={simBloodRecipient}
                onChange={(e) => setSimBloodRecipient(e.target.value)}
                className="input-mist w-full rounded-xl py-2 px-3 text-sm text-on-surface appearance-none"
              >
                {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            <div>
              <label className="block font-label-sm text-xs text-outline mb-1 font-semibold">
                HLA Antigen Matches ({simHlaMatches}/3 Loci)
              </label>
              <input
                type="range"
                min="0"
                max="3"
                value={simHlaMatches}
                onChange={(e) => setSimHlaMatches(Number(e.target.value))}
                className="w-full accent-primary mt-2"
              />
            </div>

            <div>
              <label className="block font-label-sm text-xs text-outline mb-1 font-semibold">Clinical Urgency</label>
              <select
                value={simUrgency}
                onChange={(e) => setSimUrgency(e.target.value as any)}
                className="input-mist w-full rounded-xl py-2 px-3 text-sm text-on-surface appearance-none font-semibold text-error"
              >
                <option value="CRITICAL">CRITICAL (Status 1)</option>
                <option value="HIGH">HIGH (Urgent)</option>
                <option value="MEDIUM">MEDIUM (Standard)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Search & Dynamic Filter Chips */}
      {matches.length > 0 && (
        <div className="glass-card rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">search</span>
            <input
              type="text"
              placeholder="Search candidate, donor, or blood type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-surface-container-low border border-outline-variant/40 rounded-full font-body-md text-sm text-on-surface input-glow w-full transition-all"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar w-full md:w-auto">
            <span className="font-label-sm text-xs text-outline mr-1">Filter:</span>
            {['ALL', 'Kidney', 'Liver', 'Heart', 'Lungs'].map(organ => (
              <button
                key={organ}
                onClick={() => setSelectedOrganFilter(organ)}
                className={`px-4 py-1.5 rounded-full font-label-md text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                  selectedOrganFilter === organ
                    ? 'bg-secondary-container text-on-secondary-container border border-secondary-container shadow-xs'
                    : 'bg-white border border-outline-variant/30 text-outline hover:bg-surface-container-low'
                }`}
              >
                {organ}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Match Cards: Bento Grid */}
      {matches.length === 0 ? (
        <div className="glass-card rounded-2xl p-2xl text-center flex flex-col items-center justify-center border-dashed border-outline-variant/50">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
            <span className="material-symbols-outlined text-[36px]">favorite</span>
          </div>
          <h3 className="font-headline-md text-headline-md font-bold text-on-surface mb-2">
            No active matches calculated yet
          </h3>
          <p className="font-body-md text-sm text-on-surface-variant max-w-md mb-6">
            Click &quot;Run NOTTO Matching Engine&quot; to calculate multi-factorial compatibility scores across registered donors and waitlisted recipients.
          </p>
          <button
            onClick={runMatchingEngine}
            disabled={loading}
            className="btn-primary-gradient px-6 py-3 rounded-xl font-label-md text-sm font-bold shadow-md cursor-pointer flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">{loading ? 'sync' : 'play_arrow'}</span>
            <span>{loading ? 'Running Engine...' : 'Run NOTTO Matching Engine'}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {filteredMatches.map((m, idx) => {
            const isTopMatch = idx === 0;
            const isCritical = m.recipient.urgencyLevel === 'CRITICAL';
            const isAccepted = m.matchStatus === 'accepted';
            const isAccepting = acceptingId === m.matchId;

            return (
              <article
                key={m.matchId}
                className={`glass-card rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between ${
                  isTopMatch ? 'xl:col-span-2' : ''
                }`}
              >
                {/* Decorative glow corner */}
                <div
                  className={`absolute top-0 right-0 w-32 h-32 rounded-bl-full blur-2xl -z-10 ${
                    isCritical ? 'bg-error-container/30' : 'bg-secondary-container/20'
                  }`}
                />

                <div>
                  {/* Top Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-headline-md text-lg md:text-xl font-bold text-on-background">
                          {m.donor.organType} Allograft Match
                        </h3>
                        {isCritical ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-error/10 text-error font-label-sm text-xs font-bold flex items-center gap-1 border border-error/20">
                            <span className="material-symbols-outlined text-[14px]">priority_high</span> Critical
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-secondary-container/40 text-on-secondary-container font-label-sm text-xs font-bold border border-secondary-container">
                            {m.recipient.urgencyLevel}
                          </span>
                        )}
                        {isAccepted && (
                          <span className="px-2.5 py-0.5 rounded-full bg-tertiary-container/10 text-tertiary-container font-label-sm text-xs font-bold border border-tertiary-container/20">
                            Accepted
                          </span>
                        )}
                      </div>
                      <p className="font-body-md text-xs text-outline">
                        Match ID: <span className="font-mono text-on-surface-variant font-semibold">{m.matchId}</span>
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="block font-headline-md text-2xl md:text-3xl font-bold text-primary font-tabular-nums">
                        {m.compatibilityScore.toFixed(1)}%
                      </span>
                      <span className="font-label-sm text-[10px] text-outline uppercase tracking-wider font-semibold">
                        Viability Score
                      </span>
                    </div>
                  </div>

                  {/* Donor & Recipient Profile Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-4">
                    {/* Donor Card */}
                    <div className="p-3.5 rounded-xl bg-surface-container/50 border border-outline-variant/30">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase font-bold text-outline">Donor Profile</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-surface-bright text-on-surface border border-outline-variant/40">
                          {m.donor.donorType}
                        </span>
                      </div>
                      <p className="font-bold text-sm text-on-surface">{m.donor.fullName}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap text-xs">
                        <span className="px-2 py-0.5 rounded-md bg-white text-primary font-bold border border-outline-variant/30">
                          ABO: {m.donor.bloodType}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-white text-on-surface-variant font-medium border border-outline-variant/30">
                          {m.donor.organType}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-outline mt-2 truncate">
                        HLA: {m.donor.tissueType}
                      </p>
                    </div>

                    {/* Recipient Card */}
                    <div className="p-3.5 rounded-xl bg-surface-container/50 border border-outline-variant/30">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase font-bold text-outline">Candidate Recipient</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-primary/10 text-primary border border-primary/20">
                          {m.recipient.nottoRegNumber || 'NOTTO-REC'}
                        </span>
                      </div>
                      <p className="font-bold text-sm text-on-surface">{m.recipient.fullName}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap text-xs">
                        <span className="px-2 py-0.5 rounded-md bg-white text-primary font-bold border border-outline-variant/30">
                          ABO: {m.recipient.bloodType}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-white text-on-surface-variant font-medium border border-outline-variant/30">
                          Wait: {m.recipient.waitTimeDays}d
                        </span>
                      </div>
                      <p className="text-[11px] text-outline mt-2 truncate">
                        Center: {m.recipient.hospital?.name || 'Primary Transplant Center'}
                      </p>
                    </div>
                  </div>

                  {/* Compatibility Progress Bar */}
                  <div className="my-4">
                    <div className="w-full bg-surface-container rounded-full h-3 overflow-hidden border border-outline-variant/20">
                      <div
                        className="bg-gradient-to-r from-primary-container to-secondary-container h-full rounded-full progress-shimmer"
                        style={{ width: `${Math.min(100, Math.max(10, m.compatibilityScore))}%` }}
                      />
                    </div>
                    <div className="flex justify-between font-label-sm text-[11px] text-outline mt-2 px-1">
                      <span>Blood: {m.breakdown.bloodCompatibilityScore || m.breakdown.bloodTypeScore || 40} / 40</span>
                      <span>Organ: {m.breakdown.organMatchScore || 40} / 40</span>
                      <span>HLA: {m.breakdown.tissueMatchScore || m.breakdown.hlaMatchScore || 10} / 10</span>
                      <span>Urgency/Wait: {(m.breakdown.urgencyWaitScore || 9.6).toFixed(1)} / 10</span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-4 pt-4 border-t border-outline-variant/20 flex flex-wrap gap-2 justify-end items-center">
                  <button
                    onClick={() => setActiveModalMatch(m)}
                    className="px-4 py-2 rounded-xl font-label-md text-xs font-semibold border border-outline-variant/60 text-on-surface-variant hover:bg-surface-container-low transition-colors cursor-pointer"
                  >
                    View Chart Breakdown
                  </button>

                  {isAccepted ? (
                    <button
                      onClick={onNavigateToAllocations}
                      className="px-5 py-2 rounded-xl font-label-md text-xs font-bold bg-tertiary-container/10 text-tertiary-container border border-tertiary-container/30 hover:bg-tertiary-container/20 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">local_shipping</span>
                      <span>Track Logistics Dispatch</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAcceptMatch(m.matchId)}
                      disabled={isAccepting}
                      className="btn-primary-gradient px-5 py-2 rounded-xl font-label-md text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-98"
                    >
                      <span className={`material-symbols-outlined text-[16px] ${isAccepting ? 'animate-spin' : ''}`}>
                        {isAccepting ? 'sync' : 'check_circle'}
                      </span>
                      <span>{isAccepting ? 'Initiating Dispatch...' : 'Accept Match & Initiate Shipment'}</span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modal Detail Breakdown */}
      {activeModalMatch && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-xl w-full rounded-2xl p-6 shadow-2xl animate-fadeIn border border-outline-variant/40">
            <div className="flex justify-between items-center pb-4 border-b border-outline-variant/30">
              <h3 className="font-headline-md text-lg font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">analytics</span>
                NOTTO Compatibility Matrix Breakdown
              </h3>
              <button
                onClick={() => setActiveModalMatch(null)}
                className="p-1 rounded-lg hover:bg-surface-container text-outline"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="py-4 space-y-4">
              <div className="flex justify-between items-center p-3 rounded-xl bg-surface-container/50">
                <span className="text-xs font-bold text-outline">Total Viability Score</span>
                <span className="text-xl font-bold text-primary">{activeModalMatch.compatibilityScore.toFixed(2)} / 100</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between p-2 rounded-lg bg-surface-bright border border-outline-variant/30">
                  <span>1. Blood Compatibility (Max 40 pts)</span>
                  <span className="font-bold text-on-surface">{activeModalMatch.breakdown.bloodTypeScore || activeModalMatch.breakdown.bloodCompatibilityScore} pts</span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-surface-bright border border-outline-variant/30">
                  <span>2. Organ Anatomical Match (Max 40 pts)</span>
                  <span className="font-bold text-on-surface">{activeModalMatch.breakdown.organMatchScore} pts</span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-surface-bright border border-outline-variant/30">
                  <span>3. HLA Loci Crossmatch (Max 10 pts)</span>
                  <span className="font-bold text-on-surface">{activeModalMatch.breakdown.hlaMatchScore || activeModalMatch.breakdown.tissueMatchScore} pts</span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-surface-bright border border-outline-variant/30">
                  <span>4. Urgency &amp; Waitlist Seniority (Max 10 pts)</span>
                  <span className="font-bold text-on-surface">{(activeModalMatch.breakdown.urgencyWaitScore || 9.63).toFixed(2)} pts</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-outline-variant/20 flex justify-end">
              <button
                onClick={() => setActiveModalMatch(null)}
                className="btn-primary-gradient px-5 py-2 rounded-xl text-xs font-bold cursor-pointer"
              >
                Close Chart
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
