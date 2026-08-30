import React, { useState } from 'react';
import { AuthSession } from '../types';
import { apiClient, setStoredSession } from '../services/apiClient';

interface StarterHospitalLoginProps {
  onLoginSuccess: (session: AuthSession) => void;
  onNotification: (msg: string, type: 'success' | 'error') => void;
}

interface DemoAccount {
  name: string;
  roleTitle: string;
  roleKey: 'transplant_surgeon' | 'hospital_admin' | 'regulatory_officer';
  email: string;
  hospital: string;
  hospitalCode: string;
  license: string;
  icon: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    name: 'Dr. Ananya Iyer',
    roleTitle: 'Surgeon',
    roleKey: 'transplant_surgeon',
    email: 'ananya.iyer@apollo.org',
    hospital: 'Apollo Hospitals Enterprise',
    hospitalCode: 'APOLLO-CHE-02',
    license: 'MCI-TN-89211',
    icon: 'healing'
  },
  {
    name: 'Officer Vikramaditya Sen',
    roleTitle: 'Regulatory Officer',
    roleKey: 'regulatory_officer',
    email: 'vikram.sen@notto.gov.in',
    hospital: 'Fortis Memorial Gurugram',
    hospitalCode: 'FMRI-GGN-03',
    license: 'NOTTO-REG-0994',
    icon: 'hub'
  },
  {
    name: 'Dr. Rajesh Sharma',
    roleTitle: 'Hospital Admin',
    roleKey: 'hospital_admin',
    email: 'rajesh.sharma@aiims.edu',
    hospital: 'AIIMS New Delhi',
    hospitalCode: 'AIIMS-DEL-01',
    license: 'MCI-DEL-10482',
    icon: 'local_hospital'
  }
];

export const StarterHospitalLogin: React.FC<StarterHospitalLoginProps> = ({ onLoginSuccess, onNotification }) => {
  const [activeTab, setActiveTab] = useState<'otp' | 'password' | 'register'>('otp');
  const [loading, setLoading] = useState<boolean>(false);

  // Email OTP State
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);

  // Password Login State
  const [email, setEmail] = useState('ananya.iyer@apollo.org');
  const [password, setPassword] = useState('HospitalPass123!');

  // Registration Form State
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('HospitalPass123!');
  const [regRole, setRegRole] = useState<'hospital_admin' | 'transplant_surgeon' | 'regulatory_officer'>('transplant_surgeon');
  const [regHospitalId, setRegHospitalId] = useState('22222222-2222-4222-a222-222222222222');
  const [regMedicalLicense, setRegMedicalLicense] = useState('');

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!otpEmail.trim()) {
      onNotification('Please enter your email address to receive OTP', 'error');
      return;
    }

    setSendingOtp(true);
    try {
      const res = await apiClient.post<{ status: string; message: string }>('/auth/send-otp', {
        email: otpEmail.trim(),
        purpose: 'login'
      });

      if (res.ok && res.data) {
        setOtpSent(true);
        onNotification(`OTP verification code dispatched to ${otpEmail}! Check your inbox.`, 'success');
      } else {
        const errMsg = (res.data as any)?.message || 'Failed to send OTP email';
        onNotification(errMsg, 'error');
      }
    } catch (err: any) {
      onNotification('Network error dispatching OTP email', 'error');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent, codeToVerify?: string) => {
    if (e) e.preventDefault();
    const cleanOtp = (codeToVerify || otpCode).replace(/\D/g, '');

    if (!cleanOtp || cleanOtp.length !== 6) {
      onNotification('Please enter the 6-digit OTP code received in your email (or 999999)', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.post<AuthSession>('/auth/verify-otp', {
        email: otpEmail.trim(),
        otp: cleanOtp,
        loginAfterVerify: true
      });

      if (res.ok && res.data && res.data.token) {
        setStoredSession(res.data);
        onNotification(`Email verified! Welcome, ${res.data.user.full_name}!`, 'success');
        onLoginSuccess(res.data);
      } else {
        const errMsg = (res.data as any)?.message || 'Invalid or expired verification code';
        onNotification(errMsg, 'error');
      }
    } catch (err: any) {
      onNotification('Network error verifying OTP code', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async (loginEmail?: string, loginPassword?: string) => {
    const targetEmail = loginEmail || email;
    const targetPassword = loginPassword || password;

    if (!targetEmail.trim() || !targetPassword.trim()) {
      onNotification('Please provide both staff email and password', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.post<AuthSession>('/auth/login', {
        email: targetEmail,
        password: targetPassword
      });

      if (res.ok && res.data && res.data.token) {
        setStoredSession(res.data);
        onNotification(`Welcome back, ${res.data.user.full_name} (${res.data.hospital?.name || 'Verified Hospital'})!`, 'success');
        onLoginSuccess(res.data);
      } else {
        const errMsg = (res.data as any)?.message || 'Authentication failed. Please check your credentials.';
        onNotification(errMsg, 'error');
      }
    } catch (err: any) {
      onNotification('Network connection error contacting authentication gateway', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!regFullName.trim() || !regEmail.trim() || !regPassword.trim()) {
      onNotification('Please fill in all mandatory registration fields', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.post<AuthSession>('/auth/register', {
        hospitalId: regHospitalId,
        fullName: regFullName,
        email: regEmail,
        password: regPassword,
        role: regRole,
        medicalLicense: regMedicalLicense || undefined
      });

      if (res.ok && res.data && res.data.token) {
        setStoredSession(res.data);
        onNotification(`Staff personnel ${regFullName} registered and authenticated successfully!`, 'success');
        onLoginSuccess(res.data);
      } else {
        const errMsg = (res.data as any)?.message || 'Registration failed. Check hospital authorization.';
        onNotification(errMsg, 'error');
      }
    } catch (err) {
      onNotification('Network error registering hospital personnel', 'error');
    } finally {
      setLoading(false);
    }
  };

  const selectDemoAccount = (account: DemoAccount) => {
    setEmail(account.email);
    setPassword('HospitalPass123!');
    handlePasswordLogin(account.email, 'HospitalPass123!');
  };

  return (
    <div className="min-h-screen bg-background bg-radial-glow text-on-surface antialiased flex items-center justify-center p-md lg:p-3xl overflow-hidden relative selection:bg-primary/20 selection:text-primary">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-surface-variant blur-[100px] opacity-40 -z-10 pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[30%] h-[30%] rounded-full bg-secondary-container blur-[100px] opacity-20 -z-10 pointer-events-none" />

      <div className="w-full max-w-[1100px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-xl items-center">
        {/* Branding Section (Left side on Desktop) */}
        <div className="lg:col-span-5 flex flex-col justify-center items-center lg:items-start text-center lg:text-left space-y-md z-10 mb-xl lg:mb-0">
          <div className="flex items-center space-x-sm text-primary mb-sm">
            <span className="material-symbols-outlined text-[48px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              monitor_heart
            </span>
            <h1 className="font-display-lg text-display-lg font-bold text-primary tracking-tight">NOTTO</h1>
          </div>
          <h2 className="font-headline-lg-mobile lg:font-headline-lg text-headline-lg-mobile lg:text-headline-lg font-bold text-on-surface">
            VitalSync Portal
          </h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-md">
            National Organ &amp; Tissue Transplant Organisation. A secure, clinical-grade platform for transplant coordination, donor registry, and cold-chain logistics.
          </p>

          <div className="flex items-center gap-2 text-xs font-semibold text-primary bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span>Indian Clinical Gateway • THOA 2014 Compliant</span>
          </div>
        </div>

        {/* Login Container (Right side on Desktop) */}
        <div className="lg:col-span-7 glass-panel rounded-[24px] shadow-[0_20px_40px_-10px_rgba(15,23,42,0.08)] overflow-hidden flex flex-col w-full z-10">
          <div className="p-lg lg:p-2xl flex flex-col h-full">
            <div className="flex items-center justify-between mb-md flex-wrap gap-2">
              <h3 className="font-headline-md text-headline-md font-bold text-on-surface">
                {activeTab === 'otp' ? 'Email OTP Sign-In' : activeTab === 'password' ? 'Password Login' : 'Staff Registration'}
              </h3>
              <div className="flex bg-surface-container rounded-lg p-1 border border-outline-variant/30 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('otp')}
                  className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer ${
                    activeTab === 'otp' ? 'bg-white text-primary shadow-xs' : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Email OTP
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('password')}
                  className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer ${
                    activeTab === 'password' ? 'bg-white text-primary shadow-xs' : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Password
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('register')}
                  className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer ${
                    activeTab === 'register' ? 'bg-white text-primary shadow-xs' : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Register
                </button>
              </div>
            </div>

            {/* Quick Access Roles */}
            <div className="mb-lg">
              <p className="font-label-sm text-label-sm text-outline uppercase tracking-wider mb-sm">
                1-Click Quick Access Roles
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-sm">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => selectDemoAccount(acc)}
                    disabled={loading}
                    className="role-card glass-panel rounded-xl p-md flex flex-col items-center justify-center space-y-xs text-on-surface-variant hover:text-primary cursor-pointer text-center focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <span className="material-symbols-outlined text-primary text-2xl">
                      {acc.icon}
                    </span>
                    <span className="font-label-md text-label-md font-semibold">{acc.roleTitle}</span>
                    <span className="text-[10px] text-outline truncate max-w-full font-mono">{acc.hospitalCode}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-sm mb-lg">
              <div className="h-px bg-outline-variant flex-1" />
              <span className="font-label-sm text-label-sm text-outline">or authenticate with your personal email</span>
              <div className="h-px bg-outline-variant flex-1" />
            </div>

            {/* TAB 1: Email OTP Authentication */}
            {activeTab === 'otp' && (
              <div className="space-y-md">
                {!otpSent ? (
                  <form onSubmit={handleSendOtp} className="space-y-md">
                    <div>
                      <label className="block font-label-md text-label-md text-on-surface mb-xs" htmlFor="otp_email">
                        Your Email Address
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-sm text-outline">
                          <span className="material-symbols-outlined text-[20px]">mail</span>
                        </span>
                        <input
                          id="otp_email"
                          type="email"
                          placeholder="e.g. yourname@gmail.com"
                          value={otpEmail}
                          onChange={(e) => setOtpEmail(e.target.value)}
                          required
                          className="input-mist w-full rounded-xl py-sm pl-xl pr-sm font-body-md text-body-md text-on-surface placeholder:text-outline/70 focus:ring-0"
                        />
                      </div>
                      <p className="text-xs text-outline mt-1.5">
                        We will send a 6-digit secure verification code to this email.
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={sendingOtp}
                      className="btn-gradient w-full rounded-xl py-[12px] px-md font-label-md text-label-md text-on-primary flex items-center justify-center space-x-sm cursor-pointer shadow-sm"
                    >
                      <span>{sendingOtp ? 'Sending Verification Code...' : 'Send OTP Verification Code'}</span>
                      <span className={`material-symbols-outlined text-[20px] ${sendingOtp ? 'animate-spin' : ''}`}>
                        {sendingOtp ? 'sync' : 'send'}
                      </span>
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-md animate-fadeIn">
                    <div className="p-3 bg-secondary-container/20 border border-secondary-container/40 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="material-symbols-outlined text-primary text-lg">mark_email_read</span>
                        <span>OTP sent to <strong className="text-primary">{otpEmail}</strong></span>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setOtpSent(false); setOtpCode(''); }}
                        className="text-xs font-bold text-primary hover:underline cursor-pointer"
                      >
                        Change Email
                      </button>
                    </div>

                    <div>
                      <label className="block font-label-md text-label-md text-on-surface mb-xs" htmlFor="otp_code">
                        Enter 6-Digit Verification PIN
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-sm text-outline">
                          <span className="material-symbols-outlined text-[20px]">pin</span>
                        </span>
                        <input
                          id="otp_code"
                          type="text"
                          maxLength={6}
                          placeholder="••••••"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                          required
                          className="input-mist w-full rounded-xl py-sm pl-xl pr-sm font-mono text-center tracking-[8px] text-xl font-bold text-primary placeholder:tracking-normal focus:ring-0"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="btn-gradient w-full rounded-xl py-[12px] px-md font-label-md text-label-md text-on-primary flex items-center justify-center space-x-sm cursor-pointer shadow-sm"
                    >
                      <span>{loading ? 'Verifying...' : 'Verify OTP & Access Portal'}</span>
                      <span className={`material-symbols-outlined text-[20px] ${loading ? 'animate-spin' : ''}`}>
                        {loading ? 'sync' : 'arrow_forward'}
                      </span>
                    </button>

                    <div className="text-center">
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={sendingOtp}
                        className="text-xs text-outline hover:text-primary font-semibold cursor-pointer"
                      >
                        Didn&apos;t receive email? Resend OTP
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* TAB 2: Password Login */}
            {activeTab === 'password' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handlePasswordLogin();
                }}
                className="space-y-md"
              >
                <div>
                  <label className="block font-label-md text-label-md text-on-surface mb-xs" htmlFor="clinical_id">
                    Staff Email Address
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-sm text-outline">
                      <span className="material-symbols-outlined text-[20px]">badge</span>
                    </span>
                    <input
                      className="input-mist w-full rounded-xl py-sm pl-xl pr-sm font-body-md text-body-md text-on-surface placeholder:text-outline/70 focus:ring-0"
                      id="clinical_id"
                      placeholder="Enter your ID / Email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-xs">
                    <label className="block font-label-md text-label-md text-on-surface" htmlFor="password">
                      Password
                    </label>
                    <span className="font-label-sm text-label-sm text-primary">Pre-filled: HospitalPass123!</span>
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-sm text-outline">
                      <span className="material-symbols-outlined text-[20px]">lock</span>
                    </span>
                    <input
                      className="input-mist w-full rounded-xl py-sm pl-xl pr-sm font-body-md text-body-md text-on-surface placeholder:text-outline/70 focus:ring-0"
                      id="password"
                      placeholder="••••••••"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button
                  disabled={loading}
                  className="btn-gradient w-full rounded-xl py-[12px] px-md font-label-md text-label-md text-on-primary flex items-center justify-center space-x-sm cursor-pointer shadow-sm"
                  type="submit"
                >
                  <span>{loading ? 'Authenticating...' : 'Authenticate & Access Network'}</span>
                  <span className="material-symbols-outlined text-[20px]">
                    {loading ? 'sync' : 'arrow_forward'}
                  </span>
                </button>
              </form>
            )}

            {/* TAB 3: Staff Registration */}
            {activeTab === 'register' && (
              <form onSubmit={handleRegister} className="space-y-md">
                <div>
                  <label className="block font-label-md text-xs text-on-surface mb-1">Full Clinical Name</label>
                  <input
                    type="text"
                    placeholder="Dr. S. K. Mukherjee"
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    required
                    className="input-mist w-full rounded-xl py-2 px-3 text-sm text-on-surface"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
                  <div>
                    <label className="block font-label-md text-xs text-on-surface mb-1">Staff Email</label>
                    <input
                      type="email"
                      placeholder="mukherjee@aiims.edu"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      required
                      className="input-mist w-full rounded-xl py-2 px-3 text-sm text-on-surface"
                    />
                  </div>
                  <div>
                    <label className="block font-label-md text-xs text-on-surface mb-1">License Number</label>
                    <input
                      type="text"
                      placeholder="MCI-DEL-98421"
                      value={regMedicalLicense}
                      onChange={(e) => setRegMedicalLicense(e.target.value)}
                      className="input-mist w-full rounded-xl py-2 px-3 text-sm text-on-surface"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
                  <div>
                    <label className="block font-label-md text-xs text-on-surface mb-1">Affiliated Hospital</label>
                    <select
                      value={regHospitalId}
                      onChange={(e) => setRegHospitalId(e.target.value)}
                      className="input-mist w-full rounded-xl py-2 px-3 text-sm text-on-surface appearance-none"
                    >
                      <option value="11111111-1111-4111-a111-111111111111">AIIMS New Delhi</option>
                      <option value="22222222-2222-4222-a222-222222222222">Apollo Hospitals Chennai</option>
                      <option value="33333333-3333-4333-a333-333333333333">Fortis Memorial Gurugram</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-label-md text-xs text-on-surface mb-1">Clinical Role</label>
                    <select
                      value={regRole}
                      onChange={(e) => setRegRole(e.target.value as any)}
                      className="input-mist w-full rounded-xl py-2 px-3 text-sm text-on-surface appearance-none"
                    >
                      <option value="transplant_surgeon">Transplant Surgeon</option>
                      <option value="hospital_admin">Hospital Administrator</option>
                      <option value="regulatory_officer">NOTTO Regulatory Officer</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-label-md text-xs text-on-surface mb-1">Password</label>
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    required
                    className="input-mist w-full rounded-xl py-2 px-3 text-sm text-on-surface"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-gradient w-full rounded-xl py-3 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer mt-2"
                >
                  <span className="material-symbols-outlined text-lg">{loading ? 'sync' : 'how_to_reg'}</span>
                  <span>{loading ? 'Registering...' : 'Register & Authenticate'}</span>
                </button>
              </form>
            )}

            <div className="mt-xl text-center">
              <p className="font-label-sm text-label-sm text-outline flex items-center justify-center gap-xs">
                <span className="material-symbols-outlined text-[16px] text-primary">verified_user</span>
                End-to-End Encrypted Clinical Connection
              </p>
            </div>
          </div>

          {/* Bottom decorative bar indicating system status */}
          <div className="h-2 w-full bg-surface-variant flex">
            <div className="h-full bg-tertiary-container w-1/3 shimmer-active" />
          </div>
        </div>
      </div>
    </div>
  );
};
