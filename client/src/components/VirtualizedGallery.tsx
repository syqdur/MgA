import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MediaItem, Comment, Like } from '../types';

interface VirtualizedGalleryProps {
  items: MediaItem[];
  onItemClick: (index: number) => void;
  comments: Comment[];
  likes: Like[];
  userName: string;
  isDarkMode: boolean;
  getUserAvatar?: (userName: string, deviceId?: string) => string | null;
  getUserDisplayName?: (userName: string, deviceId?: string) => string;
  deviceId: string;
  galleryTheme: 'hochzeit' | 'geburtstag' | 'urlaub' | 'eigenes';
  // Virtual scrolling props
  itemHeight?: number;
  overscan?: number;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

interface VirtualItem {
  index: number;
  item: MediaItem;
  isVisible: boolean;
}

export const VirtualizedGallery: React.FC<VirtualizedGalleryProps> = ({
  items,
  onItemClick,
  comments,
  likes,
  userName,
  isDarkMode,
  getUserAvatar,
  getUserDisplayName,
  deviceId,
  galleryTheme,
  itemHeight = 400, // Approximate height per item
  overscan = 3, // Keep 3 items above/below visible area
  onLoadMore,
  hasMore,
  isLoadingMore
}) => {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 10 });
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver>();

  // Calculate which items should be visible
  const updateVisibleRange = useCallback(() => {
    if (!containerRef.current) return;

    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const viewportHeight = window.innerHeight;
    
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length - 1,
      Math.floor((scrollTop + viewportHeight) / itemHeight) + overscan
    );

    setVisibleRange({ start: startIndex, end: endIndex });
    setScrollTop(scrollTop);

    // Trigger load more when near bottom
    if (onLoadMore && hasMore && !isLoadingMore) {
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = document.documentElement.clientHeight;
      
      if (scrollHeight - scrollTop <= clientHeight + 200) {
        onLoadMore();
      }
    }
  }, [items.length, itemHeight, overscan, onLoadMore, hasMore, isLoadingMore]);

  // Set up scroll listener
  useEffect(() => {
    const handleScroll = () => {
      requestAnimationFrame(updateVisibleRange);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    
    // Initial calculation
    updateVisibleRange();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [updateVisibleRange]);

  // Set up intersection observer for lazy loading images
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const img = entry.target as HTMLImageElement;
          if (entry.isIntersecting && img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            observerRef.current?.unobserve(img);
          }
        });
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  // Create virtual items array with only visible items
  const virtualItems: VirtualItem[] = [];
  for (let i = visibleRange.start; i <= visibleRange.end && i < items.length; i++) {
    virtualItems.push({
      index: i,
      item: items[i],
      isVisible: true
    });
  }

  const totalHeight = items.length * itemHeight;
  const offsetY = visibleRange.start * itemHeight;

  return (
    <div ref={containerRef} className="relative">
      {/* Virtual container with total height for scrollbar */}
      <div style={{ height: totalHeight }} className="relative">
        {/* Visible items container */}
        <div 
          style={{ 
            transform: `translateY(${offsetY}px)`,
            position: 'relative'
          }}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1 sm:gap-2 px-2 sm:px-3">
            {virtualItems.map(({ index, item }) => {
              const itemLikes = likes.filter(l => l.mediaId === item.id);
              const itemComments = comments.filter(c => c.mediaId === item.id);
              
              return (
                <VirtualMediaItem
                  key={`${item.id}-${index}`}
                  item={item}
                  index={index}
                  onItemClick={onItemClick}
                  likes={itemLikes}
                  comments={itemComments}
                  isDarkMode={isDarkMode}
                  observer={observerRef.current}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Loading indicator */}
      {isLoadingMore && (
        <div className={`text-center py-8 transition-colors duration-300 ${
          isDarkMode ? 'text-gray-400' : 'text-gray-500'
        }`}>
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-t-transparent border-current"></div>
          <p className="mt-2">Lade weitere Bilder...</p>
        </div>
      )}

      {/* End of content indicator */}
      {!hasMore && items.length > 0 && (
        <div className={`text-center py-6 text-sm transition-colors duration-300 ${
          isDarkMode ? 'text-gray-500' : 'text-gray-400'
        }`}>
          🎉 Alle Bilder geladen!
        </div>
      )}
    </div>
  );
};

// Individual media item component with lazy loading
interface VirtualMediaItemProps {
  item: MediaItem;
  index: number;
  onItemClick: (index: number) => void;
  likes: any[];
  comments: any[];
  isDarkMode: boolean;
  observer?: IntersectionObserver;
}

const VirtualMediaItem: React.FC<VirtualMediaItemProps> = ({
  item,
  index,
  onItemClick,
  likes,
  comments,
  isDarkMode,
  observer
}) => {
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const imgElement = imgRef.current;
    if (imgElement && observer) {
      observer.observe(imgElement);
    }

    return () => {
      if (imgElement && observer) {
        observer.unobserve(imgElement);
      }
    };
  }, [observer]);

  return (
    <div
      className="relative aspect-square cursor-pointer group touch-manipulation"
      onClick={() => onItemClick(index)}
      style={{ minHeight: '120px' }}
    >
      {/* Media Content */}
      <div className="w-full h-full overflow-hidden rounded-lg">
        {item.type === 'video' ? (
          <div className="relative w-full h-full">
            <video
              data-src={item.url}
              className="w-full h-full object-cover"
              muted
              preload="none"
            />
            {/* Video indicator */}
            <div className="absolute top-2 right-2 bg-black/60 rounded-full p-1">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        ) : (
          <img
            ref={imgRef}
            data-src={item.url}
            alt={item.noteText || item.note || 'Gallery image'}
            className="w-full h-full object-cover transition-opacity duration-200"
            loading="lazy"
            style={{ 
              backgroundColor: isDarkMode ? '#374151' : '#f3f4f6',
              opacity: 0
            }}
            onLoad={(e) => {
              const img = e.target as HTMLImageElement;
              img.style.opacity = '1';
            }}
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              img.style.opacity = '0.5';
            }}
          />
        )}
      </div>
      
      {/* Overlay with stats */}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="flex items-center justify-center gap-2 sm:gap-4 text-xs sm:text-sm font-medium">
            <span className="flex items-center gap-1 bg-black/30 px-2 py-1 rounded-full">
              <span>❤️</span>
              {likes.length}
            </span>
            <span className="flex items-center gap-1 bg-black/30 px-2 py-1 rounded-full">
              <span>💬</span>
              {comments.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};