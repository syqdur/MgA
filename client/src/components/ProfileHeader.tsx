import React, { useState, useEffect } from 'react';
import { Settings, User } from 'lucide-react';
import { db } from '../config/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { ProfileEditModal } from './ProfileEditModal';

interface ProfileData {
  name: string;
  bio: string;
  profilePicture?: string;
  theme?: 'hochzeit' | 'geburtstag' | 'urlaub' | 'eigenes';
}

interface ProfileHeaderProps {
  galleryId: string;
  initialData?: ProfileData;
  isAdmin?: boolean;
  isDarkMode?: boolean;
  onProfileUpdate?: (data: ProfileData) => void;
  theme?: 'hochzeit' | 'geburtstag' | 'urlaub' | 'eigenes';
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  galleryId,
  initialData,
  isAdmin = false,
  isDarkMode = false,
  onProfileUpdate,
  theme = 'hochzeit'
}) => {
  const [showEditModal, setShowEditModal] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData>({
    name: initialData?.name || 'Galerie Name',
    bio: initialData?.bio || 'Beschreibung der Galerie...',
    profilePicture: initialData?.profilePicture,
    theme: initialData?.theme || theme
  });

  // Real-time Firebase listener for profile data
  useEffect(() => {
    if (!galleryId) return;

    const profileDoc = doc(db, 'galleries', galleryId, 'profile', 'main');
    const unsubscribe = onSnapshot(profileDoc, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data() as ProfileData;
        setProfileData(data);
        onProfileUpdate?.(data);
      }
    });

    return () => unsubscribe();
  }, [galleryId, onProfileUpdate]);

  const handleProfileSave = (updatedProfile: ProfileData) => {
    setProfileData(updatedProfile);
    onProfileUpdate?.(updatedProfile);
  };

  const getThemeGlow = () => {
    switch (theme) {
      case 'hochzeit':
        return 'shadow-pink-500/30';
      case 'geburtstag':
        return 'shadow-purple-500/30';
      case 'urlaub':
        return 'shadow-blue-500/30';
      case 'eigenes':
        return 'shadow-green-500/30';
      default:
        return 'shadow-pink-500/30';
    }
  };

  const getThemeRing = () => {
    switch (theme) {
      case 'hochzeit':
        return 'ring-pink-500/40';
      case 'geburtstag':
        return 'ring-purple-500/40';
      case 'urlaub':
        return 'ring-blue-500/40';
      case 'eigenes':
        return 'ring-green-500/40';
      default:
        return 'ring-pink-500/40';
    }
  };

  return (
    <>
      {/* Desktop Layout (≥768px) */}
      <div className="hidden md:block">
        <div className={`relative p-6 mx-4 mb-6 rounded-3xl transition-all duration-500 ${
          isDarkMode
            ? 'bg-gray-900/70 border border-gray-700/30'
            : 'bg-white/70 border border-gray-200/30'
        } backdrop-blur-xl shadow-xl ${getThemeGlow()}`}>
          
          <div className="flex items-center gap-6">
            {/* Profile Picture */}
            <div className={`relative w-20 h-20 rounded-2xl overflow-hidden ring-4 ${getThemeRing()} ${getThemeGlow()} shadow-lg flex-shrink-0`}>
              {profileData.profilePicture ? (
                <img
                  src={profileData.profilePicture}
                  alt={profileData.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className={`w-full h-full flex items-center justify-center ${
                  isDarkMode ? 'bg-gray-800' : 'bg-gray-100'
                }`}>
                  <User className={`w-8 h-8 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
                </div>
              )}
            </div>

            {/* Profile Info */}
            <div className="flex-1 min-w-0">
              <h1 className={`text-xl font-bold mb-2 ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                {profileData.name}
              </h1>
              <p className={`text-sm leading-relaxed ${
                isDarkMode ? 'text-gray-300' : 'text-gray-600'
              }`}>
                {profileData.bio}
              </p>
            </div>

            {/* Admin Settings Button */}
            {isAdmin && (
              <button
                onClick={() => setShowEditModal(true)}
                className={`flex-shrink-0 w-12 h-12 rounded-full transition-all duration-300 hover:scale-110 flex items-center justify-center shadow-lg ${
                  isDarkMode
                    ? 'bg-gray-800/90 hover:bg-gray-700/90 text-gray-300'
                    : 'bg-white/90 hover:bg-gray-50/90 text-gray-600'
                } backdrop-blur-sm ring-2 ring-gray-300/20 hover:ring-gray-400/40`}
                title="Profil bearbeiten"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Layout (<768px) */}
      <div className="md:hidden">
        <div className={`relative p-4 mx-2 mb-4 rounded-2xl transition-all duration-500 ${
          isDarkMode
            ? 'bg-gray-900/70 border border-gray-700/30'
            : 'bg-white/70 border border-gray-200/30'
        } backdrop-blur-xl shadow-xl ${getThemeGlow()}`}>
          
          <div className="flex items-start gap-4">
            {/* Profile Picture */}
            <div className={`relative w-16 h-16 rounded-xl overflow-hidden ring-3 ${getThemeRing()} ${getThemeGlow()} shadow-lg flex-shrink-0`}>
              {profileData.profilePicture ? (
                <img
                  src={profileData.profilePicture}
                  alt={profileData.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className={`w-full h-full flex items-center justify-center ${
                  isDarkMode ? 'bg-gray-800' : 'bg-gray-100'
                }`}>
                  <User className={`w-6 h-6 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
                </div>
              )}
            </div>

            {/* Profile Info */}
            <div className="flex-1 min-w-0">
              <h1 className={`text-base font-bold mb-1 ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                {profileData.name}
              </h1>
              <p className={`text-xs leading-relaxed ${
                isDarkMode ? 'text-gray-300' : 'text-gray-600'
              }`}>
                {profileData.bio}
              </p>
            </div>

            {/* Admin Settings Button */}
            {isAdmin && (
              <button
                onClick={() => setShowEditModal(true)}
                className={`flex-shrink-0 w-10 h-10 rounded-full transition-all duration-300 hover:scale-110 flex items-center justify-center touch-manipulation ${
                  isDarkMode
                    ? 'bg-gray-800/90 hover:bg-gray-700/90 text-gray-300'
                    : 'bg-white/90 hover:bg-gray-50/90 text-gray-600'
                } backdrop-blur-sm ring-2 ring-gray-300/20 hover:ring-gray-400/40 shadow-md`}
                title="Profil bearbeiten"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <ProfileEditModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        galleryId={galleryId}
        theme={theme}
        isDarkMode={isDarkMode}
        onSave={handleProfileSave}
      />
    </>
  );
};