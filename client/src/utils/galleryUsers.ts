import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

export interface GalleryUser {
  deviceId: string;
  userName: string;
  displayName?: string;
  profilePicture?: string;
  isOnline?: boolean;
  lastSeen?: Date;
}

export async function getGalleryUsers(galleryId: string): Promise<GalleryUser[]> {
  try {
    const usersRef = collection(db, 'galleries', galleryId, 'userProfiles');
    const snapshot = await getDocs(usersRef);
    
    const users: GalleryUser[] = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      users.push({
        deviceId: doc.id,
        userName: data.userName || 'Unbekannter Nutzer',
        displayName: data.displayName,
        profilePicture: data.profilePicture,
        isOnline: data.isOnline || false,
        lastSeen: data.lastSeen?.toDate()
      });
    });
    
    return users;
  } catch (error) {
    console.error('Failed to load gallery users:', error);
    return [];
  }
}