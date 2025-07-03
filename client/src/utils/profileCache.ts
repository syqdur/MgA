interface CachedProfile {
  profilePicture?: string;
  displayName?: string;
  userName: string;
  timestamp: number;
}

interface CacheConfig {
  maxAge: number; // Cache duration in milliseconds
  maxSize: number; // Maximum number of cached items
}

class ProfileCache {
  private cache = new Map<string, CachedProfile>();
  private config: CacheConfig = {
    maxAge: 5 * 60 * 1000, // 5 minutes
    maxSize: 200 // Cache up to 200 profiles
  };

  private generateKey(galleryId: string, deviceId: string): string {
    return `${galleryId}:${deviceId}`;
  }

  set(galleryId: string, deviceId: string, profile: Omit<CachedProfile, 'timestamp'>): void {
    const key = this.generateKey(galleryId, deviceId);
    
    // Clean old entries if cache is full
    if (this.cache.size >= this.config.maxSize) {
      this.cleanup();
    }

    this.cache.set(key, {
      ...profile,
      timestamp: Date.now()
    });

    // Silent caching for better performance
  }

  get(galleryId: string, deviceId: string): CachedProfile | null {
    const key = this.generateKey(galleryId, deviceId);
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    // Check if cache entry is expired
    if (Date.now() - cached.timestamp > this.config.maxAge) {
      this.cache.delete(key);
      return null;
    }

    return cached;
  }

  getProfilePicture(galleryId: string, deviceId: string): string | null {
    const cached = this.get(galleryId, deviceId);
    return cached?.profilePicture || null;
  }

  getDisplayName(galleryId: string, deviceId: string): string | null {
    const cached = this.get(galleryId, deviceId);
    return cached?.displayName || cached?.userName || null;
  }

  private cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    // Remove expired entries
    for (const [key, profile] of this.cache.entries()) {
      if (now - profile.timestamp > this.config.maxAge) {
        toDelete.push(key);
      }
    }

    // If still too many entries, remove oldest ones
    if (this.cache.size - toDelete.length >= this.config.maxSize) {
      const sortedEntries = Array.from(this.cache.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp);
      
      const excess = this.cache.size - toDelete.length - this.config.maxSize + 20; // Remove 20 extra
      for (let i = 0; i < excess && i < sortedEntries.length; i++) {
        toDelete.push(sortedEntries[i][0]);
      }
    }

    toDelete.forEach(key => this.cache.delete(key));
    
    // Silent cleanup for better performance
  }

  clear(galleryId?: string): void {
    if (galleryId) {
      // Clear only profiles for specific gallery
      const toDelete: string[] = [];
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${galleryId}:`)) {
          toDelete.push(key);
        }
      }
      toDelete.forEach(key => this.cache.delete(key));
      // Silent clear for better performance
    } else {
      // Clear all cached profiles
      this.cache.clear();
      // Silent clear for better performance
    }
  }

  getStats(): { size: number; maxSize: number; maxAge: number } {
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      maxAge: this.config.maxAge
    };
  }

  // Preload multiple profiles at once
  preload(galleryId: string, profiles: Array<{ deviceId: string; userName: string; displayName?: string; profilePicture?: string }>): void {
    profiles.forEach(profile => {
      this.set(galleryId, profile.deviceId, {
        userName: profile.userName,
        displayName: profile.displayName,
        profilePicture: profile.profilePicture
      });
    });
  }
}

// Global cache instance
export const profileCache = new ProfileCache();

// Helper functions for easy access
export const getCachedProfilePicture = (galleryId: string, deviceId: string): string | null => {
  return profileCache.getProfilePicture(galleryId, deviceId);
};

export const getCachedDisplayName = (galleryId: string, deviceId: string): string | null => {
  return profileCache.getDisplayName(galleryId, deviceId);
};

export const cacheUserProfile = (galleryId: string, deviceId: string, userName: string, displayName?: string, profilePicture?: string): void => {
  profileCache.set(galleryId, deviceId, {
    userName,
    displayName,
    profilePicture
  });
};

export const preloadProfiles = (galleryId: string, profiles: Array<{ deviceId: string; userName: string; displayName?: string; profilePicture?: string }>): void => {
  profileCache.preload(galleryId, profiles);
};

export const clearProfileCache = (galleryId?: string): void => {
  profileCache.clear(galleryId);
};