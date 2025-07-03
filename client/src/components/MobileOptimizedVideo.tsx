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
      
      console.log('📹 Video state:', {
        readyState: video.readyState,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        currentTime: video.currentTime,
        duration: video.duration,
        paused: video.paused,
        ended: video.ended
      });
      
      if (ctx && video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= 2) {
        console.log(`📹 Generating thumbnail: ${video.videoWidth}x${video.videoHeight}`);
        
        // Use reasonable canvas dimensions to avoid memory issues
        const maxSize = 640;
        const aspectRatio = video.videoHeight / video.videoWidth;
        let canvasWidth = Math.min(video.videoWidth, maxSize);
        let canvasHeight = Math.min(video.videoHeight, maxSize);
        
        if (video.videoWidth > video.videoHeight) {
          canvasHeight = canvasWidth * aspectRatio;
        } else {
          canvasWidth = canvasHeight / aspectRatio;
        }
        
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        try {
          // Clear canvas first
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Draw video frame to canvas
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Test if canvas has actual image data
          const imageData = ctx.getImageData(0, 0, Math.min(10, canvas.width), Math.min(10, canvas.height));
          const hasData = imageData.data.some(pixel => pixel !== 0);
          
          if (!hasData) {
            console.error('❌ Canvas contains no image data');
            return;
          }
          
          // Convert to base64 image
          const thumbnailData = canvas.toDataURL('image/jpeg', 0.8);
          
          // Validate that we actually got image data
          if (thumbnailData && thumbnailData.length > 1000 && !thumbnailData.includes('data:,')) {
            console.log('✅ Thumbnail generated successfully', thumbnailData.substring(0, 50) + '...');
            setThumbnail(thumbnailData);
            
            // Call callback if provided
            if (onThumbnailGenerated) {
              onThumbnailGenerated(thumbnailData);
            }
          } else {
            console.error('❌ Generated thumbnail data is invalid or too small');
          }
        } catch (error) {
          console.error('❌ Error generating thumbnail:', error);
          // Fallback: try again with a slight delay
          setTimeout(() => {
            if (!thumbnail && video.readyState >= 2) {
              console.log('🔄 Retrying thumbnail generation...');
              generateThumbnail();
            }
          }, 500);
        }
      } else {
        console.warn('⚠️ Cannot generate thumbnail:', {
          hasContext: !!ctx,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          readyState: video.readyState
        });
      }
    }
  };

  // Generate thumbnail when component mounts and video is ready
  useEffect(() => {
    if (showThumbnail && videoRef.current && src && !thumbnail) {
      const video = videoRef.current;
      console.log('📹 Setting up thumbnail generation for video:', src);
      
      // Force load the video if not already loading
      if (video.readyState === 0) {
        console.log('📹 Loading video for thumbnail generation...');
        video.load();
      } else if (video.readyState >= 1) {
        // Metadata already loaded, can proceed
        console.log('📹 Video metadata already available, proceeding with thumbnail');
        video.currentTime = 0.1;
      }
    }
  }, [showThumbnail, src, thumbnail]);

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
        // Always set src for thumbnail generation
        src={src}
        className={className}
        muted={muted}
        playsInline
        webkit-playsinline=""
        x-webkit-airplay="allow"
        // Always preload metadata for thumbnail generation
        preload="metadata"
        poster={poster}
        controls={hasStarted && controls}
        loop={loop}
        // Enable CORS for canvas drawing
        crossOrigin="anonymous"
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
          console.log('📹 Video onLoadedMetadata triggered');
          if (showThumbnail && videoRef.current) {
            const video = videoRef.current;
            console.log(`📹 Video ready for thumbnail: ${video.videoWidth}x${video.videoHeight}, duration: ${video.duration}`);
            // Seek to 0.5 seconds to get a more meaningful frame
            video.currentTime = 0.5;
          }
        }}
        onSeeked={() => {
          console.log('📹 Video seeked, generating thumbnail');
          if (showThumbnail && !thumbnail) {
            // Add a small delay to ensure the frame is properly rendered
            setTimeout(() => {
              generateThumbnail();
            }, 100);
          }
        }}
        onError={(e) => {
          console.error('📹 Video error:', e);
        }}
        onLoadStart={() => {
          console.log('📹 Video load started');
        }}
        onLoadedData={() => {
          console.log('📹 Video data loaded');
        }}
        onCanPlay={() => {
          console.log('📹 Video can play - ready for thumbnail generation');
          if (showThumbnail && !thumbnail && videoRef.current) {
            // Fallback thumbnail generation if seeking doesn't work
            setTimeout(() => {
              if (!thumbnail) {
                generateThumbnail();
              }
            }, 300);
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