import type { Metadata } from 'next';
import './globals.css';
import RouteProgress from '@/components/RouteProgress';
import { Analytics } from '@vercel/analytics/next';

export const metadata: Metadata = {
  title: 'RIT Internship Portal',
  description:
    'Internship management platform for the Rajiv Gandhi Institute of Technology — sessions, assignments, attendance, evaluation.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Preconnect to Google Fonts CDN for faster font load */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>
        <RouteProgress />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
