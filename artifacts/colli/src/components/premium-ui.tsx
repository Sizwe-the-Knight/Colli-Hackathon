import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * PremiumCard — the core surface of Colli.
 * Inspired by the walnut + bronze icon: warm, tactile, lifted.
 * Pure white card above a warm ivory desk.
 */
export function PremiumCard({
  className,
  children,
  glow = false,
  interactive = true,
  onClick,
}: {
  className?: string;
  children: React.ReactNode;
  glow?: boolean;
  interactive?: boolean;
  onClick?: () => void;
}) {
  return (
    <div className={cn('relative group', interactive && 'card-lift', className)} onClick={onClick}>
      {glow && (
        <div
          className="absolute -inset-1.5 rounded-3xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 50% 0%, hsl(33 40% 52% / 0.14) 0%, transparent 70%)',
          }}
        />
      )}
      <Card
        className="relative bg-white overflow-hidden"
        style={{
          borderRadius: '18px',
          border: '1px solid hsl(33 28% 82%)',
          boxShadow:
            '0 1px 3px rgba(58,43,34,0.05), 0 4px 14px rgba(58,43,34,0.06), 0 0 0 0.5px rgba(58,43,34,0.04)',
        }}
      >
        {/* Top-edge light catch — mimics the warm light on walnut */}
        <div
          className="absolute top-0 left-6 right-6 h-px pointer-events-none"
          style={{
            background:
              'linear-gradient(to right, transparent, rgba(255,255,255,1) 30%, rgba(255,255,255,1) 70%, transparent)',
          }}
        />
        <CardContent className="p-0">{children}</CardContent>
      </Card>
    </div>
  );
}

/**
 * ValueDisplay — single metric with optional trend badge.
 * The label is quiet; the number commands the space.
 */
export function ValueDisplay({
  label,
  value,
  trend,
  isCurrency = false,
  subtitle,
}: {
  label: string;
  value: string | number;
  trend?: number;
  isCurrency?: boolean;
  subtitle?: string;
}) {
  return (
    <div>
      <p
        className="text-xs font-medium mb-2.5 tracking-wide"
        style={{ color: 'hsl(20 10% 52%)' }}
      >
        {label}
      </p>
      <div className="flex items-baseline gap-3">
        <h3
          className="text-[1.6rem] font-semibold tracking-tight"
          style={{
            color: 'hsl(18 26% 18%)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {isCurrency ? '$' : ''}
          {typeof value === 'number' ? value.toLocaleString() : value}
        </h3>
        {trend !== undefined && (
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={
              trend > 0
                ? {
                    color: 'hsl(148 27% 36%)',
                    background: 'hsl(148 27% 48% / 0.10)',
                    border: '1px solid hsl(148 27% 48% / 0.18)',
                  }
                : {
                    color: 'hsl(13 37% 40%)',
                    background: 'hsl(13 37% 52% / 0.10)',
                    border: '1px solid hsl(13 37% 52% / 0.18)',
                  }
            }
          >
            {trend > 0 ? '+' : ''}
            {trend}%
          </span>
        )}
      </div>
      {subtitle && (
        <p
          className="text-[11px] mt-2 font-normal"
          style={{ color: 'hsl(20 10% 58%)' }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

/**
 * SectionLabel — quiet uppercase divider with bronze authority.
 */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[10px] font-semibold uppercase tracking-[0.12em]"
      style={{ color: 'hsl(20 10% 56%)' }}
    >
      {children}
    </p>
  );
}

/**
 * SkeletonCard — warm shimmer placeholder for loading states.
 */
export function SkeletonCard({ height = 'h-40' }: { height?: string }) {
  return (
    <div
      className={cn('rounded-2xl skeleton-shimmer', height)}
      style={{
        background: 'hsl(36 22% 91%)',
        border: '1px solid hsl(33 28% 86%)',
      }}
    />
  );
}
