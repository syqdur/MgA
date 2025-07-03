import React, { useState, useRef, useEffect } from 'react';
import { Play, Film } from 'lucide-react';

interface RobustVideoPlayerProps {
  src: string;
  className?: string;
  muted?: boolean;
  controls?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  poster?: string;
  onError?: (error: any) => void;
  showFallback?: boolean;
  fallbackText?: string;
}

const RobustVideoPlayer: React.FC<RobustVideoPlayerProps> = ({
  src,
  className = "w-full h-full object-cover",
  muted = true,
  controls = false,
  autoPlay = false,
  loop = false,
  poster = "",
  onError,
  showFallback = true,
  fallbackText = "Video konnte nicht geladen werden"
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const maxRetries = 2;

  useEffect(() => {
    // Reset state when src changes
    setHasError(false);
    setIsLoading(true);
    setRetryCount(0);
  }, [src]);

  const handleError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = e.target as HTMLVideoElement;
    const error = video.error;
    
    console.error('🚨 Video error:', {
      src: video.src,
      retryCount
    });

    if (onError) {
      onError(error);
    }

    // Check if this is a legacy MOV file that wasn't converted during upload
    const isMOVFile = src.toLowerCase().includes('.mov');
    if (isMOVFile && error?.code === 4) {
      console.warn('❌ Legacy MOV file detected - cannot play this format. File was uploaded before conversion system.');
      setHasError(true);
      setIsLoading(false);
      return;
    }

    // Try to retry loading for other error types
    if (retryCount < maxRetries && error?.code === 4) { // Format error
      console.log(`🔄 Retrying video load (${retryCount + 1}/${maxRetries})...`);
      setRetryCount(prev => prev + 1);
      
      // Wait a bit before retrying
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.load();
        }
      }, 1000 * (retryCount + 1)); // Exponential backoff
    } else {
      setHasError(true);
      setIsLoading(false);
    }
  };

  const handleLoadStart = () => {
    console.log('📹 Video load started');
    setIsLoading(true);
  };

  const handleLoadedData = () => {
    console.log('📹 Video data loaded successfully');
    setIsLoading(false);
    setHasError(false);
  };

  const handleCanPlay = () => {
    console.log('📹 Video can play');
    setIsLoading(false);
  };

  // If we have an error and should show fallback, render fallback UI
  if (hasError && showFallback) {
    const isMOVFile = src.toLowerCase().includes('.mov');
    
    return (
      <div className={`${className} flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400`}>
        <Film className="w-8 h-8 mb-2" />
        {isMOVFile ? (
          <>
            <p className="text-sm text-center px-2">MOV-Format wird nicht unterstützt</p>
            <p className="text-xs text-center px-2 mt-1">Datei wurde vor der Konvertierung hochgeladen</p>
          </>
        ) : (
          <>
            <p className="text-sm text-center px-2">{fallbackText}</p>
            <button
              onClick={() => {
                setHasError(false);
                setIsLoading(true);
                setRetryCount(0);
                if (videoRef.current) {
                  videoRef.current.load();
                }
              }}
              className="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors"
            >
              Erneut versuchen
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 z-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      )}

      <video
        ref={videoRef}
        className={className}
        muted={muted}
        controls={controls}
        autoPlay={autoPlay}
        loop={loop}
        poster={poster}
        playsInline
        webkit-playsinline=""
        preload="metadata"
        crossOrigin="anonymous"
        onError={handleError}
        onLoadStart={handleLoadStart}
        onLoadedData={handleLoadedData}
        onCanPlay={handleCanPlay}
        style={{
          WebkitTransform: 'translateZ(0)',
          WebkitBackfaceVisibility: 'hidden',
          WebkitPerspective: 1000,
        }}
        src={src}
      >
        {/* Fallback message */}
        <p className="text-gray-500 p-4 text-center">
          Dein Browser unterstützt dieses Videoformat nicht. 
          <br />
          Versuche es mit einem modernen Browser oder lade das Video als MP4 hoch.
        </p>
      </video>
    </div>
  );
};

export default RobustVideoPlayer;