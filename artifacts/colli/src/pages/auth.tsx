import React from 'react';
import { Link, useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Globe, Monitor } from 'lucide-react';
import { useLogin, apiFailureKind } from '@workspace/api-client-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LegalFooter } from '@/components/legal-footer';
import { useToast } from '@/hooks/use-toast';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const loginMutation = useLogin();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = (values: z.infer<typeof loginSchema>) => {
    loginMutation.mutate(
      { data: values },
      {
        onSuccess: () => setLocation('/brief'),
        onError: (error) => {
          toast({
            title: 'Sign in failed',
            description: apiFailureKind(error) === 'unauthorized' ? 'Invalid email or password.' : 'Sign in is unavailable. Please try again.',
            variant: 'destructive',
          });
        },
      }
    );
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 page-enter"
      style={{
        background: 'hsl(40 35% 95%)',
        backgroundImage: [
          'radial-gradient(ellipse 80% 65% at 10% 5%,  hsla(36, 50%, 91%, 0.60) 0%, transparent 60%)',
          'radial-gradient(ellipse 55% 50% at 90% 90%, hsla(33, 35%, 88%, 0.40) 0%, transparent 55%)',
        ].join(', '),
      }}
    >
      <div className="w-full max-w-[400px]">
        {/* Logo + headline */}
        <div className="flex flex-col items-center mb-8">
          <img
            src="/colli-icon.png"
            alt="Colli"
            className="w-12 h-12 object-contain rounded-[11px] mb-5"
            style={{ boxShadow: '0 4px 16px rgba(58,43,34,0.18)' }}
          />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground text-center">
            Sign in to Colli
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5 text-center">
            Your Executive AI Operating System
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: 'rgba(255,255,255,0.88)',
            border: '1px solid hsl(33 28% 83%)',
            borderRadius: '20px',
            boxShadow:
              '0 1px 3px rgba(0,0,0,0.05), 0 8px 32px rgba(0,0,0,0.07)',
            padding: '32px',
          }}
        >
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-muted-foreground">
                      Email address
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="executive@company.com"
                        className="h-11 text-sm"
                        style={{
                          background: 'hsl(40 22% 91%)',
                          border: '1px solid hsl(38 20% 84%)',
                          borderRadius: '10px',
                        }}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-muted-foreground">
                      Password
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        className="h-11 text-sm"
                        style={{
                          background: 'hsl(40 22% 91%)',
                          border: '1px solid hsl(38 20% 84%)',
                          borderRadius: '10px',
                        }}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full h-11 text-sm font-semibold press-scale bg-[#356e68] text-white border-[#356e68] hover:bg-[#2b5e58] focus-visible:ring-[#356e68]"
                style={{ borderRadius: '10px', marginTop: '8px' }}
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </Form>

          <div className="my-6 flex items-center gap-3">
            <div className="flex-1" style={{ borderTop: '1px solid hsl(38 20% 86%)' }} />
            <span className="text-xs text-muted-foreground/60">or</span>
            <div className="flex-1" style={{ borderTop: '1px solid hsl(38 20% 86%)' }} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { Icon: Globe,   label: 'Google' },
              { Icon: Monitor, label: 'Microsoft' },
            ].map(({ Icon, label }) => (
              <button
                key={label}
                className="h-11 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-150 press-scale"
                style={{
                  background: 'rgba(255,255,255,0.7)',
                  border: '1px solid hsl(38 20% 84%)',
                  borderRadius: '10px',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'white';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.7)';
                }}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Don't have an account?{' '}
            <Link
              className="text-primary hover:text-primary/80 cursor-pointer font-medium transition-colors duration-150 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              href="/register"
            >
              Request access
            </Link>
          </p>
          <LegalFooter />
        </div>
      </div>
    </div>
  );
}
