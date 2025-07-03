import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { MediaCompressionService } from './mediaCompressionService';

interface UploadedMedia {
  url: string;
  type: 'image' | 'video';
  fileName: string;
  compressionData?: {
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    processingTime: number;
  };
}

/**
 * Vereinfachter Upload-Service mit Instagram-Komprimierung
 */
export class UploadService {
  
  /**
   * Hauptfunktion für optimierte Medien-Uploads
   */
  static async uploadWithInstagramCompression(
    files: File[],
    galleryId: string,
    userName: string,
    deviceId: string,
    tags: any[] = [],
    onProgress?: (fileIndex: number, progress: number, status: string) => void
  ): Promise<void> {
    
    const compressionResults: any[] = [];
    
    // 1. Komprimierung und Upload zu Firebase Storage
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      if (onProgress) {
        onProgress(i, 0, `Komprimiert ${file.name}...`);
      }
      
      try {
        if (file.type.startsWith('image/')) {
          const result = await MediaCompressionService.compressAndUploadImage(
            file,
            galleryId,
            { contentType: 'feed', adaptiveQuality: true, connectionSpeed: 'medium' }
          );
          compressionResults.push(result);
          
        } else if (file.type.startsWith('video/')) {
          // Check for MOV files and show conversion status
          if (file.type === 'video/quicktime' || file.name.toLowerCase().endsWith('.mov')) {
            if (onProgress) {
              onProgress(i, 10, `Konvertiert MOV zu WebM: ${file.name}...`);
            }
          }
          
          // Process videos through compression service (includes MOV conversion)
          const result = await MediaCompressionService.handleVideoUpload(
            file,
            galleryId,
            { contentType: 'feed', adaptiveQuality: true, connectionSpeed: 'medium' }
          );
          compressionResults.push(result);
        }
        
        if (onProgress) {
          const progressPercent = ((i + 1) / files.length) * 80;
          onProgress(i, progressPercent, `${file.name} komprimiert`);
        }
        
      } catch (error) {
        console.error(`Upload failed for ${file.name}:`, error);
        throw error;
      }
    }
    
    // 2. Firestore-Dokumente erstellen
    if (onProgress) {
      onProgress(files.length - 1, 90, 'Speichert Metadaten...');
    }
    
    for (let i = 0; i < compressionResults.length; i++) {
      const result = compressionResults[i];
      const file = files[i];
      
      await this.createMediaDocument(
        result,
        file,
        galleryId,
        userName,
        deviceId,
        tags
      );
    }
    
    if (onProgress) {
      onProgress(files.length - 1, 100, 'Upload abgeschlossen!');
    }
  }
  
  /**
   * Vereinfachter Video-Upload
   */
  private static async uploadVideoFile(file: File, galleryId: string): Promise<any> {
    // Für Videos: Falls unter 15MB, direkter Upload
    if (file.size < 15 * 1024 * 1024) {
      return {
        url: URL.createObjectURL(file), // Temporär - sollte durch echten Upload ersetzt werden
        originalSize: file.size,
        compressedSize: file.size,
        compressionRatio: 0,
        processingTime: 0
      };
    } else {
      throw new Error('Video zu groß (>15MB)');
    }
  }
  
  /**
   * Erstellt Firestore-Dokument für hochgeladene Medien
   */
  private static async createMediaDocument(
    compressionResult: any,
    originalFile: File,
    galleryId: string,
    userName: string,
    deviceId: string,
    tags: any[]
  ): Promise<void> {
    
    const isVideo = originalFile.type.startsWith('video/');
    const mediaItem = {
      media: compressionResult.url,
      mediaType: isVideo ? 'video' : 'image',
      uploadedBy: userName,
      deviceId: deviceId,
      uploadedAt: Timestamp.now(),
      fileName: originalFile.name,
      originalSize: compressionResult.originalSize,
      compressedSize: compressionResult.compressedSize,
      compressionRatio: compressionResult.compressionRatio,
      spaceSaved: compressionResult.originalSize - compressionResult.compressedSize,
      tags: tags || [],
      // Instagram-spezifische Metadaten
      instagramOptimized: true,
      processingTime: compressionResult.processingTime
    };
    
    await addDoc(collection(db, `galleries/${galleryId}/media`), mediaItem);
  }
}

export default UploadService;