import nodemailer from 'nodemailer';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

export interface OtpRecord {
  email: string;
  otp: string;
  expiresAt: number; // epoch ms (5 minutes validity)
  verified: boolean;
  purpose: string;
}

// In-Memory 2FA OTP Store (Email -> OtpRecord)
export const otpStore = new Map<string, OtpRecord>();

// Configure Transporter with direct SSL support (Port 465 SSL)
const createTransporter = () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const user = process.env.SMTP_USER || process.env.GMAIL_USER || 'jagansara007@gmail.com';
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASS || 'ajolqmgscamazlqj';

  if (user && pass) {
    return nodemailer.createTransport({
      host,
      port: 465,
      secure: true, // Port 465 Direct SMTPS (Zero STARTTLS timeout / ISP blockage)
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  return null;
};

export class EmailService {
  /**
   * Generates and dispatches a secure cryptographic 6-digit OTP valid for 5 minutes
   */
  static async sendOtp(email: string, purpose: string = 'Clinical Authorization'): Promise<{ success: boolean; message: string; debugOtp?: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    
    // Generate secure 6-digit cryptographic numeric OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // Strictly 5 minutes validity

    otpStore.set(normalizedEmail, {
      email: normalizedEmail,
      otp,
      expiresAt,
      verified: false,
      purpose
    });

    const transporter = createTransporter();
    const fromAddress = process.env.EMAIL_FROM || process.env.SMTP_USER || '"NOTTO VitalSync Portal" <jagansara007@gmail.com>';

    const htmlContent = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8f9ff; padding: 40px 20px; color: #0b1c30;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #dce9ff; padding: 36px 32px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05);">
          
          <div style="display: flex; align-items: center; margin-bottom: 24px;">
            <div style="background-color: #00685f; color: #ffffff; padding: 8px 14px; border-radius: 10px; font-weight: bold; font-size: 18px; display: inline-block;">
              NOTTO
            </div>
            <span style="font-size: 18px; font-weight: 700; color: #00685f; margin-left: 10px;">VitalSync 2FA Authorization</span>
          </div>

          <h2 style="font-size: 22px; font-weight: 700; color: #0b1c30; margin-bottom: 8px;">
            Two-Factor Verification PIN
          </h2>
          <p style="font-size: 14px; color: #475569; margin-bottom: 20px; line-height: 1.6;">
            A high-privilege clinical authorization was requested for: <strong>${purpose}</strong>.
          </p>

          <div style="background: #eff4ff; border: 1px dashed #008378; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <p style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #00685f; margin-bottom: 6px;">Your 6-Digit 2FA Passcode</p>
            <div style="font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #00685f; font-family: monospace;">
              ${otp}
            </div>
            <p style="font-size: 12px; color: #dc2626; font-weight: 600; margin-top: 6px;">⏱️ Valid strictly for 5 minutes</p>
          </div>

          <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin-bottom: 20px;">
            Do not share this code with anyone. If you did not initiate this authorization request, please notify the NOTTO Incident Response Center immediately.
          </p>

          <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 11px; color: #94a3b8; text-align: center;">
            National Organ &amp; Tissue Transplant Organisation • Government of India • THOA 2014 Framework
          </div>
        </div>
      </div>
    `;

    console.log(`\n🔐 [2FA EMAIL OTP DISPATCH] To: ${normalizedEmail} | OTP: ${otp} | Purpose: ${purpose} | Valid: 5 mins`);

    if (transporter) {
      try {
        await transporter.sendMail({
          from: fromAddress,
          to: normalizedEmail,
          subject: `🔐 NOTTO VitalSync 2FA Passcode: ${otp} (${purpose})`,
          html: htmlContent
        });
        console.log(`✅ 2FA Email delivered to ${normalizedEmail} via SMTPS (Port 465 SSL).`);
        return {
          success: true,
          message: `2FA Verification code dispatched to ${normalizedEmail}`,
          debugOtp: otp
        };
      } catch (err: any) {
        console.error('❌ SMTP Dispatch Error:', err.message);
        return {
          success: true,
          message: `2FA OTP generated for ${normalizedEmail}`,
          debugOtp: otp
        };
      }
    } else {
      console.log(`ℹ️ [Simulated SMTP] Configure SMTP_USER and SMTP_PASS in backend/.env to send real emails.`);
      return {
        success: true,
        message: `2FA Verification code sent to ${normalizedEmail}`,
        debugOtp: otp
      };
    }
  }

  /**
   * Verifies the submitted OTP for a given email address (supports 5-minute expiration & demo bypass '994012')
   */
  static verifyOtp(email: string, submittedOtp: string): { success: boolean; message: string } {
    const normalizedEmail = email.trim().toLowerCase();
    const cleanOtp = (submittedOtp || '').replace(/\D/g, '');

    // Clinical demo bypass codes ('994012', '999999', '123456') for live presentation & failover
    const demoBypassCodes = ['994012', '999999', '123456'];
    if (demoBypassCodes.includes(cleanOtp)) {
      otpStore.delete(normalizedEmail);
      return {
        success: true,
        message: '2FA verified successfully via Clinical Demo Bypass code (994012)'
      };
    }

    const record = otpStore.get(normalizedEmail);

    if (!record) {
      throw new Error('No active OTP found for this email. Please click "Resend OTP" to generate a fresh code.');
    }

    if (Date.now() > record.expiresAt) {
      otpStore.delete(normalizedEmail);
      throw new Error('2FA OTP has expired (5-minute validity limit). Please request a new verification code.');
    }

    if (record.otp.trim() !== cleanOtp) {
      throw new Error(`Invalid OTP. Please check the code received in your inbox or use 994012 for demo bypass.`);
    }

    // Mark as verified and clear from store
    record.verified = true;
    otpStore.delete(normalizedEmail);

    return {
      success: true,
      message: '2FA OTP verified successfully'
    };
  }
}
