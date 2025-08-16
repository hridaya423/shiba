const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appg245A41MWc6Rej';
const AIRTABLE_USERS_TABLE = process.env.AIRTABLE_USERS_TABLE || 'Users';
const AIRTABLE_GAMES_TABLE = process.env.AIRTABLE_GAMES_TABLE || 'Games';
const AIRTABLE_YSWS_RECORD_HISTORY_TABLE = 'YSWS Record History';
const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  if (!AIRTABLE_API_KEY) {
    return res.status(500).json({ message: 'Server configuration error' });
  }

  const { token, gameId, githubUrl } = req.body || {};
  if (!token) {
    return res.status(400).json({ message: 'Missing required field: token' });
  }
  if (!githubUrl || githubUrl.trim() === '') {
    return res.status(400).json({ message: 'Missing required field: githubUrl' });
  }

  try {
    // Find the user by token
    const userRecord = await findUserByToken(token);
    if (!userRecord) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Create a record in the "YSWS Record History" table
    const fields = {
      'Code URL': githubUrl.trim(),
      'Game': [gameId],
      'User': [userRecord.id]
    };

    const payload = { records: [{ fields }] };
    const created = await airtableRequest(encodeURIComponent(AIRTABLE_YSWS_RECORD_HISTORY_TABLE), {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (created?.records?.[0]) {
      return res.status(200).json({ 
        ok: true, 
        message: 'Successfully created YSWS record',
        recordId: created.records[0].id
      });
    } else {
      return res.status(500).json({ message: 'Failed to create YSWS record' });
    }
  } catch (error) {
    console.error('SyncUserWithYSWSDB error:', error);
    return res.status(500).json({ message: 'An unexpected error occurred during sync.' });
  }
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

function escapeFormulaString(value) {
  return String(value).replace(/"/g, '\\"');
}

async function findUserByToken(token) {
  const tokenEscaped = escapeFormulaString(token);
  const formula = `{token} = "${tokenEscaped}"`;
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
