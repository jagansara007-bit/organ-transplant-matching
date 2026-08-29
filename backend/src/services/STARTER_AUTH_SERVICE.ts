import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { pool } from '../config/db';

export const JWT_SECRET = process.env.JWT_SECRET || 'organ-transplant-secure-jwt-key-2026';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

export interface UserTokenPayload {
  id: string;
  hospital_id: string;
  email: string;
  full_name?: string;
  user_role: string;
  medical_license?: string;
}

export interface AuthenticatedUser {
  id: string;
  hospital_id: string;
  full_name: string;
  email: string;
  role: string;
  medical_license?: string;
  is_authorized: boolean;
  hospital?: {
    id: string;
    name: string;
    hospital_code: string;
    city: string;
    state: string;
    verification_status: string;
  };
}

// In-Memory Fallback Hospital & User Stores for offline resilience
export interface InMemoryHospital {
  id: string;
  name: string;
  hospital_code: string;
  city: string;
  state: string;
  verification_status: string;
}

export interface InMemoryUser {
  id: string;
  hospital_id: string;
  full_name: string;
  email: string;
  password_hash: string;
  medical_license: string;
  role: string;
  is_authorized: boolean;
}

export const inMemoryHospitals: InMemoryHospital[] = [
  { id: '11111111-1111-4111-a111-111111111111', name: 'All India Institute of Medical Sciences (AIIMS)', hospital_code: 'AIIMS-DEL-01', city: 'New Delhi', state: 'Delhi', verification_status: 'verified' },
  { id: '22222222-2222-4222-a222-222222222222', name: 'Apollo Hospitals Enterprise', hospital_code: 'APOLLO-CHE-02', city: 'Chennai', state: 'Tamil Nadu', verification_status: 'verified' },
  { id: '33333333-3333-4333-a333-333333333333', name: 'Fortis Memorial Research Institute', hospital_code: 'FMRI-GGN-03', city: 'Gurugram', state: 'Haryana', verification_status: 'verified' }
];

const DEFAULT_HASH = bcrypt.hashSync('HospitalPass123!', 10);

export const inMemoryUsers: InMemoryUser[] = [
  {
    id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    hospital_id: '11111111-1111-4111-a111-111111111111',
    full_name: 'Dr. Rajesh Sharma',
    email: 'rajesh.sharma@aiims.edu',
    password_hash: DEFAULT_HASH,
    medical_license: 'MCI-DEL-10482',
    role: 'hospital_admin',
    is_authorized: true
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
    hospital_id: '22222222-2222-4222-a222-222222222222',
    full_name: 'Dr. Ananya Iyer',
    email: 'ananya.iyer@apollo.org',
    password_hash: DEFAULT_HASH,
    medical_license: 'MCI-TN-89211',
    role: 'transplant_surgeon',
    is_authorized: true
  },
  {
    id: 'cccccccc-cccc-4ccc-cccc-cccccccccccc',
    hospital_id: '33333333-3333-4333-a333-333333333333',
    full_name: 'Officer Vikramaditya Sen',
    email: 'vikram.sen@notto.gov.in',
    password_hash: DEFAULT_HASH,
    medical_license: 'NOTTO-REG-0994',
    role: 'regulatory_officer',
    is_authorized: true
  }
];

export class StarterAuthService {
  /**
   * Generates a signed JWT token with required staff claims
   */
  public static generateToken(payload: UserTokenPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
  }

  /**
   * Authenticates hospital personnel, verifies hospital standing and returns JWT
   */
  public static async login(email: string, passwordPlain: string) {
    let userRow: any = null;
    let hospitalRow: any = null;

    // 1. Attempt PostgreSQL Query
    try {
      const query = `
        SELECT 
          u.id, 
          u.hospital_id, 
          u.full_name, 
          u.email, 
          u.password_hash, 
          u.medical_license, 
          u.role, 
          u.is_authorized,
          h.name AS hospital_name,
          h.hospital_code,
          h.city AS hospital_city,
          h.state AS hospital_state,
          h.verification_status AS hospital_verification_status
        FROM hospital_users u
        JOIN hospitals h ON u.hospital_id = h.id
        WHERE LOWER(u.email) = LOWER($1);
      `;
      const result = await pool.query(query, [email]);
      if (result.rows.length > 0) {
        const row = result.rows[0];
        userRow = {
          id: row.id,
          hospital_id: row.hospital_id,
          full_name: row.full_name,
          email: row.email,
          password_hash: row.password_hash,
          medical_license: row.medical_license,
          role: row.role,
          is_authorized: row.is_authorized
        };
        hospitalRow = {
          id: row.hospital_id,
          name: row.hospital_name,
          hospital_code: row.hospital_code,
          city: row.hospital_city,
          state: row.hospital_state,
          verification_status: row.hospital_verification_status
        };
      }
    } catch (err) {
      // Database offline - fallback to in-memory store
    }

    // 2. In-Memory Fallback if DB query was empty or failed
    if (!userRow) {
      const foundUser = inMemoryUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (foundUser) {
        userRow = foundUser;
        hospitalRow = inMemoryHospitals.find(h => h.id === foundUser.hospital_id);
      }
    }

    if (!userRow) {
      throw new Error('Invalid email or password credentials');
    }

    // 3. Check User Authorization
    if (!userRow.is_authorized) {
      throw new Error('Hospital staff account is deactivated or pending verification');
    }

    // 4. Check Hospital Verification Status
    if (!hospitalRow || hospitalRow.verification_status !== 'verified') {
      throw new Error('Affiliated hospital is not verified in the national organ network');
    }

    // 5. Check Password Hash
    const isPasswordValid = await bcrypt.compare(passwordPlain, userRow.password_hash);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password credentials');
    }

    // 6. Generate JWT Token
    const normalizedRole = userRow.role.toLowerCase();
    const tokenPayload: UserTokenPayload = {
      id: userRow.id,
      hospital_id: userRow.hospital_id,
      email: userRow.email,
      full_name: userRow.full_name,
      user_role: normalizedRole,
      medical_license: userRow.medical_license
    };

    const token = this.generateToken(tokenPayload);

    return {
      status: 'success',
      token,
      user: {
        id: userRow.id,
        hospital_id: userRow.hospital_id,
        full_name: userRow.full_name,
        email: userRow.email,
        user_role: normalizedRole,
        medical_license: userRow.medical_license
      },
      hospital: hospitalRow
    };
  }

  /**
   * Registers new hospital staff member under an existing verified hospital
   */
  public static async register(data: {
    hospitalId: string;
    fullName: string;
    email: string;
    passwordPlain: string;
    role: 'hospital_admin' | 'transplant_surgeon' | 'regulatory_officer';
    medicalLicense?: string;
  }) {
    const { hospitalId, fullName, email, passwordPlain, role, medicalLicense } = data;

    let hospitalRow: any = null;

    // Check Hospital in DB
    try {
      const hRes = await pool.query('SELECT * FROM hospitals WHERE id = $1', [hospitalId]);
      if (hRes.rows.length > 0) {
        hospitalRow = hRes.rows[0];
      }
    } catch (err) {
      // Offline fallback
    }

    if (!hospitalRow) {
      hospitalRow = inMemoryHospitals.find(h => h.id === hospitalId);
    }

    if (!hospitalRow) {
      throw new Error(`Hospital with ID ${hospitalId} not found`);
    }

    if (hospitalRow.verification_status !== 'verified') {
      throw new Error('Cannot register staff under an unverified hospital');
    }

    const passwordHash = await bcrypt.hash(passwordPlain, 10);
    const normalizedRole = role.toLowerCase();

    let createdUser: any = null;

    try {
      const insertQuery = `
        INSERT INTO hospital_users (hospital_id, full_name, email, password_hash, medical_license, role, is_authorized)
        VALUES ($1, $2, $3, $4, $5, $6, true)
        RETURNING id, hospital_id, full_name, email, medical_license, role, is_authorized, created_at;
      `;
      const result = await pool.query(insertQuery, [
        hospitalId,
        fullName,
        email.toLowerCase(),
        passwordHash,
        medicalLicense || `LIC-${Math.floor(10000 + Math.random() * 90000)}`,
        normalizedRole
      ]);

      if (result.rows.length > 0) {
        createdUser = result.rows[0];
      }
    } catch (err) {
      // Fallback
    }

    if (!createdUser) {
      const newId = `usr-${Date.now()}`;
      const newUser: InMemoryUser = {
        id: newId,
        hospital_id: hospitalId,
        full_name: fullName,
        email: email.toLowerCase(),
        password_hash: passwordHash,
        medical_license: medicalLicense || `LIC-${Math.floor(10000 + Math.random() * 90000)}`,
        role: normalizedRole,
        is_authorized: true
      };
      inMemoryUsers.push(newUser);
      createdUser = newUser;
    }

    const tokenPayload: UserTokenPayload = {
      id: createdUser.id,
      hospital_id: createdUser.hospital_id,
      email: createdUser.email,
      user_role: normalizedRole,
      medical_license: createdUser.medical_license
    };

    const token = this.generateToken(tokenPayload);

    return {
      status: 'success',
      token,
      user: {
        id: createdUser.id,
        hospital_id: createdUser.hospital_id,
        full_name: createdUser.full_name,
        email: createdUser.email,
        user_role: normalizedRole,
        medical_license: createdUser.medical_license
      },
      hospital: hospitalRow
    };
  }

  /**
   * Retrieves profile and hospital metadata for current session
   */
  public static async getMe(userId: string): Promise<AuthenticatedUser | null> {
    try {
      const query = `
        SELECT 
          u.id, 
          u.hospital_id, 
          u.full_name, 
          u.email, 
          u.role, 
          u.medical_license, 
          u.is_authorized,
          h.id AS h_id,
          h.name AS hospital_name,
          h.hospital_code,
          h.city AS hospital_city,
          h.state AS hospital_state,
          h.verification_status AS hospital_verification_status
        FROM hospital_users u
        LEFT JOIN hospitals h ON u.hospital_id = h.id
        WHERE u.id = $1;
      `;
      const result = await pool.query(query, [userId]);
      if (result.rows.length > 0) {
        const row = result.rows[0];
        return {
          id: row.id,
          hospital_id: row.hospital_id,
          full_name: row.full_name,
          email: row.email,
          role: row.role.toLowerCase(),
          medical_license: row.medical_license,
          is_authorized: row.is_authorized,
          hospital: row.h_id ? {
            id: row.h_id,
            name: row.hospital_name,
            hospital_code: row.hospital_code,
            city: row.hospital_city,
            state: row.hospital_state,
            verification_status: row.hospital_verification_status
          } : undefined
        };
      }
    } catch (err) {
      // Offline fallback
    }

    const user = inMemoryUsers.find(u => u.id === userId);
    if (!user) return null;

    const hospital = inMemoryHospitals.find(h => h.id === user.hospital_id);

    return {
      id: user.id,
      hospital_id: user.hospital_id,
      full_name: user.full_name,
      email: user.email,
      role: user.role.toLowerCase(),
      medical_license: user.medical_license,
      is_authorized: user.is_authorized,
      hospital
    };
  }

  /**
   * Logs in or creates a verified session using a verified Email OTP
   */
  public static async loginWithVerifiedEmail(email: string) {
    const normalizedEmail = email.trim().toLowerCase();


    // 1. Try to find user in database
    try {
      const query = `
        SELECT 
          u.id, 
          u.hospital_id, 
          u.full_name, 
          u.email, 
          u.role, 
          u.medical_license, 
          u.is_authorized,
          h.id AS h_id,
          h.name AS hospital_name,
          h.hospital_code,
          h.city AS hospital_city,
          h.state AS hospital_state,
          h.verification_status AS hospital_verification_status
        FROM hospital_users u
        LEFT JOIN hospitals h ON u.hospital_id = h.id
        WHERE LOWER(u.email) = LOWER($1);
      `;
      const result = await pool.query(query, [normalizedEmail]);
      if (result.rows.length > 0) {
        const userRow = result.rows[0];
        const tokenPayload: UserTokenPayload = {
          id: userRow.id,
          hospital_id: userRow.hospital_id,
          email: userRow.email,
          full_name: userRow.full_name,
          user_role: userRow.role.toLowerCase(),
          medical_license: userRow.medical_license
        };

        const token = this.generateToken(tokenPayload);

        return {
          status: 'success',
          token,
          user: {
            id: userRow.id,
            hospital_id: userRow.hospital_id,
            full_name: userRow.full_name,
            email: userRow.email,
            user_role: userRow.role.toLowerCase(),
            medical_license: userRow.medical_license
          },
          hospital: userRow.h_id ? {
            id: userRow.h_id,
            name: userRow.hospital_name,
            hospital_code: userRow.hospital_code,
            city: userRow.hospital_city,
            state: userRow.hospital_state,
            verification_status: userRow.hospital_verification_status
          } : undefined
        };
      }
    } catch (err) {
      // In-memory fallback
    }

    // 2. Check in-memory users
    let user = inMemoryUsers.find(u => u.email.toLowerCase() === normalizedEmail);

    if (!user) {
      // Create on-the-fly authorized session for this personal verified email
      const newUserId = `usr-${Date.now()}`;
      const defaultHospital = inMemoryHospitals[0];
      const nameFromEmail = normalizedEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

      user = {
        id: newUserId,
        hospital_id: defaultHospital.id,
        full_name: nameFromEmail || 'Verified Clinical Officer',
        email: normalizedEmail,
        password_hash: 'otp-verified',
        medical_license: `MCI-VERIFIED-${Math.floor(10000 + Math.random() * 90000)}`,
        role: 'transplant_surgeon',
        is_authorized: true
      };
      inMemoryUsers.push(user);
    }

    const hospital = inMemoryHospitals.find(h => h.id === user?.hospital_id) || inMemoryHospitals[0];

    const tokenPayload: UserTokenPayload = {
      id: user.id,
      hospital_id: user.hospital_id,
      email: user.email,
      user_role: user.role.toLowerCase(),
      medical_license: user.medical_license
    };

    const token = this.generateToken(tokenPayload);

    return {
      status: 'success',
      token,
      user: {
        id: user.id,
        hospital_id: user.hospital_id,
        full_name: user.full_name,
        email: user.email,
        user_role: user.role.toLowerCase(),
        medical_license: user.medical_license
      },
      hospital
    };
  }
}

