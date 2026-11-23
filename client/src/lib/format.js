export const STATUSES = [
  { key: 'todo', label: 'To do' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'review', label: 'In review' },
  { key: 'done', label: 'Done' },
];
export const STATUS_LABEL = Object.fromEntries(STATUSES.map((s) => [s.key, s.label]));
export const PRIORITIES = ['low', 'medium', 'high', 'critical'];

const DAY = 86400000;

export function formatDate(d) {
  if (!d) return 'No date';
  return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function relativeDue(d) {
  if (!d) return { text: 'No due date', tone: 'muted' };
  const days = Math.ceil((new Date(d).setHours(23, 59, 59, 999) - Date.now()) / DAY);
  if (days < 0) return { text: `${-days}d overdue`, tone: 'danger' };
  if (days === 0) return { text: 'Due today', tone: 'warn' };
  if (days === 1) return { text: 'Due tomorrow', tone: 'warn' };
  if (days <= 7) return { text: `Due in ${days}d`, tone: 'normal' };
  return { text: formatDate(d), tone: 'muted' };
}

export function timeAgo(d) {
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// yyyy-mm-dd for <input type="date">
export const toInputDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
// Treat a picked date as end of that local day so "due today" is not already overdue.
export const fromInputDate = (s) => (s ? new Date(`${s}T23:59:00`).toISOString() : null);

export const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

const AVATAR_COLORS = ['#14213d', 'color-mix(in srgb, #14213d 60%, #ff6b5b)'];
export function avatarColor(user) {
  const key = String(user?._id || user?.name || '');
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
