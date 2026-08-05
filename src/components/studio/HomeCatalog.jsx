'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { useLocale, useT } from '@/context/LocaleContext';
import {
  CATEGORY_QUERY_KEY,
  parseCategoryParam,
} from '@/lib/studio/navigation';
import { buildCatalogTools } from '@/lib/studio/tools';
import { TOOL_CATEGORIES } from '@/lib/workflow-catalog';
import { cn } from '@/lib/utils';

import ToolCard from './ToolCard';

export default function HomeCatalog() {
  const t = useT();
  const { isKorean } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toolCategory = useMemo(
    () => parseCategoryParam(searchParams.get(CATEGORY_QUERY_KEY)),
    [searchParams],
  );

  const setToolCategory = useCallback(
    categoryId => {
      const params = new URLSearchParams(searchParams.toString());
      if (categoryId === 'all') {
        params.delete(CATEGORY_QUERY_KEY);
      } else {
        params.set(CATEGORY_QUERY_KEY, categoryId);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, searchParams, pathname],
  );

  const catalogTools = useMemo(() => buildCatalogTools(), []);

  const filteredCatalogTools = useMemo(() => {
    if (toolCategory === 'all') {
      return catalogTools;
    }
    return catalogTools.filter(tool => tool.category === toolCategory);
  }, [catalogTools, toolCategory]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-2xl text-center">
        <h1
          className={cn(
            'text-3xl font-bold tracking-tight sm:text-4xl',
            isKorean && 'leading-snug',
          )}
        >
          {t('home.heading')}
        </h1>
        <p
          className={cn(
            'text-muted-foreground mx-auto mt-3 max-w-md text-base sm:text-lg',
            isKorean ? 'leading-relaxed' : 'leading-normal',
          )}
        >
          {t('home.tagline')}
        </p>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {TOOL_CATEGORIES.map(category => (
          <Button
            key={category.id}
            type="button"
            size="sm"
            variant={toolCategory === category.id ? 'default' : 'outline'}
            className="rounded-full px-4"
            onClick={() => setToolCategory(category.id)}
          >
            {t(`category.${category.id}`, null, category.label)}
          </Button>
        ))}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredCatalogTools.map(tool => (
          <ToolCard
            key={`${tool.modality}-${tool.id}`}
            tool={tool}
            category={toolCategory !== 'all' ? toolCategory : undefined}
          />
        ))}
      </div>

      {filteredCatalogTools.length === 0 ? (
        <p className="text-muted-foreground mx-auto mt-10 max-w-sm text-center text-sm leading-relaxed">
          {t('home.emptyFilter')}
        </p>
      ) : null}
    </main>
  );
}
