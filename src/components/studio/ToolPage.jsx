'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useT } from '@/context/LocaleContext';
import { useToolRunner } from '@/hooks/useToolRunner';
import {
  buildToolsHref,
  CATEGORY_QUERY_KEY,
} from '@/lib/studio/navigation';
import { normalizeCreateModelId } from '@/lib/workflow-catalog';

import RedrobLogo from './RedrobLogo';
import StudioHeader from './StudioHeader';
import ToolWorkspace from './ToolWorkspace';

function ToolPageContent({ modality, task }) {
  const t = useT();
  const searchParams = useSearchParams();
  const toolsHref = buildToolsHref(searchParams.get(CATEGORY_QUERY_KEY));
  const styleParam = searchParams.get('style');
  const initialCreateStyle = styleParam ? normalizeCreateModelId(styleParam) : undefined;
  const runner = useToolRunner(modality, task, { initialCreateStyle });

  if (runner.workflowOptions.length === 0) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <Alert>
          <AlertDescription>
            {t('workspace.noWorkflows')}{' '}
            <code className="font-mono text-sm">src/workflows/manifest.json</code>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!runner.selectedWorkflow) {
    return (
      <div className="min-h-screen bg-muted/30">
        <header className="border-b bg-card">
          <div className="mx-auto flex max-w-7xl items-center px-4 py-2.5 sm:px-6">
            <RedrobLogo href={toolsHref} />
          </div>
        </header>
        <main className="mx-auto max-w-2xl p-6">
          <Alert>
            <AlertDescription>{t('workspace.toolUnavailable')}</AlertDescription>
          </Alert>
          <Button type="button" variant="outline" className="mt-4" asChild>
            <Link href={toolsHref}>
              <ArrowLeft className="size-4" />
              {t('nav.allTools')}
            </Link>
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <StudioHeader isRunning={runner.isRunning} />
      <ToolWorkspace {...runner} />
    </div>
  );
}

export default function ToolPage(props) {
  return (
    <Suspense fallback={null}>
      <ToolPageContent {...props} />
    </Suspense>
  );
}
