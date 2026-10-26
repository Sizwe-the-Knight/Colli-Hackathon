import React, { useEffect } from 'react';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useGetMe, apiFailureKind, isAuthenticatedUser } from '@workspace/api-client-react';
import { AppProvider, useAppContext } from '@/lib/context';

import { ApiUnavailable } from '@/components/api-unavailable';

import NotFound from '@/pages/not-found';
import { Login } from '@/pages/auth';
import { Register } from '@/pages/register';
import { Privacy, Terms } from '@/pages/legal';
import { Brief } from '@/pages/brief';
import { Dashboard } from '@/pages/dashboard';
import { Models } from '@/pages/models';
import { ActivityPage } from '@/pages/activity';
import { Workflows } from '@/pages/workflows';
import { Costs } from '@/pages/costs';
import { Reports } from '@/pages/reports';
import { Settings } from '@/pages/settings';
import { Onboarding } from '@/pages/onboarding';
import { Shell } from '@/components/shell';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { data: rawUser, isLoading, error, refetch } = useGetMe();
  const { setUser } = useAppContext();
  const [, setLocation] = useLocation();

  const user = !error && isAuthenticatedUser(rawUser) ? rawUser : undefined;
  const unauthorized = !!error && apiFailureKind(error) === 'unauthorized';

  useEffect(() => {
    setUser(user ?? null);
  }, [user]);

  useEffect(() => {
    if (!isLoading && unauthorized) {
      setLocation('/login');
    }
    // If logged in but never onboarded, send to onboarding
    if (!isLoading && user && user.providers === null) {
      setLocation('/onboarding');
    }
  }, [user, isLoading, unauthorized, setLocation]);

  if (isLoading) return <Spinner />;
  if (!user && !unauthorized) return <ApiUnavailable subject="Account status" onRetry={() => { void refetch(); }} />;
  if (!user || user.providers === null) return null;

  return (
    <Shell>
      <Component />
    </Shell>
  );
}

// Onboarding route — user must be logged in but providers can be null
function OnboardingRoute() {
  const { data: rawUser, isLoading, error, refetch } = useGetMe();
  const { setUser } = useAppContext();
  const [, setLocation] = useLocation();

  const user = !error && isAuthenticatedUser(rawUser) ? rawUser : undefined;
  const unauthorized = !!error && apiFailureKind(error) === 'unauthorized';

  useEffect(() => {
    setUser(user ?? null);
  }, [user]);

  useEffect(() => {
    if (!isLoading && unauthorized) {
      setLocation('/login');
    }
    // If already onboarded, skip to brief
    if (!isLoading && user && user.providers !== null) {
      setLocation('/brief');
    }
  }, [user, isLoading, unauthorized, setLocation]);

  if (isLoading) return <Spinner />;
  if (!user && !unauthorized) return <ApiUnavailable subject="Account status" onRetry={() => { void refetch(); }} />;
  if (!user) return null;
  if (user.providers !== null) return null;

  return <Onboarding />;
}

function BriefProtectedRoute() {
  const { data: rawUser, isLoading, error, refetch } = useGetMe();
  const { setUser } = useAppContext();
  const [, setLocation] = useLocation();

  const user = !error && isAuthenticatedUser(rawUser) ? rawUser : undefined;
  const unauthorized = !!error && apiFailureKind(error) === 'unauthorized';

  useEffect(() => {
    setUser(user ?? null);
  }, [user]);

  useEffect(() => {
    if (!isLoading && unauthorized) {
      setLocation('/login');
    }
    if (!isLoading && user && user.providers === null) {
      setLocation('/onboarding');
    }
  }, [user, isLoading, unauthorized, setLocation]);

  if (isLoading) return <Spinner />;
  if (!user && !unauthorized) return <ApiUnavailable subject="Account status" onRetry={() => { void refetch(); }} />;
  if (!user || user.providers === null) return null;

  return <Brief />;
}

function AuthRoute({ component: Component }: { component: React.ComponentType }) {
  const { data: rawUser, isLoading, error, refetch } = useGetMe();
  const { setUser } = useAppContext();
  const [, setLocation] = useLocation();

  const user = !error && isAuthenticatedUser(rawUser) ? rawUser : undefined;
  const unauthorized = !!error && apiFailureKind(error) === 'unauthorized';

  useEffect(() => {
    setUser(user ?? null);
  }, [user]);

  useEffect(() => {
    if (!isLoading && user) {
      // Redirect based on onboarding state
      if (user.providers === null) {
        setLocation('/onboarding');
      } else {
        setLocation('/brief');
      }
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) return <Spinner />;
  if (!user && !unauthorized) return <ApiUnavailable subject="Account status" onRetry={() => { void refetch(); }} />;
  if (user) return null;

  return <Component />;
}

function RootRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation('/brief'); }, [setLocation]);
  return null;
}

function Spinner() {
  return (
    <div className="h-screen w-full bg-background flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/" component={RootRedirect} />
      <Route path="/login"><AuthRoute component={Login} /></Route>
      <Route path="/register"><AuthRoute component={Register} /></Route>
      <Route path="/onboarding"><OnboardingRoute /></Route>

      <Route path="/brief"><BriefProtectedRoute /></Route>

      <Route path="/dashboard"><ProtectedRoute component={Dashboard} /></Route>
      <Route path="/models"><ProtectedRoute component={Models} /></Route>
      <Route path="/activity"><ProtectedRoute component={ActivityPage} /></Route>
      <Route path="/workflows"><ProtectedRoute component={Workflows} /></Route>
      <Route path="/costs"><ProtectedRoute component={Costs} /></Route>
      <Route path="/reports"><ProtectedRoute component={Reports} /></Route>
      <Route path="/settings"><ProtectedRoute component={Settings} /></Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AppProvider>
    </QueryClientProvider>
  );
}

export default App;
