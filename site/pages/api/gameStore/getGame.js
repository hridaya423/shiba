import { safeEscapeFormulaString } from '../utils/security.js';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;

// Simple in-memory rate limiting (in production, use Redis or similar)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute per IP
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appg245A41MWc6Rej';
const AIRTABLE_USERS_TABLE = process.env.AIRTABLE_USERS_TABLE || 'Users';
const AIRTABLE_GAMES_TABLE = process.env.AIRTABLE_GAMES_TABLE || 'Games';
const AIRTABLE_POSTS_TABLE = process.env.AIRTABLE_POSTS_TABLE || 'Posts';
const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  if (!AIRTABLE_API_KEY) {
    return res.status(500).json({ message: 'Server configuration error' });
  }

  // Rate limiting
  const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;
  
  if (!rateLimitMap.has(clientIP)) {
    rateLimitMap.set(clientIP, []);
  }
  
  const requests = rateLimitMap.get(clientIP);
  const recentRequests = requests.filter(timestamp => timestamp > windowStart);
  
  if (recentRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({ message: 'Rate limit exceeded. Please try again later.' });
  }
  
  recentRequests.push(now);
  rateLimitMap.set(clientIP, recentRequests);

  try {
    const { slackId, gameName } = req.body || {};
    
    // Input validation and sanitization
    if (!slackId || !gameName) {
      return res.status(400).json({ message: 'Missing required fields: slackId, gameName' });
    }

    // Validate input types and lengths
    if (typeof slackId !== 'string' || typeof gameName !== 'string') {
      return res.status(400).json({ message: 'Invalid input types' });
    }

    // Sanitize and validate input lengths
    const sanitizedSlackId = slackId.trim();
    const sanitizedGameName = gameName.trim();

    if (sanitizedSlackId.length === 0 || sanitizedGameName.length === 0) {
      return res.status(400).json({ message: 'Empty input values' });
    }

    // Validate Slack ID format (basic validation)
    if (!/^[A-Z0-9]+$/.test(sanitizedSlackId)) {
      return res.status(400).json({ message: 'Invalid Slack ID format' });
    }

    // Limit input lengths to prevent abuse
    if (sanitizedSlackId.length > 20 || sanitizedGameName.length > 200) {
      return res.status(400).json({ message: 'Input too long' });
    }

    // Find the specific game by slackId and game name directly in Games table
    const targetGame = await findGameBySlackIdAndName(sanitizedSlackId, sanitizedGameName);

    if (!targetGame) {
      return res.status(404).json({ message: 'Game not found for this user' });
    }

    // Fetch posts for this game
    const posts = await fetchPostsForGame(targetGame.id);

    // Explicitly select only the fields we want to expose (defense in depth)
    const allowedFields = [
      'Name', 'Description', 'Thumbnail', 'Playable URL', 'GitHubURL', 'GithubURL',
      'Hackatime Projects', 'HoursSpent', 'AveragePlaytestSeconds', 'AverageFunScore',
      'AverageArtScore', 'AverageCreativityScore', 'AverageAudioScore', 'AverageMoodScore',
      'numberComplete', 'Feedback', 'Last Updated'
    ];

    // Format the game data with explicit field selection
    const game = {
      id: targetGame.id,
      name: targetGame.fields?.Name || '',
      description: targetGame.fields?.Description || '',
      thumbnailUrl: Array.isArray(targetGame.fields?.Thumbnail) && targetGame.fields.Thumbnail[0]?.url 
        ? targetGame.fields.Thumbnail[0].url 
        : '',
      playableURL: targetGame.fields?.['Playable URL'] || '',
      GitHubURL: targetGame.fields?.GitHubURL || targetGame.fields?.GithubURL || '',
      HackatimeProjects: Array.isArray(targetGame.fields?.['Hackatime Projects'])
        ? targetGame.fields['Hackatime Projects'].filter(Boolean).join(', ')
        : (typeof targetGame.fields?.['Hackatime Projects'] === 'string' 
           ? targetGame.fields['Hackatime Projects'] 
           : ''),
      HoursSpent: targetGame.fields?.HoursSpent || 0,
      AveragePlaytestSeconds: targetGame.fields?.AveragePlaytestSeconds || 0,
      AverageFunScore: targetGame.fields?.AverageFunScore || 0,
      AverageArtScore: targetGame.fields?.AverageArtScore || 0,
      AverageCreativityScore: targetGame.fields?.AverageCreativityScore || 0,
      AverageAudioScore: targetGame.fields?.AverageAudioScore || 0,
      AverageMoodScore: targetGame.fields?.AverageMoodScore || 0,
      numberComplete: targetGame.fields?.numberComplete || 0,
      Feedback: targetGame.fields?.Feedback || '',
      lastUpdated: targetGame.fields?.['Last Updated'] || targetGame.createdTime || '',
      posts,
    };

    return res.status(200).json(game);
  } catch (error) {
    console.error('getGame error:', error);
    return res.status(500).json({ message: 'An unexpected error occurred.' });
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

async function findGameBySlackIdAndName(slackId, gameName) {
  const slackIdEscaped = safeEscapeFormulaString(slackId);
  const gameNameEscaped = safeEscapeFormulaString(gameName);
  const formula = `AND({slack id} = "${slackIdEscaped}", {Name} = "${gameNameEscaped}")`;
  const params = new URLSearchParams({
    filterByFormula: formula,
    pageSize: '1',
  });

  const data = await airtableRequest(`${encodeURIComponent(AIRTABLE_GAMES_TABLE)}?${params.toString()}`, {
    method: 'GET',
  });
  const record = data.records && data.records[0];
  return record || null;
}

async function fetchPostsForGame(gameId) {
  console.log('[getGame] fetchPostsForGame gameId:', gameId);
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
    console.log(`[getGame] server filter posts count for ${gameId}:`, records.length);
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
    console.log(`[getGame] fallback client-filter posts count for ${gameId}:`, allRecords.length);
    records = allRecords;
  }

  // Sort newest first using "Created At" (fallback to createdTime)
  records.sort((a, b) => {
    const ad = new Date(a?.fields?.['Created At'] || a?.createdTime || 0).getTime();
    const bd = new Date(b?.fields?.['Created At'] || b?.createdTime || 0).getTime();
    return bd - ad;
  });

  return records.map((rec) => ({
    id: rec.id,
    postId: rec.fields?.PostID || '',
    content: rec.fields?.Content || '',
    createdAt: rec.fields?.['Created At'] || rec.createdTime || '',
    PlayLink: typeof rec.fields?.PlayLink === 'string' ? rec.fields.PlayLink : '',
    HoursSpent: rec.fields?.HoursSpent || 0,
    attachments: Array.isArray(rec.fields?.Attachements)
      ? rec.fields.Attachements.map((a) => ({
          url: a?.url,
          type: a?.type,
          filename: a?.filename,
          id: a?.id,
          size: a?.size,
        })).filter((a) => a.url)
      : [],
    badges: Array.isArray(rec.fields?.Badges) ? rec.fields.Badges : [],
  }));
}
