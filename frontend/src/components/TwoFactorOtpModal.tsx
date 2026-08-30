import React, { useState, useEffect, useRef } from 'react';
import { apiClient } from '../services/apiClient';

interface TwoFactorOtpModalProps {
  isOpen: boolean;
  email: string;
  purpose: string;
  onClose: () => void;
  onSuccess: () => void;
  onNotification: (msg: string, type: 'success' | 'error') => void;
}

export const TwoFactorOtpModal: React.FC<TwoFactorOtpModalProps> = ({
  isOpen,
  email,
  purpose,
  onClose,
  onSuccess,
  onNotification
}) => {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(300); // 5 minutes (300s)
  const [loading, setLoading] = useState<boolean>(false);
  const [resending, setResending] = useState<boolean>(false);
  const [debugCode, setDebugCode] = useState<string | null>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-request OTP & 5-minute countdown timer
  useEffect(() => {
    if (!isOpen) return;

    setDigits(['', '', '', '', '', '']);

    // Auto-request fresh OTP on modal open
    apiClient.post<{ message: string }>('/auth/request-otp', {
      email,
      purpose
    }).catch(() => {});

    setTimeLeftSeconds(300);

    // Initial focus on input box
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 150);

    const interval = setInterval(() => {
      setTimeLeftSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, email, purpose]);

  if (!isOpen) return null;

  const formatTime = (seconds: number) => {
    const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const handleDigitChange = (index: number, value: string) => {
    // Only accept numeric digit
    const cleaned = value.replace(/\D/g, '');
    if (!cleaned) {
      const newDigits = [...digits];
      newDigits[index] = '';
      setDigits(newDigits);
      return;
    }

    // Single digit input
    const char = cleaned.slice(-1);
    const newDigits = [...digits];
    newDigits[index] = char;
    setDigits(newDigits);

    // Shift focus to next input box
    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData.length > 0) {
      const newDigits = ['', '', '', '', '', ''];
      pastedData.split('').forEach((char, idx) => {
        if (idx < 6) newDigits[idx] = char;
      });
      setDigits(newDigits);
      const nextFocus = Math.min(pastedData.length, 5);
      inputRefs.current[nextFocus]?.focus();
    }
  };

  const handleResendOtp = async () => {
    setResending(true);
    try {
      const res = await apiClient.post<{ message: string }>('/auth/request-otp', {
        email,
        purpose
      });

      if (res.ok) {
        setTimeLeftSeconds(300);
        onNotification(`Fresh 2FA passcode dispatched to ${email}!`, 'success');
      } else {
        onNotification((res.data as any)?.message || 'Failed to dispatch 2FA code', 'error');
      }
    } catch (err) {
      onNotification('Network error dispatching 2FA passcode', 'error');
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (overrideOtp?: string) => {
    const fullOtp = overrideOtp || digits.join('');
    if (fullOtp.length !== 6) {
      onNotification('Please enter all 6 numeric digits', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.post<{ status: string; message: string }>('/auth/verify-otp', {
        email,
        otp: fullOtp,
        purpose,
        loginAfterVerify: false
      });

      if (res.ok) {
        onNotification('2FA Security Check Passed! Proceeding with authorization...', 'success');
        onSuccess();
        onClose();
      } else {
        onNotification((res.data as any)?.message || 'Invalid or expired 2FA code', 'error');
      }
    } catch (err) {
      onNotification('Network error verifying 2FA code', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="glass-panel-raised max-w-md w-full rounded-2xl p-6 shadow-2xl border border-outline-variant/40 bg-white relative">
        {/* Header */}
        <div className="flex justify-between items-start pb-4 border-b border-outline-variant/30">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">verified_user</span>
            </div>
            <div>
              <h3 className="font-headline-md text-base font-bold text-on-surface">
                Two-Factor (2FA) Verification
              </h3>
              <p className="text-[11px] text-outline">Clinical Privilege Authorization</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-container text-outline cursor-pointer"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="py-5 space-y-4">
          <div className="p-3 rounded-xl bg-surface-container/60 border border-outline-variant/30 text-xs">
            <div className="flex justify-between mb-1">
              <span className="text-outline">Protected Action:</span>
              <span className="font-bold text-primary">{purpose}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-outline">Recipient Account:</span>
              <span className="font-mono text-on-surface font-semibold">{email}</span>
            </div>
          </div>

          <p className="text-xs text-on-surface-variant text-center">
            Enter the 6-digit passcode sent to your email to confirm statutory authorization.
          </p>

          {/* 6 Individual Numeric Input Boxes */}
          <div className="flex justify-center gap-2 py-2" onPaste={handlePaste}>
            {digits.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => (inputRefs.current[idx] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                className={`w-11 h-13 text-center text-xl font-bold font-mono rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-primary ${
                  digit
                    ? 'border-primary bg-primary-fixed/20 text-primary shadow-xs'
                    : 'border-outline-variant/60 bg-surface-container-low text-on-surface'
                }`}
              />
            ))}
          </div>

          {/* Timer & Resend */}
          <div className="flex justify-between items-center text-xs px-1">
            <div className="flex items-center gap-1.5 font-mono">
              <span className="material-symbols-outlined text-sm text-primary">timer</span>
              <span className={`font-bold ${timeLeftSeconds < 60 ? 'text-rose-600 animate-pulse' : 'text-primary'}`}>
                {formatTime(timeLeftSeconds)}
              </span>
              <span className="text-outline text-[11px]">(5m validity)</span>
            </div>

            <button
              type="button"
              onClick={handleResendOtp}
              disabled={resending || timeLeftSeconds > 240}
              className="text-xs font-bold text-primary hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer"
            >
              {resending ? 'Sending...' : 'Resend Code'}
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-outline-variant/20 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-outline hover:bg-surface-container cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={loading || digits.join('').length !== 6}
            className="btn-primary-gradient px-5 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
          >
            <span>{loading ? 'Verifying...' : 'Authorize Action'}</span>
            <span className={`material-symbols-outlined text-[16px] ${loading ? 'animate-spin' : ''}`}>
              {loading ? 'sync' : 'arrow_forward'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
