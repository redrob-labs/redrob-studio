'use client';

import { useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Label } from '@/components/ui/label';
import { useT } from '@/context/LocaleContext';
import {
  getAvailableCreateModelFamilies,
  getCreateUrlStyleParam,
  getDefaultStyleVariantForFamily,
} from '@/lib/workflow-catalog';
import { cn } from '@/lib/utils';

export default function CreateModelOptions({
  resolvedTask,
  createBaseModel,
  setCreateBaseModel,
  setCreateStyleVariant,
  isRunning,
  clearError,
}) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const availableFamilies = useMemo(() => getAvailableCreateModelFamilies(), []);

  if (resolvedTask !== 'create' || availableFamilies.length <= 1) {
    return null;
  }

  const syncUrl = (baseModel, styleVariant) => {
    const params = new URLSearchParams(searchParams.toString());
    const styleParam = getCreateUrlStyleParam(baseModel, styleVariant);
    if (styleParam) {
      params.set('style', styleParam);
    } else {
      params.delete('style');
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const handleModelChange = familyId => {
    clearError();
    const defaultVariant = getDefaultStyleVariantForFamily(familyId);
    setCreateBaseModel(familyId);
    setCreateStyleVariant(defaultVariant?.id ?? null);
    syncUrl(familyId, defaultVariant?.id ?? null);
  };

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs">{t('options.qualityStack')}</Label>
      <p className="text-muted-foreground text-xs leading-relaxed">
        {t('options.qualityStackHint')}
      </p>
      <div className="flex flex-col gap-1.5">
        {availableFamilies.map(family => {
          const selected = createBaseModel === family.id;

          return (
            <button
              key={family.id}
              type="button"
              disabled={isRunning}
              className={cn(
                'rounded-md border px-3 py-2 text-left transition-colors disabled:opacity-50',
                selected ? 'border-primary bg-primary/5' : 'hover:bg-muted/60',
              )}
              onClick={() => handleModelChange(family.id)}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{family.label}</span>
                {family.recommended ? (
                  <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                    {t('options.recommended')}
                  </span>
                ) : null}
              </div>
              {family.description ? (
                <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                  {t(`createModel.${family.id}.description`, null, family.description)}
                </p>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
