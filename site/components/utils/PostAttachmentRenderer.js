/* eslint-disable react/prop-types */
import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const PlayGameComponent = dynamic(() => import("@/components/utils/playGameComponent"), { ssr: false });

export default function PostAttachmentRenderer({ content, attachments, playLink, gameName, thumbnailUrl, slackId, createdAt, token, onPlayCreated, badges, HoursSpent, gamePageUrl, postType, timelapseVideoId, githubImageLink, timeScreenshotId, hoursSpent, minutesSpent }) {
  const [slackProfile, setSlackProfile] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!slackId) return;
      try {
        const res = await fetch(`https://cachet.dunkirk.sh/users/${encodeURIComponent(slackId)}`);
        const json = await res.json().catch(() => ({}));
        if (!cancelled && json && (json.displayName || json.image)) {
          setSlackProfile({ displayName: json.displayName || '', image: json.image || '' });
        }
      } catch (_) {
        // best-effort only
      }
    };
    load();
    return () => { cancelled = true; };
  }, [slackId]);
  // Prefer explicit PlayLink field provided by API
  let playHref = typeof playLink === 'string' && playLink.trim() ? playLink.trim() : null;

  // If attachments contain a text/plain with a play URL, fallback (rare)
  if (!playHref && Array.isArray(attachments)) {
    const txt = attachments.find((a) => (a?.type || a?.contentType || "").startsWith("text/"));
    if (txt && typeof txt.url === "string") {
      playHref = txt.url;
    }
  }

  let gameId = '';
  if (playHref) {
    try {
      const path = playHref.startsWith('http') ? new URL(playHref).pathname : playHref;
      const m = /\/play\/([^\/?#]+)/.exec(path);
      gameId = m && m[1] ? decodeURIComponent(m[1]) : '';
    } catch (_) {
      gameId = '';
    }
  }

  // Utility: classify attachment kind using MIME and filename extension
  const classifyKind = (att) => {
    const rawType = String(att?.type || att?.contentType || '').toLowerCase();
    const filename = String(att?.filename || '');
    let ext = '';

    // First try to get extension from filename
    if (filename && filename.includes('.')) {
      ext = filename.split('.').pop().toLowerCase();
    }
    // If no filename extension, try to get it from the URL
    else if (att?.url) {
      try {
        const u = new URL(att.url, 'https://dummy');
        const p = u.pathname || '';
        if (p.includes('.')) {
          ext = p.split('.').pop().toLowerCase();
        }
      } catch (_) {
        // ignore
      }
    }

    // For S3 attachments, the type might be 'application/octet-stream'
    // so we need to rely more heavily on file extensions
    const imageExts = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg']);
    const videoExts = new Set(['mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv', 'mpg', 'mpeg']);
    const audioExts = new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac']);

    // Check MIME type first
    if (rawType.startsWith('image/') || imageExts.has(ext)) return 'image';
    if (rawType.startsWith('video/') || videoExts.has(ext)) return 'video';
    if (rawType.startsWith('audio/') || audioExts.has(ext)) return 'audio';

    // If MIME type is generic (like application/octet-stream), rely on extension
    if (rawType === 'application/octet-stream' || !rawType) {
      if (imageExts.has(ext)) return 'image';
      if (videoExts.has(ext)) return 'video';
      if (audioExts.has(ext)) return 'audio';
    }

    return 'other';
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {(slackId || (Array.isArray(badges) && badges.includes('Speedy Shiba Shipper'))) ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              border: '1px solid rgba(0,0,0,0.18)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundColor: '#fff',
              backgroundImage: slackProfile?.image ? `url(${slackProfile.image})` : 'none',
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 12 }}>
              <strong>{slackProfile?.displayName || slackId || 'User'}</strong>
              {Array.isArray(badges) && badges.includes('Speedy Shiba Shipper') && (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src="/SpeedyShibaShipper.png"
                    alt="Speedy Shiba Shipper"
                    style={{
                      width: 20,
                      height: 20,
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease-out, border 0.2s ease-out, background-color 0.2s ease-out',
                      border: '1px dotted transparent',
                      borderRadius: '4px',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      // Add gentle bounce effect
                      e.target.style.transform = 'scale(1.1)';
                      e.target.style.border = '1px dotted #999';
                      e.target.style.backgroundColor = 'white';
                      setTimeout(() => {
                        e.target.style.transform = 'scale(1)';
                      }, 200);

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.display = 'block';
                        // Trigger animation after display is set
                        setTimeout(() => {
                          popup.style.opacity = '1';
                          popup.style.transform = 'translateX(-50%) scale(1)';
                        }, 10);
                      }
                    }}
                    onMouseLeave={(e) => {
                      // Reset transform and border
                      e.target.style.transform = 'scale(1)';
                      e.target.style.border = '1px dotted transparent';
                      e.target.style.backgroundColor = 'transparent';

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.opacity = '0';
                        popup.style.transform = 'translateX(-50%) scale(0)';
                        // Hide after animation completes
                        setTimeout(() => {
                          popup.style.display = 'none';
                        }, 200);
                      }
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#FFD1A3',
                      border: '1px solid #F5994B',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      fontSize: '6px',
                      fontWeight: 'bold',
                      color: '#333',
                      whiteSpace: 'nowrap',
                      zIndex: 1000,
                      display: 'none',
                      marginBottom: '0px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      opacity: 0,
                      transformOrigin: 'center bottom',
                      transition: 'all 0.2s ease-out'
                    }}
                  >
                    Speedy Shiba Shipper
                  </div>
                </div>
              )}
              {Array.isArray(badges) && badges.includes('Super Subtle Shiba') && (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src="/SuperSubtleShiba.png"
                    alt="Super Subtle Shiba"
                    style={{
                      width: 20,
                      height: 20,
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease-out, border 0.2s ease-out, background-color 0.2s ease-out',
                      border: '1px dotted transparent',
                      borderRadius: '4px',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      // Add gentle bounce effect
                      e.target.style.transform = 'scale(1.1)';
                      e.target.style.border = '1px dotted #999';
                      e.target.style.backgroundColor = 'white';
                      setTimeout(() => {
                        e.target.style.transform = 'scale(1)';
                      }, 200);

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.display = 'block';
                        // Trigger animation after display is set
                        setTimeout(() => {
                          popup.style.opacity = '1';
                          popup.style.transform = 'translateX(-50%) scale(1)';
                        }, 10);
                      }
                    }}
                    onMouseLeave={(e) => {
                      // Reset transform and border
                      e.target.style.transform = 'scale(1)';
                      e.target.style.border = '1px dotted transparent';
                      e.target.style.backgroundColor = 'transparent';

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.opacity = '0';
                        popup.style.transform = 'translateX(-50%) scale(0)';
                        // Hide after animation completes
                        setTimeout(() => {
                          popup.style.display = 'none';
                        }, 200);
                      }
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#E8F4FD',
                      border: '1px solid #4A90E2',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      fontSize: '6px',
                      fontWeight: 'bold',
                      color: '#333',
                      whiteSpace: 'nowrap',
                      zIndex: 1000,
                      display: 'none',
                      marginBottom: '0px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      opacity: 0,
                      transformOrigin: 'center bottom',
                      transition: 'all 0.2s ease-out'
                    }}
                  >
                    Super Subtle Shiba
                  </div>
                </div>
              )}
              {gameName ? (
                gamePageUrl ? (
                  <a
                    href={gamePageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      opacity: 0.8,
                      textDecoration: 'underline',
                      color: 'inherit',
                      cursor: 'pointer'
                    }}
                  >
                    (making {gameName})
                  </a>
                ) : (
                  <em style={{ opacity: 0.8 }}>(making {gameName})</em>
                )
              ) : null}
            </div>
            {createdAt ? (
              <div style={{ display: 'flex', flexDirection: 'row', gap: 8, fontSize: 11, opacity: 0.6, marginTop: 2, alignItems: 'center' }}>
                {HoursSpent && HoursSpent > 0 && Math.floor((HoursSpent % 1) * 60) > 0 && (
                  <>
                    <span>
                      {Math.floor(HoursSpent) > 0 ? `${Math.floor(HoursSpent)}hr ` : ''}{Math.floor((HoursSpent % 1) * 60)}min logged
                    </span>
                    <span style={{ fontSize: 8 }}>●</span>
                  </>
                )}
                <span>
                  {new Date(createdAt).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })}
                </span>
                <span>
                  {new Date(createdAt).toLocaleDateString('en-US', {
                    month: '2-digit',
                    day: '2-digit',
                    year: '2-digit'
                  })}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      
      
      
      <div style={{ whiteSpace: 'pre-wrap' }}>{content || ''}</div>

      {/* Debug logging */}
      {console.log('PostAttachmentRenderer artlog check:', {
        postType,
        timelapseVideoId,
        githubImageLink,
        hoursSpent,
        condition: postType === 'artlog' || (timelapseVideoId && githubImageLink && hoursSpent > 0)
      })}
      
      {/* Artlog-specific rendering */}
      {(postType === 'artlog' || (timelapseVideoId && githubImageLink && hoursSpent > 0)) && (
        <div style={{ 
          border: '2px solid #ff6fa5', 
          borderRadius: '12px', 
          padding: '16px', 
          marginBottom: '16px',
          background: 'rgba(255, 111, 165, 0.05)'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            marginBottom: '12px',
            color: '#ff6fa5',
            fontWeight: 'bold',
            fontSize: '14px'
          }}>
            🎨 Artlog
          </div>
          
          {/* Timelapse Video */}
          {timelapseVideoId && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Timelapse:</div>
              <video
                src={timelapseVideoId}
                controls
                playsInline
                style={{
                  width: '100%',
                  maxHeight: '300px',
                  borderRadius: '8px',
                  background: '#000'
                }}
                onError={(e) => {
                  console.error('Video error:', e);
                  console.error('Video src:', timelapseVideoId);
                }}
                onLoadStart={() => {
                  console.log('Video loading started:', timelapseVideoId);
                }}
                onCanPlay={() => {
                  console.log('Video can play:', timelapseVideoId);
                }}
              />

            </div>
          )}
          
          {/* GitHub Image Link (dropdown) */}
          {githubImageLink && (
            <details style={{ marginBottom: '12px' }}>
              <summary style={{ fontSize: '12px', color: '#666', marginBottom: '4px', cursor: 'pointer', outline: 'none' }}>
                GitHub Link
              </summary>
              <a 
                href={githubImageLink} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ 
                  color: '#007bff', 
                  textDecoration: 'none',
                  fontSize: '14px',
                  wordBreak: 'break-all'
                }}
              >
                {githubImageLink}
              </a>
            </details>
          )}
          
          {/* Time Screenshot (dropdown) */}
          {timeScreenshotId && (
            <details style={{ marginBottom: '12px' }}>
              <summary style={{ fontSize: '12px', color: '#666', marginBottom: '4px', cursor: 'pointer', outline: 'none' }}>
                Time Screenshot
              </summary>
              <img 
                src={typeof timeScreenshotId === 'string' ? timeScreenshotId : timeScreenshotId?.[0]?.url || ''}
                alt="Time spent screenshot"
                style={{
                  maxWidth: '100%',
                  maxHeight: '200px',
                  borderRadius: '8px',
                  border: '1px solid #ddd',
                  marginTop: '8px'
                }}
              />
            </details>
          )}
          
          {/* Time Display */}
          {hoursSpent > 0 && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              fontSize: '14px',
              color: '#666'
            }}>
              <span>⏱️</span>
              <span>
                {hoursSpent >= 1 ? `${Math.floor(hoursSpent)}h` : ''}
                {hoursSpent % 1 > 0 ? `${Math.round((hoursSpent % 1) * 60)}m` : ''}
                {hoursSpent < 1 ? `${Math.round(hoursSpent * 60)}m` : ''}
              </span>
            </div>
          )}
        </div>
      )}
      {gameId ? (
        <PlayGameComponent
          gameId={gameId}
          gameName={gameName}
          thumbnailUrl={thumbnailUrl}
          token={token}
          onPlayCreated={onPlayCreated}
          gamePageUrl={gamePageUrl}
        />
      ) : null}
      {Array.isArray(attachments) && attachments.length > 0 && (() => {
        const media = attachments.filter((att) => {
          const kind = classifyKind(att);
          return kind === 'image' || kind === 'video';
        });
        const mediaCount = media.length;
        const columns = Math.max(1, Math.min(mediaCount, 3)); // 1 col for 1, 2 cols for 2, 3+ cols => 3
        const imageMax = Math.max(160, Math.floor(480 / columns));
        const videoMax = Math.max(200, Math.floor(540 / columns));
        return (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 8 }}>
            {attachments.map((att, idx) => {
              const url = att?.url;
              const kind = classifyKind(att);
              if (!url) return null;
              if (kind === 'image') {
                return (
                  <img
                    key={att.id || idx}
                    src={url}
                    alt={att.filename || ''}
                    style={{
                      width: '100%',
                      height: 'auto',
                      maxHeight: imageMax,
                      objectFit: 'contain',
                      border: '1px solid #ddd',
                      borderRadius: 8,
                      background: '#fff',
                    }}
                  />
                );
              }
              if (kind === 'video') {
                return (
                  <video
                    key={att.id || idx}
                    src={url}
                    controls
                    playsInline
                    style={{
                      width: '100%',
                      height: 'auto',
                      maxHeight: videoMax,
                      borderRadius: 8,
                      background: '#000',
                    }}
                  />
                );
              }
              if (kind === 'audio') {
                return (
                  <div key={att.id || idx} style={{ gridColumn: columns > 1 ? `span ${columns}` : 'auto' }}>
                    <audio src={url} controls style={{ width: '100%' }} />
                  </div>
                );
              }
              return (
                <a
                  key={att.id || idx}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  download
                  style={{ fontSize: 12, gridColumn: columns > 1 ? `span ${columns}` : 'auto' }}
                >
                  {att.filename || url}
                </a>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
