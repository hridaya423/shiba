# HackatimeSync Server

A Node.js Express server for synchronizing Hackatime data.

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm

### Installation

1. Navigate to the project directory:
```bash
cd hackatimeSync
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp env.example .env
# Edit .env and add your actual Airtable API key
```

Required environment variables:
- `AIRTABLE_API_KEY` - Your Airtable API key (required for SyncAllGames)
- `AIRTABLE_BASE_ID` - Base ID (defaults to 'appg245A41MWc6Rej')
- `PORT` - Server port (default: 3001)

### Running the Server

Start the server:
```bash
npm start
```

For development:
```bash
npm run dev
```

The server will start on port 3001 by default (or the port specified in your environment).

## API Endpoints

- `GET /` - Server status and info
- `GET /health` - Health check endpoint
- `GET /api/sync` - Sync status endpoint
- `POST /api/sync` - Sync data endpoint
- `GET /api/SyncAllGames` - **Manual sync trigger**: Manually trigger a sync (returns 409 if already running)
- `GET /api/sync-status` - **Sync status**: Check background sync status, last run time, next run time
- `GET /api/test-hackatime/:slackId` - Test endpoint to verify Hackatime API integration

## Continuous Background Sync

The server automatically runs a full sync every **5 minutes** in the background:

- **Automatic**: Syncs start 10 seconds after server startup
- **Interval**: Every 5 minutes (configurable via `SYNC_INTERVAL` environment variable)
- **Smart filtering**: Only fetches Hackatime data for users who have games with "Hackatime Projects"
- **No double counting**: Each project is only counted once per user across all their games
- **Error handling**: Failed syncs don't stop the background process
- **Status tracking**: Monitor sync status via `/api/sync-status` endpoint

### SyncAllGames Endpoint

This endpoint:
1. Fetches all games from Airtable
2. For each game with a Slack ID and Hackatime Projects:
   - Calls the Hackatime API to get project data
   - Matches project names (case-insensitive) 
   - Sums up total seconds for matching projects
   - Updates the game's `HackatimeSeconds` field in Airtable

**Example Response:**
```json
{
  "success": true,
  "count": 817,
  "games": [
    {
      "id": "recXXXXXX",
      "Name": "Ghost Town",
      "slack id": "U076BLKB39Q",
      "Hackatime Projects": "Ghost Town",
      "HackatimeSeconds": 18937
    }
  ],
  "timestamp": "2025-08-21T18:23:12.000Z"
}
```

## Environment Variables

- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment mode (development/production)
