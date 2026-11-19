import './globals.css';
import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';

// Self-hosted by Next at build time: no render-blocking Google stylesheet, no layout shift.
const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata = {
  title: 'CallTrack CRM',
  description: 'Team call and lead tracking for tele-calling managers',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        {children}
        <Toaster
          position="bottom-right"
          gutter={8}
          toastOptions={{
            duration: 3500,
            className: 'ct-toast',
            success: { iconTheme: { primary: '#079455', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#D92D20', secondary: '#fff' } },
          }}
        />
      </body>
    </html>
  );
}
