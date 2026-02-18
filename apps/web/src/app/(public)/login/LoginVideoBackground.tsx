'use client';

import { useRef, useEffect, useState } from 'react';

const LOGIN_BG_VIDEO_LOCAL = '/video/login-bg.mp4';
const LOGIN_BG_VIDEO_FALLBACK =
  'https://cdn.mixkit.co/videos/preview/mixkit-white-and-blue-clouds-on-a-sky-background-4172-large.mp4';

export function LoginVideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoSrc, setVideoSrc] = useState(LOGIN_BG_VIDEO_LOCAL);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.load();
    video.play().catch(() => {});
    return () => {
      video.pause();
    };
  }, [videoSrc]);

  const onVideoError = () => {
    setVideoSrc(LOGIN_BG_VIDEO_FALLBACK);
  };

  return (
    <div className="absolute inset-0 z-0" aria-hidden>
      <video
        ref={videoRef}
        muted
        loop
        playsInline
        preload="auto"
        onError={onVideoError}
        className="absolute inset-0 w-full h-full object-cover scale-110 blur-3xl opacity-70"
      >
        <source src={videoSrc} type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-slate-900/30" />
    </div>
  );
}
