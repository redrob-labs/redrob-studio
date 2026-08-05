import { Suspense } from 'react';

import HomeCatalog from '@/components/studio/HomeCatalog';
import StudioHeader from '@/components/studio/StudioHeader';

export const metadata = {
  title: 'Redrob Studio',
  description: 'Image, audio, and video tools on your own GPU',
};

/** Tools catalog is the product home. */
export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={null}>
        <StudioHeader isRunning={false} />
      </Suspense>
      <Suspense fallback={null}>
        <HomeCatalog />
      </Suspense>
    </div>
  );
}
