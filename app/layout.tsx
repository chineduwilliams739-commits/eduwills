import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EDUWILLS — Learn smarter. Quiz better.',
  description: 'AI-powered book learning and quiz preparation for Nigerian students.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
