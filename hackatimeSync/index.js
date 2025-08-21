const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

// Global sync state
let isSyncRunning = false;
let lastSyncTime = null;
let lastSyncResult = null;
let syncError = null;

// Airtable configuration
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_GAMES_TABLE = process.env.AIRTABLE_GAMES_TABLE || 'Games';
const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';

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

// Core sync logic
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
  
  for (let i = 0; i < allGames.length; i++) {
    const game = allGames[i];
    const fields = game.fields || {};
    const slackId = fields['slack id'];
    
    console.log(`Processing game ${i + 1}/${allGames.length}: ${fields.Name}`);
    
    // Skip update if no slack id or hackatime projects
    if (!slackId || !fields['Hackatime Projects']) {
      console.log(`Skipping ${fields.Name} - missing slack id or hackatime projects`);
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
      
      successCount++;
      console.log(`✅ Updated ${fields.Name}: ${totalSeconds} seconds`);
      
    } catch (error) {
      errorCount++;
      console.error(`❌ Error updating ${fields.Name}:`, error.message);
    }
  }
  
  console.log(`Sync complete! ${successCount} successful, ${errorCount} errors`);
  
  return {
    success: true,
    totalGames: allGames.length,
    uniqueUsers: uniqueUsers.length,
    successfulUpdates: successCount,
    errors: errorCount,
    timestamp: new Date().toISOString()
  };
}

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

// Minimal middleware - only what's needed
app.use(express.json({ limit: '1mb' }));

// Essential routes only
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Manual sync trigger (for debugging/monitoring)
app.get('/api/sync-status', (req, res) => {
  res.json({
    isRunning: isSyncRunning,
    lastSyncTime: lastSyncTime?.toISOString(),
    lastError: syncError?.message,
    nextSyncIn: lastSyncTime ? SYNC_INTERVAL - (Date.now() - lastSyncTime.getTime()) : null,
    syncIntervalMinutes: SYNC_INTERVAL / 1000 / 60,
    timestamp: new Date().toISOString()
  });
});

// Manual sync trigger
app.post('/api/sync', async (req, res) => {
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

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Start background sync interval
console.log(`🔄 Starting background sync every ${SYNC_INTERVAL / 1000 / 60} minutes...`);
setInterval(runBackgroundSync, SYNC_INTERVAL);

// Run initial sync after 10 seconds
setTimeout(() => {
  console.log('🚀 Running initial sync in 10 seconds...');
  runBackgroundSync();
}, 10000);

app.listen(PORT, () => {
  console.log(`HackatimeSync server is running on port ${PORT}`);
});

module.exports = app;
