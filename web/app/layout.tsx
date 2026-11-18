import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('http://localhost:3000'),
  title: 'Дневник эмоций',
  description: 'Личный дневник для бережного наблюдения за эмоциями и мыслями.',
  openGraph: {
    title: 'Дневник эмоций',
    description: 'Замечай чувства, наполняй сосуд эмоций и сохраняй мысли.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Дневник эмоций' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Дневник эмоций',
    description: 'Замечай чувства, наполняй сосуд эмоций и сохраняй мысли.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
