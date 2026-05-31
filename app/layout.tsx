import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tele-Sales CRM',
  description: 'Sales CRM Assistant',
};

// Runs before React hydrates — applies the persisted/system theme so there's
// no flash of light mode on first paint.
const themeInitScript = `
(function(){
  try {
    var stored = localStorage.getItem('mindfuel-theme');
    var pref = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    if (pref === 'dark') document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = pref;
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Theme — applied pre-hydration to prevent flash */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {/* Bengali font for the in-call script panel */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
