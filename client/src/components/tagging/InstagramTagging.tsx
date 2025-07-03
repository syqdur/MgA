import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { X, Users, MapPin, Type, Trash2 } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';

interface TagPosition {
  x: number; // percentage from left
  y: number; // percentage from top
}

interface PersonTag {
  id: string;
  type: 'person';
  position: TagPosition;
  userName: string;
  displayName?: string;
  deviceId: string;
}

interface LocationTag {
  id: string;
  type: 'location';
  position: TagPosition;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

interface TextTag {
  id: string;
  type: 'text';
  position: TagPosition;
  text: string;
}

type MediaTag = PersonTag | LocationTag | TextTag;

interface InstagramTaggingProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tags: MediaTag[]) => void;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  initialTags?: MediaTag[];
  galleryId: string;
  galleryUsers: any[];
}

const InstagramTagging: React.FC<InstagramTaggingProps> = ({
  isOpen,
  onClose,
  onSave,
  mediaUrl,
  mediaType,
  initialTags = [],
  galleryId,
  galleryUsers
}) => {
  const [tags, setTags] = useState<MediaTag[]>(initialTags);
  const [mode, setMode] = useState<'idle' | 'person' | 'location' | 'text'>('idle');
  const [selectedPosition, setSelectedPosition] = useState<TagPosition | null>(null);
  const [showTags, setShowTags] = useState(false);
  const [showUserList, setShowUserList] = useState(false);
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [textInput, setTextInput] = useState('');

  const [locationSearchResults, setLocationSearchResults] = useState<any[]>([]);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLImageElement | HTMLVideoElement>(null);

  // Gallery users are now passed as a prop, no need to load them here

  // Location search effect
  useEffect(() => {
    if (searchQuery && showLocationInput) {
      const searchLocations = async () => {
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=8&accept-language=de`
          );
          const data = await response.json();
          
          const results = data.map((item: any) => ({
            name: item.display_name.split(',')[0] || item.display_name,
            address: item.display_name,
            latitude: parseFloat(item.lat),
            longitude: parseFloat(item.lon)
          }));
          
          setLocationSearchResults(results);
        } catch (error) {
          console.error('Location search failed:', error);
          setLocationSearchResults([]);
        }
      };
      
      const timeoutId = setTimeout(searchLocations, 300);
      return () => clearTimeout(timeoutId);
    } else {
      setLocationSearchResults([]);
    }
  }, [searchQuery, showLocationInput]);

  const handleMediaClick = useCallback((e: React.MouseEvent) => {
    if (mode === 'idle' || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const position = { x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(95, y)) };
    setSelectedPosition(position);

    if (mode === 'person') {
      setShowUserList(true);
    } else if (mode === 'location') {
      setShowLocationInput(true);
    } else if (mode === 'text') {
      setShowTextInput(true);
    }
  }, [mode]);

  const addPersonTag = useCallback((user: any) => {
    if (!selectedPosition) return;

    const newTag: PersonTag = {
      id: Date.now().toString(),
      type: 'person',
      position: selectedPosition,
      userName: user.userName,
      displayName: user.displayName,
      deviceId: user.deviceId
    };

    setTags(prev => [...prev, newTag]);
    setShowUserList(false);
    setSelectedPosition(null);
    setMode('idle');
    setSearchQuery('');
  }, [selectedPosition]);

  const addLocationTag = useCallback((location: any) => {
    if (!selectedPosition) return;

    const newTag: LocationTag = {
      id: Date.now().toString(),
      type: 'location',
      position: selectedPosition,
      name: location.name,
      address: location.address,
      latitude: location.latitude,
      longitude: location.longitude
    };

    setTags(prev => [...prev, newTag]);
    setShowLocationInput(false);
    setSelectedPosition(null);
    setMode('idle');
    setSearchQuery('');
    setLocationSearchResults([]);
  }, [selectedPosition]);

  const addTextTag = useCallback(() => {
    if (!selectedPosition || !textInput.trim()) return;

    const newTag: TextTag = {
      id: Date.now().toString(),
      type: 'text',
      position: selectedPosition,
      text: textInput.trim()
    };

    setTags(prev => [...prev, newTag]);
    setShowTextInput(false);
    setSelectedPosition(null);
    setMode('idle');
    setTextInput('');
  }, [selectedPosition, textInput]);

  const removeTag = useCallback((tagId: string) => {
    setTags(prev => prev.filter(tag => tag.id !== tagId));
  }, []);

  const clearAllTags = useCallback(() => {
    setTags([]);
    setMode('idle');
  }, []);

  const handleGPSLocation = useCallback(async () => {
    if (!selectedPosition) return;

    setIsLoadingLocation(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 60000
        });
      });
      
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=de`
      );
      const data = await response.json();
      
      addLocationTag({
        name: data.display_name?.split(',')[0] || 'Aktueller Standort',
        address: data.display_name || '',
        latitude: lat,
        longitude: lon
      });
    } catch (error) {
      console.error('GPS location failed:', error);
      alert('Standort konnte nicht ermittelt werden. Bitte Berechtigung prüfen.');
    } finally {
      setIsLoadingLocation(false);
    }
  }, [selectedPosition, addLocationTag]);

  const handleSave = useCallback(() => {
    onSave(tags);
    onClose();
  }, [tags, onSave, onClose]);

  const handleClose = useCallback(() => {
    setMode('idle');
    setSelectedPosition(null);
    setShowUserList(false);
    setShowLocationInput(false);
    setShowTextInput(false);
    setSearchQuery('');
    setTextInput('');
    onClose();
  }, [onClose]);

  // Tag position calculations
  const getTagStyle = (position: TagPosition) => ({
    left: `${position.x}%`,
    top: `${position.y}%`,
    transform: 'translate(-50%, -50%)'
  });

  const getLabelPosition = (position: TagPosition) => {
    const isRight = position.x > 50;
    const isBottom = position.y > 70;
    
    return {
      [isRight ? 'right' : 'left']: '100%',
      [isBottom ? 'bottom' : 'top']: '50%',
      transform: `translateY(${isBottom ? '50%' : '-50%'})`,
      marginLeft: isRight ? '-8px' : '8px'
    };
  };

  // Filtered users for search
  const filteredUsers = useMemo(() => {
    if (!searchQuery) return galleryUsers;
    return galleryUsers.filter((user: any) => 
      user.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.displayName && user.displayName.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [galleryUsers, searchQuery]);

  // Recent users (first 5)
  const recentUsers = useMemo(() => galleryUsers.slice(0, 5), [galleryUsers]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2147483647] bg-black/60 backdrop-blur-lg flex items-center justify-center p-4">
      {/* Instagram 2.0 Popup Modal */}
      <div className="bg-white/95 backdrop-blur-xl border border-white/30 shadow-2xl rounded-3xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 bg-gradient-to-r from-purple-500/10 to-pink-500/10 backdrop-blur-xl border-b border-gray-200/30">
          <button 
            onClick={handleClose} 
            className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100/60 hover:bg-gray-200/60 transition-all duration-300 hover:scale-110"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-gray-900 font-bold text-xl">📸 Foto markieren</h1>
          <button 
            onClick={handleSave}
            className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full font-semibold hover:from-purple-600 hover:to-pink-600 hover:scale-105 transition-all duration-300 shadow-lg"
          >
            Fertig
          </button>
        </div>

        {/* Media Container */}
        <div className="flex-1 relative overflow-hidden bg-gray-50/30">
          <div 
            ref={containerRef}
            className="relative w-full h-full flex items-center justify-center p-4"
            style={{ cursor: mode !== 'idle' ? 'crosshair' : 'default' }}
            onClick={handleMediaClick}
            onMouseEnter={() => setShowTags(true)}
            onMouseLeave={() => setShowTags(false)}
          >
            {mediaType === 'image' ? (
              <img
                ref={mediaRef as React.RefObject<HTMLImageElement>}
                src={mediaUrl}
                alt="Media"
                className="max-w-full max-h-full object-contain rounded-2xl shadow-xl"
                draggable={false}
              />
            ) : (
              <video
                ref={mediaRef as React.RefObject<HTMLVideoElement>}
                src={mediaUrl}
                className="max-w-full max-h-full object-contain rounded-2xl shadow-xl"
                controls
                preload="metadata"
              />
            )}

            {/* Tags Overlay */}
            {tags.map(tag => (
              <div
                key={tag.id}
                className="absolute group"
                style={getTagStyle(tag.position)}
              >
                {/* Tag Dot */}
                <div className="relative">
                  <div className="w-6 h-6 bg-white border-2 border-purple-500 rounded-full animate-pulse shadow-lg" />
                  
                  {/* Tag Label */}
                  <div 
                    className={`absolute z-10 px-2 py-1 bg-black/80 text-white text-xs rounded-md whitespace-nowrap transition-opacity ${
                      showTags || mode !== 'idle' ? 'opacity-100' : 'opacity-0'
                    }`}
                    style={getLabelPosition(tag.position)}
                  >
                    {tag.type === 'person' && (tag.displayName || tag.userName)}
                    {tag.type === 'location' && tag.name}
                    {tag.type === 'text' && tag.text}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeTag(tag.id);
                      }}
                      className="ml-1 text-red-400 hover:text-red-300"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Selected Position Indicator */}
            {selectedPosition && (
              <div
                className="absolute w-6 h-6 bg-yellow-400 border-2 border-white rounded-full animate-ping"
                style={getTagStyle(selectedPosition)}
              />
            )}
          </div>
        </div>

        {/* Bottom Controls */}
        <div className="p-6 bg-gradient-to-t from-gray-50/50 to-transparent border-t border-gray-200/30">
          {/* Tag Counter */}
          {tags.length > 0 && (
            <div className="text-center mb-4">
              <span className="text-gray-600 text-sm">
                {tags.filter(t => t.type === 'person').length} Personen, {' '}
                {tags.filter(t => t.type === 'location').length} Orte, {' '}
                {tags.filter(t => t.type === 'text').length} Texte markiert
              </span>
              <button
                onClick={clearAllTags}
                className="ml-3 text-red-500 hover:text-red-600 text-sm font-medium"
              >
                Alle löschen
              </button>
            </div>
          )}

          {/* Control Buttons */}
          <div className="grid grid-cols-4 gap-3">
            <button
              onClick={() => setMode(mode === 'person' ? 'idle' : 'person')}
              className={`flex flex-col items-center px-4 py-3 rounded-full backdrop-blur-sm transition-all duration-300 ${
                mode === 'person' 
                  ? 'bg-gradient-to-br from-purple-500/90 to-pink-500/90 text-white shadow-lg shadow-purple-500/30 scale-105 border border-white/20' 
                  : 'bg-gray-100/60 text-gray-700 hover:bg-gray-200/60 border border-gray-200/30 hover:scale-105'
              }`}
            >
              <Users className="w-5 h-5 mb-2" />
              <span className="text-xs font-medium">Personen</span>
            </button>

            <button
              onClick={() => setMode(mode === 'location' ? 'idle' : 'location')}
              className={`flex flex-col items-center px-4 py-3 rounded-full backdrop-blur-sm transition-all duration-300 ${
                mode === 'location' 
                  ? 'bg-gradient-to-br from-green-500/90 to-emerald-500/90 text-white shadow-lg shadow-green-500/30 scale-105 border border-white/20' 
                  : 'bg-gray-100/60 text-gray-700 hover:bg-gray-200/60 border border-gray-200/30 hover:scale-105'
              }`}
            >
              <MapPin className="w-5 h-5 mb-2" />
              <span className="text-xs font-medium">Ort</span>
            </button>

            <button
              onClick={() => setMode(mode === 'text' ? 'idle' : 'text')}
              className={`flex flex-col items-center px-4 py-3 rounded-full backdrop-blur-sm transition-all duration-300 ${
                mode === 'text' 
                  ? 'bg-gradient-to-br from-blue-500/90 to-cyan-500/90 text-white shadow-lg shadow-blue-500/30 scale-105 border border-white/20' 
                  : 'bg-gray-100/60 text-gray-700 hover:bg-gray-200/60 border border-gray-200/30 hover:scale-105'
              }`}
            >
              <Type className="w-5 h-5 mb-2" />
              <span className="text-xs font-medium">Text</span>
            </button>

            <button
              onClick={clearAllTags}
              disabled={tags.length === 0}
              className={`flex flex-col items-center px-4 py-3 rounded-full backdrop-blur-sm transition-all duration-300 ${
                tags.length > 0
                  ? 'bg-gradient-to-br from-red-500/90 to-rose-500/90 text-white hover:from-red-600/90 hover:to-rose-600/90 shadow-lg shadow-red-500/30 border border-white/20 hover:scale-105' 
                  : 'bg-gray-100/30 text-gray-400 cursor-not-allowed border border-gray-200/20'
              }`}
            >
              <Trash2 className="w-5 h-5 mb-2" />
              <span className="text-xs font-medium">Löschen</span>
            </button>
          </div>

          {/* Instructions */}
          {mode === 'idle' && tags.length === 0 && (
            <div className="text-center mt-4">
              <p className="text-gray-500 text-sm">
                Wähle eine Kategorie und tippe auf das Bild zum Markieren
              </p>
            </div>
          )}

          {mode !== 'idle' && !selectedPosition && (
            <div className="text-center mt-4">
              <p className="text-gray-700 text-sm">
                Tippe auf das Bild, um {mode === 'person' ? 'eine Person' : mode === 'location' ? 'einen Ort' : 'Text'} zu markieren
              </p>
            </div>
          )}
        </div>

        {/* Instagram 2.0 User Selection Modal */}
        {showUserList && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-lg flex items-end md:items-center justify-center z-20">
            <div className="bg-white/95 backdrop-blur-xl border border-white/30 shadow-2xl rounded-t-3xl md:rounded-3xl w-full md:max-w-lg max-h-[70vh] overflow-hidden">
              <div className="p-6 border-b border-gray-100/30">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 text-lg">Person markieren</h3>
                  <button 
                    onClick={() => setShowUserList(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100/60 hover:bg-gray-200/60 transition-all duration-200"
                  >
                    <X className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Person suchen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-3 bg-gradient-to-r from-gray-50/80 to-white/80 border border-gray-200/50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-300/60 transition-all duration-200 placeholder-gray-400 shadow-sm"
                  autoFocus
                />
              </div>
              
              <div className="overflow-y-auto max-h-80">
                {/* All Users */}
                <div className="p-6">
                  <h4 className="text-sm font-medium text-gray-600 mb-3">
                    {searchQuery ? 'Suchergebnisse' : 'Alle Personen'}
                  </h4>
                  {filteredUsers.map((user: any) => (
                    <button
                      key={user.deviceId}
                      onClick={() => addPersonTag(user)}
                      className="w-full flex items-center gap-4 p-4 hover:bg-gray-50/80 rounded-2xl transition-all duration-200 mb-2 hover:scale-[1.02]"
                    >
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center overflow-hidden shadow-sm">
                        {user.profilePicture ? (
                          <img src={user.profilePicture} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-purple-600 font-medium">
                            {(user.displayName || user.userName).charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-gray-900">{user.displayName || user.userName}</div>
                        {user.displayName && (
                          <div className="text-sm text-gray-500">@{user.userName}</div>
                        )}
                      </div>
                      {user.isOnline && (
                        <div className="w-3 h-3 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full shadow-sm" />
                      )}
                    </button>
                  ))}
                  
                  {filteredUsers.length === 0 && (
                    <p className="text-gray-500 text-center py-8 text-sm">
                      {searchQuery ? 'Keine Personen gefunden' : 'Keine Nutzer verfügbar'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Location Input Modal */}
        {showLocationInput && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center z-20">
            <div className="bg-white/95 backdrop-blur-xl border border-white/20 shadow-2xl rounded-t-3xl md:rounded-3xl w-full md:max-w-md max-h-[70vh] overflow-hidden">
              <div className="p-6 border-b border-gray-100/50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-gray-900">Ort hinzufügen</h3>
                  <button 
                    onClick={() => setShowLocationInput(false)}
                    className="p-2 hover:bg-gray-100/50 rounded-full transition-colors duration-200"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
                
                <div className="space-y-3">
                  <button
                    onClick={handleGPSLocation}
                    disabled={isLoadingLocation}
                    className="w-full flex items-center gap-3 p-4 bg-gradient-to-r from-green-50/80 to-emerald-50/80 hover:from-green-100/80 hover:to-emerald-100/80 rounded-2xl disabled:opacity-50 transition-all duration-200 border border-green-100/30"
                  >
                    <MapPin className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-700">
                      {isLoadingLocation ? 'Standort wird ermittelt...' : 'Aktueller Standort'}
                    </span>
                  </button>
                  
                  <input
                    type="text"
                    placeholder="Ort suchen..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50/80 border border-gray-200/50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-300 transition-all duration-200 placeholder-gray-400"
                  />
                </div>
              </div>
              
              {locationSearchResults.length > 0 && (
                <div className="overflow-y-auto max-h-80 p-4">
                  {locationSearchResults.map((location: any, index: number) => (
                    <button
                      key={index}
                      onClick={() => addLocationTag(location)}
                      className="w-full flex items-start gap-4 p-4 hover:bg-gray-50/60 rounded-2xl text-left transition-all duration-200 mb-2"
                    >
                      <div className="w-10 h-10 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center mt-1 shadow-sm">
                        <MapPin className="w-4 h-4 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{location.name}</div>
                        <div className="text-sm text-gray-500 line-clamp-2 mt-1">{location.address}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Text Input Modal */}
        {showTextInput && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center z-20">
            <div className="bg-white/95 backdrop-blur-xl border border-white/20 shadow-2xl rounded-t-3xl md:rounded-3xl w-full md:max-w-md">
              <div className="p-6 border-b border-gray-100/50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-gray-900">Text hinzufügen</h3>
                  <button 
                    onClick={() => setShowTextInput(false)}
                    className="p-2 hover:bg-gray-100/50 rounded-full transition-colors duration-200"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
                <p className="text-sm text-gray-500">
                  Dieser Text wird auf dem Bild angezeigt
                </p>
              </div>
              
              <div className="p-6">
                <textarea
                  placeholder="Text eingeben..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50/80 border border-gray-200/50 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-300 transition-all duration-200 placeholder-gray-400"
                  rows={3}
                  maxLength={100}
                  autoFocus
                />
                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-gray-400">{textInput.length}/100</span>
                  <button
                    onClick={addTextTag}
                    disabled={!textInput.trim()}
                    className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-lg shadow-purple-500/25"
                  >
                    Hinzufügen
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InstagramTagging;