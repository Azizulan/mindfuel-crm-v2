import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tele-Sales CRM',
  description: 'Sales CRM Assistant',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
