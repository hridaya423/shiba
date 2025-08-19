import { escapeFormulaString, generateSecureRandomString } from './utils/security.js';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appg245A41MWc6Rej';
const AIRTABLE_USERS_TABLE = process.env.AIRTABLE_USERS_TABLE || 'Users';
const AIRTABLE_GAMES_TABLE = process.env.AIRTABLE_GAMES_TABLE || 'Games';
const AIRTABLE_POSTS_TABLE = process.env.AIRTABLE_POSTS_TABLE || 'Posts';
const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';
const ALPHANUMERIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  if (!AIRTABLE_API_KEY) {
    return res.status(500).json({ message: 'Server configuration error' });
  }

  const { token, gameId, content, attachmentsUpload, playLink } = req.body || {};
  if (!token || !gameId || !content) {
    return res.status(400).json({ message: 'Missing required fields: token, gameId, content' });
  }

  const sanitized = String(content).trim().substring(0, 5000); // they really should not be this long
  if (sanitized.length === 0) {
    return res.status(400).json({ message: 'Content empty?' });
  }

  try {
    const userRecord = await findUserByToken(token);
    if (!userRecord) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Verify ownership of the game
    const game = await airtableRequest(`${encodeURIComponent(AIRTABLE_GAMES_TABLE)}/${encodeURIComponent(gameId)}`, { method: 'GET' });
    const ownerIds = normalizeLinkedIds(game?.fields?.Owner);
    const isOwner = ownerIds.includes(userRecord.id);
    if (!isOwner) {
      return res.status(403).json({ message: 'Forbidden: not the owner of this game' });
    }

    // Create a new Post and link to the Game
    const postId = generateAlphanumericId(16);
    const fields = {
      Content: sanitized,
      Game: [gameId],
      PostID: postId,
    };

    if (typeof playLink === 'string' && playLink.trim().length > 0) {
      const trimmed = playLink.trim().substring(0, 500);
      try {
        const url = new URL(trimmed);
        if (url.protocol === 'https:') {
          fields.PlayLink = trimmed;
        }
      } catch {
        // wonky
      }
    }
    const payload = { records: [{ fields }] };
    const created = await airtableRequest(encodeURIComponent(AIRTABLE_POSTS_TABLE), {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const rec = created?.records?.[0];
    // Optionally upload multiple attachments (<= 5MB each as base64) to Attachements field
    if (rec && Array.isArray(attachmentsUpload) && attachmentsUpload.length > 0) {
      for (const item of attachmentsUpload) {
        const { fileBase64, contentType, filename } = item || {};
        if (fileBase64 && contentType && filename) {
          try {
            await airtableContentUpload({
              recordId: rec.id,
              fieldName: 'Attachements',
              fileBase64,
              contentType,
              filename,
            });
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error('createPost attachment upload failed:', e);
          }
        }
      }
    }
    // Fetch latest post to include uploaded attachments
    const latest = await airtableRequest(`${encodeURIComponent(AIRTABLE_POSTS_TABLE)}/${encodeURIComponent(rec.id)}`, { method: 'GET' });
    const result = latest
      ? {
          id: latest.id,
          content: latest.fields?.Content || '',
          gameId,
          PostID: latest.fields?.PostID || postId,
          createdAt: latest.fields?.['Created At'] || latest.createdTime || new Date().toISOString(),
          PlayLink: typeof latest.fields?.PlayLink === 'string' ? latest.fields.PlayLink : '',
          attachments: Array.isArray(latest.fields?.Attachements)
            ? latest.fields.Attachements.map((a) => ({ 
                url: a?.url, 
                type: a?.type, 
                contentType: a?.type, // Add contentType for compatibility
                filename: a?.filename, 
                id: a?.id, 
                size: a?.size 
              })).filter((a) => a.url)
            : [],
        }
      : null;

    return res.status(200).json({ ok: true, post: result });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('createPost error:', error);
    return res.status(500).json({ message: 'An unexpected error occurred.' });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb',
    },
  },
};



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

function normalizeLinkedIds(value) {
  if (Array.isArray(value)) {
    if (value.length === 0) return [];
    if (typeof value[0] === 'string') return value;
    if (typeof value[0] === 'object' && value[0] && typeof value[0].id === 'string') {
      return value.map((v) => v.id);
    }
  }
  return [];
}

async function airtableContentUpload({ recordId, fieldName, fileBase64, contentType, filename }) {
  const url = `https://content.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(recordId)}/${encodeURIComponent(fieldName)}/uploadAttachment`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: fileBase64, contentType, filename }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Airtable content upload error ${res.status}: ${text}`);
  }
  return res.json();
}

function generateAlphanumericId(length) {
  return generateSecureRandomString(length);
}


