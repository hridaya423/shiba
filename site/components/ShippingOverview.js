import { useState, useEffect } from 'react';

export default function ShippingOverview({ token }) {
  const [shippingData, setShippingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) return;

    const fetchShippingData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/GetMyDemoShips', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token: token
          })
        });

        if (response.ok) {
          const data = await response.json();
          setShippingData(data);
        } else {
          setError('Failed to load shipping data');
        }
      } catch (err) {
        setError('Error fetching shipping data');
        console.error('Error fetching shipping data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchShippingData();
  }, [token]);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved': return '✅';
      case 'rejected': return '❌';
      case 'partial': return '⚠️';
      default: return '⏳';
    }
  };

  const getStatusText = (ship) => {
    const { hoursSpent, approvedHours, status } = ship;

    if (status === 'approved') {
      return `approved for ${approvedHours}h`;
    } else if (status === 'rejected') {
      return 'rejected';
    } else if (status === 'partial') {
      return `approved for ${approvedHours}h of ${hoursSpent}h`;
    } else {
      return 'pending review';
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  };

  if (loading) {
    return (
      <div style={{
        width: '100%',
        padding: '20px',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        marginBottom: '20px'
      }}>
        <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)', textAlign: 'center' }}>
          Loading demo ships...
        </div>
      </div>
    );
  }

  if (error || !shippingData) {
    return null;
  }

  const { totalShippedHours, totalApprovedHours, gameShips } = shippingData;

  if (!gameShips || gameShips.length === 0) {
    return (
      <div style={{
        width: '100%',
        padding: '40px 20px',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>
          📦
        </div>
        <h3 style={{
          margin: 0,
          marginBottom: '8px',
          fontSize: '18px',
          fontWeight: '600',
          color: '#fff'
        }}>
          No Demo Ships Yet
        </h3>
        <p style={{
          margin: 0,
          fontSize: '14px',
          color: 'rgba(255, 255, 255, 0.7)',
          lineHeight: 1.5
        }}>
          Ship your first demo by uploading a build file with your game updates.<br />
          Every 2 hours of work, you get 1 playtest. Create a new demo ship to earn playtest tickets!
        </p>
      </div>
    );
  }

  const approvalRate = totalShippedHours > 0 ? Math.round((totalApprovedHours / totalShippedHours) * 100) : 0;

  return (
    <div style={{
      width: '100%',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: '8px',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      marginBottom: '20px',
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
        backgroundColor: 'rgba(255, 255, 255, 0.05)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ fontSize: '18px' }}>📦</span>
            <h3 style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: '600',
              color: '#fff'
            }}>
              My Demo Ships & Approval Status ({gameShips.reduce((total, game) => total + game.shipCount, 0)} ships)
            </h3>
          </div>
          <div style={{
            fontSize: '14px',
            color: 'rgba(255, 255, 255, 0.8)',
            textAlign: 'right'
          }}>
            <div style={{ fontWeight: '600', color: '#fff' }}>
              {totalApprovedHours}h approved of {totalShippedHours}h shipped
            </div>
            <div style={{ fontSize: '12px' }}>
              {approvalRate}% approval rate
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 20px' }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {gameShips.map((game, gameIndex) => (
            <div key={game.gameId || gameIndex} style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              overflow: 'hidden'
            }}>
              <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                backgroundColor: 'rgba(255, 255, 255, 0.05)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}>
                  <h4 style={{
                    margin: 0,
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#fff'
                  }}>
                    {game.gameName}
                  </h4>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontSize: '12px',
                    color: 'rgba(255, 255, 255, 0.7)'
                  }}>
                    <span>{game.shipCount} ships</span>
                    <span>{game.totalApprovedHours}h / {game.totalShippedHours}h</span>
                    <span style={{
                      backgroundColor: game.approvalRate >= 80 ? 'rgba(34, 197, 94, 0.2)' :
                                     game.approvalRate >= 50 ? 'rgba(251, 191, 36, 0.2)' :
                                     'rgba(239, 68, 68, 0.2)',
                      color: game.approvalRate >= 80 ? '#22c55e' :
                             game.approvalRate >= 50 ? '#fbbf24' :
                             '#ef4444',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontWeight: '600'
                    }}>
                      {game.approvalRate}%
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ padding: '8px 16px 12px' }}>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  {game.recentShips.map((ship, shipIndex) => (
                    <div key={ship.id || shipIndex} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '4px'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flex: 1
                      }}>
                        <div style={{
                          fontSize: '11px',
                          color: 'rgba(255, 255, 255, 0.6)',
                          fontFamily: 'monospace',
                          minWidth: '50px'
                        }}>
                          {formatDate(ship.createdAt)}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: 'rgba(255, 255, 255, 0.9)',
                          flex: 1
                        }}>
                          <strong>{ship.hoursSpent}h</strong> shipped, {getStatusText(ship)}
                        </div>
                      </div>
                      <div style={{ fontSize: '14px' }}>
                        {getStatusIcon(ship.status)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}