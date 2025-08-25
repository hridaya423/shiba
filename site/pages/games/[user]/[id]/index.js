import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const PlayGameComponent = dynamic(() => import('@/components/utils/playGameComponent.js'), { ssr: false });
const PostAttachmentRenderer = dynamic(() => import('@/components/utils/PostAttachmentRenderer'), { ssr: false });

export default function GamesPage({ gameData, error }) {
  const router = useRouter();
  const { user, id } = router.query;
  const [loading, setLoading] = useState(false);
  const [slackProfile, setSlackProfile] = useState(null);

  // Fetch Slack displayName and image via cachet
  useEffect(() => {
    let cancelled = false;
    const fetchSlack = async () => {
      if (!user) return;
      try {
        const res = await fetch(
          `https://cachet.dunkirk.sh/users/${encodeURIComponent(user)}`,
        );
        const json = await res.json().catch(() => ({}));
        if (!cancelled && json && (json.displayName || json.image)) {
          setSlackProfile({
            displayName: json.displayName || '',
            image: json.image || '',
          });
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchSlack();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (error) {
    return (
      <div style={{width: '100%', alignItems: "center", height: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#fff', justifyContent: 'center'}}>
        <p>Error: {error}</p>
      </div>
    );
  }

  if (!gameData) {
    return (
      <div style={{width: '100%', alignItems: "center", height: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#fff', justifyContent: 'center'}}>
        <p>Loading...</p>
      </div>
    );
  }



  return (
    <div style={{width: '100%', alignItems: "center", height: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#fff'}}>
      <div style={{width: "100%", maxWidth: 800}}>
        <p style={{width: "100%", textAlign: "center", marginBottom: 16, marginTop: 16}}>Shiba Games</p>
        <div style={{ width: '100%', maxWidth: '1152px' }}>
          {gameData?.playableURL && (() => {
            let gameId = '';
            try {
              // Handle both string and array formats
              const playableURL = Array.isArray(gameData.playableURL) ? gameData.playableURL[0] : gameData.playableURL;
              if (!playableURL) return null;
              
              const path = playableURL.startsWith('http') ? new URL(playableURL).pathname : playableURL;
              const m = /\/play\/([^\/?#]+)/.exec(path);
              gameId = m && m[1] ? decodeURIComponent(m[1]) : '';
            } catch (_) {
              gameId = '';
            }
            return gameId ? (
              <PlayGameComponent 
                gameId={gameId}
                gameName={gameData?.name || id}
                thumbnailUrl={gameData?.thumbnailUrl || ''}
                width="100%"
                gamePageUrl={`https://shiba.hackclub.com/games/${user}/${encodeURIComponent(gameData?.name || id)}`}
              />
            ) : (
              <div style={{ aspectRatio: '16 / 9', border: "1px solid #000", width: '100%', maxWidth: '1152px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                No playable URL available
              </div>
            );
          })()}
        </div>
        <p style={{marginTop: 16, marginBottom: 4}}>{gameData?.name || 'Game Name'}</p>
        {gameData?.description && (
          <p style={{marginTop: 0, marginBottom: 8}}>{gameData.description}</p>
        )}

        <div style={{display: "flex", alignItems: "center", gap: 8, flexDirection: "row"}}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              border: '1px solid rgba(0,0,0,0.18)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundColor: '#fff',
              backgroundImage: slackProfile?.image ? `url(${slackProfile.image})` : 'none',
            }}
          />
          <div style={{display: "flex", flexDirection: "column", gap: 2}}>
            <p><strong>{slackProfile?.displayName || user}</strong></p>
            <p style={{fontSize: 10}}>
              Last Updated: {gameData?.lastUpdatedFormatted || 'Unknown'}
            </p>
          </div>
        </div>

        <p style={{marginTop: 16, marginBottom: 4}}>
          Devlogs
          {Array.isArray(gameData?.posts) && gameData.posts.length > 0 && (() => {
            const totalHours = gameData.posts.reduce((sum, post) => sum + (post.HoursSpent || 0), 0);
            return totalHours > 0 ? ` (${totalHours.toFixed(2)} hours logged total)` : '';
          })()}
        </p>
        {Array.isArray(gameData?.posts) && gameData.posts.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {gameData.posts.map((p, pIdx) => (
              <div key={p.id || pIdx} className="moment-card" style={{ 
                position: "relative",
                border: "1px solid rgba(0, 0, 0, 0.18)",
                borderRadius: "10px",
                background: "rgba(255, 255, 255, 0.8)",
                padding: "12px"
              }}>
                <PostAttachmentRenderer
                  content={p.content}
                  attachments={p.attachments}
                  playLink={p.PlayLink}
                  gameName={gameData?.name || ""}
                  thumbnailUrl={gameData?.thumbnailUrl || ""}
                  token={null}
                  slackId={user}
                  createdAt={p.createdAt}
                  badges={p.badges}
                  HoursSpent={p.HoursSpent}
                  gamePageUrl={`https://shiba.hackclub.com/games/${user}/${encodeURIComponent(gameData?.name || id)}`}
                  onPlayCreated={(play) => {
                    console.log("Play created:", play);
                  }}
                />
              </div>
            ))}
          </div>
        ) : (
          <div style={{width: "100%", border: "1px solid #000", padding: 16}}>
            <p>No posts yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

export async function getServerSideProps(context) {
  const { user, id } = context.params;

  try {
    // Get the host from the request
    const protocol = context.req.headers['x-forwarded-proto'] || 'http';
    const host = context.req.headers.host;
    const baseUrl = `${protocol}://${host}`;

    const response = await fetch(`${baseUrl}/api/gameStore/getGame`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        slackId: user,
        gameName: id
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        props: {
          gameData: null,
          error: errorData.message || 'Game not found'
        }
      };
    }

    const gameData = await response.json();

    // Format the last updated date on the server to avoid hydration issues
    if (gameData && gameData.lastUpdated) {
      gameData.lastUpdatedFormatted = new Date(gameData.lastUpdated).toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: '2-digit'
      });
    }

    return {
      props: {
        gameData,
        error: null
      }
    };
  } catch (error) {
    console.error('Error fetching game data:', error);
    return {
      props: {
        gameData: null,
        error: 'Failed to load game data'
      }
    };
  }
}
