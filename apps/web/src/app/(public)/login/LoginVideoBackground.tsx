'use client';

import { useRef, useEffect, useState } from 'react';

/** Ruta del video (archivo en public/video o URL). Autoplay solo funciona si está muteado (política del navegador). */
const LOGIN_VIDEO_SRC =
  typeof process.env.NEXT_PUBLIC_LOGIN_VIDEO_URL === 'string' &&
  process.env.NEXT_PUBLIC_LOGIN_VIDEO_URL
    ? process.env.NEXT_PUBLIC_LOGIN_VIDEO_URL
    : '/video/login-bg.mp4';

export function LoginVideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const promise = video.play();
    if (promise?.catch) promise.catch(() => {});
  }, []);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden>
      {/* Video de fondo: muteado + playsInline para que los navegadores permitan autoplay */}
      {!videoError && (
        <video
          ref={videoRef}
          src={LOGIN_VIDEO_SRC}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          aria-hidden
          onError={() => setVideoError(true)}
        />
      )}
      {/* Overlay suave para que el video se vea y el formulario siga legible */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/45 via-slate-800/40 to-slate-900/45" />
      
      {/* Capas de gradientes animados para efecto de movimiento */}
      <div 
        className="absolute inset-0 opacity-35"
        style={{
          background: `
            radial-gradient(circle at 20% 30%, rgba(59, 130, 246, 0.3) 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(139, 92, 246, 0.3) 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(14, 165, 233, 0.2) 0%, transparent 60%)
          `,
          animation: 'gradientShift 15s ease infinite',
        }}
      />
      
      {/* Efecto de "estrellas" con puntos animados */}
      <div 
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage: `
            radial-gradient(2px 2px at 20% 30%, rgba(255, 255, 255, 0.8), transparent),
            radial-gradient(2px 2px at 60% 70%, rgba(255, 255, 255, 0.6), transparent),
            radial-gradient(1px 1px at 50% 50%, rgba(255, 255, 255, 0.9), transparent),
            radial-gradient(1px 1px at 80% 10%, rgba(255, 255, 255, 0.7), transparent),
            radial-gradient(2px 2px at 90% 50%, rgba(255, 255, 255, 0.5), transparent),
            radial-gradient(1px 1px at 10% 80%, rgba(255, 255, 255, 0.8), transparent),
            radial-gradient(2px 2px at 30% 90%, rgba(255, 255, 255, 0.6), transparent),
            radial-gradient(1px 1px at 70% 20%, rgba(255, 255, 255, 0.7), transparent)
          `,
          backgroundSize: '200% 200%',
          animation: 'starTwinkle 8s ease-in-out infinite',
        }}
      />
      
      {/* Toque final oscuro suave para contraste del card */}
      <div className="absolute inset-0 bg-slate-900/15" />
      
      <style jsx>{`
        @keyframes gradientShift {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }
        
        @keyframes starTwinkle {
          0%, 100% {
            opacity: 0.6;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.1);
          }
        }
      `}</style>
    </div>
  );
}
