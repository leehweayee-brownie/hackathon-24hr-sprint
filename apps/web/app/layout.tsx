import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: { default: 'VendVet', template: '%s · VendVet' },
  description: 'AI-powered supplier onboarding. Upload once, reuse everywhere.',
};

// Applies the saved theme and cursor before first paint, so neither flashes on load.
const themeScript = `(function(){try{var d=document.documentElement;var t=localStorage.getItem('vp-theme');if(t==='dark'){d.classList.add('dark')}var c=localStorage.getItem('vp-cursor');if(c&&c!=='none'&&/^[a-z-]+$/.test(c)){d.dataset.cursor=c}}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&family=Poppins:wght@500;600&display=swap" rel="stylesheet" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
