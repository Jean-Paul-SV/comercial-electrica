import type { ReactNode } from 'react';
import { QueryClientProvider } from '@shared/providers/QueryClientProvider';

export const metadata = {
  title: 'Comercial Eléctrica',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <QueryClientProvider>{children}</QueryClientProvider>
      </body>
    </html>
  );
}

