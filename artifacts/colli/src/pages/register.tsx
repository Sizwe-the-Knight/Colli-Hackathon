import React from 'react';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRegister, ApiError } from '@workspace/api-client-react';
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

const registerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Please enter a valid email'),
  password: z.string().refine(value => Array.from(value).length >= 15, 'Password must be at least 15 characters'),
});

export function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const registerMutation = useRegister();

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const onSubmit = (values: z.infer<typeof registerSchema>) => {
    registerMutation.mutate(
      { data: values },
      {
        onSuccess: () => setLocation('/brief'),
        onError: (error) => {
          toast({
            title: 'Registration failed',
            description: error instanceof ApiError && error.status === 409 ? 'Email already in use.' : 'Registration is unavailable. Please try again.',
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
        <div className="flex flex-col items-center mb-8">
          <img
            src="/colli-icon.png"
            alt="Colli"
            className="w-12 h-12 object-contain rounded-[11px] mb-5"
            style={{ boxShadow: '0 4px 16px rgba(58,43,34,0.18)' }}
          />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground text-center">
            Request access
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5 text-center">
            Join Colli for executive AI oversight
          </p>
        </div>

        <div
          style={{
            background: 'rgba(255,255,255,0.88)',
            border: '1px solid hsl(33 28% 83%)',
            borderRadius: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 8px 32px rgba(0,0,0,0.07)',
            padding: '32px',
          }}
        >
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {[
                { name: 'name' as const, label: 'Full name', placeholder: 'Jane Doe', type: 'text' },
                { name: 'email' as const, label: 'Work email', placeholder: 'jane@company.com', type: 'text' },
                { name: 'password' as const, label: 'Password', placeholder: 'Minimum 15 characters', type: 'password' },
              ].map(({ name, label, placeholder, type }) => (
                <FormField
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground">
                        {label}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type={type}
                          placeholder={placeholder}
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
              ))}

              <p className="text-xs leading-relaxed text-[#4d6663]">By creating an account, you agree to the Terms of Service. See the Privacy Policy for how this beta handles your information.</p>
              <LegalFooter />
              <Button
                type="submit"
                className="w-full h-11 text-sm font-semibold press-scale"
                style={{ borderRadius: '10px', marginTop: '8px' }}
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? 'Creating account…' : 'Create account'}
              </Button>
            </form>
          </Form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{' '}
            <span
              className="text-primary hover:text-primary/80 cursor-pointer font-medium transition-colors duration-150"
              onClick={() => setLocation('/login')}
            >
              Sign in
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
