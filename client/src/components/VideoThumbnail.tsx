import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

interface VideoThumbnailProps {
  src: string;
  className?: string;
  showPlayButton?: boolean;
  autoPlay?: boolean;
}

const VideoThumbnail: React.FC<VideoThumbnailProps> = ({
  src,
  className = "w-full h-full object-cover",
  showPlayButton = true,
  autoPlay = false
}) => {
  const [videoReady, setVideoReady] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      const handleCanPlay = () => {
        setVideoReady(true);
      };

      const handleError = () => {
        setVideoError(true);
      };

      const handlePlay = () => {
        setIsPlaying(true);
      };

      const handlePause = () => {
        setIsPlaying(false);
      };

      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('error', handleError);
      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);

      return () => {
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('error', handleError);
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
      };
    }
  }, [src]);

  const handleVideoClick = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        setShowControls(true);
        videoRef.current.play();
      }
    }
  };

  const handleMuteToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      const newMutedState = !isMuted;
      setIsMuted(newMutedState);
      videoRef.current.muted = newMutedState;
    }
  };

  if (videoError) {
    return (
      <div className={`${className} bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center relative`} onClick={handleVideoClick}>
        <div className="text-center">
          <div className="text-6xl mb-3 opacity-60">🎬</div>
          <div className="text-sm font-medium text-gray-600 dark:text-gray-300">Video</div>
        </div>
        {showPlayButton && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/10">
            <div className="bg-white/90 backdrop-blur-sm rounded-full p-3 shadow-lg hover:bg-white transition-colors duration-200">
              <Play 
                size={24} 
                className="text-gray-800 ml-1" 
                fill="currentColor"
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full h-full" onClick={handleVideoClick}>
      {/* Video element as thumbnail - paused at first frame */}
      <video
        ref={videoRef}
        className={className}
        muted={isMuted}
        playsInline
        preload="metadata"
        loop
        style={{
          objectFit: 'cover',
          width: '100%',
          height: '100%'
        }}
        onLoadedMetadata={() => {
          // Set to first frame for thumbnail
          if (videoRef.current) {
            videoRef.current.currentTime = 0.1;
            videoRef.current.muted = isMuted;
          }
        }}
        onError={() => {
          setVideoError(true);
        }}
      >
        <source src={src} type="video/mp4" />
        <source src={src} type="video/webm" />
        <source src={src} type="video/ogg" />
        Your browser does not support the video tag.
      </video>
      
      {/* Loading overlay */}
      {!videoReady && !videoError && (
        <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <div className="text-sm text-gray-500">Video wird geladen...</div>
          </div>
        </div>
      )}
      
      {/* Play/Pause Button Overlay - only show when paused */}
      {showPlayButton && videoReady && !isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm cursor-pointer transition-opacity duration-300 hover:bg-black/30">
          <div className="bg-white/90 backdrop-blur-sm rounded-full p-3 shadow-lg hover:bg-white transition-colors duration-200">
            <Play 
              size={24} 
              className="text-gray-800 ml-1" 
              fill="currentColor"
            />
          </div>
        </div>
      )}

      {/* Instagram-style Video Controls - show when playing */}
      {isPlaying && (
        <>
          {/* Sound Toggle Button - Top Left */}
          <div className="absolute top-4 left-4">
            <button
              onClick={handleMuteToggle}
              className="bg-black/60 backdrop-blur-sm rounded-full p-2 hover:bg-black/80 transition-all duration-200 cursor-pointer group"
              title={isMuted ? 'Sound einschalten' : 'Sound ausschalten'}
            >
              {isMuted ? (
                <VolumeX 
                  size={18} 
                  className="text-white group-hover:scale-110 transition-transform duration-200" 
                />
              ) : (
                <Volume2 
                  size={18} 
                  className="text-white group-hover:scale-110 transition-transform duration-200" 
                />
              )}
            </button>
          </div>

          {/* Pause Button - Bottom Right */}
          <div className="absolute bottom-4 right-4">
            <button
              onClick={handleVideoClick}
              className="bg-black/60 backdrop-blur-sm rounded-full p-2 hover:bg-black/80 transition-all duration-200 cursor-pointer group"
              title="Video pausieren"
            >
              <Pause 
                size={18} 
                className="text-white group-hover:scale-110 transition-transform duration-200" 
                fill="currentColor"
              />
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default VideoThumbnail;