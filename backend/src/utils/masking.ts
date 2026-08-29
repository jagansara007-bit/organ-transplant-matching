/**
 * Privacy & Identity Masking Utility (DPDP Act & THOA 2014 Compliant)
 */

export function maskAadhaar(rawAadhaar?: string): string {
  if (!rawAadhaar) return 'XXXX-XXXX-8921';
  const clean = rawAadhaar.replace(/\D/g, '');
  if (clean.length < 4) return 'XXXX-XXXX-8921';
  const last4 = clean.slice(-4);
  return `XXXX-XXXX-${last4}`;
}

export function maskPhone(rawPhone?: string): string {
  if (!rawPhone) return '+91 XXXXX-XX912';
  const clean = rawPhone.replace(/\D/g, '');
  if (clean.length < 3) return '+91 XXXXX-XX912';
  const last3 = clean.slice(-3);
  return `+91 XXXXX-XX${last3}`;
}

export function maskLicense(rawLicense?: string): string {
  if (!rawLicense) return 'MCI-XX-XXXXX';
  if (rawLicense.length <= 4) return rawLicense;
  const prefix = rawLicense.slice(0, 4);
  const suffix = rawLicense.slice(-2);
  return `${prefix}XXXX${suffix}`;
}
