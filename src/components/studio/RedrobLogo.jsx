'use client';

import Link from 'next/link';

import { cn } from '@/lib/utils';

/**
 * Redrob brand mark / wordmark (assets from console-web / home).
 * On dark UI, invert the black SVG fills so the logo reads light.
 */
export default function RedrobLogo({
  variant = 'full',
  className,
  href = '/',
  theme = 'dark',
  disabled = false,
}) {
  const imgClass = cn(
    theme === 'dark' && 'brightness-0 invert opacity-90',
    theme === 'light' && 'opacity-100',
    className,
  );

  const img =
    variant === 'mark' ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src="/logo.svg" alt="Redrob" className={cn('h-6 w-6', imgClass)} draggable={false} />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/logo-long.svg"
        alt="Redrob"
        className={cn('h-5 w-auto max-w-[7.5rem]', imgClass)}
        draggable={false}
      />
    );

  if (disabled || !href) {
    return <span className="inline-flex shrink-0 items-center">{img}</span>;
  }

  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center hover:opacity-80"
      aria-label="Redrob Studio home"
    >
      {img}
    </Link>
  );
}
