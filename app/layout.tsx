import type { Metadata } from 'next';
import './globals.css';
import AnalyticsTracker from '@/components/AnalyticsTracker';
import LandingConversionBar from '@/components/LandingConversionBar';
import OfflineBootstrap from '@/components/OfflineBootstrap';
import AccountIdentityBootstrap from '@/components/AccountIdentityBootstrap';
import LoginReturnBootstrap from '@/components/LoginReturnBootstrap';

const SITE_URL = 'https://chineduwilliams739-commits.github.io/eduwills/';

export const metadata: Metadata = {
  title: 'EDUWILLS — AI Quiz Generator for WAEC, JAMB & NECO | Nigerian Students',
  description: 'Practice WAEC, JAMB & NECO with AI-powered quizzes. Generate smart questions from books, prepare for Nigerian exams, and track your progress with EDUWILLS.',
  keywords: ['WAEC practice questions','JAMB past questions','JAMB CBT mock test','NECO exam preparation','AI quiz generator','free CBT practice Nigeria','Nigerian exam prep','book quiz generator','UTME practice online'],
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: 'EDUWILLS — AI Quiz Generator for WAEC, JAMB & NECO',
    description: 'Generate smart quizzes from books and prepare for Nigerian exams with EDUWILLS.',
    url: SITE_URL,
    siteName: 'EDUWILLS',
    type: 'website',
    locale: 'en_NG',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EDUWILLS — AI Quiz Generator for Nigerian Students',
    description: 'Practice WAEC, JAMB and NECO with AI-powered quizzes and study tools.',
  },
};

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}#website`,
      url: SITE_URL,
      name: 'EDUWILLS',
      description: 'AI-assisted learning and exam-practice platform for Nigerian students.',
      inLanguage: 'en-NG',
    },
    {
      '@type': 'EducationalOrganization',
      '@id': `${SITE_URL}#organization`,
      name: 'EDUWILLS',
      url: SITE_URL,
      description: 'Nigeria-focused digital learning platform for exam practice, book quizzes and academic progress.',
    },
    {
      '@type': 'WebApplication',
      '@id': `${SITE_URL}#app`,
      name: 'EDUWILLS',
      url: SITE_URL,
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Web',
      description: 'AI-assisted quiz generation, exam practice and learning tools for Nigerian students.',
    },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-NG">
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      </head>
      <body><OfflineBootstrap /><AccountIdentityBootstrap /><AnalyticsTracker /><LandingConversionBar /><LoginReturnBootstrap />{children}</body>
    </html>
  );
}
