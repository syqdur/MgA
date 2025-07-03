import { getCachedProfilePicture, getCachedDisplayName } from './profileCache';

interface AvatarData {
  src?: string;
  alt: string;
  initials: string;
}

/**
 * Get avatar data with caching for instant display
 */
export const getCachedAvatar = (
  galleryId: string, 
  deviceId: string, 
  userName: string, 
  fallbackProfilePicture?: string
): AvatarData => {
  // Try to get cached profile picture first
  const cachedPicture = getCachedProfilePicture(galleryId, deviceId);
  const cachedDisplayName = getCachedDisplayName(galleryId, deviceId);
  
  const displayName = cachedDisplayName || userName;
  const profilePicture = cachedPicture || fallbackProfilePicture;
  
  return {
    src: profilePicture,
    alt: `${displayName} avatar`,
    initials: getInitials(displayName)
  };
};

/**
 * Generate initials from display name or username
 */
export const getInitials = (name: string): string => {
  if (!name) return '?';
  
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  
  return parts
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('');
};

/**
 * Get theme-appropriate avatar colors based on initials
 */
export const getAvatarColor = (initials: string, theme: string = 'hochzeit'): { bg: string; text: string } => {
  const colors = {
    hochzeit: [
      { bg: 'bg-pink-500', text: 'text-white' },
      { bg: 'bg-rose-500', text: 'text-white' },
      { bg: 'bg-pink-400', text: 'text-white' },
      { bg: 'bg-rose-400', text: 'text-white' }
    ],
    geburtstag: [
      { bg: 'bg-purple-500', text: 'text-white' },
      { bg: 'bg-violet-500', text: 'text-white' },
      { bg: 'bg-purple-400', text: 'text-white' },
      { bg: 'bg-violet-400', text: 'text-white' }
    ],
    urlaub: [
      { bg: 'bg-blue-500', text: 'text-white' },
      { bg: 'bg-cyan-500', text: 'text-white' },
      { bg: 'bg-blue-400', text: 'text-white' },
      { bg: 'bg-cyan-400', text: 'text-white' }
    ],
    eigenes: [
      { bg: 'bg-green-500', text: 'text-white' },
      { bg: 'bg-emerald-500', text: 'text-white' },
      { bg: 'bg-green-400', text: 'text-white' },
      { bg: 'bg-emerald-400', text: 'text-white' }
    ]
  };
  
  const themeColors = colors[theme as keyof typeof colors] || colors.hochzeit;
  const hash = initials.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colorIndex = hash % themeColors.length;
  
  return themeColors[colorIndex];
};

/**
 * Avatar props interface for cached avatar component
 */
export interface CachedAvatarProps {
  galleryId: string;
  deviceId: string;
  userName: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  theme?: string;
  fallbackProfilePicture?: string;
  onClick?: () => void;
}

/**
 * Get size classes for avatar
 */
export const getAvatarSizeClasses = (size: 'sm' | 'md' | 'lg' | 'xl' = 'md') => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg'
  };
  
  return `${sizeClasses[size]} rounded-full flex items-center justify-center font-medium shrink-0`;
};