import crypto from 'crypto';
import { escapeFormulaString, isValidEmail } from './utils/security.js';
import { checkRateLimit } from './utils/rateLimit.js';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appg245A41MWc6Rej';
const AIRTABLE_USERS_TABLE = process.env.AIRTABLE_USERS_TABLE || 'Users';
const AIRTABLE_OTP_TABLE = process.env.AIRTABLE_OTP_TABLE || 'OTP';
const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  if (!AIRTABLE_API_KEY) {
    return res.status(500).json({ message: 'Server configuration error' });
  }

  const { email, otp } = req.body || {};
  if (!email || !otp) {
    return res.status(400).json({ message: 'Missing required fields: email, otp' });
  }

  const normalizedEmail = normalizeEmail(email);
  
  // Rate limiting by email address for OTP attempts
  const rateLimitKey = `otp:${normalizedEmail}`;
  if (!checkRateLimit(rateLimitKey, 10, 300000)) { // 10 attempts per 5 minutes
    return res.status(429).json({ message: 'Too many OTP attempts. Please try again later.' });
  }

  try {
    // Get most recent OTP for this email within last 5 minutes
    const minutesWindow = 5;
    const recentOtp = await getMostRecentOtpForEmail(normalizedEmail, minutesWindow);
    if (!recentOtp) {
      return res.status(400).json({ message: 'Invalid or expired code.' });
    }

    const recentCode = String(recentOtp.fields?.OTP || '');
    // Extra server-side guard in case table lacks filter support
    if (recentOtp.createdTime) {
      const createdMs = new Date(recentOtp.createdTime).getTime();
      if (Number.isFinite(createdMs)) {
        const ageMs = Date.now() - createdMs;
        if (ageMs > minutesWindow * 60 * 1000) {
          return res.status(400).json({ message: 'Invalid or expired code.' });
        }
      }
    }
    if (recentCode !== String(otp)) {
      return res.status(400).json({ message: 'Invalid code.' });
    }

    // Fetch user and return current token
    const userRecord = await findUserByEmail(normalizedEmail);
    if (!userRecord) {
      return res.status(400).json({ message: 'User not found.' });
    }
    const token = String(userRecord.fields?.token || '');
    if (!token) {
      return res.status(400).json({ message: 'No active token for user.' });
    }

    return res.status(200).json({ token });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('tryOTP error:', error);
    return res.status(500).json({ message: 'An unexpected error occurred.' });
  }
}

function normalizeEmail(input) {
  const normalized = String(input).toLowerCase().replace(/\s+/g, '');
  return isValidEmail(normalized) ? normalized : '';
}

async function airtableRequest(path, options = {}) {
  const url = `${AIRTABLE_API_BASE}/${AIRTABLE_BASE_ID}/${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Airtable error ${response.status}: ${text}`);
  }
  return response.json();
}

async function findUserByEmail(email) {
  // For email searches, use simple exact match without complex escaping
  const formula = `{Email} = "${email}"`;
  const params = new URLSearchParams({
    filterByFormula: formula,
    pageSize: '1',
  });

  const data = await airtableRequest(`${encodeURIComponent(AIRTABLE_USERS_TABLE)}?${params.toString()}`, {
    method: 'GET',
  });
  const record = data.records && data.records[0];
  return record || null;
}

async function getMostRecentOtpForEmail(email, minutesWindow = 5) {
  const params = new URLSearchParams();
  params.set('filterByFormula', `AND({Email} = "${email}", IS_AFTER(CREATED_TIME(), DATEADD(NOW(), -${minutesWindow}, 'minutes')))`);
  params.set('pageSize', '1');
  params.set('sort[0][field]', 'Created At');
  params.set('sort[0][direction]', 'desc');

  const data = await airtableRequest(`${encodeURIComponent(AIRTABLE_OTP_TABLE)}?${params.toString()}`, {
    method: 'GET',
  });
  const record = data.records && data.records[0];
  return record || null;
}
