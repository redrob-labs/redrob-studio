'use client';

import { Sparkles } from 'lucide-react';
import Link from 'next/link';

import { useT } from '@/context/LocaleContext';
import { appendCategoryToHref } from '@/lib/studio/navigation';
import { TOOL_VISUALS } from '@/lib/studio/tool-visuals';
import { cn } from '@/lib/utils';

export default function ToolCard({ tool, category, disabled }) {
  const t = useT();
  const visual = TOOL_VISUALS[tool.id] ?? { icon: Sparkles, accent: 'bg-muted text-muted-foreground' };
  const Icon = visual.icon;
  const href = appendCategoryToHref(tool.href, category);

  return (
    <Link
      href={href}
      aria-disabled={disabled}
      className={cn(
        'group flex cursor-pointer flex-col rounded-2xl border bg-card p-5 text-left shadow-sm transition',
        'hover:border-primary/30 hover:shadow-md focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
        disabled && 'pointer-events-none cursor-not-allowed opacity-50',
      )}
      onClick={event => {
        if (disabled) {
          event.preventDefault();
        }
      }}
    >
      <div
        className={cn(
          'mb-4 flex size-14 items-center justify-center rounded-2xl transition group-hover:scale-105',
          visual.accent,
        )}
      >
        <Icon className="size-7" strokeWidth={1.75} />
      </div>
      <h3 className="text-base font-semibold leading-snug break-keep">
        {t(`task.${tool.id}.label`, null, tool.label)}
      </h3>
      <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed break-keep">
        {t(`task.${tool.id}.description`, null, tool.description)}
      </p>
    </Link>
  );
}
