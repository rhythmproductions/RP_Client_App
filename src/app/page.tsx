import { redirect } from 'next/navigation';

// The app is served under explicit paths (/upload, /portal). The root just
// forwards to the client upload page.
export default function HomePage() {
  redirect('/upload');
}
