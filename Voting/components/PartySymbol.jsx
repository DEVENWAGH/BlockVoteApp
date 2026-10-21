'use client';

import { resolveAssetUrl } from '@/lib/urlUtils';

/**
 * Renders a party symbol from an S3/HTTP URL or falls back to initials.
 */
export default function PartySymbol({
  symbol,
  name = '',
  size = 'md',
  className = '',
}) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-14 h-14 text-xl',
    xl: 'w-20 h-20 text-2xl',
    '2xl': 'w-24 h-24 text-3xl',
  };
  const box = sizeClasses[size] || sizeClasses.md;

  const src = resolveAssetUrl(symbol);
  if (src) {
    return (
      <img
        src={src}
        alt={name ? `${name} party symbol` : 'Party symbol'}
        className={`${box} rounded-2xl object-contain p-1 bg-white border border-hairline shrink-0 shadow-sm ${className}`}
      />
    );
  }

  const initial = (name || '?').trim().charAt(0).toUpperCase();
  return (
    <div
      className={`${box} rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-semibold text-primary shrink-0 ${className}`}
      aria-label={name ? `${name} symbol` : 'Party symbol'}
    >
      {initial}
    </div>
  );
}
