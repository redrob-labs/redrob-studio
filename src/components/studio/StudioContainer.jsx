import { cn } from '@/lib/utils';

/** Shared page width — keep header and studio tools aligned. */
export const STUDIO_CONTAINER_CLASS = 'mx-auto w-full max-w-7xl px-4 sm:px-6';

export function StudioContainer({ as: Comp = 'div', className, children, ...props }) {
  return (
    <Comp className={cn(STUDIO_CONTAINER_CLASS, className)} {...props}>
      {children}
    </Comp>
  );
}
