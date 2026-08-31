import type { Metadata } from 'next';
import './globals.css';
import AnalyticsTracker from '@/components/AnalyticsTracker';
import LandingConversionBar from '@/components/LandingConversionBar';
import OfflineBootstrap from '@/components/OfflineBootstrap';
import AccountIdentityBootstrap from '@/components/AccountIdentityBootstrap';
import LoginReturnBootstrap from '@/components/LoginReturnBootstrap';

export const metadata: Metadata = {
  title: 'EDUWILLS — AI Quiz Generator for WAEC, JAMB & NECO | Nigerian Students',
  description: 'Practice WAEC, JAMB & NECO with AI-powered quizzes. Generate smart questions from books, prepare for Nigerian exams, and track your progress with EDUWILLS.',
  keywords: ['WAEC practice questions','JAMB past questions','JAMB CBT mock test','NECO exam preparation','AI quiz generator','free CBT practice Nigeria','Nigerian exam prep','book quiz generator','UTME practice online'],
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  alternates: { canonical: 'https://chineduwilliams739-commits.github.io/eduwills/' },
  openGraph: {
    title: 'EDUWILLS — AI Quiz Generator for WAEC, JAMB & NECO',
    description: 'Generate smart quizzes from books and prepare for Nigerian exams with EDUWILLS.',
    url: 'https://chineduwilliams739-commits.github.io/eduwills/',
    siteName: 'EDUWILLS', type: 'website', locale: 'en_NG',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (<html lang="en-NG"><body><OfflineBootstrap /><AccountIdentityBootstrap /><AnalyticsTracker /><LandingConversionBar /><LoginReturnBootstrap />{children}</body></html>);
}
