import { Home, Map, Plus, SunMoon } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { BrandLockup } from '../brand/BrandLockup';
import { useTheme, type ThemePreference } from '../../app/providers/ThemeProvider';
import styles from './AppShell.module.css';

const navigation = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/trips', label: 'My Trips', icon: Map },
  { to: '/plan', label: 'Plan a Trip', icon: Plus },
];

function ThemeSelector() {
  const { preference, setPreference } = useTheme();
  return (
    <label className={styles.themeControl} title="Theme">
      <SunMoon size={19} aria-hidden="true" />
      <span className="sr-only">Theme</span>
      <select value={preference} onChange={(event) => setPreference(event.target.value as ThemePreference)} aria-label="Theme">
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}

export function AppShell() {
  return (
    <div className={styles.app}>
      <aside className={styles.rail} aria-label="Primary navigation">
        <NavLink to="/" className={styles.brandLink} aria-label="Smart Travel Planner home"><BrandLockup compact /></NavLink>
        <nav className={styles.desktopNav}>
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} title={label} aria-label={label} className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}>
              <Icon size={20} strokeWidth={1.8} aria-hidden="true" /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className={styles.desktopTheme}><ThemeSelector /></div>
      </aside>
      <div className={styles.mobileHeader}><BrandLockup /><ThemeSelector /></div>
      <main className={styles.main} id="main-content"><Outlet /></main>
      <nav className={styles.mobileNav} aria-label="Primary navigation">
        {navigation.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `${styles.mobileNavItem} ${isActive ? styles.active : ''}`}>
            <Icon size={20} strokeWidth={1.8} aria-hidden="true" /><span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
