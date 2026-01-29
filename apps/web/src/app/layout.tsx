import type { ReactNode } from 'react';
import { QueryClientProvider } from '@shared/providers/QueryClientProvider';
import { AuthProvider } from '@shared/providers/AuthProvider';
import './globals.css';

export const metadata = {
  title: 'Comercial Eléctrica',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>
          <QueryClientProvider>{children}</QueryClientProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

