import React, { useState, useEffect } from 'react';
import { MatchingDashboard } from './components/MatchingDashboard';
import { RegistryView } from './components/RegistryView';
import { AllocationTracker } from './components/AllocationTracker';
import { AuditTrailView } from './components/AuditTrailView';
import { SystemStatus } from './components/SystemStatus';
import { StatsOverview } from './components/StatsOverview';
import { ClinicalHeader } from './components/ClinicalHeader';
import { StarterHospitalLogin } from './components/STARTER_HOSPITAL_LOGIN';
import { HealthResponse, AuthSession } from './types';
import { apiClient, getStoredSession, clearStoredSession } from './services/apiClient';

type TabType = 'matches' | 'registry' | 'allocations' | 'audit' | 'health';

interface ToastNotification {
  id: number;
  message: string;
  type: 'success' | 'error';
}

export const App: React.FC = () => {
  const [session, setSession] = useState<AuthSession | null>(() => getStoredSession());
  const [activeTab, setActiveTab] = useState<TabType>('matches');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<ToastNotification[]>([]);

  // Dynamic Live Counts for Stats Overview
  const [donorCount, setDonorCount] = useState<number>(5);
  const [recipientCount, setRecipientCount] = useState<number>(5);
  const [matchCount, setMatchCount] = useState<number>(3);
  const [allocationCount, setAllocationCount] = useState<number>(1);

  // Auto-Sync Toggle
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(true);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);

    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  };

  const removeNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleLogout = () => {
    clearStoredSession();
    setSession(null);
    showNotification('Logged out of clinical session successfully.', 'success');
  };

  const handleRoleSwitch = (role: 'surgeon' | 'admin' | 'regulatory') => {
    let mockUser: any;
    if (role === 'surgeon') {
      mockUser = {
        id: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
        hospital_id: '22222222-2222-4222-a222-222222222222',
        full_name: 'Dr. Ananya Iyer',
        email: 'ananya.iyer@apollo.org',
        user_role: 'transplant_surgeon',
        medical_license: 'MCI-TN-89211',
        is_authorized: true
      };
    } else if (role === 'admin') {
      mockUser = {
        id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
        hospital_id: '11111111-1111-4111-a111-111111111111',
        full_name: 'Dr. Rajesh Sharma',
        email: 'rajesh.sharma@aiims.edu',
        user_role: 'hospital_admin',
        medical_license: 'MCI-DL-44821',
        is_authorized: true
      };
    } else {
      mockUser = {
        id: 'cccccccc-cccc-4ccc-bccc-cccccccccccc',
        hospital_id: '33333333-3333-4333-a333-333333333333',
        full_name: 'Officer Vikramaditya Sen',
        email: 'vikram.sen@notto.gov.in',
        user_role: 'regulatory_officer',
        medical_license: 'NOTTO-REG-009',
        is_authorized: true
      };
    }

    const newSession: AuthSession = {
      token: 'mock-jwt-token',
      user: mockUser,
      hospital: {
        id: mockUser.hospital_id,
        name: role === 'surgeon' ? 'Apollo Hospitals Enterprise' : role === 'admin' ? 'All India Institute of Medical Sciences' : 'NOTTO Central Registry',
        hospital_code: role === 'surgeon' ? 'APOLLO-CHE-02' : role === 'admin' ? 'AIIMS-DEL-01' : 'NOTTO-CENTRAL',
        city: role === 'surgeon' ? 'Chennai' : 'New Delhi',
        state: role === 'surgeon' ? 'Tamil Nadu' : 'Delhi',
        verification_status: 'VERIFIED'
      }
    };

    localStorage.setItem('organ_transplant_token', newSession.token);
    localStorage.setItem('organ_transplant_session', JSON.stringify(newSession));
    setSession(newSession);
    showNotification(`Switched role to ${mockUser.full_name} (${mockUser.user_role})!`, 'success');
  };

  const fetchSummaryCounts = async () => {
    if (!session) return;
    try {
      const [dRes, rRes, aRes] = await Promise.all([
        apiClient.get<{ count: number; donors: any[] }>('/donors'),
        apiClient.get<{ count: number; recipients: any[] }>('/recipients'),
        apiClient.get<{ count: number; allocations: any[] }>('/allocations')
      ]);

      if (dRes.ok && dRes.data) {
        setDonorCount(dRes.data.count || dRes.data.donors?.length || 5);
      }
      if (rRes.ok && rRes.data) {
        setRecipientCount(rRes.data.count || rRes.data.recipients?.length || 5);
      }
      if (aRes.ok && aRes.data) {
        const count = aRes.data.count || aRes.data.allocations?.length || 1;
        setAllocationCount(count);
        setMatchCount(count + 2);
      }
    } catch (err) {
      // Fallback
    }
  };

  const fetchHealth = async () => {
    setHealthLoading(true);
    try {
      const res = await apiClient.get<HealthResponse>('/health');
      if (res.ok && res.data) {
        setHealth(res.data);
      } else {
        setHealth(null);
      }
    } catch (err) {
      console.error('Failed to fetch health status:', err);
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  };

  // Global Unauthorized Interceptor Handler
  useEffect(() => {
    const handleUnauthorized = () => {
      setSession(null);
      showNotification('Session expired or unauthorized. Please sign in again.', 'error');
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  useEffect(() => {
    if (session) {
      fetchHealth();
      fetchSummaryCounts();
    }
  }, [session]);

  // Live Auto-Sync Loop
  useEffect(() => {
    if (!autoSyncEnabled || !session) return;

    const interval = setInterval(() => {
      fetchSummaryCounts();
    }, 5000);

    return () => clearInterval(interval);
  }, [autoSyncEnabled, session]);

  // Route Guarding: Show Login Screen if Unauthenticated
  if (!session) {
    return (
      <div className="bg-background text-on-background min-h-screen">
        {/* Toast Notifications Overlay */}
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full">
          {notifications.map(n => (
            <div 
              key={n.id}
              className={`flex items-center justify-between gap-3 p-4 rounded-xl shadow-lg text-white font-label-md text-label-md backdrop-blur-md ${
                n.type === 'success' ? 'bg-primary' : 'bg-error'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">
                  {n.type === 'success' ? 'check_circle' : 'error'}
                </span>
                <span>{n.message}</span>
              </div>
              <button onClick={() => removeNotification(n.id)} className="text-white hover:opacity-80 cursor-pointer">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          ))}
        </div>

        <StarterHospitalLogin 
          onLoginSuccess={(s) => {
            setSession(s);
            fetchSummaryCounts();
          }}
          onNotification={showNotification}
        />
      </div>
    );
  }

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col font-body-md relative overflow-x-hidden selection:bg-primary/20 selection:text-primary">
      {/* Ambient Background Glows */}
      <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-secondary-container/20 rounded-full blur-[120px] -z-10 pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary-container/10 rounded-full blur-[100px] -z-10 pointer-events-none" />

      {/* Toast Notifications Overlay */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full">
        {notifications.map(n => (
          <div 
            key={n.id}
            className={`flex items-center justify-between gap-3 p-4 rounded-xl shadow-lg text-white font-label-md text-xs font-bold backdrop-blur-md ${
              n.type === 'success' ? 'bg-primary' : 'bg-error'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base">
                {n.type === 'success' ? 'check_circle' : 'error'}
              </span>
              <span>{n.message}</span>
            </div>
            <button onClick={() => removeNotification(n.id)} className="text-white hover:opacity-80 cursor-pointer">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        ))}
      </div>

      {/* TopAppBar */}
      <ClinicalHeader 
        session={session}
        onLogout={handleLogout}
        autoSync={autoSyncEnabled}
        onToggleAutoSync={() => setAutoSyncEnabled(!autoSyncEnabled)}
      />

      <div className="flex flex-1 w-full min-h-[calc(100vh-65px)]">
        {/* Desktop SideNavBar */}
        <aside className="hidden md:flex flex-col w-64 bg-white/85 backdrop-blur-xl border-r border-outline-variant/20 shadow-md p-md space-y-2 shrink-0 sticky top-[65px] h-[calc(100vh-65px)] z-40">
          {/* Header Badge */}
          <div className="mb-md px-2">
            <h1 className="font-headline-md text-base font-bold text-primary">Clinical Portal</h1>
            <p className="font-label-sm text-xs text-outline font-medium">NOTTO Verified Node</p>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 space-y-1">
            <button
              onClick={() => setActiveTab('matches')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-label-md text-sm cursor-pointer ${
                activeTab === 'matches'
                  ? 'bg-secondary-container text-on-secondary-container font-bold shadow-xs'
                  : 'text-on-surface-variant hover:bg-surface-variant/50'
              }`}
            >
              <span
                className="material-symbols-outlined text-lg"
                style={{ fontVariationSettings: activeTab === 'matches' ? "'FILL' 1" : "'FILL' 0" }}
              >
                monitor_heart
              </span>
              <span>Organ Matching</span>
            </button>

            <button
              onClick={() => setActiveTab('registry')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-label-md text-sm cursor-pointer ${
                activeTab === 'registry'
                  ? 'bg-secondary-container text-on-secondary-container font-bold shadow-xs'
                  : 'text-on-surface-variant hover:bg-surface-variant/50'
              }`}
            >
              <span
                className="material-symbols-outlined text-lg"
                style={{ fontVariationSettings: activeTab === 'registry' ? "'FILL' 1" : "'FILL' 0" }}
              >
                format_list_bulleted
              </span>
              <span>Waitlist Registry</span>
            </button>

            <button
              onClick={() => setActiveTab('allocations')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-label-md text-sm cursor-pointer ${
                activeTab === 'allocations'
                  ? 'bg-secondary-container text-on-secondary-container font-bold shadow-xs'
                  : 'text-on-surface-variant hover:bg-surface-variant/50'
              }`}
            >
              <span
                className="material-symbols-outlined text-lg"
                style={{ fontVariationSettings: activeTab === 'allocations' ? "'FILL' 1" : "'FILL' 0" }}
              >
                local_shipping
              </span>
              <span>Cold-Chain Logistics</span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-label-md text-sm cursor-pointer ${
                activeTab === 'audit'
                  ? 'bg-secondary-container text-on-secondary-container font-bold shadow-xs'
                  : 'text-on-surface-variant hover:bg-surface-variant/50'
              }`}
            >
              <span
                className="material-symbols-outlined text-lg"
                style={{ fontVariationSettings: activeTab === 'audit' ? "'FILL' 1" : "'FILL' 0" }}
              >
                gavel
              </span>
              <span>Regulatory &amp; Audit</span>
            </button>

            <button
              onClick={() => setActiveTab('health')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-label-md text-sm cursor-pointer ${
                activeTab === 'health'
                  ? 'bg-secondary-container text-on-secondary-container font-bold shadow-xs'
                  : 'text-on-surface-variant hover:bg-surface-variant/50'
              }`}
            >
              <span
                className="material-symbols-outlined text-lg"
                style={{ fontVariationSettings: activeTab === 'health' ? "'FILL' 1" : "'FILL' 0" }}
              >
                health_metrics
              </span>
              <span>System Health</span>
            </button>
          </nav>

          {/* SideNav Footer CTA */}
          <div className="mt-auto pt-4 space-y-3 border-t border-outline-variant/20">
            <button
              onClick={() => {
                setActiveTab('matches');
                showNotification('Emergency donor organ match protocol triggered!', 'success');
              }}
              className="w-full py-2.5 px-4 btn-gradient rounded-xl font-label-md text-xs font-bold shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">emergency</span>
              <span>Emergency Match</span>
            </button>

            <div className="space-y-0.5">
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-error hover:bg-error-container/20 rounded-xl transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full min-w-0 pb-24 md:pb-8">
          {/* Stats Overview */}
          <StatsOverview 
            donorCount={donorCount}
            recipientCount={recipientCount}
            matchCount={matchCount}
            allocationCount={allocationCount}
          />

          {activeTab === 'matches' && (
            <MatchingDashboard 
              onNotification={showNotification}
              onNavigateToAllocations={() => {
                setActiveTab('allocations');
                fetchSummaryCounts();
              }}
            />
          )}

          {activeTab === 'registry' && (
            <RegistryView onNotification={(msg, type) => {
              showNotification(msg, type);
              fetchSummaryCounts();
            }} />
          )}

          {activeTab === 'allocations' && (
            <AllocationTracker onNotification={(msg, type) => {
              showNotification(msg, type);
              fetchSummaryCounts();
            }} />
          )}

          {activeTab === 'audit' && (
            <AuditTrailView onNotification={(msg, type) => {
              showNotification(msg, type);
            }} />
          )}

          {activeTab === 'health' && (
            <SystemStatus 
              health={health}
              loading={healthLoading}
              onRefresh={fetchHealth}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 py-2 pb-safe bg-white/90 backdrop-blur-lg border-t border-outline-variant/30 shadow-lg rounded-t-xl">
        <button
          onClick={() => setActiveTab('matches')}
          className={`flex flex-col items-center justify-center p-1 rounded-lg ${
            activeTab === 'matches' ? 'text-primary font-bold' : 'text-on-surface-variant'
          }`}
        >
          <span className="material-symbols-outlined text-xl">monitor_heart</span>
          <span className="text-[10px] font-label-sm">Matches</span>
        </button>

        <button
          onClick={() => setActiveTab('registry')}
          className={`flex flex-col items-center justify-center p-1 rounded-lg ${
            activeTab === 'registry' ? 'text-primary font-bold' : 'text-on-surface-variant'
          }`}
        >
          <span className="material-symbols-outlined text-xl">format_list_bulleted</span>
          <span className="text-[10px] font-label-sm">Waitlist</span>
        </button>

        <button
          onClick={() => setActiveTab('allocations')}
          className={`flex flex-col items-center justify-center p-1 rounded-lg ${
            activeTab === 'allocations' ? 'text-primary font-bold' : 'text-on-surface-variant'
          }`}
        >
          <span className="material-symbols-outlined text-xl">local_shipping</span>
          <span className="text-[10px] font-label-sm">Logistics</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex flex-col items-center justify-center p-1 rounded-lg ${
            activeTab === 'audit' ? 'text-primary font-bold' : 'text-on-surface-variant'
          }`}
        >
          <span className="material-symbols-outlined text-xl">gavel</span>
          <span className="text-[10px] font-label-sm">Audit</span>
        </button>

        <button
          onClick={() => setActiveTab('health')}
          className={`flex flex-col items-center justify-center p-1 rounded-lg ${
            activeTab === 'health' ? 'text-primary font-bold' : 'text-on-surface-variant'
          }`}
        >
          <span className="material-symbols-outlined text-xl">health_metrics</span>
          <span className="text-[10px] font-label-sm">Health</span>
        </button>
      </nav>
    </div>
  );
};

export default App;

