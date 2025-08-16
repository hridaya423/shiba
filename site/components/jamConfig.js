// Central configuration for jam timing.
// Edit the defaults below or set environment variables:
//   NEXT_PUBLIC_JAM_START, NEXT_PUBLIC_JAM_END (ISO strings)
// All calculation is done on client. Times should include timezone/offset or be Z.

const JAM_START_DEFAULT = '2025-08-22T00:00:00-07:00';
const JAM_END_DEFAULT   = '2025-10-20T23:59:59-07:00';

export const JAM_START_DATE = new Date(
  process.env.NEXT_PUBLIC_JAM_START || JAM_START_DEFAULT
);
export const JAM_END_DATE = new Date(
  process.env.NEXT_PUBLIC_JAM_END || JAM_END_DEFAULT
);

export function getRemainingUntil(date) {
  const now = Date.now();
  const target = date.getTime();
  const diffMs = target - now;
  if (diffMs <= 0) return { totalMs: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { totalMs: diffMs, days, hours, minutes, seconds };
}

export function formatJamCountdown() {
  const now = Date.now();
  if (isNaN(JAM_START_DATE.getTime()) || isNaN(JAM_END_DATE.getTime())) {
    return 'jam schedule tbd';
  }
  if (now < JAM_START_DATE.getTime()) {
    const r = getRemainingUntil(JAM_START_DATE);
    return `jam starts in ${r.days}d ${r.hours}h ${r.minutes}m ${String(r.seconds).padStart(2,'0')}s`;
  }
  if (now < JAM_END_DATE.getTime()) {
    const r = getRemainingUntil(JAM_END_DATE);
    return `jam ends in ${r.days}d ${r.hours}h ${r.minutes}m ${String(r.seconds).padStart(2,'0')}s`;
  }
  return 'jam is over!';
}
