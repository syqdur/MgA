import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import { useInView } from 'react-intersection-observer';
import { Heart, MessageCircle, MapPin, User, Calendar } from 'lucide-react';
import { MediaItem, Comment, Like } from '../types';
import { UserProfile } from '../services/firebaseService';
import { MediaModal } from './MediaModal';
import MobileOptimizedVideo from './MobileOptimizedVideo';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

interface VirtualizedGalleryProps {
  mediaItems: MediaItem[];
  comments: Comment[];
  likes: Like[];
  userProfiles: UserProfile[];
  onLike: (mediaId: string) => void;
  onComment: (mediaId: string, comment: string) => void;
  onDelete: (mediaId: string) => void;
  currentUser?: string;
  deviceId?: string;
  isAdmin?: boolean;
  galleryId: string;
}

interface CellData {
  mediaItems: MediaItem[];
  comments: Comment[];
  likes: Like[];
  userProfiles: UserProfile[];
  onLike: (mediaId: string) => void;
  onComment: (mediaId: string, comment: string) => void;
  onDelete: (mediaId: string) => void;
  currentUser?: string;
  deviceId?: string;
  isAdmin?: boolean;
  galleryId: string;
  columnCount: number;
  onMediaClick: (media: MediaItem) => void;
}

const MediaCell = React.memo(({ columnIndex, rowIndex, style, data }: {
  columnIndex: number;
  rowIndex: number;
  style: React.CSSProperties;
  data: CellData;
}) => {
  const {
    mediaItems,
    comments,
    likes,
    userProfiles,
    onLike,
    columnCount,
    onMediaClick,
    currentUser,
    deviceId
  } = data;

  const index = rowIndex * columnCount + columnIndex;
  const media = mediaItems[index];

  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true,
    rootMargin: '50px'
  });

  if (!media) {
    return <div style={style} />;
  }

  const mediaLikes = likes.filter(like => like.mediaId === media.id);
  const mediaComments = comments.filter(comment => comment.mediaId === media.id);
  const isLiked = mediaLikes.some(like => like.deviceId === deviceId);
  
  const author = userProfiles.find(p => p.deviceId === media.deviceId);
  const displayName = author?.displayName || author?.userName || 'Unknown';

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    onLike(media.id);
  };

  const handleClick = () => {
    onMediaClick(media);
  };

  return (
    <div
      ref={ref}
      style={style}
      className="p-1"
      onClick={handleClick}
    >
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow">
        {/* Media Content */}
        <div className="aspect-square relative">
          {inView ? (
            <>
              {media.type === 'image' ? (
                <img
                  src={media.url}
                  alt="Gallery media"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <MobileOptimizedVideo
                  src={media.url}
                  className="w-full h-full object-cover"
                  showThumbnail={true}
                  controls={false}
                  muted={true}
                  poster=""
                />
              )}
              
              {/* Overlay with quick actions */}
              <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-20 transition-all duration-200 flex items-end">
                <div className="p-2 w-full">
                  <div className="flex items-center justify-between text-white">
                    <span className="text-xs font-medium truncate">{displayName}</span>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={handleLike}
                        className="flex items-center space-x-1 text-xs"
                      >
                        <Heart
                          className={`w-4 h-4 ${isLiked ? 'fill-red-500 text-red-500' : 'text-white'}`}
                        />
                        <span>{mediaLikes.length}</span>
                      </button>
                      <div className="flex items-center space-x-1 text-xs">
                        <MessageCircle className="w-4 h-4" />
                        <span>{mediaComments.length}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="w-full h-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
});

export const VirtualizedGallery: React.FC<VirtualizedGalleryProps> = ({
  mediaItems,
  comments,
  likes,
  userProfiles,
  onLike,
  onComment,
  onDelete,
  currentUser,
  deviceId,
  isAdmin,
  galleryId
}) => {
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate responsive grid dimensions
  const columnCount = useMemo(() => {
    if (containerSize.width < 640) return 2; // Mobile: 2 columns
    if (containerSize.width < 1024) return 3; // Tablet: 3 columns
    return 4; // Desktop: 4 columns
  }, [containerSize.width]);

  const cellSize = useMemo(() => {
    const padding = 16; // Account for padding
    const gap = 8; // Gap between items
    return Math.floor((containerSize.width - padding * 2 - gap * (columnCount - 1)) / columnCount);
  }, [containerSize.width, columnCount]);

  const rowCount = Math.ceil(mediaItems.length / columnCount);

  // Handle container resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setContainerSize({ width, height });
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMediaClick = useCallback((media: MediaItem) => {
    setSelectedMedia(media);
  }, []);

  const cellData: CellData = useMemo(() => ({
    mediaItems,
    comments,
    likes,
    userProfiles,
    onLike,
    onComment,
    onDelete,
    currentUser,
    deviceId,
    isAdmin,
    galleryId,
    columnCount,
    onMediaClick: handleMediaClick
  }), [
    mediaItems,
    comments,
    likes,
    userProfiles,
    onLike,
    onComment,
    onDelete,
    currentUser,
    deviceId,
    isAdmin,
    galleryId,
    columnCount,
    handleMediaClick
  ]);

  if (containerSize.width === 0) {
    return (
      <div ref={containerRef} className="w-full h-full">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full">
      {mediaItems.length > 0 ? (
        <Grid
          columnCount={columnCount}
          columnWidth={cellSize}
          height={containerSize.height}
          rowCount={rowCount}
          rowHeight={cellSize}
          width={containerSize.width}
          itemData={cellData}
          overscanRowCount={2}
          overscanColumnCount={1}
        >
          {MediaCell}
        </Grid>
      ) : (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
          <div className="text-4xl mb-4">📸</div>
          <p className="text-lg font-medium">Noch keine Bilder</p>
          <p className="text-sm">Teile deine ersten Momente!</p>
        </div>
      )}

      {/* TODO: MediaModal interface mismatch - needs to be updated to match current MediaModal props */}
      {/* Media Modal */}
      {/* {selectedMedia && (
        <MediaModal
          media={selectedMedia}
          isOpen={!!selectedMedia}
          onClose={() => setSelectedMedia(null)}
          comments={comments.filter(c => c.mediaId === selectedMedia.id)}
          likes={likes.filter(l => l.mediaId === selectedMedia.id)}
          userProfiles={userProfiles}
          onLike={onLike}
          onComment={onComment}
          onDelete={onDelete}
          currentUser={currentUser || ''}
          deviceId={deviceId || ''}
          isAdmin={isAdmin || false}
          galleryId={galleryId}
        />
      )} */}
    </div>
  );
};