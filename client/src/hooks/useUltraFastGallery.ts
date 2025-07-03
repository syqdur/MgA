import { useState, useEffect, useCallback, useRef } from 'react';
import { MediaItem, Comment, Like } from '../types';
import { UserProfile } from '../services/firebaseService';
import { collection, query, limit, onSnapshot, orderBy, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../config/firebase';

interface UltraFastGalleryOptions {
  galleryId: string;
  enabled?: boolean;
}

interface UltraFastGalleryReturn {
  mediaItems: MediaItem[];
  isLoading: boolean;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
  // Secondary data loaded in background
  comments: Comment[];
  likes: Like[];
  userProfiles: UserProfile[];
}

/**
 * Ultra-fast gallery hook that loads only the minimum data needed for initial render
 * then progressively loads more data in the background
 */
export const useUltraFastGallery = ({
  galleryId,
  enabled = true
}: UltraFastGalleryOptions): UltraFastGalleryReturn => {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [likes, setLikes] = useState<Like[]>([]);
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  
  const unsubscribersRef = useRef<(() => void)[]>([]);
  const lastVisibleRef = useRef<any>(null);
  const loadedCountRef = useRef(0);

  // Ultra-fast initial load - only first 3 media items
  const loadInitialMedia = useCallback(async () => {
    if (!galleryId || !enabled) return;

    setIsLoading(true);
    console.log('🚀 ULTRA-FAST: Loading first 3 media items...');

    try {
      // Clean up previous subscriptions
      unsubscribersRef.current.forEach(unsubscribe => unsubscribe());
      unsubscribersRef.current = [];

      const mediaQuery = query(
        collection(db, `galleries/${galleryId}/media`),
        orderBy('timestamp', 'desc'),
        limit(3) // Only 3 items for instant load
      );

      const unsubscribe = onSnapshot(mediaQuery, (snapshot: QuerySnapshot<DocumentData>) => {
        const media: MediaItem[] = [];
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          media.push({
            id: doc.id,
            type: data.type || 'image',
            url: data.url,
            timestamp: data.timestamp,
            deviceId: data.deviceId,
            userName: data.userName,
            tags: data.tags || [],
            location: data.location
          });
        });

        setMediaItems(media);
        setIsLoading(false);
        loadedCountRef.current = media.length;
        lastVisibleRef.current = snapshot.docs[snapshot.docs.length - 1];
        setHasMore(media.length === 3);

        console.log(`🚀 ULTRA-FAST: Loaded ${media.length} media items instantly`);
      });

      unsubscribersRef.current.push(unsubscribe);

      // Load secondary data in background after initial render
      setTimeout(() => {
        loadSecondaryData();
      }, 100);

    } catch (error) {
      console.error('❌ Error loading initial media:', error);
      setIsLoading(false);
    }
  }, [galleryId, enabled]);

  // Load comments, likes, and user profiles in background
  const loadSecondaryData = useCallback(() => {
    if (!galleryId) return;

    console.log('🔄 Loading secondary data in background...');

    // Load comments
    const commentsQuery = query(collection(db, `galleries/${galleryId}/comments`));
    const commentsUnsubscribe = onSnapshot(commentsQuery, (snapshot) => {
      const commentsData: Comment[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        commentsData.push({
          id: doc.id,
          mediaId: data.mediaId,
          text: data.text,
          userName: data.userName,
          deviceId: data.deviceId,
          timestamp: data.timestamp
        });
      });
      setComments(commentsData);
    });

    // Load likes
    const likesQuery = query(collection(db, `galleries/${galleryId}/likes`));
    const likesUnsubscribe = onSnapshot(likesQuery, (snapshot) => {
      const likesData: Like[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        likesData.push({
          id: doc.id,
          mediaId: data.mediaId,
          userName: data.userName,
          deviceId: data.deviceId,
          timestamp: data.timestamp
        });
      });
      setLikes(likesData);
    });

    // Load user profiles
    const profilesQuery = query(collection(db, `galleries/${galleryId}/userProfiles`));
    const profilesUnsubscribe = onSnapshot(profilesQuery, (snapshot) => {
      const profilesData: UserProfile[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        profilesData.push({
          deviceId: doc.id,
          userName: data.userName,
          displayName: data.displayName,
          profilePicture: data.profilePicture,
          lastSeen: data.lastSeen
        });
      });
      setUserProfiles(profilesData);
    });

    unsubscribersRef.current.push(commentsUnsubscribe, likesUnsubscribe, profilesUnsubscribe);
  }, [galleryId]);

  // Load more media items (pagination)
  const loadMore = useCallback(async () => {
    if (!galleryId || !hasMore || isLoading || !lastVisibleRef.current) return;

    setIsLoading(true);
    console.log('📱 Loading next 6 media items...');

    try {
      const nextQuery = query(
        collection(db, `galleries/${galleryId}/media`),
        orderBy('timestamp', 'desc'),
        limit(6), // Load 6 more items
        // startAfter(lastVisibleRef.current) // Continue from last item
      );

      const unsubscribe = onSnapshot(nextQuery, (snapshot: QuerySnapshot<DocumentData>) => {
        const newMedia: MediaItem[] = [];
        
        snapshot.forEach((doc, index) => {
          // Skip items we already have
          if (index < loadedCountRef.current) return;
          
          const data = doc.data();
          newMedia.push({
            id: doc.id,
            type: data.type || 'image',
            url: data.url,
            timestamp: data.timestamp,
            deviceId: data.deviceId,
            userName: data.userName,
            tags: data.tags || [],
            location: data.location
          });
        });

        if (newMedia.length > 0) {
          setMediaItems(prev => [...prev, ...newMedia]);
          loadedCountRef.current += newMedia.length;
          lastVisibleRef.current = snapshot.docs[snapshot.docs.length - 1];
        }

        setHasMore(newMedia.length === 6);
        setIsLoading(false);
        console.log(`📱 Loaded ${newMedia.length} additional media items`);
      });

      // Clean up old subscription and add new one
      unsubscribersRef.current = unsubscribersRef.current.filter((unsub, index) => {
        if (index === 0) { // First subscription is media
          unsub();
          return false;
        }
        return true;
      });
      unsubscribersRef.current.unshift(unsubscribe);

    } catch (error) {
      console.error('❌ Error loading more media:', error);
      setIsLoading(false);
    }
  }, [galleryId, hasMore, isLoading]);

  // Refresh gallery
  const refresh = useCallback(() => {
    setMediaItems([]);
    setComments([]);
    setLikes([]);
    setUserProfiles([]);
    lastVisibleRef.current = null;
    loadedCountRef.current = 0;
    setHasMore(true);
    loadInitialMedia();
  }, [loadInitialMedia]);

  // Initialize
  useEffect(() => {
    if (enabled && galleryId) {
      loadInitialMedia();
    }

    return () => {
      unsubscribersRef.current.forEach(unsubscribe => unsubscribe());
      unsubscribersRef.current = [];
    };
  }, [galleryId, enabled, loadInitialMedia]);

  return {
    mediaItems,
    isLoading,
    hasMore,
    loadMore,
    refresh,
    comments,
    likes,
    userProfiles
  };
};