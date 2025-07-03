import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, orderBy, limit, onSnapshot, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../config/firebase';
import { MediaItem } from '../types';

interface MinimalGalleryOptions {
  galleryId: string;
  enabled?: boolean;
}

interface MinimalGalleryReturn {
  mediaItems: MediaItem[];
  isLoading: boolean;
  refresh: () => void;
}

/**
 * Minimal gallery hook that loads only 1 media item instantly
 * for the fastest possible initial gallery load time
 */
export const useMinimalGallery = ({
  galleryId,
  enabled = true
}: MinimalGalleryOptions): MinimalGalleryReturn => {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Load only 1 media item for instant display
  const loadMinimalMedia = useCallback(async () => {
    if (!galleryId || !enabled) return;

    setIsLoading(true);
    console.log('⚡ MINIMAL: Loading 1 media item for instant gallery...');

    try {
      // Clean up previous subscription
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }

      const mediaQuery = query(
        collection(db, `galleries/${galleryId}/media`),
        orderBy('timestamp', 'desc'),
        limit(1) // Only 1 item for instant load
      );

      const unsubscribe = onSnapshot(mediaQuery, (snapshot: QuerySnapshot<DocumentData>) => {
        const media: MediaItem[] = [];
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          media.push({
            id: doc.id,
            type: data.type || 'image',
            url: data.url,
            createdAt: data.timestamp || data.createdAt,
            deviceId: data.deviceId,
            userName: data.userName,
            tags: data.tags || [],
            location: data.location
          });
        });

        setMediaItems(media);
        setIsLoading(false);

        console.log(`⚡ MINIMAL: Loaded ${media.length} media item instantly`);
      });

      unsubscribeRef.current = unsubscribe;

    } catch (error) {
      console.error('❌ Error loading minimal media:', error);
      setIsLoading(false);
    }
  }, [galleryId, enabled]);

  // Refresh gallery
  const refresh = useCallback(() => {
    setMediaItems([]);
    loadMinimalMedia();
  }, [loadMinimalMedia]);

  // Initialize
  useEffect(() => {
    if (enabled && galleryId) {
      loadMinimalMedia();
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [galleryId, enabled, loadMinimalMedia]);

  return {
    mediaItems,
    isLoading,
    refresh
  };
};