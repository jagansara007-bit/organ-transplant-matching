import React, { useState, useEffect } from 'react';
import { Allocation } from '../types';
import { apiClient, getStoredSession } from '../services/apiClient';
import { TwoFactorOtpModal } from './TwoFactorOtpModal';

interface AllocationTrackerProps {
  onNotification: (msg: string, type: 'success' | 'error') => void;
}

interface OrganIschemiaConfig {
  maxHours: number;
  optimalHours: number;
  icon: string;
}

const getOrganIschemiaConfig = (organType: string = 'Kidney'): OrganIschemiaConfig => {
  const organ = organType.toLowerCase();
  if (organ.includes('heart')) {
    return { maxHours: 4.0, optimalHours: 3.0, icon: 'favorite' };
  }
  if (organ.includes('liver')) {
    return { maxHours: 12.0, optimalHours: 8.0, icon: 'medical_services' };
  }
  if (organ.includes('lung')) {
    return { maxHours: 6.0, optimalHours: 4.5, icon: 'air' };
  }
  if (organ.includes('pancreas')) {
    return { maxHours: 12.0, optimalHours: 9.0, icon: 'health_metrics' };
  }
  // Kidney default (24 to 36 hours limit)
  return { maxHours: 24.0, optimalHours: 12.0, icon: 'science' };
};

export const AllocationTracker: React.FC<AllocationTrackerProps> = ({ onNotification }) => {
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Regulatory Modal State
  const [selectedAllocForApproval, setSelectedAllocForApproval] = useState<Allocation | null>(null);
  const [complianceNotes, setComplianceNotes] = useState<string>(
    'NOTTO Form 8 statutory verification complete. Identity, clinical crossmatch, and consent verified without discrepancy.'
  );
  const [nottoForm8Checked, setNottoForm8Checked] = useState<boolean>(true);
  const [submittingApproval, setSubmittingApproval] = useState<boolean>(false);

  // Hand-off & Delivery Modal State
  const [selectedAllocForHandover, setSelectedAllocForHandover] = useState<Allocation | null>(null);
  const [handoverRecipientSurgeon, setHandoverRecipientSurgeon] = useState<string>('Dr. Rajesh Sharma (AIIMS OT-4)');
  const [handoverSealIntact, setHandoverSealIntact] = useState<boolean>(true);
  const [handoverTempChecked, setHandoverTempChecked] = useState<boolean>(true);
  const [submittingHandover, setSubmittingHandover] = useState<boolean>(false);

  // 2FA Security Modal State
  const [twoFactorModal, setTwoFactorModal] = useState<{
    isOpen: boolean;
    purpose: string;
    action: () => void;
  }>({
    isOpen: false,
    purpose: '',
    action: () => {}
  });

  // Live Dynamic Telemetry State
  const [simTemperature, setSimTemperature] = useState<number>(4.2);
  const [simAmbientTemp, setSimAmbientTemp] = useState<number>(28.4);
  const [simBattery, setSimBattery] = useState<number>(94);
  const [simEtaMinutes, setSimEtaMinutes] = useState<number>(38);
  const [ischemiaSeconds, setIschemiaSeconds] = useState<number>(8072); // 02:14:32

  // GPS Transit Coordinates State
  const [gpsProgress, setGpsProgress] = useState<number>(0.62);
  const [currentLat, setCurrentLat] = useState<number>(20.8421);
  const [currentLng, setCurrentLng] = useState<number>(78.7391);
  const [transitSpeed, setTransitSpeed] = useState<number>(420);
  const [altitude, setAltitude] = useState<number>(8450);

  // Temperature Breach Simulation Trigger
  const [tempBreachSimulated, setTempBreachSimulated] = useState<boolean>(false);

  const session = getStoredSession();
  const userEmail = session?.user.email || 'jagansara007@gmail.com';
  const isRegulatoryOfficer = (session?.user.user_role || '').toLowerCase().includes('regulatory') ||
                              (session?.user.user_role || '').toLowerCase().includes('admin');

  const fetchAllocations = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ allocations: Allocation[] }>('/allocations');
      if (res.ok && res.data) {
        setAllocations(res.data.allocations || []);
      }
    } catch (err) {
      console.error('Failed to fetch allocations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllocations();
  }, []);

  // Live Timer, Telemetry Fluctuations & GPS Stream
  useEffect(() => {
    const interval = setInterval(() => {
      setIschemiaSeconds(prev => prev + 1);

      if (!tempBreachSimulated) {
        setSimTemperature(+(4.0 + Math.sin(Date.now() / 4000) * 0.3).toFixed(1));
      } else {
        setSimTemperature(+(6.8 + Math.random() * 0.4).toFixed(1));
      }

      setSimAmbientTemp(+(28.0 + Math.sin(Date.now() / 6000) * 0.8).toFixed(1));
      setTransitSpeed(415 + Math.floor(Math.random() * 12));
      setAltitude(8400 + Math.floor(Math.random() * 80));

      setGpsProgress(prev => {
        const next = prev < 0.95 ? prev + 0.0008 : 0.62;
        const lat = 13.0827 + next * (28.6139 - 13.0827);
        const lng = 80.2707 + next * (77.2090 - 80.2707);
        setCurrentLat(+lat.toFixed(4));
        setCurrentLng(+lng.toFixed(4));
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [tempBreachSimulated]);

  const activeAlloc = allocations.find(a => a.logistics_status === 'in_transit') || allocations[0];
  const organType = activeAlloc?.donor_organ || 'Kidney';
  const organConfig = getOrganIschemiaConfig(organType);
  const maxIschemiaSeconds = organConfig.maxHours * 3600;
  const ischemiaRatio = ischemiaSeconds / maxIschemiaSeconds;

  const getIschemiaUrgencyDetails = () => {
    if (ischemiaRatio < 0.5) {
      return {
        level: 'OPTIMAL',
        badgeColor: 'text-emerald-700 bg-emerald-500/10 border-emerald-500/30',
        barColor: 'bg-emerald-600',
        label: 'Optimal Viability Window',
        desc: `Elapsed <50% of maximum ${organConfig.maxHours}h threshold.`
      };
    }
    if (ischemiaRatio <= 0.85) {
      return {
        level: 'WARNING',
        badgeColor: 'text-amber-700 bg-amber-500/10 border-amber-500/30',
        barColor: 'bg-amber-500',
        label: 'Warning - Approaching Threshold',
        desc: `Priority corridor active. Exceeding ${organConfig.optimalHours}h standard window.`
      };
    }
    return {
      level: 'CRITICAL_BREACH',
      badgeColor: 'text-rose-700 bg-rose-500/10 border-rose-500/30 animate-pulse',
      barColor: 'bg-rose-600',
      label: 'Critical Ischemia Breach Warning',
      desc: `Critical cellular viability limit reached! Immediate OT implantation required.`
    };
  };

  const urgency = getIschemiaUrgencyDetails();
  const isTempSafe = simTemperature >= 2.0 && simTemperature <= 6.0;

  const formatIschemiaTime = (seconds: number) => {
    const hrs = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  };

  const handleUpdateLogistics = async (allocId: string, newStatus: 'pending' | 'in_transit' | 'delivered') => {
    setUpdatingId(allocId);
    try {
      const res = await apiClient.patch(`/allocations/${allocId}/logistics`, {
        logisticsStatus: newStatus,
        temperatureCelsius: simTemperature,
        organCondition: isTempSafe ? 'OPTIMAL' : 'RISK_DETECTED'
      });

      if (res.ok) {
        onNotification(`Logistics status updated to: ${newStatus.toUpperCase()}`, 'success');
        fetchAllocations();
      } else {
        onNotification((res.data as any)?.message || 'Failed to update logistics status', 'error');
      }
    } catch (err) {
      onNotification('Network error updating logistics state', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  // Execution after 2FA validation for Handover
  const executeCompleteHandover = async () => {
    if (!selectedAllocForHandover) return;
    setSubmittingHandover(true);
    const allocId = selectedAllocForHandover.allocation_id || selectedAllocForHandover.id || '';

    try {
      const res = await apiClient.patch(`/allocations/${allocId}/logistics`, {
        logisticsStatus: 'delivered',
        temperatureCelsius: simTemperature,
        organCondition: isTempSafe ? 'OPTIMAL' : 'ACCEPTABLE'
      });

      if (res.ok) {
        onNotification(
          `Organ Hand-off confirmed to ${handoverRecipientSurgeon}! Final Cold Ischemia logged at ${formatIschemiaTime(ischemiaSeconds)}.`,
          'success'
        );
        setSelectedAllocForHandover(null);
        fetchAllocations();
      } else {
        onNotification((res.data as any)?.message || 'Failed to complete handover', 'error');
      }
    } catch (err) {
      onNotification('Network error recording organ reception', 'error');
    } finally {
      setSubmittingHandover(false);
    }
  };

  // Trigger 2FA for Handover
  const handleInitiateHandoverWith2FA = () => {
    if (!selectedAllocForHandover) return;
    if (!handoverSealIntact || !handoverTempChecked) {
      onNotification('Please verify both Icebox Seal integrity and Core Temperature checks', 'error');
      return;
    }

    // Trigger 2FA OTP Modal
    apiClient.post('/auth/request-otp', {
      email: userEmail,
      purpose: 'Organ Reception & Hand-off Authorization'
    }).catch(console.error);

    setTwoFactorModal({
      isOpen: true,
      purpose: 'Organ Reception & Hand-off Authorization',
      action: executeCompleteHandover
    });
  };

  // Execution after 2FA validation for Regulatory Form 8 Sign-off
  const executeRegulatorySignOff = async () => {
    if (!selectedAllocForApproval) return;
    setSubmittingApproval(true);

    try {
      const targetId = selectedAllocForApproval.allocation_id || selectedAllocForApproval.id || '';
      const res = await apiClient.post(`/allocations/${targetId}/regulatory-approval`, {
        approvalStatus: 'APPROVED',
        complianceNotes,
        nottoForm8Verified: true
      });

      if (res.ok) {
        onNotification('NOTTO Form 8 Statutory Clearance recorded and signed successfully!', 'success');
        setSelectedAllocForApproval(null);
        fetchAllocations();
      } else {
        onNotification((res.data as any)?.message || 'Regulatory clearance submission failed', 'error');
      }
    } catch (err) {
      onNotification('Network error submitting regulatory clearance', 'error');
    } finally {
      setSubmittingApproval(false);
    }
  };

  // Trigger 2FA for Form 8 Sign-off
  const handleInitiateApprovalWith2FA = () => {
    if (!selectedAllocForApproval) return;
    if (!nottoForm8Checked) {
      onNotification('Please verify statutory NOTTO Form 8 clearance checkbox', 'error');
      return;
    }

    // Trigger 2FA OTP Modal
    apiClient.post('/auth/request-otp', {
      email: userEmail,
      purpose: 'NOTTO Form 8 Statutory Clearance Signature'
    }).catch(console.error);

    setTwoFactorModal({
      isOpen: true,
      purpose: 'NOTTO Form 8 Statutory Clearance Signature',
      action: executeRegulatorySignOff
    });
  };

  const trackingCode = activeAlloc
    ? `#TRK-${(activeAlloc.allocation_id || activeAlloc.id || '9824').slice(-4).toUpperCase()}-H`
    : '#TRK-9824-H';

  return (
    <div className="space-y-lg animate-fadeIn">
      {/* Top Banner & Header Section */}
      <div className="mb-lg flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
        <div>
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h2 className="text-headline-lg-mobile md:text-headline-lg font-headline-lg-mobile md:font-headline-lg text-on-background font-bold">
              {trackingCode}
            </h2>
            <span className="px-3 py-1 bg-surface-container-lowest border border-outline-variant/50 rounded-full text-label-sm font-label-sm text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px] text-primary">{organConfig.icon}</span>
              {organType} Allograft ({activeAlloc?.donor_blood_type || 'O+'} ➔ {activeAlloc?.recipient_blood_type || 'O+'})
            </span>
          </div>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <div className="px-3 py-1.5 bg-green-50 border border-green-200 rounded-md flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${activeAlloc?.logistics_status === 'in_transit' ? 'bg-green-500 pulse-beacon-red' : activeAlloc?.logistics_status === 'delivered' ? 'bg-emerald-600' : 'bg-amber-500'}`} />
              <span className="text-label-sm font-label-sm text-green-800 font-bold tracking-wide uppercase">
                {activeAlloc?.logistics_status === 'in_transit'
                  ? 'IN TRANSIT - GREEN CORRIDOR ACTIVE'
                  : activeAlloc?.logistics_status === 'delivered'
                  ? 'DELIVERED - OT HANDOVER COMPLETE'
                  : 'PENDING DISPATCH - HARVESTING STAGE'}
              </span>
            </div>

            {/* Organ Specific Ischemia Urgency Pill */}
            <div className={`px-3 py-1.5 rounded-md border text-xs font-bold flex items-center gap-1.5 ${urgency.badgeColor}`}>
              <span className="material-symbols-outlined text-sm">timer</span>
              <span>{organType} Max: {organConfig.maxHours}h ({urgency.level})</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Temperature Breach Simulation Toggle */}
          <button
            onClick={() => setTempBreachSimulated(!tempBreachSimulated)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
              tempBreachSimulated
                ? 'bg-rose-500/10 text-rose-700 border-rose-500/40 animate-pulse'
                : 'bg-surface-container text-outline border-outline-variant/40 hover:bg-surface-container-high'
            }`}
            title="Toggle cold-box temperature spike to test live IoT alert"
          >
            <span className="material-symbols-outlined text-sm">device_thermostat</span>
            <span>{tempBreachSimulated ? 'Simulating Spike (6.8°C)' : 'Simulate Temp Spike'}</span>
          </button>

          {/* Quick Refresh */}
          <button
            onClick={fetchAllocations}
            disabled={loading}
            className="glass-panel px-4 py-2 rounded-full text-label-sm font-label-sm text-on-surface-variant hover:text-primary transition-colors flex items-center gap-2 cursor-pointer"
          >
            <span className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`}>sync</span>
            <span>{loading ? 'Polling...' : 'Refresh Route'}</span>
          </button>

          {/* Prominent Reception & Hand-off Button */}
          {activeAlloc?.logistics_status !== 'delivered' && (
            <button
              onClick={() => setSelectedAllocForHandover(activeAlloc)}
              className="btn-primary-gradient px-4 py-2 rounded-full text-xs font-bold shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">task_alt</span>
              <span>Confirm Organ Reception &amp; Hand-off</span>
            </button>
          )}
        </div>
      </div>

      {/* Temperature Breach Alert Banner */}
      {!isTempSafe && (
        <div className="p-4 rounded-xl bg-rose-500/10 border-2 border-rose-500/40 flex items-center justify-between text-rose-800 animate-fadeIn shadow-sm">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-2xl text-rose-600 animate-bounce">warning</span>
            <div>
              <strong className="block text-sm font-bold">COLD-CHAIN TEMPERATURE BREACH DETECTED ({simTemperature}°C)</strong>
              <p className="text-xs text-rose-700">Storage box temperature exceeded safe threshold (2.0°C – 6.0°C). Air carrier telemetry notified.</p>
            </div>
          </div>
          <button
            onClick={() => setTempBreachSimulated(false)}
            className="px-3 py-1 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 cursor-pointer"
          >
            Acknowledge &amp; Restore
          </button>
        </div>
      )}

      {/* Section 1: Telemetry Dashboard & Organ Ischemia Timer Bento */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-md mb-lg">
        {/* Animated Transit Route (8-col) */}
        <div className="md:col-span-8 glass-panel rounded-xl flex flex-col overflow-hidden relative min-h-[380px]">
          <div className="p-4 border-b border-outline-variant/50 bg-white/40 flex justify-between items-center z-10 flex-wrap gap-2">
            <h3 className="text-title-lg font-title-lg text-on-surface flex items-center gap-2 font-bold text-base md:text-lg">
              <span className="material-symbols-outlined text-primary">route</span>
              Live Transit Route &amp; Green Corridor Flight
            </h3>
            <div className="flex items-center gap-2">
              <div className="bg-primary text-on-primary px-3 py-1 rounded-md flex items-center gap-2 shadow-sm text-white text-xs font-bold">
                <span className="material-symbols-outlined text-[16px] animate-spin-slow">flight</span>
                <span className="text-data-mono font-data-mono">{activeAlloc?.logistics_status === 'delivered' ? 'ARRIVED' : `${simEtaMinutes} mins ETA`}</span>
              </div>
            </div>
          </div>

          <div className="flex-1 relative bg-surface-container-low/50 min-h-[260px] flex items-center justify-center p-6">
            {/* Map Background Overlay */}
            <div
              className="absolute inset-0 opacity-20 pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(#00685f 1px, transparent 1px)',
                backgroundSize: '20px 20px'
              }}
            />

            {/* SVG Route Visualization */}
            <div className="w-full h-full max-h-[240px] relative flex items-center justify-center">
              <svg className="w-full h-full" preserveAspectRatio="xMidYMid meet" viewBox="0 0 600 200">
                {/* Origin Marker (Apollo Chennai) */}
                <g transform="translate(60, 110)">
                  <circle className="pulse-beacon" cx="0" cy="0" fill="#00685f" r="16" />
                  <circle cx="0" cy="0" fill="#ffffff" r="6" />
                  <text className="text-label-sm font-label-sm fill-on-surface font-bold text-[13px]" textAnchor="middle" x="0" y="32">
                    {activeAlloc?.donor_name ? `${activeAlloc.donor_name} (Origin)` : 'Apollo Chennai'}
                  </text>
                </g>

                {/* Destination Marker (AIIMS Delhi) */}
                <g transform="translate(540, 110)">
                  <circle cx="0" cy="0" fill="#0b1c30" r="14" />
                  <circle cx="0" cy="0" fill="#ffffff" r="5" />
                  <text className="text-label-sm font-label-sm fill-on-surface font-bold text-[13px]" textAnchor="middle" x="0" y="32">
                    {activeAlloc?.recipient_name ? `${activeAlloc.recipient_name} (AIIMS)` : 'AIIMS Delhi'}
                  </text>
                </g>

                {/* Route Curved Path */}
                <path d="M 76 110 Q 300 15 526 110" fill="none" stroke="#bec9c6" strokeLinecap="round" strokeWidth="4" />
                <path className="route-line" d="M 76 110 Q 300 15 526 110" fill="none" stroke="#00685f" strokeLinecap="round" strokeWidth="4" />

                {/* Live Carrier Beacon */}
                <g transform={`translate(${60 + gpsProgress * (540 - 60)}, ${110 - Math.sin(gpsProgress * Math.PI) * 95})`}>
                  <circle cx="0" cy="0" fill="rgba(255,255,255,0.95)" r="24" stroke="#E2E8F0" strokeWidth="1.5" />
                  <circle className="pulse-beacon-red" cx="0" cy="0" fill="#dc2626" r="10" />
                  <path d="M-5 -2 L5 -2 L5 2 L-5 2 Z" fill="white" />
                  <text className="text-label-sm font-label-sm fill-on-surface font-bold text-[11px]" textAnchor="middle" x="0" y="-30">
                    Carrier IND-88 (En Route)
                  </text>
                </g>
              </svg>
            </div>
          </div>

          {/* Live Telemetry GPS Bar */}
          <div className="p-3 bg-white/80 border-t border-outline-variant/30 text-xs flex justify-between items-center flex-wrap gap-2 text-on-surface-variant font-mono">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 font-bold text-primary">
                <span className="material-symbols-outlined text-[16px]">location_on</span>
                GPS: {currentLat}° N, {currentLng}° E
              </span>
              <span>•</span>
              <span>Speed: <strong>{transitSpeed} km/h</strong></span>
              <span>•</span>
              <span>Alt: <strong>{altitude.toLocaleString()} ft</strong></span>
            </div>
            <div className="text-[11px] text-outline">
              Bearing: 342° NNW • Flight Corridor #DEL-MAA-992
            </div>
          </div>
        </div>

        {/* Critical Telemetry (4-col) */}
        <div className="md:col-span-4 flex flex-col gap-sm">
          {/* Organ-Specific Cold Ischemia Countdown */}
          <div className="glass-panel-raised rounded-xl p-md flex-1 flex flex-col justify-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-surface-variant">
              <div className={`h-full ${urgency.barColor} w-1/3 rounded-r-full progress-shimmer`} />
            </div>

            <div className="flex justify-between items-start mb-2">
              <h3 className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5 font-bold">
                <span className="material-symbols-outlined text-[16px] text-primary">{organConfig.icon}</span>
                {organType} Cold Ischemia
              </h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${urgency.badgeColor}`}>
                {urgency.level}
              </span>
            </div>

            <div className={`text-display-lg font-display-lg tracking-tighter mb-2 font-bold text-4xl tabular-nums ${urgency.level === 'CRITICAL_BREACH' ? 'text-rose-600' : 'text-primary'}`}>
              {formatIschemiaTime(ischemiaSeconds)}
            </div>

            <p className="text-[11px] text-outline mb-3">{urgency.desc}</p>

            <div className="space-y-1.5">
              <div className="flex justify-between text-data-mono font-data-mono text-xs">
                <span className="text-emerald-700 font-bold">Optimal (&lt;{organConfig.optimalHours}h)</span>
                <span className="text-rose-600 font-bold">Limit ({organConfig.maxHours}h)</span>
              </div>
              <div className="w-full bg-surface-variant h-2.5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${urgency.barColor}`}
                  style={{ width: `${Math.min(100, Math.max(5, (ischemiaSeconds / maxIschemiaSeconds) * 100))}%` }}
                />
              </div>
            </div>
          </div>

          {/* 4 Sensor Readout Tiles */}
          <div className="grid grid-cols-2 gap-sm">
            {/* Storage Box Core Temperature */}
            <div className={`glass-panel rounded-lg p-3 flex flex-col gap-1 border ${isTempSafe ? 'border-outline-variant/40' : 'border-rose-500 bg-rose-50'}`}>
              <div className="flex justify-between items-start">
                <span className="material-symbols-outlined text-primary text-[20px]">device_thermostat</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${isTempSafe ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-600 text-white animate-pulse'}`}>
                  {isTempSafe ? 'SAFE' : 'ALERT'}
                </span>
              </div>
              <div className={`text-data-mono font-data-mono text-xl font-bold tabular-nums ${isTempSafe ? 'text-on-surface' : 'text-rose-600'}`}>
                {simTemperature}°C
              </div>
              <div className="text-label-sm font-label-sm text-outline text-[11px]">Core Storage (2–6°C)</div>
            </div>

            {/* External Ambient Cabin Temperature */}
            <div className="glass-panel rounded-lg p-3 flex flex-col gap-1">
              <div className="flex justify-between items-start">
                <span className="material-symbols-outlined text-outline text-[20px]">thermostat</span>
                <span className="text-[10px] font-bold text-outline bg-surface-container px-1.5 rounded">CABIN</span>
              </div>
              <div className="text-data-mono font-data-mono text-xl font-bold text-on-surface tabular-nums">
                {simAmbientTemp}°C
              </div>
              <div className="text-label-sm font-label-sm text-outline text-[11px]">Ambient Road/Air</div>
            </div>

            {/* Carrier Battery */}
            <div className="glass-panel rounded-lg p-3 flex flex-col gap-1">
              <div className="flex justify-between items-start">
                <span className="material-symbols-outlined text-primary text-[20px]">battery_charging_full</span>
                <span className="text-[10px] font-bold text-primary bg-primary-fixed px-1.5 rounded">11.8V</span>
              </div>
              <div className="text-data-mono font-data-mono text-xl font-bold text-on-surface tabular-nums">
                {simBattery}%
              </div>
              <div className="text-label-sm font-label-sm text-outline text-[11px]">Carrier Battery</div>
            </div>

            {/* Perfusion / IoT Status */}
            <div className="glass-panel rounded-lg p-3 flex flex-col gap-1">
              <div className="flex justify-between items-start">
                <span className="material-symbols-outlined text-secondary text-[20px]">sensors</span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 rounded">LIVE</span>
              </div>
              <div className="text-data-mono font-data-mono text-sm font-bold text-on-surface mt-1">
                4.2 kPa Flow
              </div>
              <div className="text-label-sm font-label-sm text-outline text-[11px]">Pulsatile Perfusion</div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Sequential 4 Transit Checkpoints Bar */}
      <div className="glass-panel rounded-xl p-md mb-lg">
        <h3 className="text-title-lg font-title-lg text-on-surface mb-6 flex items-center gap-2 border-b border-outline-variant/30 pb-3 font-bold text-base md:text-lg">
          <span className="material-symbols-outlined text-primary">alt_route</span>
          Cold-Chain Transit Checkpoints &amp; Chain of Custody
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative">
          {/* Checkpoint 1: Retrieval */}
          <div className="p-4 rounded-xl bg-white border-2 border-emerald-500/40 shadow-xs relative">
            <div className="flex justify-between items-start mb-2">
              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
                <span className="material-symbols-outlined text-sm">check</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                10:42 AM IST
              </span>
            </div>
            <h4 className="font-bold text-sm text-on-surface">1. Excision &amp; Retrieval</h4>
            <p className="text-xs text-outline mt-1 font-medium">Apollo Hospitals Chennai</p>
            <p className="text-[11px] text-emerald-700 mt-2 font-mono">Surgeon: Dr. Ananya Iyer</p>
          </div>

          {/* Checkpoint 2: Flight / Transit (Active) */}
          <div className="p-4 rounded-xl bg-primary-container/10 border-2 border-primary shadow-xs relative">
            <div className="flex justify-between items-start mb-2">
              <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold pulse-beacon">
                <span className="material-symbols-outlined text-sm">flight</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary text-white">
                IN PROGRESS
              </span>
            </div>
            <h4 className="font-bold text-sm text-primary">2. Green Corridor Transit</h4>
            <p className="text-xs text-on-surface-variant mt-1 font-medium">Air Courier IND-88</p>
            <p className="text-[11px] text-primary mt-2 font-mono font-bold">ETA: {simEtaMinutes} mins • 420 km/h</p>
          </div>

          {/* Checkpoint 3: Hospital Reception */}
          <div className={`p-4 rounded-xl border transition-all ${activeAlloc?.logistics_status === 'delivered' ? 'bg-white border-2 border-emerald-500/40' : 'bg-surface-container-low border-outline-variant/40 opacity-80'}`}>
            <div className="flex justify-between items-start mb-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${activeAlloc?.logistics_status === 'delivered' ? 'bg-emerald-600 text-white' : 'bg-surface-container text-outline'}`}>
                {activeAlloc?.logistics_status === 'delivered' ? <span className="material-symbols-outlined text-sm">check</span> : '3'}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-surface-container text-outline">
                {activeAlloc?.logistics_status === 'delivered' ? 'COMPLETED' : 'UPCOMING'}
              </span>
            </div>
            <h4 className="font-bold text-sm text-on-surface">3. Hospital Reception</h4>
            <p className="text-xs text-outline mt-1 font-medium">AIIMS Trauma Bay Entry</p>
            <p className="text-[11px] text-outline mt-2">Cold-box seal verification</p>
          </div>

          {/* Checkpoint 4: OT Hand-off */}
          <div className={`p-4 rounded-xl border transition-all ${activeAlloc?.logistics_status === 'delivered' ? 'bg-white border-2 border-emerald-500/40' : 'bg-surface-container-low border-outline-variant/40 opacity-80'}`}>
            <div className="flex justify-between items-start mb-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${activeAlloc?.logistics_status === 'delivered' ? 'bg-emerald-600 text-white' : 'bg-surface-container text-outline'}`}>
                {activeAlloc?.logistics_status === 'delivered' ? <span className="material-symbols-outlined text-sm">check</span> : '4'}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-surface-container text-outline">
                {activeAlloc?.logistics_status === 'delivered' ? 'COMPLETED' : 'STANDBY'}
              </span>
            </div>
            <h4 className="font-bold text-sm text-on-surface">4. OT-4 Surgical Hand-off</h4>
            <p className="text-xs text-outline mt-1 font-medium">AIIMS Delhi Transplant Suite</p>
            <p className="text-[11px] text-outline mt-2">Immediate Implantation</p>
          </div>
        </div>
      </div>

      {/* Section 3: Statutory Protocol & Active Dispatch Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-md">
        {/* Statutory Timeline & Form 8 Protocol */}
        <div className="glass-panel rounded-xl p-md">
          <h3 className="text-title-lg font-title-lg text-on-surface mb-6 flex items-center gap-2 border-b border-outline-variant/30 pb-3 font-bold text-base md:text-lg">
            <span className="material-symbols-outlined text-primary">gavel</span>
            Statutory Protocol &amp; Form 8 Clearances
          </h3>

          <div className="relative pl-6 space-y-6 before:absolute before:inset-0 before:left-3 before:h-full before:w-0.5 before:bg-outline-variant/40">
            {/* Step 1: Completed */}
            <div className="relative flex items-start gap-3">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white shrink-0 -ml-6 z-10 shadow-xs">
                <span className="material-symbols-outlined text-[14px]">check</span>
              </div>
              <div className="w-full bg-white/80 border border-outline-variant/50 p-4 rounded-lg shadow-sm">
                <div className="flex justify-between items-start mb-1">
                  <h4 className="text-data-mono font-data-mono font-bold text-on-surface text-sm">
                    Donor Surgeon Approval
                  </h4>
                  <span className="text-[10px] text-on-surface-variant bg-surface-container px-2 py-0.5 rounded font-mono">
                    10:42 AM
                  </span>
                </div>
                <p className="text-label-sm font-label-sm text-on-surface-variant text-xs">
                  Dr. Ananya Iyer (Apollo Hospitals Chennai) • MCI-TN-89211
                </p>
              </div>
            </div>

            {/* Step 2: Active / Actionable */}
            <div className="relative flex items-start gap-3">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white border-2 border-primary shrink-0 -ml-6 z-10">
                <div className="w-2 h-2 rounded-full bg-primary pulse-beacon" />
              </div>
              <div className="w-full bg-primary-container/10 border-2 border-primary/30 p-4 rounded-lg">
                <div className="flex justify-between items-start mb-1">
                  <h4 className="text-data-mono font-data-mono text-primary font-bold text-sm">
                    NOTTO Sign-Off (Form 8)
                  </h4>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${activeAlloc?.regulatory_approval ? 'bg-green-100 text-green-800' : 'bg-primary-fixed text-primary'}`}>
                    {activeAlloc?.regulatory_approval ? 'APPROVED' : 'ACTION REQUIRED'}
                  </span>
                </div>
                <p className="text-label-sm font-label-sm text-on-surface-variant text-xs mb-2">
                  {activeAlloc?.regulatory_approval ? 'Statutory clearance verified by NOTTO Regulatory Officer' : 'Awaiting final regulatory officer signature under THOA 2014 rules'}
                </p>
                {!activeAlloc?.regulatory_approval && isRegulatoryOfficer && (
                  <button
                    onClick={() => setSelectedAllocForApproval(activeAlloc)}
                    className="btn-primary-gradient text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">draw</span>
                    <span>Sign NOTTO Form 8 (2FA Protected)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Step 3: Pending */}
            <div className="relative flex items-start gap-3">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white border-2 border-outline-variant shrink-0 -ml-6 z-10" />
              <div className="w-full bg-white/40 border border-outline-variant/30 p-4 rounded-lg opacity-80">
                <h4 className="text-data-mono font-data-mono text-on-surface-variant mb-1 font-bold text-sm">
                  Recipient Hospital OT Intake
                </h4>
                <p className="text-label-sm font-label-sm text-on-surface-variant text-xs">
                  {activeAlloc?.recipient_name || 'AIIMS Delhi'} - {activeAlloc?.logistics_status === 'delivered' ? 'Intake Complete' : 'Pending Arrival'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Dispatch Ledger */}
        <div className="glass-panel rounded-xl p-md flex flex-col">
          <div className="flex justify-between items-center border-b border-outline-variant/30 pb-3 mb-4 flex-wrap gap-2">
            <h3 className="text-title-lg font-title-lg text-on-surface flex items-center gap-2 font-bold text-base md:text-lg">
              <span className="material-symbols-outlined text-primary">list_alt</span>
              Dispatch Ledger
            </h3>

            <div className="flex gap-2">
              {activeAlloc?.logistics_status === 'pending' && (
                <button
                  onClick={() => handleUpdateLogistics(activeAlloc.allocation_id || activeAlloc.id || '', 'in_transit')}
                  disabled={updatingId === (activeAlloc.allocation_id || activeAlloc.id)}
                  className="bg-secondary text-on-secondary text-white px-3 py-1.5 rounded-md text-label-sm font-label-sm hover:opacity-90 transition flex items-center gap-1 shadow-sm font-bold cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">local_shipping</span>
                  <span>{updatingId ? 'Dispatching...' : 'Dispatch'}</span>
                </button>
              )}

              {activeAlloc?.logistics_status === 'in_transit' && (
                <button
                  onClick={() => setSelectedAllocForHandover(activeAlloc)}
                  className="bg-emerald-600 text-white px-3 py-1.5 rounded-md text-label-sm font-label-sm hover:bg-emerald-700 transition flex items-center gap-1 font-bold cursor-pointer shadow-sm"
                >
                  <span className="material-symbols-outlined text-[16px]">done_all</span>
                  <span>Confirm Hand-off (2FA)</span>
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-label-sm font-label-sm text-on-surface-variant border-b border-outline-variant/30 text-xs uppercase font-semibold">
                  <th className="py-2 px-3">Time (IST)</th>
                  <th className="py-2 px-3">Event</th>
                  <th className="py-2 px-3">Actor / Node</th>
                  <th className="py-2 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="text-data-mono font-data-mono text-xs">
                <tr className="border-b border-outline-variant/20 hover:bg-surface-container/30 transition-colors">
                  <td className="py-3 px-3 text-on-surface-variant font-medium">11:15 AM</td>
                  <td className="py-3 px-3 font-semibold text-on-surface">Green Corridor Activated</td>
                  <td className="py-3 px-3 text-on-surface-variant">Traffic Police CN</td>
                  <td className="py-3 px-3 text-right">
                    <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded text-[10px] font-bold">
                      <span className="material-symbols-outlined text-[12px]">check_circle</span> OK
                    </span>
                  </td>
                </tr>
                <tr className="border-b border-outline-variant/20 hover:bg-surface-container/30 transition-colors">
                  <td className="py-3 px-3 text-on-surface-variant font-medium">11:05 AM</td>
                  <td className="py-3 px-3 font-semibold text-on-surface">Carrier Departed Origin</td>
                  <td className="py-3 px-3 text-on-surface-variant">Carrier ID: IND-88</td>
                  <td className="py-3 px-3 text-right">
                    <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded text-[10px] font-bold">
                      <span className="material-symbols-outlined text-[12px]">check_circle</span> OK
                    </span>
                  </td>
                </tr>
                <tr className="border-b border-outline-variant/20 hover:bg-surface-container/30 transition-colors">
                  <td className="py-3 px-3 text-on-surface-variant font-medium">10:58 AM</td>
                  <td className="py-3 px-3 font-semibold text-on-surface">Icebox Sealed (IoT active)</td>
                  <td className="py-3 px-3 text-on-surface-variant">Sys Telemetry</td>
                  <td className="py-3 px-3 text-right">
                    <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded text-[10px] font-bold">
                      <span className="material-symbols-outlined text-[12px]">check_circle</span> OK
                    </span>
                  </td>
                </tr>
                <tr className="hover:bg-surface-container/30 transition-colors opacity-70">
                  <td className="py-3 px-3 text-on-surface-variant font-medium">10:45 AM</td>
                  <td className="py-3 px-3 font-semibold text-on-surface">Organ Excision Complete</td>
                  <td className="py-3 px-3 text-on-surface-variant">Dr. Ananya Iyer</td>
                  <td className="py-3 px-3 text-right">
                    <span className="inline-flex items-center gap-1 text-on-surface-variant bg-surface-variant px-2 py-0.5 rounded text-[10px] font-bold">
                      <span className="material-symbols-outlined text-[12px]">history</span> LOG
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Hand-off & Reception Confirmation Modal */}
      {selectedAllocForHandover && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel-raised max-w-lg w-full rounded-2xl p-6 shadow-2xl animate-fadeIn border border-outline-variant/40 bg-white">
            <div className="flex justify-between items-center pb-4 border-b border-outline-variant/30">
              <h3 className="font-headline-md text-lg font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600">task_alt</span>
                Confirm Organ Reception &amp; OT Hand-off
              </h3>
              <button
                onClick={() => setSelectedAllocForHandover(null)}
                className="p-1 rounded-lg hover:bg-surface-container text-outline cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="py-4 space-y-4">
              <div className="p-3.5 rounded-xl bg-surface-container/50 border border-outline-variant/30 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-outline">Tracking ID:</span>
                  <span className="font-mono font-bold text-on-surface">{trackingCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-outline">Organ Allograft:</span>
                  <span className="font-bold text-primary">{selectedAllocForHandover.donor_organ} ({selectedAllocForHandover.donor_blood_type} ➔ {selectedAllocForHandover.recipient_blood_type})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-outline">Final Cold Ischemia:</span>
                  <span className="font-bold text-on-surface font-mono">{formatIschemiaTime(ischemiaSeconds)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-outline">Delivery Core Temp:</span>
                  <span className="font-bold text-emerald-700">{simTemperature}°C (Optimal 2–6°C)</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">
                  Receiving Transplant Surgeon / OT In-Charge
                </label>
                <input
                  type="text"
                  value={handoverRecipientSurgeon}
                  onChange={(e) => setHandoverRecipientSurgeon(e.target.value)}
                  className="input-mist w-full rounded-xl p-3 text-xs text-on-surface"
                />
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-start gap-2 text-xs text-on-surface cursor-pointer">
                  <input
                    type="checkbox"
                    checked={handoverSealIntact}
                    onChange={(e) => setHandoverSealIntact(e.target.checked)}
                    className="accent-primary mt-0.5 rounded"
                  />
                  <span>
                    I verify that the cold-chain storage container tamper-evident security seal is <strong>INTACT</strong> and uncompromised upon arrival.
                  </span>
                </label>

                <label className="flex items-start gap-2 text-xs text-on-surface cursor-pointer">
                  <input
                    type="checkbox"
                    checked={handoverTempChecked}
                    onChange={(e) => setHandoverTempChecked(e.target.checked)}
                    className="accent-primary mt-0.5 rounded"
                  />
                  <span>
                    I verify that the organ allograft core temperature was maintained within safe clinical parameters (2.0°C – 6.0°C).
                  </span>
                </label>
              </div>
            </div>

            <div className="pt-3 border-t border-outline-variant/20 flex justify-end gap-2">
              <button
                onClick={() => setSelectedAllocForHandover(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-outline hover:bg-surface-container cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleInitiateHandoverWith2FA}
                disabled={submittingHandover}
                className="bg-emerald-600 text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-emerald-700 transition cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <span className="material-symbols-outlined text-sm">lock</span>
                <span>Proceed to 2FA &amp; Sign Hand-off</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form 8 Regulatory Sign-Off Modal */}
      {selectedAllocForApproval && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel-raised max-w-lg w-full rounded-2xl p-6 shadow-2xl animate-fadeIn border border-outline-variant/40 bg-white">
            <div className="flex justify-between items-center pb-4 border-b border-outline-variant/30">
              <h3 className="font-headline-md text-lg font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">gavel</span>
                NOTTO Form 8 Statutory Clearance
              </h3>
              <button
                onClick={() => setSelectedAllocForApproval(null)}
                className="p-1 rounded-lg hover:bg-surface-container text-outline cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="py-4 space-y-4">
              <div className="p-3 rounded-xl bg-surface-container/50 border border-outline-variant/30 text-xs space-y-1">
                <p><strong>Tracking Code:</strong> {trackingCode}</p>
                <p><strong>Donor Center:</strong> {selectedAllocForApproval.donor_name}</p>
                <p><strong>Recipient Center:</strong> {selectedAllocForApproval.recipient_name}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">
                  Regulatory Compliance Rationale &amp; Notes
                </label>
                <textarea
                  rows={3}
                  value={complianceNotes}
                  onChange={(e) => setComplianceNotes(e.target.value)}
                  className="input-mist w-full rounded-xl p-3 text-xs text-on-surface"
                />
              </div>

              <label className="flex items-start gap-2 text-xs text-on-surface cursor-pointer">
                <input
                  type="checkbox"
                  checked={nottoForm8Checked}
                  onChange={(e) => setNottoForm8Checked(e.target.checked)}
                  className="accent-primary mt-0.5 rounded"
                />
                <span>
                  I hereby certify under THOA 2014 rules that NOTTO Form 8 statutory clearances, HLA crossmatches, and hospital authorizations are validated without discrepancy.
                </span>
              </label>
            </div>

            <div className="pt-3 border-t border-outline-variant/20 flex justify-end gap-2">
              <button
                onClick={() => setSelectedAllocForApproval(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-outline hover:bg-surface-container cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleInitiateApprovalWith2FA}
                disabled={submittingApproval}
                className="btn-primary-gradient px-5 py-2 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">lock</span>
                <span>Proceed to 2FA &amp; Sign</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reusable 2FA OTP Modal */}
      <TwoFactorOtpModal
        isOpen={twoFactorModal.isOpen}
        email={userEmail}
        purpose={twoFactorModal.purpose}
        onClose={() => setTwoFactorModal(prev => ({ ...prev, isOpen: false }))}
        onSuccess={twoFactorModal.action}
        onNotification={onNotification}
      />
    </div>
  );
};
