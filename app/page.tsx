'use client';
import dynamic from 'next/dynamic';

// Disable SSR entirely for the SPA shell.
// The original app was a pure Vite SPA with no SSR; components freely use
// localStorage, window, etc. during render. ssr:false matches that behaviour.
const App = dynamic(() => import('../src/App'), { ssr: false });

export default function Page() {
  return <App />;
}
