import React, { useState, useEffect } from 'react';
import { ProfileHeader } from './ProfileHeader';
import { getThemeConfig } from '../config/themes';

interface ProfileHeaderExampleProps {
  galleryId: string;
  theme?: 'hochzeit' | 'geburtstag' | 'urlaub' | 'eigenes';
  isAdmin?: boolean;
  isDarkMode?: boolean;
}

export const ProfileHeaderExample: React.FC<ProfileHeaderExampleProps> = ({
  galleryId,
  theme = 'hochzeit',
  isAdmin = false,
  isDarkMode = false
}) => {
  const [profileData, setProfileData] = useState({
    name: '',
    bio: '',
    profilePicture: undefined,
    theme: theme
  });

  const themeConfig = getThemeConfig(theme);

  // Example initial data based on theme
  useEffect(() => {
    switch (theme) {
      case 'hochzeit':
        setProfileData({
          name: 'Unsere Traumhochzeit 💕',
          bio: 'Teilt mit uns die schönsten Momente unseres besonderen Tages!',
          profilePicture: undefined,
          theme: theme
        });
        break;
      case 'geburtstag':
        setProfileData({
          name: 'Meine Geburtstagsparty 🎂',
          bio: 'Lasst uns zusammen feiern und unvergessliche Erinnerungen sammeln!',
          profilePicture: undefined,
          theme: theme
        });
        break;
      case 'urlaub':
        setProfileData({
          name: 'Unser Traumurlaub 🏖️',
          bio: 'Hier sammeln wir alle Highlights unserer unvergesslichen Reise!',
          profilePicture: undefined,
          theme: theme
        });
        break;
      case 'eigenes':
        setProfileData({
          name: 'Unser besonderes Event 🎊',
          bio: 'Ein unvergessliches Event - teilt eure schönsten Momente mit uns!',
          profilePicture: undefined,
          theme: theme
        });
        break;
      default:
        setProfileData({
          name: 'Galerie Name',
          bio: 'Beschreibung der Galerie...',
          profilePicture: undefined,
          theme: theme
        });
    }
  }, [theme]);

  const handleProfileUpdate = (updatedData: any) => {
    setProfileData(updatedData);
    console.log('✅ Profil wurde aktualisiert:', updatedData);
  };

  return (
    <div className="min-h-screen p-6" style={{
      background: `linear-gradient(135deg, ${themeConfig.styles.bgGradient})`
    }}>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800 dark:text-white">
          ProfileHeader Demo - {themeConfig.name} Theme
        </h1>
        
        <ProfileHeader
          galleryId={galleryId}
          initialData={profileData}
          isAdmin={isAdmin}
          isDarkMode={isDarkMode}
          onProfileUpdate={handleProfileUpdate}
          theme={theme}
        />

        {/* Demo Controls */}
        <div className="mt-8 p-6 rounded-3xl bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border border-gray-200/50 dark:border-gray-700/50">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">
            Demo Controls
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Admin Modus:
              </label>
              <button
                onClick={() => window.location.reload()}
                className={`
                  px-4 py-2 rounded-full text-sm font-medium
                  ${isAdmin 
                    ? 'bg-green-500 text-white' 
                    : 'bg-gray-300 text-gray-700'
                  }
                `}
              >
                {isAdmin ? 'Admin ✓' : 'Besucher'}
              </button>
              <span className="text-xs text-gray-500">
                (Nur Admins können das Profil bearbeiten)
              </span>
            </div>

            <div className="text-sm text-gray-600 dark:text-gray-400">
              <p><strong>Features:</strong></p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Responsive Design (Mobile & Desktop)</li>
                <li>Theme-spezifische Farben und Effekte</li>
                <li>Profilbild Upload mit automatischer Komprimierung</li>
                <li>Firebase Integration für Datenpersistierung</li>
                <li>Inline-Bearbeitung für Name und Bio</li>
                <li>Touch-optimiert für mobile Geräte</li>
                <li>Glassmorphism Design passend zur Galerie</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Integration Instructions */}
        <div className="mt-6 p-6 rounded-3xl bg-blue-50/80 dark:bg-blue-900/20 backdrop-blur-md border border-blue-200/50 dark:border-blue-700/30">
          <h3 className="text-lg font-semibold mb-3 text-blue-800 dark:text-blue-200">
            Integration Instructions
          </h3>
          <div className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
            <p><strong>1. Import the component:</strong></p>
            <code className="block bg-blue-100 dark:bg-blue-900/50 p-2 rounded text-xs">
              import &#123; ProfileHeader &#125; from './components/ProfileHeader';
            </code>
            
            <p><strong>2. Use in your gallery:</strong></p>
            <code className="block bg-blue-100 dark:bg-blue-900/50 p-2 rounded text-xs overflow-x-auto">
              &lt;ProfileHeader<br/>
              &nbsp;&nbsp;galleryId=&#123;gallery.id&#125;<br/>
              &nbsp;&nbsp;initialData=&#123;galleryProfileData&#125;<br/>
              &nbsp;&nbsp;isAdmin=&#123;isAdmin&#125;<br/>
              &nbsp;&nbsp;isDarkMode=&#123;isDarkMode&#125;<br/>
              &nbsp;&nbsp;theme=&#123;gallery.theme&#125;<br/>
              &nbsp;&nbsp;onProfileUpdate=&#123;handleProfileUpdate&#125;<br/>
              /&gt;
            </code>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileHeaderExample;