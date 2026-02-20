'use client';

export function LoginVideoBackground() {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden>
      {/* Gradiente base animado */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
      
      {/* Capas de gradientes animados para efecto de movimiento */}
      <div 
        className="absolute inset-0 opacity-40"
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
        className="absolute inset-0 opacity-60"
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
      
      {/* Overlay oscuro para contraste */}
      <div className="absolute inset-0 bg-slate-900/30" />
      
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
