import { useTheme } from '../lib/theme.js';
import Icon from './Icon.jsx';

// Sun / moon switch between light and dark mode.
export default function ThemeToggle({ className = 'btn ghost sm' }) {
  const { theme, toggle } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button type="button" className={className} onClick={toggle} title={`Switch to ${next} mode`} aria-label={`Switch to ${next} mode`}>
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
    </button>
  );
}
