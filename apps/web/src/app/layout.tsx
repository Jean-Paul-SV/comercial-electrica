import type { ReactNode } from 'react';
import Script from 'next/script';
import { QueryClientProvider } from '@shared/providers/QueryClientProvider';
import { AuthProvider } from '@shared/providers/AuthProvider';
import { ThemeProvider } from '@shared/theme';
import { Toaster } from '@shared/components/Toaster';
import './globals.css';

export const metadata = {
  title: 'Orion',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover' as const,
};

/** Script que aplica tema guardado antes del primer pintado para evitar parpadeo. */
const themeScript = `
(function(){
  var t=localStorage.getItem('ce-theme')||'blue';
  var d=localStorage.getItem('ce-dark');
  var dark=d===null?(typeof matchMedia!=='undefined'&&matchMedia('(prefers-color-scheme: dark)').matches):d==='true';
  var themes={
    blue:{light:{primary:'221 83% 53%',pf:'0 0% 100%',ring:'221 83% 53%'},dark:{primary:'221 83% 58%',pf:'0 0% 100%',ring:'221 83% 58%'}},
    indigo:{light:{primary:'239 84% 67%',pf:'0 0% 100%',ring:'239 84% 67%'},dark:{primary:'239 84% 72%',pf:'0 0% 100%',ring:'239 84% 72%'}},
    emerald:{light:{primary:'160 84% 39%',pf:'0 0% 100%',ring:'160 84% 39%'},dark:{primary:'160 84% 45%',pf:'0 0% 100%',ring:'160 84% 45%'}},
    violet:{light:{primary:'263 70% 50%',pf:'0 0% 100%',ring:'263 70% 50%'},dark:{primary:'263 70% 58%',pf:'0 0% 100%',ring:'263 70% 58%'}},
    amber:{light:{primary:'32 95% 44%',pf:'0 0% 100%',ring:'32 95% 44%'},dark:{primary:'38 92% 50%',pf:'32 95% 15%',ring:'38 92% 50%'}},
    slate:{light:{primary:'215 28% 35%',pf:'0 0% 100%',ring:'215 28% 35%'},dark:{primary:'215 20% 55%',pf:'215 28% 12%',ring:'215 20% 55%'}}
  };
  var p=themes[t]||themes.blue;
  var v=dark?p.dark:p.light;
  var r=document.documentElement;
  r.style.setProperty('--primary',v.primary);
  r.style.setProperty('--primary-foreground',v.pf);
  r.style.setProperty('--ring',v.ring);
  if(dark)r.classList.add('dark');else r.classList.remove('dark');
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning data-scroll-behavior="smooth">
      <body>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeScript }}
        />
        <ThemeProvider>
          <AuthProvider>
            <QueryClientProvider>{children}</QueryClientProvider>
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

