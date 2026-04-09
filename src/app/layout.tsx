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
    statusBarStyle: 'black-translucent',
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
  themeColor: '#1e1108',
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
      <body className="min-h-screen bg-gradient-to-b from-brand-950 via-brand-900 to-black text-brand-50 antialiased">
        <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col pt-safe pb-safe">
          {children}
        </div>
      </body>
    </html>
  );
}
