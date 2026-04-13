import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Rhythm Productions — Client Upload',
  description:
    'Send your photos and videos to Rhythm Productions. Simple, secure uploads from your phone.',
  manifest: '/manifest.json',
  applicationName: 'RP Upload',
  appleWebApp: {
    capable: true,
    title: 'RP Upload',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#d9232b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Oswald:ital,wght@0,700;1,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-gradient-to-b from-white via-brand-50 to-brand-100 text-brand-900 antialiased">
        <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col pt-safe pb-safe">
          {children}
        </div>
      </body>
    </html>
  );
}
