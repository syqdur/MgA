import { useState, useEffect, useRef } from 'react';
import { MediaItem, Comment, Like } from '../types';
import { UserProfile } from '../services/firebaseService';
import { 
  loadGalleryComments, 
  loadGalleryLikes,
  loadGalleryUserProfiles,
  getGalleryUsers
} from '../services/galleryFirebaseService';
import { preloadProfiles, clearProfileCache } from '../utils/profileCache';
import { useInfiniteMediaLoading } from './useInfiniteMediaLoading';

interface UseSimpleGalleryOptions {
  galleryId: string;
  userName: string;
  deviceId: string;
  enableVirtualScrolling?: boolean;
}

interface UseSimpleGalleryReturn {
  // Data
  mediaItems: MediaItem[];
  comments: Comment[];
  likes: Like[];
  userProfiles: UserProfile[];
  galleryUsers: any[];
  
  // Loading states
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  
  // Actions
  loadMore: () => void;
  refresh: () => Promise<void>;
}

export const useSimpleGallery = ({
  galleryId,
  userName,
  deviceId
}: UseSimpleGalleryOptions): UseSimpleGalleryReturn => {
  // Use the new infinite media loading hook
  const {
    mediaItems,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    refresh: refreshMedia
  } = useInfiniteMediaLoading({
    galleryId,
    pageSize: 1, // 🚀 INSTANT: Load only 1 image for sub-second gallery display
    enabled: !!galleryId
  });

  // State for other data
  const [comments, setComments] = useState<Comment[]>([]);
  const [likes, setLikes] = useState<Like[]>([]);
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>([]);
  const [galleryUsers, setGalleryUsers] = useState<any[]>([]);
  
  // Refs for cleanup
  const unsubscribersRef = useRef<(() => void)[]>([]);

  // 🚀 DEFERRED: Load additional data AFTER media is displayed (1 second delay)
  useEffect(() => {
    if (!galleryId) return;

    // Clear previous gallery cache and subscriptions
    clearProfileCache(galleryId);
    unsubscribersRef.current.forEach(unsubscribe => unsubscribe());
    unsubscribersRef.current = [];
    
    // 🚀 PERFORMANCE: Defer heavy data loading for instant gallery display
    const deferredTimer = setTimeout(() => {
      console.log('🔄 Loading secondary data after media display...');
      
      // Load comments
      const commentsUnsubscribe = loadGalleryComments(galleryId, setComments);
      unsubscribersRef.current.push(commentsUnsubscribe);
      
      // Load likes
      const likesUnsubscribe = loadGalleryLikes(galleryId, setLikes);
      unsubscribersRef.current.push(likesUnsubscribe);
      
      // Load user profiles with caching
      const profilesUnsubscribe = loadGalleryUserProfiles(galleryId, (profiles) => {
        // Cache profiles for faster access
        const profilesForCache = profiles.map(p => ({
          deviceId: p.deviceId,
          userName: p.userName,
          displayName: p.displayName,
          profilePicture: p.profilePicture
        }));
        preloadProfiles(galleryId, profilesForCache);
        setUserProfiles(profiles);
      });
      unsubscribersRef.current.push(profilesUnsubscribe);
      
      // Load gallery users (not real-time)
      const loadUsers = async () => {
        try {
          const users = await getGalleryUsers(galleryId);
          setGalleryUsers(users);
        } catch (error) {
          console.error('Error loading gallery users:', error);
        }
      };
      
      loadUsers();
    }, 1000); // Delay 1 second for instant gallery display
    
    return () => {
      clearTimeout(deferredTimer);
    };

    return () => {
      unsubscribersRef.current.forEach(unsubscribe => unsubscribe());
    };
  }, [galleryId]);

  // Refresh all data
  const refresh = async () => {
    await refreshMedia();
    
    // Refresh gallery users
    try {
      const users = await getGalleryUsers(galleryId);
      setGalleryUsers(users);
    } catch (error) {
      console.error('Error refreshing gallery users:', error);
    }
  };

  return {
    mediaItems,
    comments,
    likes,
    userProfiles,
    galleryUsers,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    refresh
  };
};