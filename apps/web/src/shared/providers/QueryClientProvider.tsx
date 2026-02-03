'use client';

import {
  QueryClient,
  QueryClientProvider as RQProvider,
} from '@tanstack/react-query';
import { ReactNode, useState } from 'react';

export function QueryClientProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000, // 1 min: menos refetches al cambiar de pestaña
            gcTime: 5 * 60 * 1000, // 5 min en caché
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return <RQProvider client={client}>{children}</RQProvider>;
}

