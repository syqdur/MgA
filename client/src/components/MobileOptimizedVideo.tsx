import React, { useState, useRef, useEffect } from 'react';
import { Play } from 'lucide-react';

interface MobileOptimizedVideoProps {
  src: string;
  className?: string;
  muted?: boolean;
  poster?: string;
  controls?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  previewMode?: boolean;
  showThumbnail?: boolean;
  onThumbnailGenerated?: (thumbnail: string) => void;
}

const MobileOptimizedVideo: React.FC<MobileOptimizedVideoProps> = ({
  src,
  className = "w-full h-full object-cover",
  muted = true,
  poster = "",
  controls = false,
  autoPlay = false,
  loop = false,
  previewMode = false,
  showThumbnail = false,
  onThumbnailGenerated
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [thumbnail, setThumbnail] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Generate thumbnail from video
  const generateThumbnail = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // Set canvas dimensions to match video
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;
        
        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert to base64 image
        const thumbnailData = canvas.toDataURL('image/jpeg', 0.8);
        setThumbnail(thumbnailData);
        
        // Call callback if provided
        if (onThumbnailGenerated) {
          onThumbnailGenerated(thumbnailData);
        }
      }
    }
  };

  // Generate thumbnail when video metadata loads
  useEffect(() => {
    if (showThumbnail && videoRef.current) {
      const video = videoRef.current;
      
      const handleLoadedMetadata = () => {
        // Set video to a small time position to get a meaningful frame
        video.currentTime = 0.1;
      };
      
      const handleSeeked = () => {
        generateThumbnail();
      };
      
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('seeked', handleSeeked);
      
      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('seeked', handleSeeked);
      };
    }
  }, [showThumbnail, src]);

  const handlePlayClick = () => {
    if (videoRef.current) {
      setHasStarted(true);
      setIsPlaying(true);
      videoRef.current.play();
    }
  };

  const handleVideoClick = () => {
    if (videoRef.current && hasStarted) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  return (
    <div className="relative w-full h-full">
      {/* Hidden canvas for thumbnail generation */}
      <canvas
        ref={canvasRef}
        style={{ display: 'none' }}
      />
      
      {/* Show thumbnail if available and not playing */}
      {showThumbnail && thumbnail && !hasStarted && (
        <img
          src={thumbnail}
          alt="Video thumbnail"
          className={className}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
        />
      )}
      
      <video
        ref={videoRef}
        // Only set src when video should start loading OR when generating thumbnail
        src={(hasStarted || showThumbnail) ? src : undefined}
        className={className}
        muted={muted}
        playsInline
        webkit-playsinline=""
        x-webkit-airplay="allow"
        // For thumbnail generation, preload metadata; otherwise none
        preload={showThumbnail ? "metadata" : "none"}
        poster={poster}
        controls={hasStarted && controls}
        loop={loop}
        // Critical mobile video attributes
        data-object-fit="cover"
        controlsList="nodownload nofullscreen"
        // iOS specific attributes for proper rendering
        style={{
          WebkitTransform: 'translateZ(0)',
          WebkitBackfaceVisibility: 'hidden',
          WebkitPerspective: 1000,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          // Hide video element if showing thumbnail
          display: (showThumbnail && thumbnail && !hasStarted) ? 'none' : 'block'
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onClick={handleVideoClick}
        onLoadedMetadata={() => {
          if (showThumbnail && !hasStarted) {
            // For thumbnail mode, force metadata preload
            videoRef.current?.load();
          }
        }}
      />
      
      {/* Play button overlay - only show if video hasn't started or is paused */}
      {(!hasStarted || !isPlaying) && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm cursor-pointer transition-opacity duration-300 hover:bg-black/30"
          onClick={handlePlayClick}
        >
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
};

export default MobileOptimizedVideo;