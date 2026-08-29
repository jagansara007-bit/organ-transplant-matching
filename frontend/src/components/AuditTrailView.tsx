import React, { useState, useEffect } from 'react';
import { AuditLogRecord } from '../types';
import { apiClient } from '../services/apiClient';

interface AuditTrailViewProps {
  onNotification: (msg: string, type: 'success' | 'error') => void;
}

export const AuditTrailView: React.FC<AuditTrailViewProps> = ({ onNotification }) => {
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedActionFilter, setSelectedActionFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ auditLogs: AuditLogRecord[] }>('/allocations/audit-trail');
      if (res.ok && res.data) {
        setLogs(res.data.auditLogs || []);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
      onNotification('Failed to fetch audit logs', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'MATCH_ACCEPTED':
        return {
          title: 'Match Accepted',
          icon: 'check_circle',
          classes: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30'
        };
      case 'REGULATORY_APPROVAL_RECORDED':
        return {
          title: 'Regulatory Clearance',
          icon: 'gavel',
          classes: 'bg-amber-500/10 text-amber-700 border-amber-500/30'
        };
      case 'LOGISTICS_STATUS_UPDATED':
      case 'ORGAN_RECEPTION_CONFIRMED':
        return {
          title: action === 'ORGAN_RECEPTION_CONFIRMED' ? 'Reception Confirmed' : 'Logistics Transition',
          icon: 'local_shipping',
          classes: 'bg-indigo-500/10 text-indigo-700 border-indigo-500/30'
        };
      case 'ALLOCATION_INITIALIZED':
        return {
          title: 'Allocation Initialized',
          icon: 'inventory_2',
          classes: 'bg-secondary-container/40 text-on-secondary-container border-secondary-container'
        };
      case 'DONOR_ENROLLED':
        return {
          title: 'Donor Enrolled',
          icon: 'person_add',
          classes: 'bg-teal-500/10 text-teal-700 border-teal-500/30'
        };
      case 'RECIPIENT_WAITLISTED':
        return {
          title: 'Recipient Waitlisted',
          icon: 'format_list_bulleted_add',
          classes: 'bg-purple-500/10 text-purple-700 border-purple-500/30'
        };
      default:
        return {
          title: action.replace(/_/g, ' '),
          icon: 'receipt_long',
          classes: 'bg-surface-container text-on-surface border-outline-variant/30'
        };
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesAction = selectedActionFilter === 'ALL' || log.action === selectedActionFilter;
    const matchesSearch = searchQuery === '' ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.entity_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.entity_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.performed_by_name && log.performed_by_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      JSON.stringify(log.details).toLowerCase().includes(searchQuery.toLowerCase());
    return matchesAction && matchesSearch;
  });

  return (
    <div className="space-y-lg animate-fadeIn">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full bg-tertiary-container/10 text-tertiary font-label-sm text-xs font-bold border border-tertiary/20">
              IMMUTABLE FORENSIC LEDGER
            </span>
            <span className="text-outline font-label-sm text-xs">THOA 2014 &amp; DPDP Cryptographic Stream</span>
          </div>
          <h2 className="font-headline-lg text-headline-lg font-bold text-on-background">
            Statutory Audit Trail &amp; Forensic Ledger
          </h2>
          <p className="font-body-md text-body-md text-outline mt-1 max-w-2xl">
            Cryptographically timestamped compliance records with SHA-256 payload integrity hashing, client IP logging, and dual-physician signatures.
          </p>
        </div>

        <button
          onClick={fetchAuditLogs}
          disabled={loading}
          className="btn-primary-gradient px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 self-start md:self-auto cursor-pointer"
        >
          <span className={`material-symbols-outlined text-base ${loading ? 'animate-spin' : ''}`}>
            refresh
          </span>
          <span>{loading ? 'Refreshing...' : 'Refresh Ledger'}</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-outline-variant/30 shadow-xs">
        <div className="relative w-full md:w-96">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">
            search
          </span>
          <input
            type="text"
            placeholder="Search by action, actor, entity ID, hash..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 bg-surface-container-low border border-outline-variant/40 rounded-full font-body-md text-sm text-on-surface input-glow w-full transition-all"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar w-full md:w-auto">
          <span className="font-label-sm text-xs text-outline mr-1 font-semibold">Filter:</span>
          {['ALL', 'MATCH_ACCEPTED', 'ALLOCATION_INITIALIZED', 'LOGISTICS_STATUS_UPDATED', 'ORGAN_RECEPTION_CONFIRMED', 'REGULATORY_APPROVAL_RECORDED', 'DONOR_ENROLLED'].map(act => (
            <button
              key={act}
              onClick={() => setSelectedActionFilter(act)}
              className={`px-3 py-1 rounded-full font-label-sm text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                selectedActionFilter === act
                  ? 'bg-secondary-container text-on-secondary-container border border-secondary-container shadow-xs'
                  : 'bg-white border border-outline-variant/30 text-outline hover:bg-surface-container-low'
              }`}
            >
              {act.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Audit Log Timeline Stream */}
      <div className="glass-card rounded-2xl p-6">
        <h3 className="font-headline-md text-base font-bold text-on-background mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">receipt_long</span>
          Audit Events Recorded ({filteredLogs.length})
        </h3>

        {filteredLogs.length === 0 ? (
          <div className="py-12 text-center text-outline">
            <span className="material-symbols-outlined text-4xl mb-2 text-outline/40">verified_user</span>
            <p className="text-sm">No audit logs matching query criteria.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLogs.map((log) => {
              const badge = getActionBadge(log.action);
              const isExpanded = expandedLogId === log.id;
              const formattedDate = new Date(log.created_at).toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
                dateStyle: 'medium',
                timeStyle: 'medium'
              });

              const hashSnippet = log.payload_sha256_hash
                ? `${log.payload_sha256_hash.slice(0, 12)}...`
                : `${(log.id || 'hash').slice(0, 10)}...`;

              return (
                <div
                  key={log.id}
                  className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 transition-all hover:border-outline-variant"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-surface-bright border border-outline-variant/30 flex items-center justify-center text-primary shrink-0">
                        <span className="material-symbols-outlined text-lg">{badge.icon}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${badge.classes}`}>
                            {badge.title}
                          </span>
                          <span className="font-mono text-xs text-outline">
                            Entity: <strong className="text-on-surface">{log.entity_type}</strong> ({log.entity_id.slice(0, 14)})
                          </span>
                          {/* Actor & Role Badge */}
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-surface-container text-on-surface border border-outline-variant/30 flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">account_circle</span>
                            {log.performed_by_name || 'Staff User'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-outline mt-1 flex-wrap">
                          <span>
                            Logged: <strong className="text-on-surface">{formattedDate} IST</strong>
                          </span>
                          <span>•</span>
                          <span>
                            IP: <strong className="font-mono text-on-surface">{log.client_ip || '127.0.0.1'}</strong>
                          </span>
                          <span>•</span>
                          <span className="font-mono text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20">
                            SHA-256: {hashSnippet}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                      className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 self-end sm:self-auto cursor-pointer"
                    >
                      <span>{isExpanded ? 'Hide Forensic Payload' : 'Inspect SHA-256 Payload'}</span>
                      <span className="material-symbols-outlined text-sm">
                        {isExpanded ? 'expand_less' : 'expand_more'}
                      </span>
                    </button>
                  </div>

                  {/* Expandable Forensic JSON Viewer */}
                  {isExpanded && (
                    <div className="mt-3 p-3 rounded-xl bg-on-background text-[#6df5e1] font-mono text-xs overflow-x-auto border border-outline-variant/20 shadow-inner">
                      <div className="text-[10px] text-white/60 mb-2 pb-1 border-b border-white/10 flex justify-between">
                        <span>INTEGRITY HASH: {log.payload_sha256_hash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}</span>
                        <span>CLIENT IP: {log.client_ip || '127.0.0.1'}</span>
                      </div>
                      <pre className="leading-relaxed whitespace-pre-wrap">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
