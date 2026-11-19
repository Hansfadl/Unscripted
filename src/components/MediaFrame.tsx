import React, { useEffect, useState } from 'react';
import { Camera } from 'lucide-react';

interface MediaFrameProps {
  src: string;
  alt: string;
  type?: 'image' | 'video';
  className?: string;
  imgClassName?: string;
  imgStyle?: React.CSSProperties;
  fallbackTitle?: string;
}

export function MediaFrame({
  src,
  alt,
  type = 'image',
  className = '',
  imgClassName = 'w-full h-full object-cover',
  imgStyle,
  fallbackTitle,
}: MediaFrameProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (type === 'video' && src && !hasError) {
    return (
      <div className={`relative overflow-hidden bg-[#171717] ${className}`}>
        <video
          src={src}
          controls
          playsInline
          preload="metadata"
          onError={() => setHasError(true)}
          className={imgClassName}
          style={imgStyle}
        />
      </div>
    );
  }

  if (!src || hasError) {
    return (
      <div
        className={`relative overflow-hidden bg-gradient-to-br from-[#171717] via-[#262626] to-[#171717] text-[#F5F1E9] flex flex-col items-center justify-center p-6 text-center ${className}`}
      >
        <Camera className="w-6 h-6 text-[#D8FF3E] mb-2" />
        <p className="text-xs font-mono uppercase tracking-widest text-[#F5F1E9]/70">
          {fallbackTitle || alt || 'UNSCRIPTED Frame'}
        </p>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-[#E8E2D5] ${className}`}>
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        loading="lazy"
        onError={() => setHasError(true)}
        className={imgClassName}
        style={imgStyle}
      />
    </div>
  );
}
