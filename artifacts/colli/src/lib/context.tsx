import React, { createContext, useContext, useState, useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CurrentUser {
  id: number;
  email: string;
  name: string;
  providers: string[] | null; // null = not onboarded yet
  createdAt: string;
}

interface AppContextValue {
  // User & providers
  user: CurrentUser | null;
  setUser: (u: CurrentUser | null) => void;
  activeProviders: string[]; // resolved: user's picks or all if admin/fallback

  // Global search
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // Notification panel
  notificationPanelOpen: boolean;
  setNotificationPanelOpen: (open: boolean) => void;
  unreadCount: number;
  setUnreadCount: (n: number) => void;

  // Theme
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
}

const ALL_PROVIDERS = ['openai', 'anthropic', 'google', 'perplexity', 'mistral', 'grok', 'deepseek'];

const AppContext = createContext<AppContextValue>({
  user: null,
  setUser: () => {},
  activeProviders: ALL_PROVIDERS,
  searchQuery: '',
  setSearchQuery: () => {},
  notificationPanelOpen: false,
  setNotificationPanelOpen: () => {},
  unreadCount: 3,
  setUnreadCount: () => {},
  theme: 'light',
  setTheme: () => {},
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(3);
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('colli-theme') as 'light' | 'dark') ?? 'light';
  });

  const activeProviders = user?.providers ?? ALL_PROVIDERS;

  const setTheme = (t: 'light' | 'dark') => {
    setThemeState(t);
    localStorage.setItem('colli-theme', t);
    if (t === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Apply saved theme on mount
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  return (
    <AppContext.Provider value={{
      user,
      setUser,
      activeProviders,
      searchQuery,
      setSearchQuery,
      notificationPanelOpen,
      setNotificationPanelOpen,
      unreadCount,
      setUnreadCount,
      theme,
      setTheme,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}

// Convenience helpers
export function useActiveProviders() {
  return useContext(AppContext).activeProviders;
}

export function useSearchQuery() {
  const { searchQuery } = useContext(AppContext);
  return searchQuery;
}
