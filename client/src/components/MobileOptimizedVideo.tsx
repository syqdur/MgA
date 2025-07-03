import React from 'react';

interface MobileOptimizedVideoProps {
  src: string;
  className?: string;
  muted?: boolean;
  poster?: string;
  controls?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  previewMode?: boolean;
}

const MobileOptimizedVideo: React.FC<MobileOptimizedVideoProps> = ({
  src,
  className = "w-full h-full object-cover",
  muted = true,
  poster = "",
  controls = false,
  autoPlay = false,
  loop = false,
  previewMode = false
}) => {
  return (
    <video
      src={src}
      className={className}
      muted={muted}
      playsInline
      webkit-playsinline=""
      x-webkit-airplay="allow"
      preload={previewMode ? "metadata" : "auto"}
      poster={poster}
      controls={controls}
      autoPlay={autoPlay}
      loop={loop}
      // Critical mobile video attributes
      data-object-fit="cover"
      // Prevent fullscreen on mobile when tapped
      controlsList={previewMode ? "nodownload nofullscreen" : undefined}
      // iOS specific attributes
      style={{
        WebkitTransform: 'translateZ(0)',
        WebkitBackfaceVisibility: 'hidden',
        WebkitPerspective: 1000
      }}
    />
  );
};

export default MobileOptimizedVideo;