import { safeEscapeFormulaString } from './utils/security.js';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appg245A41MWc6Rej';
const AIRTABLE_USERS_TABLE = process.env.AIRTABLE_USERS_TABLE || 'Users';
const AIRTABLE_POSTS_TABLE = process.env.AIRTABLE_POSTS_TABLE || 'Posts';
const AIRTABLE_GAMES_TABLE = process.env.AIRTABLE_GAMES_TABLE || 'Games';
const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  if (!AIRTABLE_API_KEY) {
    return res.status(500).json({ message: 'Server configuration error' });
  }

  const { token } = req.body || {};
  if (!token) {
    return res.status(400).json({ message: 'Missing required field: token' });
  }

  try {
    const userRecord = await findUserByToken(token);
    if (!userRecord) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const userGames = await getUserGames(userRecord.id);
    if (!userGames || userGames.length === 0) {
      return res.status(200).json({
        ok: true,
        totalShippedHours: 0,
        totalApprovedHours: 0,
        gameShips: []
      });
    }

    const gameShips = await Promise.all(
      userGames.map(async (game) => {
        const shipPosts = await fetchShipPostsForGame(game.id);
        const totalShippedHours = shipPosts.reduce((sum, post) => sum + (post.hoursSpent || 0), 0);
        const totalApprovedHours = shipPosts.reduce((sum, post) => sum + (post.approvedHours || 0), 0);

        return {
          gameId: game.id,
          gameName: game.fields?.Name,
          totalShippedHours,
          totalApprovedHours,
          shipCount: shipPosts.length,
          recentShips: shipPosts.slice(0, 3),
          approvalRate: totalShippedHours > 0 ? Math.round((totalApprovedHours / totalShippedHours) * 100) : 0
        };
      })
    );

    const gamesWithShips = gameShips.filter(game => game.shipCount > 0);

    const totalShippedHours = gamesWithShips.reduce((sum, game) => sum + game.totalShippedHours, 0);
    const totalApprovedHours = gamesWithShips.reduce((sum, game) => sum + game.totalApprovedHours, 0);

    return res.status(200).json({
      ok: true,
      totalShippedHours,
      totalApprovedHours,
      gameShips: gamesWithShips
    });
  } catch (error) {
    console.error('GetMyDemoShips error:', error);
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

async function findUserByToken(token) {
  const tokenEscaped = safeEscapeFormulaString(token);
  const params = new URLSearchParams({
    filterByFormula: `{token} = "${tokenEscaped}"`,
    pageSize: '1',
  });

  const data = await airtableRequest(`${encodeURIComponent(AIRTABLE_USERS_TABLE)}?${params.toString()}`, {
    method: 'GET',
  });

  return (data.records && data.records[0]) || null;
}

async function getUserGames(userId) {
  const userIdEscaped = safeEscapeFormulaString(userId);
  const params = new URLSearchParams({
    filterByFormula: `FIND("${userIdEscaped}", ARRAYJOIN({Owner}))`,
  });

  const data = await airtableRequest(`${encodeURIComponent(AIRTABLE_GAMES_TABLE)}?${params.toString()}`, {
    method: 'GET',
  });

  return data.records || [];
}

async function getAllRecordsWithPagination(tableName, filterFormula = null) {
  let allRecords = [];
  let offset = null;

  do {
    const params = new URLSearchParams();
    if (filterFormula) {
      params.set('filterByFormula', filterFormula);
    }
    if (offset) {
      params.set('offset', offset);
    }
    params.set('sort[0][field]', 'Created At');
    params.set('sort[0][direction]', 'desc');

    const data = await airtableRequest(`${encodeURIComponent(tableName)}?${params.toString()}`, {
      method: 'GET',
    });

    if (data.records) {
      allRecords = allRecords.concat(data.records);
    }

    offset = data.offset;
  } while (offset);

  return allRecords;
}

async function fetchShipPostsForGame(gameId) {
  const gameIdEscaped = safeEscapeFormulaString(gameId);
  const filterFormula = `AND(FIND("${gameIdEscaped}", ARRAYJOIN({Game})))`;

  const records = await getAllRecordsWithPagination(AIRTABLE_POSTS_TABLE, filterFormula);

  const shipPosts = records
    .filter(record => {
      const attachments = record.fields?.Attachements || [];
      const attachmentLinks = record.fields?.AttachementLinks || '';
      const content = record.fields?.Content || '';

      const hasZipFile = attachments.some(att =>
        att.filename && att.filename.toLowerCase().endsWith('.zip')
      ) || attachmentLinks.toLowerCase().includes('.zip');

      const hasShipContent = content.toLowerCase().includes('demo') ||
                           content.toLowerCase().includes('ship') ||
                           content.toLowerCase().includes('build') ||
                           content.toLowerCase().includes('version');

      const hasHoursSpent = record.fields?.HoursSpent && record.fields.HoursSpent > 0;

      return hasZipFile || (hasShipContent && hasHoursSpent);
    })
    .map(record => {
      const badges = Array.isArray(record.fields?.Badges) ? record.fields.Badges : [];
      const hoursSpent = record.fields?.HoursSpent || 0;
      
      let status = 'pending';
      let approvedHours = 0;

      if (badges.includes('approved') || badges.includes('Approved')) {
        status = 'approved';
        approvedHours = hoursSpent;
      } else if (badges.includes('rejected') || badges.includes('Rejected')) {
        status = 'rejected';
        approvedHours = 0;
      } else if (badges.includes('partial') || badges.includes('Partial')) {
        status = 'partial';
        approvedHours = Math.floor(hoursSpent * 0.5);
      }

      return {
        id: record.id,
        content: record.fields?.Content || '',
        hoursSpent: hoursSpent,
        approvedHours: approvedHours,
        createdAt: record.fields?.['Created At'] || record.createdTime,
        status: status,
        badges: badges
      };
    });

  return shipPosts;
}