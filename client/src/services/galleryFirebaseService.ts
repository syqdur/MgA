// Firebase Storage for proper video file uploads
import { db, storage } from '../config/firebase';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  where,
  getDocs,
  updateDoc,
  getDoc,
  limit,
  startAfter
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { MediaItem, Comment, Like, ProfileData, MediaTag, LocationTag } from '../types';
import { UserProfile } from './firebaseService';
import { compressImage, compressVideo, shouldCompress } from '../utils/imageCompression';

// Gallery Stories Types
export interface Story {
  id: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  userName: string;
  deviceId: string;
  createdAt: string;
  expiresAt: string;
  views: string[]; // Array of user IDs who viewed this story
  fileName?: string; // For deletion from storage
  isStory?: boolean;
}

// Utility function to check if a user has been deleted
export const isUserDeleted = async (galleryId: string, deviceId: string): Promise<boolean> => {
  try {
    const kickSignalDoc = await getDoc(doc(db, `galleries/${galleryId}/kick_signals`, deviceId));
    if (kickSignalDoc.exists()) {
      const data = kickSignalDoc.data();
      return data.reason === 'deleted_by_admin' || data.reason === 'self_deleted' || 
             data.reason === 'bulk_deleted_by_admin' || data.reason === 'bulk_self_deleted';
    }
    return false;
  } catch (error) {
    console.warn('Error checking if user is deleted:', error);
    return false; // If we can't check, assume user is not deleted
  }
};

// 🚀 PERFORMANCE OPTIMIZED: Gallery-specific media loading with aggressive caching
export const loadGalleryMedia = (
  galleryId: string,
  setMediaItems: (items: MediaItem[]) => void,
  initialLimit: number = 8  // 🚀 OPTIMIZED: Load 8 items for good initial experience
): (() => void) => {
  const mediaCollection = `galleries/${galleryId}/media`;
  
  // 🚀 PERFORMANCE: Ultra minimal query
  const q = query(
    collection(db, mediaCollection), 
    orderBy('uploadedAt', 'desc'), 
    limit(initialLimit)
  );
  
  return onSnapshot(q, (snapshot) => {
    const startTime = performance.now();
    console.log(`🚀 Firebase callback: ${snapshot.docs.length} docs for gallery ${galleryId}`);
    
    // 🚀 CRITICAL: Even if no docs, immediately callback with empty array
    if (snapshot.docs.length === 0) {
      console.log('🚀 No media found, setting empty array immediately');
      setMediaItems([]);
      return;
    }
    
    // 🚀 PERFORMANCE: Process items with minimal processing
    const mediaList: MediaItem[] = snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      let url = '';
      
      if (data.type !== 'note') {
        // SMART FALLBACK: Prefer mediaUrl, use base64 only if necessary
        if (data.mediaUrl) {
          url = data.mediaUrl;
        } else if (data.base64Data) {
          url = data.base64Data; // Fallback for images without URLs
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
    });
    
    const endTime = performance.now();
    console.log(`🚀 Processed ${mediaList.length} items in ${Math.round(endTime - startTime)}ms`);
    
    // 🚀 PERFORMANCE: Set items immediately
    setMediaItems(mediaList);
  }, (error) => {
    console.error('🚀 Firebase error:', error);
    // 🚀 CRITICAL: Even on error, stop loading state
    setMediaItems([]);
  });
};

// Gallery-specific file upload
export const uploadGalleryFiles = async (
  files: FileList, 
  userName: string, 
  deviceId: string,
  galleryId: string,
  onProgress: (progress: number) => void,
  tags?: any[]
): Promise<void> => {
  let uploaded = 0;
  
  for (const file of Array.from(files)) {
    console.log(`📸 Processing media file: ${file.name} (${(file.size / 1024).toFixed(1)}KB)`);
    
    let processedFile = file;
    
    // Enhanced compression for Firebase document size limits
    const isVideo = file.type.startsWith('video/');
    
    let mediaUrl: string;
    let storageFileName: string | undefined;
    
    if (isVideo) {
      // Use Firebase Storage for videos (supports large files)
      console.log(`🎬 Uploading video to Firebase Storage...`);
      
      // Check reasonable video size limit (100MB)
      const maxVideoSizeForStorage = 100 * 1024 * 1024; // 100MB limit for videos
      if (file.size > maxVideoSizeForStorage) {
        throw new Error(`Video zu groß: ${(file.size / 1024 / 1024).toFixed(1)}MB (max. 100MB für Video-Upload)\n\nTipp: Verwende ein kürzeres Video oder reduziere die Qualität vor dem Upload.`);
      }
      
      // Upload to Firebase Storage
      storageFileName = `galleries/${galleryId}/videos/${Date.now()}-${file.name}`;
      const storageRef = ref(storage, storageFileName);
      
      try {
        const snapshot = await uploadBytes(storageRef, file);
        mediaUrl = await getDownloadURL(snapshot.ref);
        console.log(`✅ Video uploaded to Firebase Storage successfully (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      } catch (error: any) {
        console.error('Firebase Storage upload failed:', error);
        
        if (error?.code === 'storage/unauthorized') {
          throw new Error(`Video-Upload nicht möglich: Firebase Storage-Berechtigung fehlt.\n\nLösung: Bitte den Administrator kontaktieren, um Firebase Storage-Regeln zu aktualisieren.\n\nAlternativ: Verwende die Video-Aufnahme-Funktion der App für kleinere Videos.`);
        } else {
          throw new Error(`Video-Upload fehlgeschlagen: ${error?.message || 'Unbekannter Fehler'}\n\nBitte versuche es erneut oder verwende ein kleineres Video.`);
        }
      }
    } else if (file.type.startsWith('image/')) {
      // Use base64 for images (smaller files, better for comments/likes)
      if (shouldCompress(file)) {
        console.log(`🗜️ Compressing image file...`);
        try {
          processedFile = await compressImage(file, { targetSizeKB: 150, maxWidth: 1000, maxHeight: 800 });
          console.log(`✅ Image compression complete: ${(processedFile.size / 1024).toFixed(1)}KB`);
        } catch (error) {
          console.warn(`⚠️ Image compression failed, using original file:`, error);
          processedFile = file;
        }
      }
      
      // Convert to base64 for images
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(processedFile);
      });
      
      // Check base64 size
      const base64SizeKB = base64Data.length * 0.75 / 1024;
      const maxBase64Size = 800; // 800KB limit for images
      
      if (base64SizeKB > maxBase64Size) {
        throw new Error(`Bild zu groß für Firebase: ${base64SizeKB.toFixed(0)}KB (max. ${maxBase64Size}KB)\n\nTipp: Verwende ein kleineres Bild oder reduziere die Qualität`);
      }
      
      mediaUrl = base64Data;
      console.log(`✅ Image converted to base64 successfully (${base64SizeKB.toFixed(0)}KB)`);
    } else {
      throw new Error(`Dateityp nicht unterstützt: ${file.type}`);
    }
    
    // Add metadata to gallery-specific collection
    const mediaCollection = `galleries/${galleryId}/media`;
    const docRef = await addDoc(collection(db, mediaCollection), {
      name: `${Date.now()}-${file.name}`,
      uploadedBy: userName,
      deviceId: deviceId,
      uploadedAt: new Date().toISOString(),
      type: isVideo ? 'video' : 'image',
      mediaUrl: mediaUrl,
      size: file.size,
      mimeType: file.type,
      // FIXED: Store tags in correct format for gallery display
      textTags: tags?.filter(tag => tag.type === 'text') || [],
      personTags: tags?.filter(tag => tag.type === 'person' || tag.type === 'user') || [],
      locationTags: tags?.filter(tag => tag.type === 'location').map(tag => ({
        ...tag,
        locationName: (tag as any).name || (tag as any).locationName // Convert name to locationName for consistency
      })) || [],
      tags: tags || [], // Keep original tags for backwards compatibility
      ...(storageFileName && { fileName: storageFileName }) // Store Firebase Storage path for videos
    });

    console.log(`📝 Media uploaded successfully with ID: ${docRef.id}`);
    console.log(`📝 Tags to process: ${tags?.length || 0}`);
    
    // Process notifications after upload is complete
    if (tags && tags.length > 0) {
      // Use setTimeout to process notifications after upload completion
      setTimeout(async () => {
        console.log(`📨 Processing notifications for ${tags.length} tagged users after upload completion`);
        
        for (const tag of tags) {
          console.log(`🔍 Processing tag:`, tag);
          console.log(`🔍 Tag type: ${tag.type}`);
          if (tag.type === 'person' || tag.type === 'user') {
            console.log(`✅ Tag is user type, creating notification`);
            
            // Skip notification if tagged user has no deviceId (invalid tag)
            if (!tag.deviceId) {
              console.log(`⚠️ Skipping notification for ${tag.userName} - no deviceId found`);
              continue;
            }
            
            try {
              // Create notification for tagged user (including self-tagging)
              const isSelfTag = tag.userName === userName && tag.deviceId === deviceId;
              const notificationData = {
                type: 'tag',
                title: isSelfTag ? 'Du hast dich markiert!' : 'Du wurdest markiert!',
                message: isSelfTag 
                  ? `Du hast dich selbst in einem ${isVideo ? 'Video' : 'Foto'} markiert`
                  : `${userName} hat dich in einem ${isVideo ? 'Video' : 'Foto'} markiert`,
                targetUser: tag.userName,
                targetDeviceId: tag.deviceId,
                fromUser: userName,
                fromDeviceId: deviceId,
                mediaId: docRef.id,
                mediaType: isVideo ? 'video' : 'image',
                mediaUrl: mediaUrl,
                read: false,
                createdAt: new Date().toISOString()
              };

              // Add to notifications collection (gallery-scoped)
              const notificationRef = await addDoc(collection(db, `galleries/${galleryId}/notifications`), notificationData);

              // Send browser notification if permission granted
              if (Notification.permission === 'granted') {
                new Notification(notificationData.title, {
                  body: notificationData.message,
                  icon: '/icon-192x192.png',
                  badge: '/icon-72x72.png',
                  tag: `tag-${docRef.id}`,
                  data: {
                    mediaId: docRef.id,
                    type: 'tag'
                  }
                });
              }

            } catch (notificationError) {
              console.error(`❌ Failed to create notification for ${tag.userName}:`, notificationError);
              // Don't block upload if notification fails
            }
          }
        }
      }, 1000); // Process notifications 1 second after upload completion
    }
    
    uploaded++;
    onProgress((uploaded / files.length) * 100);
  }
};

// Gallery-specific video upload
export const uploadGalleryVideoBlob = async (
  videoBlob: Blob,
  userName: string,
  deviceId: string,
  galleryId: string,
  onProgress: (progress: number) => void
): Promise<void> => {
  console.log(`🎥 Processing video blob (${(videoBlob.size / 1024).toFixed(1)}KB)`);
  
  const fileName = `${Date.now()}-recorded-video.webm`;
  
  onProgress(25);
  
  // Check video size limit (50MB for recorded videos)
  const maxVideoSize = 50 * 1024 * 1024; // 50MB
  if (videoBlob.size > maxVideoSize) {
    throw new Error(`Video zu groß: ${(videoBlob.size / 1024 / 1024).toFixed(1)}MB (max. 50MB für aufgenommene Videos)\n\nTipp: Verwende eine kürzere Aufnahme oder niedrigere Qualität`);
  }
  
  onProgress(50);
  
  try {
    // Convert video blob to base64
    const reader = new FileReader();
    const base64Data = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(videoBlob);
    });
    
    onProgress(75);
    
    // Check base64 size (Firebase document limit is ~1MB)
    const base64SizeKB = base64Data.length * 0.75 / 1024; // Approximate size in KB
    if (base64SizeKB > 800) { // Leave some buffer
      throw new Error(`Video zu groß für Firebase: ${base64SizeKB.toFixed(0)}KB (max. 800KB)\n\nTipp: Verwende eine kürzere Aufnahme mit niedriger Auflösung`);
    }
    
    const mediaCollection = `galleries/${galleryId}/media`;
    await addDoc(collection(db, mediaCollection), {
      name: fileName,
      uploadedBy: userName,
      deviceId: deviceId,
      uploadedAt: new Date().toISOString(),
      type: 'video',
      base64Data: base64Data,
      mimeType: videoBlob.type,
      size: videoBlob.size,
      // FIXED: Initialize empty tag arrays for consistency
      textTags: [],
      personTags: [],
      locationTags: []
    });
    
    onProgress(100);
    console.log(`✅ Video blob uploaded successfully`);
  } catch (error: any) {
    console.error(`❌ Video upload failed:`, error);
    throw error;
  }
};

// Gallery-specific note addition
export const addGalleryNote = async (
  noteText: string,
  userName: string,
  deviceId: string,
  galleryId: string
): Promise<void> => {
  const mediaCollection = `galleries/${galleryId}/media`;
  await addDoc(collection(db, mediaCollection), {
    name: `note-${Date.now()}`,
    uploadedBy: userName,
    deviceId: deviceId,
    uploadedAt: new Date().toISOString(),
    type: 'note',
    noteText: noteText,
    // FIXED: Initialize empty tag arrays for consistency
    textTags: [],
    personTags: [],
    locationTags: []
  });
};

// Gallery-specific note editing
export const editGalleryNote = async (
  noteId: string, 
  newText: string,
  galleryId: string
): Promise<void> => {
  const mediaCollection = `galleries/${galleryId}/media`;
  const noteRef = doc(db, mediaCollection, noteId);
  await updateDoc(noteRef, {
    noteText: newText
  });
};

// Gallery-specific text tag editing
export const editTextTag = async (
  mediaId: string, 
  tagId: string,
  newText: string,
  galleryId: string
): Promise<void> => {
  const mediaCollection = `galleries/${galleryId}/media`;
  const mediaRef = doc(db, mediaCollection, mediaId);
  
  // Get current media document
  const mediaDoc = await getDoc(mediaRef);
  if (!mediaDoc.exists()) {
    throw new Error('Media item not found');
  }
  
  const mediaData = mediaDoc.data();
  let updated = false;
  const updates: any = {};
  
  // Check and update new textTags format
  if (mediaData.textTags && Array.isArray(mediaData.textTags)) {
    const updatedTextTags = mediaData.textTags.map((tag: any) => {
      if (tag.id === tagId) {
        updated = true;
        return {
          ...tag,
          text: newText
        };
      }
      return tag;
    });
    
    if (updated) {
      updates.textTags = updatedTextTags;
    }
  }
  
  // Check and update legacy tags format if not found in textTags
  if (!updated && mediaData.tags && Array.isArray(mediaData.tags)) {
    const updatedLegacyTags = mediaData.tags.map((tag: any) => {
      if (tag.id === tagId && tag.type === 'text') {
        updated = true;
        return {
          ...tag,
          text: newText
        };
      }
      return tag;
    });
    
    if (updated) {
      updates.tags = updatedLegacyTags;
    }
  }
  
  if (!updated) {
    throw new Error('Text tag not found');
  }
  
  // Update the media document with modified tags
  await updateDoc(mediaRef, updates);
};

// Update all tags for a media item (for admin text tag management)
export const updateMediaTags = async (
  mediaId: string,
  tags: any[],
  galleryId: string
): Promise<void> => {
  const mediaCollection = `galleries/${galleryId}/media`;
  const mediaRef = doc(db, mediaCollection, mediaId);
  
  // Update the media document with new tags
  await updateDoc(mediaRef, {
    tags: tags
  });
};

// Gallery-specific media deletion
export const deleteGalleryMediaItem = async (
  item: MediaItem,
  galleryId: string
): Promise<void> => {
  // Delete from Firestore
  const mediaCollection = `galleries/${galleryId}/media`;
  await deleteDoc(doc(db, mediaCollection, item.id));

  // Note: Storage deletion removed - using base64 data directly in Firestore

  // Delete associated comments
  const commentsCollection = `galleries/${galleryId}/comments`;
  const commentsQuery = query(collection(db, commentsCollection), where('mediaId', '==', item.id));
  const commentsSnapshot = await getDocs(commentsQuery);
  
  for (const commentDoc of commentsSnapshot.docs) {
    await deleteDoc(commentDoc.ref);
  }

  // Delete associated likes
  const likesCollection = `galleries/${galleryId}/likes`;
  const likesQuery = query(collection(db, likesCollection), where('mediaId', '==', item.id));
  const likesSnapshot = await getDocs(likesQuery);
  
  for (const likeDoc of likesSnapshot.docs) {
    await deleteDoc(likeDoc.ref);
  }
};

// Gallery-specific comments
export const loadGalleryComments = (
  galleryId: string,
  setComments: (comments: Comment[]) => void
): (() => void) => {
  const commentsCollection = `galleries/${galleryId}/comments`;
  const q = query(collection(db, commentsCollection), orderBy('createdAt', 'asc'));
  
  return onSnapshot(q, (snapshot) => {
    const commentsList: Comment[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Comment[];
    
    setComments(commentsList);
  });
};

export const addGalleryComment = async (
  mediaId: string, 
  text: string, 
  userName: string, 
  deviceId: string,
  galleryId: string
): Promise<void> => {
  const commentsCollection = `galleries/${galleryId}/comments`;
  await addDoc(collection(db, commentsCollection), {
    mediaId,
    text,
    userName,
    deviceId,
    createdAt: new Date().toISOString()
  });
};

export const deleteGalleryComment = async (
  commentId: string,
  galleryId: string
): Promise<void> => {
  const commentsCollection = `galleries/${galleryId}/comments`;
  await deleteDoc(doc(db, commentsCollection, commentId));
};

// Gallery-specific likes
export const loadGalleryLikes = (
  galleryId: string,
  setLikes: (likes: Like[]) => void
): (() => void) => {
  const likesCollection = `galleries/${galleryId}/likes`;
  const q = query(collection(db, likesCollection), orderBy('createdAt', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const likesList: Like[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Like[];
    
    setLikes(likesList);
  });
};

export const toggleGalleryLike = async (
  mediaId: string, 
  userName: string, 
  deviceId: string,
  galleryId: string
): Promise<void> => {
  const likesCollection = `galleries/${galleryId}/likes`;
  
  // Check if user already liked this item
  const existingLikeQuery = query(
    collection(db, likesCollection),
    where('mediaId', '==', mediaId),
    where('deviceId', '==', deviceId)
  );
  
  const existingLikes = await getDocs(existingLikeQuery);
  
  if (!existingLikes.empty) {
    // Remove like
    await deleteDoc(existingLikes.docs[0].ref);
  } else {
    // Add like
    await addDoc(collection(db, likesCollection), {
      mediaId,
      userName,
      deviceId,
      createdAt: new Date().toISOString()
    });
  }
};

// Gallery-specific user profiles
export const loadGalleryUserProfiles = (
  galleryId: string,
  setUserProfiles: (profiles: UserProfile[]) => void
): (() => void) => {
  const profilesCollection = `galleries/${galleryId}/userProfiles`;
  const q = query(collection(db, profilesCollection), orderBy('createdAt', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const profilesList: UserProfile[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as UserProfile[];
    
    setUserProfiles(profilesList);
  });
};

export const getGalleryUserProfile = async (
  userName: string, 
  deviceId: string,
  galleryId: string
): Promise<UserProfile | null> => {
  const profilesCollection = `galleries/${galleryId}/userProfiles`;
  const q = query(
    collection(db, profilesCollection),
    where('userName', '==', userName),
    where('deviceId', '==', deviceId)
  );
  
  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.empty) {
    return null;
  }
  
  const doc = querySnapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data()
  } as UserProfile;
};

export const getAllGalleryUserProfiles = async (galleryId: string): Promise<UserProfile[]> => {
  const profilesCollection = `galleries/${galleryId}/userProfiles`;
  const querySnapshot = await getDocs(collection(db, profilesCollection));
  
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as UserProfile[];
};

export const createOrUpdateGalleryUserProfile = async (
  userName: string,
  deviceId: string,
  profileData: Partial<UserProfile>,
  galleryId: string
): Promise<UserProfile> => {
  try {
    console.log('🔄 Starting createOrUpdateGalleryUserProfile...');
    console.log('📊 Parameters:', { userName, deviceId, galleryId });
    console.log('📝 Profile data keys:', Object.keys(profileData));
    
    const profilesCollection = `galleries/${galleryId}/userProfiles`;
    console.log('📂 Collection path:', profilesCollection);
    
    // Check if profile already exists
    console.log('🔍 Checking for existing profile...');
    const existingProfile = await getGalleryUserProfile(userName, deviceId, galleryId);
    console.log('👤 Existing profile found:', !!existingProfile);
    
    const timestamp = new Date().toISOString();
    
    // Clean profile data to remove undefined values that might cause Firebase issues
    const cleanedProfileData = Object.fromEntries(
      Object.entries(profileData).filter(([_, value]) => value !== undefined)
    );

    // Compress profile picture if it exists and is too large
    if (cleanedProfileData.profilePicture && typeof cleanedProfileData.profilePicture === 'string') {
      const sizeKB = Math.round(cleanedProfileData.profilePicture.length / 1024);
      console.log(`📸 Profile picture size: ${sizeKB}KB`);
      
      // Firebase has a 1MB limit per field, target 700KB to be safe
      if (cleanedProfileData.profilePicture.length > 700000) {
        console.log('🗜️ Profile picture too large, compressing...');
        try {
          // Convert base64 to blob for compression
          const response = await fetch(cleanedProfileData.profilePicture);
          const blob = await response.blob();
          
          // Create a simple compression function
          const compressedBase64 = await new Promise<string>((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
              // Calculate new dimensions (max 300px)
              const maxSize = 300;
              const { width, height } = img;
              const ratio = Math.min(maxSize / width, maxSize / height);
              const newWidth = width * ratio;
              const newHeight = height * ratio;
              
              canvas.width = newWidth;
              canvas.height = newHeight;
              ctx?.drawImage(img, 0, 0, newWidth, newHeight);
              
              // Progressive compression
              let quality = 0.5;
              const tryCompress = () => {
                const compressed = canvas.toDataURL('image/jpeg', quality);
                const compressedSizeKB = Math.round(compressed.length / 1024);
                console.log(`🗜️ Compressed to ${compressedSizeKB}KB (quality: ${quality.toFixed(2)})`);
                
                if (compressed.length <= 700000 || quality <= 0.1) {
                  resolve(compressed);
                } else {
                  quality *= 0.7;
                  tryCompress();
                }
              };
              tryCompress();
            };
            
            img.onerror = () => reject(new Error('Compression failed'));
            img.src = cleanedProfileData.profilePicture;
          });
          
          cleanedProfileData.profilePicture = compressedBase64;
          const finalSizeKB = Math.round(compressedBase64.length / 1024);
          console.log(`✅ Profile picture compressed to ${finalSizeKB}KB`);
        } catch (error) {
          console.error('❌ Profile picture compression failed:', error);
          // Remove the profile picture if compression fails to prevent Firebase errors
          delete cleanedProfileData.profilePicture;
        }
      }
    }
    
    const updatedData = {
      userName,
      deviceId,
      ...cleanedProfileData,
      updatedAt: timestamp
    };
    
    console.log('💾 Data to save:', updatedData);
    
    if (existingProfile) {
      // Update existing profile
      console.log('🔄 Updating existing profile with ID:', existingProfile.id);
      await updateDoc(doc(db, profilesCollection, existingProfile.id), updatedData);
      console.log('✅ Profile updated successfully');
      
      return {
        ...existingProfile,
        ...updatedData
      };
    } else {
      // Create new profile
      const newProfileData = {
        ...updatedData,
        createdAt: timestamp
      };
      
      console.log('➕ Creating new profile');
      const docRef = await addDoc(collection(db, profilesCollection), newProfileData);
      console.log('✅ New profile created with ID:', docRef.id);
      
      return {
        id: docRef.id,
        ...newProfileData
      } as UserProfile;
    }
  } catch (error: any) {
    console.error('❌ Error in createOrUpdateGalleryUserProfile:', error);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error message:', error.message);
    
    // Provide more specific error messages
    if (error.code === 'permission-denied') {
      throw new Error('Keine Berechtigung zum Speichern des Profils. Bitte versuchen Sie es erneut.');
    } else if (error.code === 'unavailable') {
      throw new Error('Verbindung unterbrochen. Bitte prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.');
    } else if (error.code === 'quota-exceeded') {
      throw new Error('Speicher-Limit erreicht. Bitte versuchen Sie es mit einem kleineren Profilbild.');
    } else if (error.code === 'invalid-argument' && error.message && error.message.includes('longer than')) {
      throw new Error('Profilbild ist zu groß. Firebase erlaubt maximal 1MB pro Feld. Bitte wählen Sie ein kleineres Bild.');
    } else if (error.message && error.message.includes('base64')) {
      throw new Error('Profilbild konnte nicht verarbeitet werden. Bitte wählen Sie ein anderes Bild.');
    }
    
    // Re-throw the original error if no specific handling
    throw error;
  }
};

export const uploadGalleryUserProfilePicture = async (
  file: File,
  userName: string,
  deviceId: string,
  galleryId: string
): Promise<string> => {
  // Convert profile picture to base64 instead of uploading to Firebase Storage
  const reader = new FileReader();
  const base64Data = await new Promise<string>((resolve, reject) => {
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  
  return base64Data;
};

// Gallery-specific stories functions
export const addGalleryStory = async (
  file: File,
  mediaType: 'image' | 'video',
  userName: string,
  deviceId: string,
  galleryId: string
): Promise<void> => {
  console.log(`🚀 === GALLERY STORY UPLOAD START ===`);
  console.log(`👤 User: ${userName} (${deviceId})`);
  console.log(`🎪 Gallery: ${galleryId}`);
  console.log(`📁 File: ${file.name} (${(file.size / 1024).toFixed(1)}KB)`);
  
  try {
    // Validate file type
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      throw new Error(`Ungültiger Dateityp: ${file.type}`);
    }
    
    const isVideo = file.type.startsWith('video/');
    let mediaUrl: string;
    let storageFileName: string | undefined;
    
    if (isVideo) {
      // Use Firebase Storage for videos (supports large files up to 100MB)
      console.log(`🎬 Uploading story video to Firebase Storage...`);
      
      // Check video size limit for stories (100MB)
      const maxVideoSize = 100 * 1024 * 1024; // 100MB
      if (file.size > maxVideoSize) {
        throw new Error(`Video zu groß: ${(file.size / 1024 / 1024).toFixed(1)}MB (max. 100MB für Story-Videos)\n\nTipp: Verwende ein kürzeres Video oder reduziere die Qualität`);
      }
      
      // Upload to Firebase Storage
      storageFileName = `galleries/${galleryId}/stories/${Date.now()}-${file.name}`;
      const storageRef = ref(storage, storageFileName);
      
      try {
        const snapshot = await uploadBytes(storageRef, file);
        mediaUrl = await getDownloadURL(storageRef);
        console.log(`✅ Story video uploaded to Firebase Storage successfully (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      } catch (error: any) {
        console.error('Firebase Storage upload failed:', error);
        
        if (error?.code === 'storage/unauthorized') {
          throw new Error(`Story-Video-Upload nicht möglich: Firebase Storage-Berechtigung fehlt.\n\nLösung: Bitte den Administrator kontaktieren, um Firebase Storage-Regeln zu aktualisieren.\n\nAlternativ: Verwende die Video-Aufnahme-Funktion für kleinere Videos.`);
        } else {
          throw new Error(`Story-Video-Upload fehlgeschlagen: ${error?.message || 'Unbekannter Fehler'}\n\nBitte versuche es erneut oder verwende ein kleineres Video.`);
        }
      }
    } else {
      // Use base64 for images (compress for stories)
      let processedFile = file;
      
      if (shouldCompress(file)) {
        console.log(`🗜️ Compressing story image for optimal storage...`);
        try {
          processedFile = await compressImage(file, { targetSizeKB: 100, maxWidth: 800, maxHeight: 600 }); // Compress for stories
          console.log(`✅ Story image compression complete: ${(processedFile.size / 1024).toFixed(1)}KB`);
        } catch (error) {
          console.warn(`⚠️ Image compression failed, using original file:`, error);
          processedFile = file;
        }
      }
      
      // Check compressed image size limit (800KB for story images)
      const maxImageSize = 800 * 1024; // 800KB
      if (processedFile.size > maxImageSize) {
        // Try extremely aggressive compression for images as last resort
        console.log(`🗜️ Attempting ultra-aggressive compression for story image...`);
        try {
          processedFile = await compressImage(processedFile, { 
            targetSizeKB: 100, 
            maxWidth: 600, 
            maxHeight: 400,
            quality: 0.4 
          });
          console.log(`✅ Story ultra compression result: ${(processedFile.size / 1024).toFixed(1)}KB`);
        } catch (error) {
          console.error(`❌ Story ultra compression failed:`, error);
        }
        
        // Final check after ultra compression
        if (processedFile.size > maxImageSize) {
          throw new Error(`Story-Bild nach maximaler Komprimierung immer noch zu groß: ${(processedFile.size / 1024).toFixed(1)}KB (max. 800KB für Story-Bilder)`);
        }
      }
      
      // Convert image to base64
      console.log(`📸 Converting story image to base64...`);
      const reader = new FileReader();
      mediaUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(processedFile);
      });
      console.log(`✅ Story image converted to base64 successfully (${(processedFile.size / 1024).toFixed(1)}KB)`);
    }
    
    // Generate filename
    const timestamp = Date.now();
    const cleanUserName = userName.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, '_');
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || (isVideo ? 'mp4' : 'jpg');
    const fileName = `STORY_${timestamp}_${cleanUserName}.${fileExtension}`;
    
    // Set expiry time (24 hours from now)
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    // Save to gallery-specific stories collection
    const storiesCollection = `galleries/${galleryId}/stories`;
    const storyData = {
      mediaUrl: mediaUrl,
      mediaType: isVideo ? 'video' : 'image',
      userName,
      deviceId,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      views: [],
      fileName: fileName,
      isStory: true,
      size: file.size,
      mimeType: file.type,
      ...(storageFileName && { fileName: storageFileName }), // Store Firebase Storage path for videos
      ...(isVideo && { isFirebaseStorage: true }), // Flag for videos in storage
      ...(!isVideo && { base64Data: mediaUrl }) // Store base64 flag for images
    };
    
    console.log(`💾 Saving to gallery stories collection: ${storiesCollection}`);
    const docRef = await addDoc(collection(db, storiesCollection), storyData);
    console.log(`✅ Gallery story saved with ID: ${docRef.id}`);
    
  } catch (error: any) {
    console.error(`❌ Gallery story upload failed:`, error);
    
    // Re-throw with user-friendly message
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error(`Unbekannter Fehler beim Story-Upload: ${error}`);
    }
  }
};

export const subscribeGalleryStories = (
  galleryId: string,
  callback: (stories: Story[]) => void
): (() => void) => {
  const storiesCollection = `galleries/${galleryId}/stories`;
  const q = query(
    collection(db, storiesCollection),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const now = new Date();
    const allStories: Story[] = [];
    const activeStories: Story[] = [];
    
    snapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      const story: Story = {
        id: doc.id,
        ...data
      } as Story;
      
      allStories.push(story);
      
      // Check if story is still active (not expired)
      const expiresAt = new Date(story.expiresAt);
      const isActive = expiresAt > now;
      
      if (isActive) {
        activeStories.push(story);
      }
    });
    
    callback(activeStories);
    
  }, (error) => {
    console.error('❌ Error listening to gallery stories:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      galleryId: galleryId
    });
    callback([]);
  });
};

export const subscribeAllGalleryStories = (
  galleryId: string,
  callback: (stories: Story[]) => void
): (() => void) => {
  const storiesCollection = `galleries/${galleryId}/stories`;
  const q = query(
    collection(db, storiesCollection),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const stories: Story[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Story[];
    
    callback(stories);
  });
};

export const markGalleryStoryAsViewed = async (
  storyId: string,
  deviceId: string,
  galleryId: string
): Promise<void> => {
  try {
    const storiesCollection = `galleries/${galleryId}/stories`;
    const storyRef = doc(db, storiesCollection, storyId);
    const storyDoc = await getDocs(query(collection(db, storiesCollection), where('__name__', '==', storyId)));
    
    if (!storyDoc.empty) {
      const storyData = storyDoc.docs[0].data();
      const currentViews = storyData.views || [];
      
      if (!currentViews.includes(deviceId)) {
        await updateDoc(storyRef, {
          views: [...currentViews, deviceId]
        });
      }
    }
    
  } catch (error) {
    console.error('Error marking gallery story as viewed:', error);
  }
};

export const deleteGalleryStory = async (
  storyId: string,
  galleryId: string
): Promise<void> => {
  try {
    const storiesCollection = `galleries/${galleryId}/stories`;
    
    // Get story data first for file deletion
    const storyDoc = await getDocs(query(collection(db, storiesCollection), where('__name__', '==', storyId)));
    
    if (!storyDoc.empty) {
      const storyData = storyDoc.docs[0].data();
      
      // Note: Stories are stored as base64 in Firestore, no storage cleanup needed
      console.log(`🗑️ Story data contains base64, no external storage cleanup required`);
    }
    
    // Delete from Firestore
    await deleteDoc(doc(db, storiesCollection, storyId));
    console.log(`✅ Deleted gallery story from Firestore: ${storyId}`);
    
  } catch (error) {
    console.error('Error deleting gallery story:', error);
    throw error;
  }
};

export const cleanupExpiredGalleryStories = async (galleryId: string): Promise<void> => {
  try {
    const storiesCollection = `galleries/${galleryId}/stories`;
    const allStoriesSnapshot = await getDocs(collection(db, storiesCollection));
    const now = new Date();
    const expiredStories: any[] = [];
    
    allStoriesSnapshot.docs.forEach(doc => {
      const storyData = doc.data();
      const expiresAt = new Date(storyData.expiresAt);
      
      if (expiresAt <= now) {
        expiredStories.push({
          id: doc.id,
          ...storyData
        });
      }
    });
    
    // Delete expired stories
    for (const expiredStory of expiredStories) {
      try {
        await deleteGalleryStory(expiredStory.id, galleryId);
      } catch (error) {
        console.error(`❌ Failed to cleanup expired gallery story: ${expiredStory.id}`, error);
      }
    }
    
  } catch (error) {
    console.error('Error cleaning up expired gallery stories:', error);
  }
};

// Get all users in a specific gallery for tagging
export const getGalleryUsers = async (galleryId: string): Promise<any[]> => {
  try {
    const userMap = new Map<string, any>();
    
    // 1. Get users from gallery-specific live_users collection
    const liveUsersQuery = query(collection(db, `galleries/${galleryId}/live_users`));
    const liveUsersSnapshot = await getDocs(liveUsersQuery);
    
    liveUsersSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.userName && data.deviceId) {
        const key = `${data.userName}-${data.deviceId}`;
        userMap.set(key, {
          userName: data.userName,
          deviceId: data.deviceId,
          displayName: data.displayName || data.userName,
          profilePicture: data.profilePicture
        });
      }
    });
    
    // 2. Get users from gallery-specific userProfiles collection
    const profilesQuery = query(collection(db, `galleries/${galleryId}/userProfiles`));
    const profilesSnapshot = await getDocs(profilesQuery);
    
    profilesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.userName && data.deviceId) {
        const key = `${data.userName}-${data.deviceId}`;
        const existingUser = userMap.get(key);
        userMap.set(key, {
          userName: data.userName,
          deviceId: data.deviceId,
          displayName: data.displayName || existingUser?.displayName || data.userName,
          profilePicture: data.profilePicture || existingUser?.profilePicture
        });
      }
    });
    
    // 3. Get users from gallery media uploads
    const mediaQuery = query(collection(db, `galleries/${galleryId}/media`));
    const mediaSnapshot = await getDocs(mediaQuery);
    
    mediaSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.uploadedBy && data.deviceId) {
        const key = `${data.uploadedBy}-${data.deviceId}`;
        if (!userMap.has(key)) {
          userMap.set(key, {
            userName: data.uploadedBy,
            deviceId: data.deviceId,
            displayName: data.uploadedBy
          });
        }
      }
    });
    
    // 4. Filter out deleted users by checking kick_signals
    const kickSignalsQuery = query(collection(db, `galleries/${galleryId}/kick_signals`));
    const kickSignalsSnapshot = await getDocs(kickSignalsQuery);
    const deletedDeviceIds = new Set<string>();
    
    kickSignalsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.deviceId && (data.reason === 'deleted_by_admin' || data.reason === 'self_deleted' || data.reason === 'bulk_deleted_by_admin' || data.reason === 'bulk_self_deleted')) {
        deletedDeviceIds.add(data.deviceId);
      }
    });
    
    // Filter out deleted users
    const allUsers = Array.from(userMap.values());
    const filteredUsers = allUsers.filter(user => !deletedDeviceIds.has(user.deviceId));
    
    return filteredUsers;
  } catch (error) {
    console.error('❌ Error fetching gallery users:', error);
    return [];
  }
};

// 🚀 PERFORMANCE OPTIMIZED: Load more media for infinite scroll
export const loadMoreGalleryMedia = async (
  galleryId: string,
  lastDocUploadedAt: string,
  loadLimit: number = 6
): Promise<{ items: MediaItem[], lastDoc: any }> => {
  const mediaCollection = `galleries/${galleryId}/media`;
  
  console.log(`🔄 Loading more media for gallery ${galleryId}, limit: ${loadLimit}, after: ${lastDocUploadedAt}`);
  const startTime = performance.now();
  
  try {
    // Query for items older than the last uploadedAt
    const q = query(
      collection(db, mediaCollection),
      orderBy('uploadedAt', 'desc'),
      where('uploadedAt', '<', lastDocUploadedAt),
      limit(loadLimit)
    );
    
    const snapshot = await getDocs(q);
    const endTime = performance.now();
    
    console.log(`🔄 Loaded ${snapshot.docs.length} more items in ${Math.round(endTime - startTime)}ms`);
    
    const mediaList: MediaItem[] = snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      let url = '';
      
      if (data.type !== 'note') {
        // SMART FALLBACK: Prefer URLs, fallback to base64
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
    });
    
    // Return the last uploadedAt for next pagination
    const newLastDoc = mediaList.length > 0 
      ? mediaList[mediaList.length - 1].uploadedAt
      : null;
    
    return {
      items: mediaList,
      lastDoc: newLastDoc
    };
  } catch (error) {
    console.error('🔄 Error loading more media:', error);
    return {
      items: [],
      lastDoc: null
    };
  }
};


