import { safeEscapeFormulaString } from './utils/security.js';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appg245A41MWc6Rej';
const AIRTABLE_POSTS_TABLE = process.env.AIRTABLE_POSTS_TABLE || 'Posts';
const AIRTABLE_GAMES_TABLE = process.env.AIRTABLE_GAMES_TABLE || 'Games';
const AIRTABLE_USERS_TABLE = process.env.AIRTABLE_USERS_TABLE || 'Users';
const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  if (!AIRTABLE_API_KEY) {
    return res.status(500).json({ message: 'Server configuration error' });
  }

  try {
    const { gameId } = req.body || {};
    if (!gameId) {
      return res.status(400).json({ message: 'Missing gameId parameter' });
    }

    // Fetch posts for the specific game
    const posts = await fetchPostsForGame(gameId);
    
    return res.status(200).json(posts);
  } catch (error) {
    console.error('GetPostsForGame error:', error);
    return res.status(500).json({ message: 'An unexpected error occurred.' });
  }
}

async function fetchPostsForGame(gameId) {
  console.log('[GetPostsForGame] fetchPostsForGame gameId:', gameId);
  
  // First, try filtering server-side for performance and correctness
  const tryServerFilter = async () => {
    const params = new URLSearchParams();
    params.set('pageSize', '100');
    params.set('filterByFormula', `ARRAYJOIN({Game}) = "${safeEscapeFormulaString(gameId)}"`);
    params.set('sort[0][field]', 'Created At');
    params.set('sort[0][direction]', 'desc');
    const url = `${encodeURIComponent(AIRTABLE_POSTS_TABLE)}?${params.toString()}`;
    const page = await airtableRequest(url, { method: 'GET' });
    const records = Array.isArray(page?.records) ? page.records : [];
    console.log(`[GetPostsForGame] server filter posts count for ${gameId}:`, records.length);
    return records;
  };

  let records = await tryServerFilter();
  if (!records || records.length === 0) {
    // Fallback: fetch pages and filter in code
    let allRecords = [];
    let offset;
    do {
      const params = new URLSearchParams();
      params.set('pageSize', '100');
      if (offset) params.set('offset', offset);
      const url = `${encodeURIComponent(AIRTABLE_POSTS_TABLE)}?${params.toString()}`;
      const page = await airtableRequest(url, { method: 'GET' });
      const pageRecords = (page?.records || []).filter((rec) => Array.isArray(rec.fields?.Game) && rec.fields.Game.includes(gameId));
      allRecords = allRecords.concat(pageRecords);
      offset = page?.offset;
    } while (offset);
    console.log(`[GetPostsForGame] fallback client-filter posts count for ${gameId}:`, allRecords.length);
    records = allRecords;
  }

  // Sort newest first using "Created At" (fallback to createdTime)
  records.sort((a, b) => {
    const ad = new Date(a?.fields?.['Created At'] || a?.createdTime || 0).getTime();
    const bd = new Date(b?.fields?.['Created At'] || b?.createdTime || 0).getTime();
    return bd - ad;
  });

  // Get game and user information for the posts
  const gameRecord = await findGameById(gameId);
  const ownerId = gameRecord ? normalizeLinkedIds(gameRecord.fields?.Owner)[0] : null;
  const ownerRecord = ownerId ? await findUserById(ownerId) : null;
  const slackId = ownerRecord ? (ownerRecord.fields?.['slack id'] || '') : '';

  return records.map((rec) => ({
    id: rec.id,
    postId: rec.fields?.PostID || '',
    content: rec.fields?.Content || '',
    createdAt: rec.fields?.['Created At'] || rec.createdTime || '',
    PlayLink: typeof rec.fields?.PlayLink === 'string' ? rec.fields.PlayLink : '',
    Attachements: Array.isArray(rec.fields?.Attachements)
      ? rec.fields.Attachements.map((a) => ({
          url: a?.url,
          type: a?.type,
          filename: a?.filename,
          id: a?.id,
          size: a?.size,
        })).filter((a) => a.url)
      : [],
    'slack id': slackId,
    'Game Name': gameRecord?.fields?.Name || '',
    GameThumbnail: Array.isArray(gameRecord?.fields?.Thumbnail) && gameRecord.fields.Thumbnail[0]?.url 
      ? gameRecord.fields.Thumbnail[0].url 
      : '',
  }));
}

async function findGameById(gameId) {
  try {
    const record = await airtableRequest(`${encodeURIComponent(AIRTABLE_GAMES_TABLE)}/${encodeURIComponent(gameId)}`, { method: 'GET' });
    return record;
  } catch (error) {
    console.error('Error finding game by ID:', error);
    return null;
  }
}

async function findUserById(userId) {
  try {
    const record = await airtableRequest(`${encodeURIComponent(AIRTABLE_USERS_TABLE)}/${encodeURIComponent(userId)}`, { method: 'GET' });
    return record;
  } catch (error) {
    console.error('Error finding user by ID:', error);
    return null;
  }
}

async function airtableRequest(path, options = {}) {
  const url = `${AIRTABLE_API_BASE}/${AIRTABLE_BASE_ID}/${path}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`Airtable API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function normalizeLinkedIds(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  } else if (typeof value === 'string') {
    return value ? [value] : [];
  } else {
    return [];
  }
}
