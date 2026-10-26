import React, { useEffect, useRef } from 'react';
import { Link, useLocation } from 'wouter';
import { LegalFooter } from './legal-footer';
import {
  BarChart2,
  BrainCircuit,
  Activity,
  Workflow,
  CreditCard,
  FileBarChart2,
  Settings,
  Search,
  Bell,
  LogOut,
  X,
  CheckCircle2,
  AlertTriangle,
  Info,
  AlertCircle,
} from 'lucide-react';
import { useGetMe, useLogout } from '@workspace/api-client-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppContext, type CurrentUser } from '@/lib/context';
import { formatDistanceToNow } from 'date-fns';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { demoNotificationsSchema, markDemoRead, unreadDemoCount, type DemoNotification as Notification } from '@/lib/demo-notifications';

const navItems = [
  { name: 'Dashboard',  path: '/dashboard',  icon: BarChart2      },
  { name: 'Models',     path: '/models',      icon: BrainCircuit   },
  { name: 'Activity',   path: '/activity',    icon: Activity       },
  { name: 'Workflows',  path: '/workflows',   icon: Workflow       },
  { name: 'Costs',      path: '/costs',       icon: CreditCard     },
  { name: 'Reports',    path: '/reports',     icon: FileBarChart2  },
  { name: 'Settings',   path: '/settings',    icon: Settings       },
];

// ── Notification types ────────────────────────────────────────────────────────

const kindIcon: Record<Notification['kind'], React.ElementType> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  alert:   AlertCircle,
  info:    Info,
};
const kindColor: Record<Notification['kind'], string> = {
  success: 'hsl(148 27% 42%)',
  warning: 'hsl(38 62% 44%)',
  alert:   'hsl(13 37% 52%)',
  info:    'hsl(33 40% 48%)',
};
const kindBg: Record<Notification['kind'], string> = {
  success: 'hsl(148 27% 48% / 0.10)',
  warning: 'hsl(38 62% 49% / 0.10)',
  alert:   'hsl(13 37% 52% / 0.10)',
  info:    'hsl(33 40% 52% / 0.10)',
};

// ── Notification panel ────────────────────────────────────────────────────────
function NotificationPanel({ onClose, notifications, onRead, loading, failed }: {
  onClose: () => void; notifications: Notification[]; onRead: (id?: string) => void; loading: boolean; failed: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);


  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);


  const unread = notifications.filter((n) => !n.read);

  return (
    <div
      ref={panelRef}
      id="demo-notifications"
      onKeyDown={event => { if (event.key === 'Escape') onClose(); }}
      className="absolute top-full right-0 mt-2 w-[380px] max-w-[calc(100vw-32px)] z-50 overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.97)',
        border: '1px solid hsl(33 28% 85%)',
        borderRadius: '20px',
        boxShadow: '0 8px 40px rgba(58,43,34,0.14), 0 2px 8px rgba(58,43,34,0.06)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: '1px solid hsl(33 28% 89%)' }}
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm" style={{ color: 'hsl(18 26% 18%)' }}>
            Notifications
          </span>
          {unread.length > 0 && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: 'hsl(33 40% 52%)', color: '#fff' }}
            >
              {unread.length}
            </span>
          )}
        </div>
        <button
          aria-label="Close notifications"
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors duration-150"
          style={{ color: 'hsl(20 10% 55%)' }}
          onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'hsl(36 22% 92%)'}
          onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="px-5 py-2 text-xs text-muted-foreground">Sample notifications. Read status is local to this visit, not saved to your account.</p>
      <div className="max-h-[440px] overflow-y-auto">
        {failed ? <p role="alert" className="p-5 text-sm">Notifications could not be loaded.</p> : loading ? <p role="status" className="p-5 text-sm">Loading notifications…</p> : notifications.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-muted-foreground/50">
            <Bell className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">No notifications</p>
          </div>
        ) : (
          notifications.map((n) => {
            const Icon = kindIcon[n.kind];
            return (
              <div
                key={n.id}
                role="button"
                tabIndex={0}
                aria-label={`${n.title}${n.read ? ', read' : ', mark as read'}`}
                onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onRead(n.id); } }}
                className="flex gap-4 px-5 py-4 cursor-pointer transition-colors duration-100"
                style={{
                  background: n.read ? 'transparent' : 'hsl(36 28% 97%)',
                  borderBottom: '1px solid hsl(33 28% 91%)',
                }}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'hsl(36 22% 95%)'}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = n.read ? 'transparent' : 'hsl(36 28% 97%)'}
                onClick={() => onRead(n.id)}
              >
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: kindBg[n.kind] }}
                >
                  <Icon className="w-4 h-4" style={{ color: kindColor[n.kind] }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className="text-sm leading-snug"
                      style={{
                        color: 'hsl(18 26% 18%)',
                        fontWeight: n.read ? 400 : 600,
                      }}
                    >
                      {n.title}
                    </p>
                    {!n.read && (
                      <div
                        className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
                        style={{ background: 'hsl(33 40% 52%)' }}
                      />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                    {n.body}
                  </p>
                  <p className="text-[10px] text-muted-foreground/50 mt-1.5">
                    {formatDistanceToNow(new Date(n.timestamp), { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div
          className="px-5 py-3 flex justify-center"
          style={{ borderTop: '1px solid hsl(33 28% 89%)' }}
        >
          <button
            className="text-xs font-medium transition-colors duration-150"
            style={{ color: 'hsl(33 40% 48%)' }}
            disabled={unread.length === 0}
            onClick={() => onRead()}
          >
            {unread.length ? 'Mark all as read' : 'All read'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Shell ─────────────────────────────────────────────────────────────────────
export function Shell({ children }: { children: React.ReactNode }) {
  const { data: rawUser, isLoading } = useGetMe();
  const user = rawUser as CurrentUser | undefined;
  const [location] = useLocation();
  const logoutMutation = useLogout();
  const queryClient = useQueryClient();
  const notificationKey = ['demo-notifications', user?.id] as const;
  const notificationQuery = useQuery({ queryKey: notificationKey, enabled: !!user?.id, staleTime: Infinity, gcTime: Infinity, retry: false,
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/notifications', { credentials: 'include', signal });
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Notifications unavailable');
      return demoNotificationsSchema.parse(await response.json());
    } });
  const notifications = notificationQuery.data ?? [];
  const unreadCount = unreadDemoCount(notifications);
  const onRead = (id?: string) => queryClient.setQueryData<Notification[]>(notificationKey, previous => markDemoRead(previous ?? [], id));
  const bellRef = useRef<HTMLButtonElement>(null);

  const {
    searchQuery, setSearchQuery,
    notificationPanelOpen, setNotificationPanelOpen,
  } = useAppContext();

  const closeNotifications = () => { setNotificationPanelOpen(false); bellRef.current?.focus(); };

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => { window.location.href = '/login'; },
    });
  };

  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ background: 'transparent' }}>
      {/* ── Sidebar ────────────────────────────────────────────── */}
      <aside
        className="w-16 md:w-[220px] flex flex-col shrink-0"
        style={{
          background: '#ffffff',
          borderRight: '1px solid hsl(33 24% 86%)',
        }}
      >
        {/* Logo */}
        <div className="h-[68px] flex items-center px-4 md:px-5" style={{ borderBottom: '1px solid hsl(33 24% 90%)' }}>
          <div className="flex items-center gap-2.5">
            <img
              src="/colli-icon.png"
              alt="Colli"
              className="w-8 h-8 object-contain rounded-[9px]"
              style={{ boxShadow: '0 2px 6px rgba(58,43,34,0.14)' }}
            />
            <span className="hidden md:inline font-semibold tracking-tight text-[15px]" style={{ color: 'hsl(18 26% 18%)' }}>
              Colli
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 md:px-3 py-6 space-y-0.5 overflow-y-auto">
          <p className="hidden md:block text-[10px] font-semibold tracking-[0.12em] uppercase mb-3 px-3" style={{ color: 'hsl(20 10% 60%)' }}>
            Workspace
          </p>
          {navItems.map((item) => {
            const isActive = location === item.path || (location === '/' && item.path === '/dashboard');
            return (
              <Link
                key={item.path}
                href={item.path}
                className="relative flex items-center gap-3 px-3 py-[9px] rounded-xl text-[13.5px] font-medium transition-all duration-150"
                style={
                  isActive
                    ? { background: 'hsl(36 28% 91%)', color: 'hsl(18 26% 18%)' }
                    : { color: 'hsl(20 10% 46%)' }
                }
                onMouseEnter={(e) => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = 'hsl(36 22% 95%)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = '';
                }}
              >
                {isActive && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                    style={{ background: 'hsl(33 40% 52%)' }}
                  />
                )}
                <item.icon
                  className="w-[15px] h-[15px] shrink-0"
                  style={isActive ? { color: 'hsl(33 40% 52%)' } : { color: 'hsl(20 10% 55%)' }}
                />
                <span className="sr-only md:not-sr-only">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User profile */}
        <div className="p-1 md:p-3" style={{ borderTop: '1px solid hsl(33 24% 90%)' }}>
          {isLoading ? (
            <div className="flex items-center gap-3 px-2 py-2">
              <Skeleton className="w-8 h-8 rounded-full" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="w-20 h-3" />
                <Skeleton className="w-28 h-2.5" />
              </div>
            </div>
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-secondary transition-colors duration-150 focus:outline-none">
                <Avatar className="w-8 h-8" style={{ border: '1px solid hsl(33 28% 84%)' }}>
                  <AvatarFallback
                    className="text-xs font-semibold"
                    style={{ background: 'hsl(33 40% 52% / 0.12)', color: 'hsl(33 40% 38%)' }}
                  >
                    {user.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="sr-only md:not-sr-only md:flex-1 text-left min-w-0">
                  <p className="text-[13px] font-medium leading-none" style={{ color: 'hsl(18 26% 18%)' }}>
                    {user.name}
                  </p>
                  <p className="text-[11px] truncate mt-0.5" style={{ color: 'hsl(20 10% 52%)' }}>
                    {user.email}
                  </p>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 bg-white border-border shadow-lg" style={{ borderRadius: '12px' }}>
                <DropdownMenuLabel className="text-[11px] font-normal" style={{ color: 'hsl(20 10% 52%)' }}>
                  My Account
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-sm rounded-lg"
                  onClick={() => (window.location.href = '/settings')}
                >
                  <Settings className="w-4 h-4 mr-2 text-muted-foreground" /> Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer text-sm rounded-lg"
                  style={{ color: 'hsl(13 37% 44%)' }}
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4 mr-2" /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topnav */}
        <header
          className="h-[68px] flex items-center justify-between px-3 md:px-8 gap-3 sticky top-0 z-10"
          style={{
            background: 'rgba(247, 244, 237, 0.88)',
            borderBottom: '1px solid hsl(33 24% 87%)',
            backdropFilter: 'blur(14px)',
          }}
        >
          {/* Search */}
          <div className="flex-1 min-w-0 flex items-center">
            <div className="relative w-full max-w-72 group">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 transition-colors duration-150"
                style={{ color: 'hsl(20 10% 58%)' }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search models, workflows, activity…"
                className="w-full h-9 pl-9 pr-4 text-sm placeholder:text-muted-foreground/50 focus:outline-none transition-all duration-150"
                style={{
                  background: 'rgba(255,255,255,0.80)',
                  border: '1px solid hsl(33 28% 83%)',
                  borderRadius: '10px',
                  color: 'hsl(18 26% 18%)',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.boxShadow = '0 0 0 3px hsl(33 40% 52% / 0.14)';
                  e.currentTarget.style.borderColor = 'hsl(33 40% 64%)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow = '';
                  e.currentTarget.style.borderColor = 'hsl(33 28% 83%)';
                }}
              />
              {searchQuery && (
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Notifications */}
          <div className="flex items-center gap-2 relative">
            <button
              ref={bellRef}
              aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
              aria-expanded={notificationPanelOpen}
              aria-controls="demo-notifications"
              className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors duration-150 relative press-scale"
              style={{
                color: 'hsl(20 10% 52%)',
                background: notificationPanelOpen ? 'hsl(36 22% 91%)' : 'transparent',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'hsl(36 22% 91%)'; }}
              onMouseLeave={(e) => {
                if (!notificationPanelOpen)
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
              onClick={() => setNotificationPanelOpen(!notificationPanelOpen)}
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && <span
                className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full ring-2 ring-white"
                style={{ background: 'hsl(33 40% 52%)' }}
              />}
            </button>

            {notificationPanelOpen && (
              <NotificationPanel onClose={closeNotifications} notifications={notifications} onRead={onRead} loading={notificationQuery.isLoading} failed={notificationQuery.isError} />
            )}
          </div>
        </header>

        {/* Page */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1400px] mx-auto px-4 md:px-10 py-8 md:py-12 pb-20">{children}</div>
          <LegalFooter />
        </main>
      </div>
    </div>
  );
}
