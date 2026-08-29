import React from 'react';
import { AuthSession } from '../types';

interface ClinicalHeaderProps {
  session: AuthSession;
  onLogout: () => void;
  autoSync: boolean;
  onToggleAutoSync: () => void;
}

export const ClinicalHeader: React.FC<ClinicalHeaderProps> = ({
  session,
  onLogout,
  autoSync,
  onToggleAutoSync
}) => {
  const { user, hospital } = session;
  const role = (user.user_role || '').toLowerCase();

  const getRoleBadge = () => {
    if (role.includes('surgeon')) {
      return {
        title: 'Transplant Surgeon',
        classes: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
        icon: 'healing'
      };
    }
    if (role.includes('admin')) {
      return {
        title: 'Hospital Admin',
        classes: 'bg-indigo-500/10 text-indigo-700 border-indigo-500/30',
        icon: 'local_hospital'
      };
    }
    return {
      title: 'Regulatory Officer',
      classes: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
      icon: 'gavel'
    };
  };

  const badge = getRoleBadge();

  return (
    <header className="sticky top-0 left-0 w-full z-50 flex justify-between items-center px-4 lg:px-8 py-3 bg-white/85 backdrop-blur-md border-b border-outline-variant/30 shadow-xs transition-all duration-150">
      {/* Brand & Hospital Node */}
      <div className="flex items-center gap-md">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-primary-container flex items-center justify-center text-white shadow-xs">
            <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              monitor_heart
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display-lg text-lg lg:text-xl font-bold tracking-tight text-primary">
                NOTTO VitalSync
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-secondary-container/40 text-on-secondary-container border border-secondary-container">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                {hospital?.hospital_code || 'AIIMS-DEL-01'}
              </span>
            </div>
            <p className="text-[11px] text-outline font-medium hidden md:block">
              {hospital?.name || 'All India Institute of Medical Sciences (AIIMS)'} • {hospital?.city || 'New Delhi'}
            </p>
          </div>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-sm lg:gap-md">
        {/* Staff Profile Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-container-low border border-outline-variant/30 shadow-xs">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
            <span className="material-symbols-outlined text-[16px]">{badge.icon}</span>
          </div>
          <div className="text-left hidden sm:block">
            <div className="flex items-center gap-1.5">
              <span className="font-label-md text-xs font-bold text-on-surface">{user.full_name}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md border ${badge.classes}`}>
                {badge.title}
              </span>
            </div>
            <p className="text-[10px] font-mono text-outline leading-none mt-0.5">
              Lic: {user.medical_license || 'MCI-TN-89211'}
            </p>
          </div>
        </div>

        {/* Live Sync Toggle */}
        <button
          onClick={onToggleAutoSync}
          title={autoSync ? 'Live auto-sync active' : 'Sync paused'}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-label-md transition-all cursor-pointer border ${
            autoSync
              ? 'bg-tertiary-container/10 border-tertiary-container/30 text-tertiary-container'
              : 'bg-surface-container border-outline-variant/40 text-outline'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${autoSync ? 'bg-tertiary-container pulse-glow' : 'bg-outline'}`} />
          <span className="hidden md:inline">{autoSync ? 'Live' : 'Paused'}</span>
        </button>

        {/* Sign Out */}
        <button
          onClick={onLogout}
          title="Sign out"
          className="flex items-center gap-1 text-xs font-label-md px-3 py-1.5 rounded-xl border border-outline-variant/40 text-on-surface hover:bg-error-container/40 hover:text-error hover:border-error/30 transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">logout</span>
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );
};
