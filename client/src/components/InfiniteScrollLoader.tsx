import React from 'react';
import { Loader2 } from 'lucide-react';

interface InfiniteScrollLoaderProps {
  isLoading: boolean;
  hasMore: boolean;
  isDarkMode: boolean;
  className?: string;
}

export const InfiniteScrollLoader: React.FC<InfiniteScrollLoaderProps> = ({
  isLoading,
  hasMore,
  isDarkMode,
  className = ''
}) => {
  if (!hasMore && !isLoading) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          Alle Medien geladen 📸
        </p>
      </div>
    );
  }

  if (!isLoading) return null;

  return (
    <div className={`flex flex-col items-center justify-center py-8 space-y-3 ${className}`}>
      <Loader2 className={`w-6 h-6 animate-spin ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`} />
      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
        Lade weitere Medien...
      </p>
    </div>
  );
};