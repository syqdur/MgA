import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, orderBy, limit, startAfter, onSnapshot, DocumentSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { MediaItem } from '../types';

interface UseInfiniteMediaLoadingOptions {
  galleryId: string;
  pageSize?: number;
  enabled?: boolean;
}

interface UseInfiniteMediaLoadingReturn {
  mediaItems: MediaItem[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
  error: string | null;
}

export const useInfiniteMediaLoading = ({
  galleryId,
  pageSize = 12, // Load 12 items per page - good balance for mobile and desktop
  enabled = true
}: UseInfiniteMediaLoadingOptions): UseInfiniteMediaLoadingReturn => {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastDocRef = useRef<DocumentSnapshot | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const processMediaItem = useCallback((docSnap: any): MediaItem => {
    const data = docSnap.data();
    let url = '';
    
    if (data.type !== 'note') {
      // Smart fallback: Prefer mediaUrl, use base64 only if necessary
      if (data.mediaUrl) {
        url = data.mediaUrl;
      } else if (data.base64Data) {
        url = data.base64Data;
      }
    }
    
    return {
      id: docSnap.id,
      name: data.name,
      url: url,
      uploadedBy: data.uploadedBy,
      uploadedAt: data.uploadedAt,
      deviceId: data.deviceId,
      type: data.type,
      noteText: data.noteText,
      note: data.note,
      tags: data.tags || [],
      isUnavailable: !url && data.type !== 'note'
    };
  }, []);

  const loadInitialMedia = useCallback(() => {
    if (!enabled || !galleryId) return;

    setIsLoading(true);
    setError(null);

    // Clean up previous subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    const mediaCollection = `galleries/${galleryId}/media`;
    const q = query(
      collection(db, mediaCollection),
      orderBy('uploadedAt', 'desc'),
      limit(pageSize)
    );

    console.log(`📱 Loading initial ${pageSize} media items...`);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        const items = snapshot.docs.map(processMediaItem);
        setMediaItems(items);
        
        // Set up for next page
        if (snapshot.docs.length > 0) {
          lastDocRef.current = snapshot.docs[snapshot.docs.length - 1];
          setHasMore(snapshot.docs.length === pageSize);
        } else {
          lastDocRef.current = null;
          setHasMore(false);
        }

        console.log(`✅ Loaded ${items.length} initial media items`);
      } catch (err) {
        console.error('❌ Error processing initial media:', err);
        setError('Fehler beim Laden der Medien');
      } finally {
        setIsLoading(false);
      }
    }, (err) => {
      console.error('❌ Firebase error during initial load:', err);
      setError('Verbindungsfehler beim Laden der Galerie');
      setIsLoading(false);
    });

    unsubscribeRef.current = unsubscribe;
  }, [galleryId, pageSize, enabled, processMediaItem]);

  const loadMore = useCallback(async () => {
    if (!enabled || isLoadingMore || !hasMore || !lastDocRef.current) return;

    setIsLoadingMore(true);

    try {
      const mediaCollection = `galleries/${galleryId}/media`;
      const q = query(
        collection(db, mediaCollection),
        orderBy('uploadedAt', 'desc'),
        startAfter(lastDocRef.current),
        limit(pageSize)
      );

      console.log(`📱 Loading next ${pageSize} media items...`);

      // Use get() instead of onSnapshot for pagination to avoid conflicts
      const { getDocs } = await import('firebase/firestore');
      const snapshot = await getDocs(q);
      
      if (snapshot.docs.length > 0) {
        const newItems = snapshot.docs.map(processMediaItem);
        
        setMediaItems(prev => {
          // Prevent duplicates by checking IDs
          const existingIds = new Set(prev.map(item => item.id));
          const uniqueNewItems = newItems.filter(item => !existingIds.has(item.id));
          return [...prev, ...uniqueNewItems];
        });

        // Update pagination state
        lastDocRef.current = snapshot.docs[snapshot.docs.length - 1];
        setHasMore(snapshot.docs.length === pageSize);

        console.log(`✅ Loaded ${newItems.length} additional media items`);
      } else {
        setHasMore(false);
        console.log('📱 No more media items to load');
      }
    } catch (err) {
      console.error('❌ Error loading more media:', err);
      setError('Fehler beim Laden weiterer Medien');
    } finally {
      setIsLoadingMore(false);
    }
  }, [galleryId, pageSize, enabled, isLoadingMore, hasMore, processMediaItem]);

  const refresh = useCallback(() => {
    setMediaItems([]);
    lastDocRef.current = null;
    setHasMore(true);
    setError(null);
    loadInitialMedia();
  }, [loadInitialMedia]);

  // Load initial media when hook is mounted or dependencies change
  useEffect(() => {
    loadInitialMedia();

    // Cleanup subscription on unmount
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [loadInitialMedia]);

  return {
    mediaItems,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    refresh,
    error
  };
};