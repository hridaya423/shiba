const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

// Global sync state
let isSyncRunning = false;
let lastSyncTime = null;
let lastSyncResult = null;
let syncError = null;

// Background sync function
async function runBackgroundSync() {
  if (isSyncRunning) {
    console.log('Sync already running, skipping...');
    return;
  }

  isSyncRunning = true;
  console.log(`\n🔄 Starting background sync at ${new Date().toISOString()}`);

  try {
    const result = await performFullSync();
    lastSyncResult = result;
    lastSyncTime = new Date();
    syncError = null;
    console.log(`✅ Background sync completed successfully at ${lastSyncTime.toISOString()}`);
  } catch (error) {
    syncError = error;
    console.error(`❌ Background sync failed:`, error.message);
  } finally {
    isSyncRunning = false;
  }
}

// Extract sync logic into reusable function
async function performFullSync() {
  if (!AIRTABLE_API_KEY) {
    throw new Error('Server configuration error: Missing Airtable API key');
  }

  console.log('Fetching all games from Airtable...');
  
  // Fetch all games with pagination, only specific fields
  const allGames = await fetchAllGames();
  
  console.log(`Fetched ${allGames.length} games. Now fetching Hackatime data per user...`);
  
  // Group games by user (slack id) to minimize API calls
  const gamesByUser = {};
  allGames.forEach(game => {
    const slackId = game.fields?.['slack id'];
    if (slackId) {
      if (!gamesByUser[slackId]) {
        gamesByUser[slackId] = [];
      }
      gamesByUser[slackId].push(game);
    }
  });
  
  // Only include users who have at least one game with non-empty Hackatime Projects
  const uniqueUsersAll = Object.keys(gamesByUser);
  const uniqueUsers = uniqueUsersAll.filter((slackId) => {
    const userGames = gamesByUser[slackId] || [];
    return userGames.some((g) => {
      const projects = g.fields?.['Hackatime Projects'];
      if (Array.isArray(projects)) return projects.filter(Boolean).length > 0;
      if (typeof projects === 'string') return projects.trim().length > 0;
      return false;
    });
  });
  console.log(`Found ${uniqueUsersAll.length} unique users; ${uniqueUsers.length} with Hackatime Projects`);
  
  // Fetch Hackatime data for each unique user
  const userHackatimeData = {};
  for (let i = 0; i < uniqueUsers.length; i++) {
    const slackId = uniqueUsers[i];
    console.log(`Fetching Hackatime data for user ${i + 1}/${uniqueUsers.length}: ${slackId}`);
    
    try {
      userHackatimeData[slackId] = await fetchHackatimeData(slackId);
      // Small delay to be respectful to Hackatime API
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`Error fetching Hackatime data for ${slackId}:`, error.message);
      userHackatimeData[slackId] = { projects: [], total_seconds: 0 };
    }
  }
  
  console.log('Hackatime data fetched. Now updating games...');
  
  // Track claimed projects per user to prevent double counting
  const userClaimedProjects = {};
  uniqueUsers.forEach(slackId => {
    userClaimedProjects[slackId] = new Set();
  });
  
  // Update each game with calculated seconds
  let successCount = 0;
  let errorCount = 0;
  const updatedGames = [];
  
  for (let i = 0; i < allGames.length; i++) {
    const game = allGames[i];
    const fields = game.fields || {};
    const slackId = fields['slack id'];
    
    console.log(`Processing game ${i + 1}/${allGames.length}: ${fields.Name}`);
    
    // Always include the game in results, even if no updates
    const gameResult = {
      id: game.id,
      Name: fields.Name || '',
      'slack id': slackId || '',
      'Hackatime Projects': Array.isArray(fields['Hackatime Projects'])
        ? fields['Hackatime Projects'].filter(Boolean).join(', ')
        : (typeof fields['Hackatime Projects'] === 'string' ? fields['Hackatime Projects'] : ''),
      HackatimeSeconds: fields.HackatimeSeconds || 0
    };
    
    // Skip update if no slack id or hackatime projects
    if (!slackId || !fields['Hackatime Projects']) {
      console.log(`Skipping ${fields.Name} - missing slack id or hackatime projects`);
      updatedGames.push(gameResult);
      continue;
    }
    
    try {
      // Get the user's Hackatime data (already fetched)
      const hackatimeData = userHackatimeData[slackId] || { projects: [], total_seconds: 0 };
      
      // Calculate total seconds for this specific game's projects (with claiming)
      const totalSeconds = calculateProjectSecondsWithClaiming(
        hackatimeData, 
        fields['Hackatime Projects'], 
        userClaimedProjects[slackId]
      );
      
      // Update the game in Airtable
      await updateGameHackatimeSeconds(game.id, totalSeconds);
      
      // Update the result object
      gameResult.HackatimeSeconds = totalSeconds;
      updatedGames.push(gameResult);
      
      successCount++;
      console.log(`✅ Updated ${fields.Name}: ${totalSeconds} seconds`);
      
    } catch (error) {
      errorCount++;
      console.error(`❌ Error updating ${fields.Name}:`, error.message);
      updatedGames.push(gameResult);
    }
  }
  
  console.log(`Sync complete! ${successCount} successful, ${errorCount} errors`);
  
  return {
    success: true,
    totalGames: allGames.length,
    uniqueUsers: uniqueUsers.length,
    successfulUpdates: successCount,
    errors: errorCount,
    games: updatedGames,
    timestamp: new Date().toISOString()
  };
}

// Start background sync interval
console.log(`🔄 Starting background sync every ${SYNC_INTERVAL / 1000 / 60} minutes...`);
setInterval(runBackgroundSync, SYNC_INTERVAL);

// Run initial sync after 10 seconds
setTimeout(() => {
  console.log('🚀 Running initial sync in 10 seconds...');
  runBackgroundSync();
}, 10000);

// Airtable configuration
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_USERS_TABLE = process.env.AIRTABLE_USERS_TABLE || 'Users';
const AIRTABLE_GAMES_TABLE = process.env.AIRTABLE_GAMES_TABLE || 'Games';
const AIRTABLE_POSTS_TABLE = process.env.AIRTABLE_POSTS_TABLE || 'Posts';
const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'HackatimeSync Server is running!',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Sync routes
app.get('/api/sync', (req, res) => {
  res.json({ 
    message: 'Sync endpoint ready',
    status: 'not implemented'
  });
});

app.post('/api/sync', (req, res) => {
  res.json({ 
    message: 'Sync data received',
    data: req.body,
    timestamp: new Date().toISOString()
  });
});

// Test endpoint to verify Hackatime API functionality
app.get('/api/test-hackatime/:slackId', async (req, res) => {
  const slackId = req.params.slackId;
  
  if (!slackId) {
    return res.status(400).json({ error: 'Missing slackId parameter' });
  }
  
  try {
    const hackatimeData = await fetchHackatimeData(slackId);
    res.json({
      success: true,
      slackId,
      hackatimeData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// SyncAllGames endpoint - manually trigger a sync
app.get('/api/SyncAllGames', async (req, res) => {
  if (isSyncRunning) {
    return res.status(409).json({ 
      message: 'Sync already running',
      lastSyncTime: lastSyncTime?.toISOString(),
      timestamp: new Date().toISOString()
    });
  }

  try {
    console.log('Manual sync triggered via API...');
    const result = await performFullSync();
    res.json(result);
  } catch (error) {
    console.error('Manual sync error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to sync games',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Sync status endpoint
app.get('/api/sync-status', (req, res) => {
  res.json({
    isRunning: isSyncRunning,
    lastSyncTime: lastSyncTime?.toISOString(),
    lastSyncResult: lastSyncResult,
    lastError: syncError?.message,
    nextSyncIn: lastSyncTime ? SYNC_INTERVAL - (Date.now() - lastSyncTime.getTime()) : null,
    syncIntervalMinutes: SYNC_INTERVAL / 1000 / 60,
    timestamp: new Date().toISOString()
  });
});

// Airtable helper functions
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



async function fetchAllGames() {
  let allRecords = [];
  let offset;
  
  do {
    const params = new URLSearchParams();
    params.set('pageSize', '100');
    if (offset) params.set('offset', offset);
    
    console.log(`Fetching games page... (offset: ${offset || 'none'})`);
    const page = await airtableRequest(`${encodeURIComponent(AIRTABLE_GAMES_TABLE)}?${params.toString()}`, {
      method: 'GET',
    });
    
    const pageRecords = page?.records || [];
    allRecords = allRecords.concat(pageRecords);
    offset = page?.offset;
    
    console.log(`Fetched ${pageRecords.length} games, total so far: ${allRecords.length}`);
  } while (offset);
  
  return allRecords;
}

// Hackatime API integration
async function fetchHackatimeData(slackId) {
  if (!slackId) return { projects: [], total_seconds: 0 };
  
  const start_date = process.env.HACKATIME_START_DATE || '2025-08-18';
  const end_date = process.env.HACKATIME_END_DATE || new Date().toISOString().slice(0, 10);
  const url = `https://hackatime.hackclub.com/api/v1/users/${encodeURIComponent(slackId)}/stats?features=projects&start_date=${start_date}&end_date=${end_date}`;
  
  try {
    console.log(`Fetching Hackatime data for ${slackId}...`);
    const headers = { Accept: 'application/json' };
    if (process.env.RACK_ATTACK_BYPASS) {
      headers['Rack-Attack-Bypass'] = process.env.RACK_ATTACK_BYPASS;
    }
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      console.log(`Hackatime API error for ${slackId}: ${response.status}`);
      return { projects: [], total_seconds: 0 };
    }
    
    const data = await response.json();
    const projects = Array.isArray(data?.data?.projects) ? data.data.projects : [];
    const total_seconds = data?.data?.total_seconds || 0;
    
    return { projects, total_seconds };
  } catch (error) {
    console.error(`Error fetching Hackatime data for ${slackId}:`, error.message);
    return { projects: [], total_seconds: 0 };
  }
}



// Helper function to calculate project seconds with claiming to prevent double counting across games
function calculateProjectSecondsWithClaiming(hackatimeData, gameProjectsField, claimedProjects) {
  let totalSeconds = 0;
  
  if (!gameProjectsField || !hackatimeData.projects.length) {
    return totalSeconds;
  }
  
  // Parse the game's Hackatime Projects field (comma-separated like "qes-ttmi-rng, wkydo")
  const projectNames = Array.isArray(gameProjectsField) 
    ? gameProjectsField.filter(Boolean)
    : (typeof gameProjectsField === 'string' ? gameProjectsField.split(',').map(p => p.trim()) : []);
  
  console.log(`  └─ Game projects: [${projectNames.join(', ')}]`);
  
  for (const projectName of projectNames) {
    if (!projectName) continue;
    
    const projectNameLower = projectName.toLowerCase();
    
    // Check if this project has already been claimed by another game for this user
    if (claimedProjects.has(projectNameLower)) {
      console.log(`  ├─ Project "${projectName}": ALREADY CLAIMED (0s)`);
      continue;
    }
    
    // Find matching project in Hackatime data
    const matchingProject = hackatimeData.projects.find(p => 
      p.name && p.name.toLowerCase() === projectNameLower
    );
    
    if (matchingProject) {
      totalSeconds += matchingProject.total_seconds || 0;
      claimedProjects.add(projectNameLower); // Claim this project
      console.log(`  ├─ Project "${projectName}": ${matchingProject.total_seconds}s (CLAIMED)`);
    } else {
      console.log(`  ├─ Project "${projectName}": NOT FOUND in Hackatime data`);
    }
  }
  
  return totalSeconds;
}

// Legacy helper function (kept for backwards compatibility if needed)
function calculateProjectSeconds(hackatimeData, gameProjectsField) {
  let totalSeconds = 0;
  
  if (!gameProjectsField || !hackatimeData.projects.length) {
    return totalSeconds;
  }
  
  // Parse the game's Hackatime Projects field (can be comma-separated)
  const projectNames = Array.isArray(gameProjectsField) 
    ? gameProjectsField.filter(Boolean)
    : (typeof gameProjectsField === 'string' ? gameProjectsField.split(',').map(p => p.trim()) : []);
  
  // Track which projects we've already counted to avoid double counting
  const countedProjects = new Set();
  
  for (const projectName of projectNames) {
    if (!projectName || countedProjects.has(projectName.toLowerCase())) {
      continue; // Skip empty names or already counted projects
    }
    
    const matchingProject = hackatimeData.projects.find(p => 
      p.name && p.name.toLowerCase() === projectName.toLowerCase()
    );
    
    if (matchingProject) {
      totalSeconds += matchingProject.total_seconds || 0;
      countedProjects.add(projectName.toLowerCase());
      console.log(`  ├─ Project "${projectName}": ${matchingProject.total_seconds}s`);
    }
  }
  
  return totalSeconds;
}

async function updateGameHackatimeSeconds(gameId, seconds) {
  const url = `${AIRTABLE_API_BASE}/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_GAMES_TABLE)}/${gameId}`;
  
  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          HackatimeSeconds: seconds
        }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`Failed to update game ${gameId}: ${response.status} ${errorText}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`Error updating game ${gameId}:`, error.message);
    return false;
  }
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl
  });
});

app.listen(PORT, () => {
  console.log(`HackatimeSync server is running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to test the server`);
});

module.exports = app;
