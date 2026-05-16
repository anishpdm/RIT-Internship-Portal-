import type { Metadata } from 'next';
import './globals.css';

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
      <body>{children}</body>
    </html>
  );
}
