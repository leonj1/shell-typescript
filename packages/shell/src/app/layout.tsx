import React from 'react';
import { ServiceProvider } from '../components/providers/ServiceProvider';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ServiceProvider>
          {children}
        </ServiceProvider>
      </body>
    </html>
  );
}