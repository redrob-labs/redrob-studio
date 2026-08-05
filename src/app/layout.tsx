import type { Metadata } from 'next';

import { LocaleProvider } from '@/context/LocaleContext';
import { StudioProvider } from '@/context/StudioContext';

import 'pretendard/dist/web/static/pretendard.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Redrob Studio',
  description: 'Create images, speech, and music with open-source models on your GPU',
  icons: {
    icon: '/logo.svg',
    apple: '/logo.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Always dark theme; StudioProvider keeps `.dark` on the document root.
    // `lang` starts at the default locale; LocaleProvider updates it after hydration.
    <html lang="en" className="dark locale-en" data-locale="en">
      <body className="min-h-screen font-sans antialiased">
        <LocaleProvider>
          <StudioProvider>{children}</StudioProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
