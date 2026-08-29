import React from 'react';

interface StatsOverviewProps {
  donorCount: number;
  recipientCount: number;
  matchCount: number;
  allocationCount: number;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({
  donorCount,
  recipientCount,
  matchCount,
  allocationCount,
}) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-md mb-xl animate-fadeIn">
      {/* Donors Stat Card */}
      <div className="glass-card rounded-2xl p-md flex items-center justify-between hover:border-primary/50 transition-all duration-200">
        <div>
          <p className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Registered Donors</p>
          <p className="font-headline-lg text-headline-lg font-bold text-primary font-tabular-nums mt-1">{donorCount}</p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-primary-container/10 border border-primary/20 flex items-center justify-center text-primary">
          <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>person_add</span>
        </div>
      </div>

      {/* Recipient Stat Card */}
      <div className="glass-card rounded-2xl p-md flex items-center justify-between hover:border-error/40 transition-all duration-200">
        <div>
          <p className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Waitlist Candidates</p>
          <p className="font-headline-lg text-headline-lg font-bold text-error font-tabular-nums mt-1">{recipientCount}</p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-error-container/40 border border-error/20 flex items-center justify-center text-error">
          <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>group</span>
        </div>
      </div>

      {/* Matches Stat Card */}
      <div className="glass-card rounded-2xl p-md flex items-center justify-between hover:border-tertiary-container/50 transition-all duration-200">
        <div>
          <p className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Matched Pairings</p>
          <p className="font-headline-lg text-headline-lg font-bold text-tertiary font-tabular-nums mt-1">{matchCount}</p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-tertiary-container/10 border border-tertiary/20 flex items-center justify-center text-tertiary">
          <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>monitor_heart</span>
        </div>
      </div>

      {/* Active Shipments Stat Card */}
      <div className="glass-card rounded-2xl p-md flex items-center justify-between hover:border-secondary-container/50 transition-all duration-200">
        <div>
          <p className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Cold-Chain Active</p>
          <p className="font-headline-lg text-headline-lg font-bold text-secondary font-tabular-nums mt-1">{allocationCount}</p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-secondary-container/30 border border-secondary-container/40 flex items-center justify-center text-on-secondary-container">
          <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>local_shipping</span>
        </div>
      </div>
    </div>
  );
};
