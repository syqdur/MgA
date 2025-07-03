import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, Upload, Save, Loader2 } from 'lucide-react';
import { db } from '../config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  galleryId: string;
  theme: 'hochzeit' | 'geburtstag' | 'urlaub' | 'eigenes';
  isDarkMode: boolean;
  onSave?: (profile: any) => void;
}

interface GalleryProfile {
  name: string;
  bio: string;
  profilePicture?: string;
  countdownDate?: string | null;
  countdownEndMessage?: string;
  countdownMessageDismissed?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const ProfileEditModal: React.FC<ProfileEditModalProps> = ({
  isOpen,
  onClose,
  galleryId,
  theme,
  isDarkMode,
  onSave
}) => {
  const [profile, setProfile] = useState<GalleryProfile>({
    name: '',
    bio: '',
    profilePicture: '',
    countdownDate: null,
    countdownEndMessage: 'Der große Tag ist da! 🎉',
    countdownMessageDismissed: false
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Theme configurations
  const themeConfig = {
    hochzeit: {
      gradients: 'from-pink-500 to-rose-500',
      colors: 'text-pink-600 dark:text-pink-400',
      borders: 'border-pink-200 dark:border-pink-800',
      backgrounds: 'bg-pink-50 dark:bg-pink-900/20'
    },
    geburtstag: {
      gradients: 'from-purple-500 to-violet-500',
      colors: 'text-purple-600 dark:text-purple-400',
      borders: 'border-purple-200 dark:border-purple-800',
      backgrounds: 'bg-purple-50 dark:bg-purple-900/20'
    },
    urlaub: {
      gradients: 'from-blue-500 to-cyan-500',
      colors: 'text-blue-600 dark:text-blue-400',
      borders: 'border-blue-200 dark:border-blue-800',
      backgrounds: 'bg-blue-50 dark:bg-blue-900/20'
    },
    eigenes: {
      gradients: 'from-green-500 to-emerald-500',
      colors: 'text-green-600 dark:text-green-400',
      borders: 'border-green-200 dark:border-green-800',
      backgrounds: 'bg-green-50 dark:bg-green-900/20'
    }
  };

  const currentTheme = themeConfig[theme];

  // Load profile data when modal opens
  useEffect(() => {
    if (isOpen && galleryId) {
      loadProfile();
    }
  }, [isOpen, galleryId]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const profileDoc = await getDoc(doc(db, 'galleries', galleryId, 'profile', 'main'));
      
      if (profileDoc.exists()) {
        const data = profileDoc.data() as GalleryProfile;
        setProfile(data);
        setImagePreview(data.profilePicture || '');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (4MB limit)
    if (file.size > 4 * 1024 * 1024) {
      alert('Bild ist zu groß. Maximale Größe: 4MB');
      return;
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      alert('Ungültiges Bildformat. Erlaubt: JPEG, PNG, WebP, GIF');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageData = e.target?.result as string;
      
      // Compress image for Firebase (target ~26KB to stay under 1MB field limit)
      const compressedImage = await compressImage(imageData, 26 * 1024);
      setImagePreview(compressedImage);
      setProfile(prev => ({ ...prev, profilePicture: compressedImage }));
    };
    reader.readAsDataURL(file);
  };

  const compressImage = (imageData: string, targetSize: number): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
        // Calculate dimensions maintaining aspect ratio
        const maxDimension = 400;
        let { width, height } = img;
        
        if (width > height && width > maxDimension) {
          height = (height * maxDimension) / width;
          width = maxDimension;
        } else if (height > maxDimension) {
          width = (width * maxDimension) / height;
          height = maxDimension;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        
        // Start with high quality and reduce until we hit target size
        let quality = 0.9;
        let compressedData = canvas.toDataURL('image/jpeg', quality);
        
        while (compressedData.length > targetSize && quality > 0.1) {
          quality -= 0.1;
          compressedData = canvas.toDataURL('image/jpeg', quality);
        }
        
        resolve(compressedData);
      };
      img.src = imageData;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updatedProfile = {
        ...profile,
        updatedAt: new Date().toISOString()
      };

      // Save to Firebase
      await setDoc(doc(db, 'galleries', galleryId, 'profile', 'main'), updatedProfile);
      
      // Call parent callback
      onSave?.(updatedProfile);
      
      console.log('✅ Profil erfolgreich aktualisiert');
      onClose();
    } catch (error) {
      console.error('❌ Fehler beim Speichern:', error);
      alert('Fehler beim Speichern des Profils. Bitte versuche es erneut.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className={`relative w-full max-w-lg mx-2 sm:mx-4 max-h-[90vh] overflow-hidden transition-all duration-300 ${
        isDarkMode 
          ? 'bg-gray-900/95 border-gray-700/50' 
          : 'bg-white/95 border-gray-200/50'
      } backdrop-blur-xl border rounded-t-3xl sm:rounded-3xl shadow-2xl`}>
        
        {/* Header */}
        <div className={`px-6 py-4 border-b ${isDarkMode ? 'border-gray-700/50' : 'border-gray-200/50'}`}>
          <div className="flex items-center justify-between">
            <h2 className={`text-xl font-bold bg-gradient-to-r ${currentTheme.gradients} bg-clip-text text-transparent`}>
              Galerie-Profil bearbeiten
            </h2>
            <button
              onClick={onClose}
              className={`p-2 rounded-full transition-colors ${
                isDarkMode 
                  ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-300' 
                  : 'hover:bg-gray-100 text-gray-600 hover:text-gray-700'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Profile Picture */}
              <div className="space-y-3">
                <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Profilbild
                </label>
                
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {/* Image Preview */}
                  <div className={`relative w-24 h-24 rounded-2xl overflow-hidden ${currentTheme.borders} border-2`}>
                    {imagePreview ? (
                      <img 
                        src={imagePreview} 
                        alt="Profilbild" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center ${currentTheme.backgrounds}`}>
                        <Camera className={`w-8 h-8 ${currentTheme.colors}`} />
                      </div>
                    )}
                  </div>
                  
                  {/* Upload Button */}
                  <div className="flex-1 w-full sm:w-auto">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className={`w-full sm:w-auto px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
                        isDarkMode
                          ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-600'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
                      }`}
                    >
                      <Upload className="w-4 h-4 inline mr-2" />
                      Bild auswählen
                    </button>
                    <p className={`text-xs mt-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      JPEG, PNG, WebP, GIF • Max. 4MB
                    </p>
                  </div>
                </div>
              </div>

              {/* Gallery Name */}
              <div className="space-y-3">
                <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Galerie-Name
                </label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
                  className={`w-full px-4 py-3 rounded-xl transition-all duration-200 ${
                    isDarkMode
                      ? 'bg-gray-800 border-gray-600 text-gray-200 focus:border-gray-500'
                      : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-gray-400'
                  } border focus:outline-none focus:ring-2 focus:ring-opacity-50 ${currentTheme.colors.includes('pink') ? 'focus:ring-pink-500' : 
                  currentTheme.colors.includes('purple') ? 'focus:ring-purple-500' :
                  currentTheme.colors.includes('blue') ? 'focus:ring-blue-500' : 'focus:ring-green-500'}`}
                  placeholder="z.B. Mauro & Kristina"
                />
              </div>

              {/* Bio */}
              <div className="space-y-3">
                <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Beschreibung
                </label>
                <textarea
                  value={profile.bio}
                  onChange={(e) => setProfile(prev => ({ ...prev, bio: e.target.value }))}
                  rows={3}
                  className={`w-full px-4 py-3 rounded-xl transition-all duration-200 resize-none ${
                    isDarkMode
                      ? 'bg-gray-800 border-gray-600 text-gray-200 focus:border-gray-500'
                      : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-gray-400'
                  } border focus:outline-none focus:ring-2 focus:ring-opacity-50 ${currentTheme.colors.includes('pink') ? 'focus:ring-pink-500' : 
                  currentTheme.colors.includes('purple') ? 'focus:ring-purple-500' :
                  currentTheme.colors.includes('blue') ? 'focus:ring-blue-500' : 'focus:ring-green-500'}`}
                  placeholder="Teilt eure schönsten Momente mit uns! 📸"
                />
              </div>

              {/* Countdown Date */}
              <div className="space-y-3">
                <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Countdown-Datum (optional)
                </label>
                <input
                  type="date"
                  value={profile.countdownDate || ''}
                  onChange={(e) => setProfile(prev => ({ ...prev, countdownDate: e.target.value || null }))}
                  className={`w-full px-4 py-3 rounded-xl transition-all duration-200 ${
                    isDarkMode
                      ? 'bg-gray-800 border-gray-600 text-gray-200 focus:border-gray-500'
                      : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-gray-400'
                  } border focus:outline-none focus:ring-2 focus:ring-opacity-50 ${currentTheme.colors.includes('pink') ? 'focus:ring-pink-500' : 
                  currentTheme.colors.includes('purple') ? 'focus:ring-purple-500' :
                  currentTheme.colors.includes('blue') ? 'focus:ring-blue-500' : 'focus:ring-green-500'}`}
                />
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t ${isDarkMode ? 'border-gray-700/50' : 'border-gray-200/50'}`}>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                isDarkMode
                  ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-600'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
              } disabled:opacity-50`}
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !profile.name.trim()}
              className={`flex-1 px-4 py-3 rounded-xl font-medium text-white transition-all duration-200 ${
                saving || !profile.name.trim()
                  ? 'bg-gray-400 cursor-not-allowed'
                  : `bg-gradient-to-r ${currentTheme.gradients} hover:shadow-lg transform hover:scale-[1.02]`
              } disabled:transform-none disabled:hover:scale-100`}
            >
              {saving ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Speichern...
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" />
                  Speichern
                </div>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};