import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
// Simple Progress component
const Progress: React.FC<{ value: number; className?: string }> = ({ value, className }) => (
  <div className={`w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700 ${className}`}>
    <div 
      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    />
  </div>
);
import { FileImage, Database, Zap, CheckCircle, AlertCircle, BarChart3 } from 'lucide-react';
import MediaMigrationService from '../services/mediaMigrationService';

interface MediaMigrationPanelProps {
  galleryId: string;
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
}

interface MigrationStats {
  totalItems: number;
  base64Items: number;
  estimatedSavings: number;
  migrationRecommended: boolean;
}

interface MigrationProgress {
  total: number;
  processed: number;
  migrated: number;
  failed: number;
  spaceSaved: number;
}

export const MediaMigrationPanel: React.FC<MediaMigrationPanelProps> = ({
  galleryId,
  isOpen,
  onClose,
  isDarkMode
}) => {
  const [migrationStats, setMigrationStats] = useState<MigrationStats | null>(null);
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationComplete, setMigrationComplete] = useState(false);
  const [error, setError] = useState<string>('');

  // Analysiere Galerie beim Öffnen
  useEffect(() => {
    if (isOpen && galleryId) {
      analyzeGallery();
    }
  }, [isOpen, galleryId]);

  const analyzeGallery = async () => {
    setIsAnalyzing(true);
    setError('');
    
    try {
      const stats = await MediaMigrationService.analyzeGalleryForMigration(galleryId);
      setMigrationStats(stats);
    } catch (error) {
      setError('Fehler bei der Analyse der Galerie');
      console.error('Migration analysis error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startMigration = async () => {
    if (!migrationStats) return;
    
    setIsMigrating(true);
    setError('');
    setMigrationComplete(false);
    
    try {
      // Optional: Backup erstellen
      console.log('Creating backup before migration...');
      await MediaMigrationService.createMigrationBackup(galleryId);
      
      // Migration durchführen
      const result = await MediaMigrationService.migrateGalleryMedia(
        galleryId,
        (progress) => {
          setMigrationProgress(progress);
        }
      );
      
      setMigrationProgress(result);
      setMigrationComplete(true);
      
      // Cleanup nach Migration
      await MediaMigrationService.cleanupAfterMigration(galleryId);
      
    } catch (error) {
      setError(`Migration fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
      console.error('Migration error:', error);
    } finally {
      setIsMigrating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto ${
        isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className={`flex items-center gap-2 ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              <Database className="w-5 h-5" />
              Media Storage Optimization
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className={isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}
            >
              ✕
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          
          {/* Analyse-Bereich */}
          <div className="space-y-4">
            <h3 className={`text-lg font-semibold flex items-center gap-2 ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              <BarChart3 className="w-5 h-5" />
              Speicher-Analyse
            </h3>
            
            {isAnalyzing && (
              <div className={`text-center py-4 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-600'
              }`}>
                <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                Analysiere Galerie...
              </div>
            )}
            
            {migrationStats && (
              <div className="grid grid-cols-2 gap-4">
                <div className={`p-4 rounded-lg ${
                  isDarkMode ? 'bg-gray-700' : 'bg-gray-50'
                }`}>
                  <div className={`text-2xl font-bold ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    {migrationStats.totalItems}
                  </div>
                  <div className={`text-sm ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Medien gesamt
                  </div>
                </div>
                
                <div className={`p-4 rounded-lg ${
                  isDarkMode ? 'bg-gray-700' : 'bg-gray-50'
                }`}>
                  <div className={`text-2xl font-bold ${
                    migrationStats.base64Items > 0 ? 'text-orange-500' : 'text-green-500'
                  }`}>
                    {migrationStats.base64Items}
                  </div>
                  <div className={`text-sm ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Base64-Medien
                  </div>
                </div>
                
                <div className={`p-4 rounded-lg col-span-2 ${
                  isDarkMode ? 'bg-gray-700' : 'bg-gray-50'
                }`}>
                  <div className={`text-2xl font-bold ${
                    migrationStats.estimatedSavings > 0 ? 'text-green-500' : 'text-gray-500'
                  }`}>
                    {migrationStats.estimatedSavings.toFixed(1)} MB
                  </div>
                  <div className={`text-sm ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Geschätzte Speicher-Einsparung
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Migration Empfehlung */}
          {migrationStats && (
            <div className={`p-4 rounded-lg border ${
              migrationStats.migrationRecommended
                ? isDarkMode ? 'bg-orange-900/20 border-orange-500/50' : 'bg-orange-50 border-orange-200'
                : isDarkMode ? 'bg-green-900/20 border-green-500/50' : 'bg-green-50 border-green-200'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {migrationStats.migrationRecommended ? (
                  <AlertCircle className="w-5 h-5 text-orange-500" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
                <span className={`font-semibold ${
                  migrationStats.migrationRecommended ? 'text-orange-500' : 'text-green-500'
                }`}>
                  {migrationStats.migrationRecommended ? 'Migration empfohlen' : 'Bereits optimiert'}
                </span>
              </div>
              <p className={`text-sm ${
                isDarkMode ? 'text-gray-300' : 'text-gray-600'
              }`}>
                {migrationStats.migrationRecommended
                  ? `${migrationStats.base64Items} Base64-Medien verbrauchen unnötig viel Speicher. Migration würde etwa ${migrationStats.estimatedSavings.toFixed(1)}MB einsparen.`
                  : 'Ihre Galerie verwendet bereits optimierte Storage-Methoden.'
                }
              </p>
            </div>
          )}
          
          {/* Migration Bereich */}
          {migrationStats?.migrationRecommended && (
            <div className="space-y-4">
              <h3 className={`text-lg font-semibold flex items-center gap-2 ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                <Zap className="w-5 h-5" />
                Instagram-Komprimierung Migration
              </h3>
              
              <div className={`p-4 rounded-lg ${
                isDarkMode ? 'bg-blue-900/20 border border-blue-500/50' : 'bg-blue-50 border border-blue-200'
              }`}>
                <h4 className={`font-semibold mb-2 ${
                  isDarkMode ? 'text-blue-400' : 'text-blue-700'
                }`}>
                  Was passiert bei der Migration?
                </h4>
                <ul className={`text-sm space-y-1 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  <li>• Base64-Medien werden zu Firebase Storage migriert</li>
                  <li>• Instagram-konforme Komprimierung (1080px, 82% Qualität)</li>
                  <li>• Automatisches Backup vor Migration</li>
                  <li>• ~33% Speicher-Einsparung durch Wegfall Base64-Overhead</li>
                </ul>
              </div>
              
              {migrationProgress && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
                      Fortschritt: {migrationProgress.processed}/{migrationProgress.total}
                    </span>
                    <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
                      {migrationProgress.migrated} migriert, {migrationProgress.failed} fehlgeschlagen
                    </span>
                  </div>
                  <Progress 
                    value={(migrationProgress.processed / migrationProgress.total) * 100} 
                    className="w-full"
                  />
                  {migrationProgress.spaceSaved > 0 && (
                    <div className={`text-sm text-green-500`}>
                      {(migrationProgress.spaceSaved / (1024 * 1024)).toFixed(1)}MB gespart
                    </div>
                  )}
                </div>
              )}
              
              {!isMigrating && !migrationComplete && (
                <Button
                  onClick={startMigration}
                  className="w-full"
                  size="lg"
                >
                  <FileImage className="w-4 h-4 mr-2" />
                  Migration starten
                </Button>
              )}
              
              {isMigrating && (
                <Button disabled className="w-full" size="lg">
                  <div className="animate-spin w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full"></div>
                  Migration läuft...
                </Button>
              )}
              
              {migrationComplete && (
                <div className={`p-4 rounded-lg ${
                  isDarkMode ? 'bg-green-900/20 border border-green-500/50' : 'bg-green-50 border border-green-200'
                }`}>
                  <div className="flex items-center gap-2 text-green-500 font-semibold mb-2">
                    <CheckCircle className="w-5 h-5" />
                    Migration erfolgreich abgeschlossen!
                  </div>
                  {migrationProgress && (
                    <p className={`text-sm ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                      {migrationProgress.migrated} Medien migriert, {(migrationProgress.spaceSaved / (1024 * 1024)).toFixed(1)}MB gespart
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* Fehler Anzeige */}
          {error && (
            <div className={`p-4 rounded-lg ${
              isDarkMode ? 'bg-red-900/20 border border-red-500/50' : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-center gap-2 text-red-500 font-semibold">
                <AlertCircle className="w-5 h-5" />
                Fehler
              </div>
              <p className={`text-sm mt-1 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-600'
              }`}>
                {error}
              </p>
            </div>
          )}
          
        </CardContent>
      </Card>
    </div>
  );
};

export default MediaMigrationPanel;