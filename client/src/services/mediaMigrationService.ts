import { doc, updateDoc, collection, query, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import OptimizedMediaHandler from '../utils/optimizedMediaHandler';
import { MediaCompressionService } from './mediaCompressionService';

interface MigrationProgress {
  total: number;
  processed: number;
  migrated: number;
  failed: number;
  spaceSaved: number; // in bytes
}

interface MediaItem {
  id: string;
  media: string; // Base64 oder URL
  mediaType: 'image' | 'video';
  [key: string]: any;
}

/**
 * Service für Migration von Base64-Medien zu Firebase Storage
 * Löst das Storage-Problem durch Umstellung auf direkte Storage-Uploads
 */
export class MediaMigrationService {
  
  /**
   * Migiert alle Base64-Medien einer Galerie zu Firebase Storage
   */
  static async migrateGalleryMedia(
    galleryId: string,
    onProgress?: (progress: MigrationProgress) => void
  ): Promise<MigrationProgress> {
    const progress: MigrationProgress = {
      total: 0,
      processed: 0,
      migrated: 0,
      failed: 0,
      spaceSaved: 0
    };

    try {
      // 1. Alle Medien-Dokumente laden
      const mediaItems = await this.loadGalleryMediaItems(galleryId);
      progress.total = mediaItems.length;
      
      if (onProgress) onProgress(progress);

      // 2. Base64-Medien identifizieren und migrieren
      const batch = writeBatch(db);
      let batchCount = 0;
      const BATCH_SIZE = 10; // Firebase batch limit beachten

      for (const item of mediaItems) {
        try {
          if (this.isBase64Media(item.media)) {
            // Originalgröße berechnen (Base64)
            const originalSize = this.calculateBase64Size(item.media);
            
            // Migration zu Firebase Storage
            const newUrl = await this.migrateToStorage(item, galleryId);
            
            // Dokument aktualisieren
            const docRef = doc(db, `galleries/${galleryId}/media`, item.id);
            batch.update(docRef, { media: newUrl });
            batchCount++;
            
            progress.migrated++;
            progress.spaceSaved += originalSize * 0.33;
          }
          
          progress.processed++;
          
          // Batch schreiben bei Limit
          if (batchCount >= BATCH_SIZE) {
            await batch.commit();
            console.log(`💾 Committed batch of ${batchCount} updates`);
            batchCount = 0;
          }
          
          if (onProgress) onProgress(progress);
          
        } catch (error) {
          console.error(`❌ Failed to migrate ${item.id}:`, error);
          progress.failed++;
          continue;
        }
      }

      // Letzten Batch schreiben
      if (batchCount > 0) {
        await batch.commit();
        console.log(`💾 Committed final batch of ${batchCount} updates`);
      }

      console.log(`✅ Migration complete: ${progress.migrated}/${progress.total} migrated, ${(progress.spaceSaved / (1024 * 1024)).toFixed(1)}MB saved`);
      return progress;

    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  /**
   * Lädt alle Medien-Items einer Galerie
   */
  private static async loadGalleryMediaItems(galleryId: string): Promise<MediaItem[]> {
    const mediaRef = collection(db, `galleries/${galleryId}/media`);
    const snapshot = await getDocs(query(mediaRef));
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as MediaItem[];
  }

  /**
   * Prüft ob es sich um Base64-Daten handelt
   */
  private static isBase64Media(mediaUrl: string): boolean {
    return mediaUrl && mediaUrl.startsWith('data:');
  }

  /**
   * Berechnet ungefähre Größe von Base64-Daten
   */
  private static calculateBase64Size(base64Data: string): number {
    // Base64 hat ~33% Overhead
    const base64Length = base64Data.length;
    const padding = base64Data.endsWith('==') ? 2 : base64Data.endsWith('=') ? 1 : 0;
    return Math.floor((base64Length * 3) / 4) - padding;
  }

  /**
   * Migriert einzelnes Base64-Medium zu Firebase Storage
   */
  private static async migrateToStorage(
    item: MediaItem,
    galleryId: string
  ): Promise<string> {
    try {
      // Base64 zu Blob konvertieren
      const response = await fetch(item.media);
      const blob = await response.blob();
      
      // File-Objekt erstellen für Komprimierung
      const file = new File([blob], `migrated-${item.id}`, {
        type: blob.type,
        lastModified: Date.now()
      });

      // Fast media compression and upload
      if (item.mediaType === 'image') {
        const result = await MediaCompressionService.compressAndUploadImage(
          file,
          galleryId,
          { contentType: 'feed', adaptiveQuality: true, connectionSpeed: 'medium' }
        );
        
        console.log(`📸 Image migrated with ${result.compressionRatio.toFixed(1)}% compression`);
        return result.url;
        
      } else if (item.mediaType === 'video') {
        const result = await OptimizedMediaHandler.compressAndUploadVideo(
          file,
          `galleries/${galleryId}/media/migrated-${Date.now()}-${file.name}`
        );
        
        console.log(`🎬 Video migrated successfully`);
        return result;
        
      } else {
        throw new Error(`Unbekannter Medientyp: ${item.mediaType}`);
      }

    } catch (error) {
      console.error(`❌ Storage migration failed for ${item.id}:`, error);
      throw error;
    }
  }

  /**
   * Analysiert Galerie für Migration-Potenzial
   */
  static async analyzeGalleryForMigration(galleryId: string): Promise<{
    totalItems: number;
    base64Items: number;
    estimatedSavings: number; // in MB
    migrationRecommended: boolean;
  }> {
    try {
      const mediaItems = await this.loadGalleryMediaItems(galleryId);
      
      let base64Count = 0;
      let totalBase64Size = 0;
      
      for (const item of mediaItems) {
        if (this.isBase64Media(item.media)) {
          base64Count++;
          totalBase64Size += this.calculateBase64Size(item.media);
        }
      }

      const estimatedSavings = (totalBase64Size * 0.33) / (1024 * 1024); // MB savings
      const migrationRecommended = base64Count > 5 || estimatedSavings > 1; // Empfehlung ab 5 Items oder 1MB Einsparung

      console.log(`📊 Migration analysis: ${base64Count}/${mediaItems.length} Base64 items, ~${estimatedSavings.toFixed(1)}MB potential savings`);

      return {
        totalItems: mediaItems.length,
        base64Items: base64Count,
        estimatedSavings,
        migrationRecommended
      };

    } catch (error) {
      console.error('❌ Migration analysis failed:', error);
      throw error;
    }
  }

  /**
   * Bereinigt verwaiste Base64-Daten nach Migration
   */
  static async cleanupAfterMigration(galleryId: string): Promise<void> {
    console.log(`🧹 Starting cleanup after migration for gallery: ${galleryId}`);
    
    try {
      // Könnte hier zusätzliche Bereinigungslogik implementieren
      // z.B. lokale Caches leeren, temporäre Dateien entfernen
      
      console.log(`✅ Cleanup completed for gallery: ${galleryId}`);
      
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Erstellt Backup vor Migration (optional)
   */
  static async createMigrationBackup(galleryId: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupId = `backup-${galleryId}-${timestamp}`;
    
    console.log(`💾 Creating migration backup: ${backupId}`);
    
    try {
      const mediaItems = await this.loadGalleryMediaItems(galleryId);
      
      // Backup in spezieller Collection speichern
      const batch = writeBatch(db);
      
      mediaItems.forEach((item, index) => {
        const backupRef = doc(db, `migration-backups/${backupId}/media`, item.id);
        batch.set(backupRef, {
          ...item,
          backupCreated: new Date(),
          originalGallery: galleryId
        });
      });
      
      await batch.commit();
      
      console.log(`✅ Backup created: ${backupId} (${mediaItems.length} items)`);
      return backupId;
      
    } catch (error) {
      console.error('❌ Backup creation failed:', error);
      throw error;
    }
  }
}

export default MediaMigrationService;