import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase';

interface CompressionConfig {
  images: {
    maxWidth: number;
    maxHeight: number;
    quality: number;
    targetSizeKB: number;
    format: 'jpeg' | 'webp';
  };
  videos: {
    maxWidth: number;
    maxHeight: number;
    targetBitrate: string;
    targetSizeKB: number;
  };
}

// Instagram-konforme Komprimierungsstandards
const COMPRESSION_CONFIG: CompressionConfig = {
  images: {
    maxWidth: 1080,  // Instagram Standard: max 1080px
    maxHeight: 1080, // Quadratische Posts: 1080x1080
    quality: 0.82,   // Instagram-ähnliche Qualität (82%)
    targetSizeKB: 200, // Aggressivere Komprimierung für Firebase
    format: 'jpeg'   // Instagram Standard: JPEG
  },
  videos: {
    maxWidth: 1080,    // Instagram Standard: max 1080p
    maxHeight: 1920,   // Stories-Format unterstützen
    targetBitrate: '2M', // Instagram H.264 Bitrate
    targetSizeKB: 8000   // 8MB target (Instagram-ähnlich)
  }
};

export class OptimizedMediaHandler {
  
  /**
   * Komprimiert und lädt Bilder direkt zu Firebase Storage hoch
   */
  static async compressAndUploadImage(
    file: File, 
    uploadPath: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    console.log(`🗜️ Compressing image: ${file.name} (${(file.size / 1024).toFixed(1)}KB)`);
    
    try {
      // 1. Komprimierung
      const compressedBlob = await this.compressImage(file);
      console.log(`✅ Compressed: ${(compressedBlob.size / 1024).toFixed(1)}KB (${((file.size - compressedBlob.size) / file.size * 100).toFixed(1)}% reduction)`);
      
      // 2. Direkter Upload zu Firebase Storage
      const storageRef = ref(storage, uploadPath);
      const snapshot = await uploadBytes(storageRef, compressedBlob);
      
      // 3. Download-URL holen
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      console.log(`✅ Image uploaded successfully: ${uploadPath}`);
      return downloadURL;
      
    } catch (error) {
      console.error(`❌ Image upload failed:`, error);
      throw new Error(`Upload fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    }
  }

  /**
   * Effiziente Bildkomprimierung mit Canvas
   */
  private static async compressImage(file: File): Promise<Blob> {
    const config = COMPRESSION_CONFIG.images;
    
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();

      img.onload = () => {
        try {
          // Optimale Dimensionen berechnen
          const { width, height } = this.calculateOptimalDimensions(
            img.width, 
            img.height, 
            config.maxWidth, 
            config.maxHeight
          );

          canvas.width = width;
          canvas.height = height;

          // Bild zeichnen mit optimaler Qualität
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // Progressive Komprimierung bis Zielgröße erreicht
          this.progressiveCompress(canvas, config.quality, config.targetSizeKB * 1024)
            .then(resolve)
            .catch(reject);

        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('Bild konnte nicht geladen werden'));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Progressive Komprimierung bis Zielgröße erreicht
   */
  private static async progressiveCompress(
    canvas: HTMLCanvasElement, 
    initialQuality: number, 
    targetSize: number
  ): Promise<Blob> {
    let quality = initialQuality;
    let attempts = 0;
    const maxAttempts = 8;

    while (attempts < maxAttempts) {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Komprimierung fehlgeschlagen'));
        }, 'image/jpeg', quality);
      });

      // Zielgröße erreicht oder maximale Versuche
      if (blob.size <= targetSize || attempts >= maxAttempts - 1) {
        return blob;
      }

      // Qualität reduzieren für nächsten Versuch
      quality *= 0.75;
      attempts++;
    }

    throw new Error('Komprimierung konnte Zielgröße nicht erreichen');
  }

  /**
   * Video-Komprimierung und Upload (für größere Videos)
   */
  static async compressAndUploadVideo(
    file: File, 
    uploadPath: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    console.log(`🎬 Processing video: ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)}MB)`);
    
    try {
      // Für kleinere Videos (<10MB) direkter Upload ohne Komprimierung
      if (file.size < 10 * 1024 * 1024) {
        console.log(`✅ Video under 10MB, uploading directly`);
        const storageRef = ref(storage, uploadPath);
        const snapshot = await uploadBytes(storageRef, file);
        return await getDownloadURL(snapshot.ref);
      }

      // Für größere Videos: Komprimierung mit Web-basierter Lösung
      const compressedBlob = await this.compressVideoWebBased(file, onProgress);
      
      const storageRef = ref(storage, uploadPath);
      const snapshot = await uploadBytes(storageRef, compressedBlob);
      
      const downloadURL = await getDownloadURL(snapshot.ref);
      console.log(`✅ Video uploaded successfully: ${uploadPath}`);
      return downloadURL;
      
    } catch (error) {
      console.error(`❌ Video upload failed:`, error);
      throw new Error(`Video-Upload fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    }
  }

  /**
   * Web-basierte Video-Komprimierung ohne FFMPEG
   */
  private static async compressVideoWebBased(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      video.onloadedmetadata = () => {
        try {
          const config = COMPRESSION_CONFIG.videos;
          
          // Optimale Dimensionen berechnen
          const { width, height } = this.calculateOptimalDimensions(
            video.videoWidth,
            video.videoHeight,
            config.maxWidth,
            config.maxHeight
          );

          canvas.width = width;
          canvas.height = height;

          // Video frame komprimieren
          ctx.drawImage(video, 0, 0, width, height);
          
          canvas.toBlob((blob) => {
            if (blob) {
              console.log(`🎬 Video compressed: ${(blob.size / (1024 * 1024)).toFixed(1)}MB`);
              resolve(blob);
            } else {
              reject(new Error('Video-Komprimierung fehlgeschlagen'));
            }
          }, 'video/mp4', 0.7);

        } catch (error) {
          reject(error);
        }
      };

      video.onerror = () => reject(new Error('Video konnte nicht geladen werden'));
      video.src = URL.createObjectURL(file);
      video.load();
    });
  }

  /**
   * Berechnet optimale Dimensionen unter Beibehaltung des Seitenverhältnisses
   */
  private static calculateOptimalDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    const aspectRatio = originalWidth / originalHeight;

    let width = originalWidth;
    let height = originalHeight;

    // Reduzierung falls zu groß
    if (width > maxWidth) {
      width = maxWidth;
      height = width / aspectRatio;
    }

    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }

    return {
      width: Math.round(width),
      height: Math.round(height)
    };
  }

  /**
   * Batch-Upload für mehrere Dateien
   */
  static async batchUploadMedia(
    files: File[],
    galleryId: string,
    onProgress?: (fileIndex: number, progress: number) => void
  ): Promise<string[]> {
    const uploadPromises = files.map(async (file, index) => {
      const timestamp = Date.now();
      const fileName = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const uploadPath = `galleries/${galleryId}/media/${fileName}`;

      const progressCallback = (progress: number) => {
        if (onProgress) onProgress(index, progress);
      };

      if (file.type.startsWith('image/')) {
        return await this.compressAndUploadImage(file, uploadPath, progressCallback);
      } else if (file.type.startsWith('video/')) {
        return await this.compressAndUploadVideo(file, uploadPath, progressCallback);
      } else {
        throw new Error(`Nicht unterstützter Dateityp: ${file.type}`);
      }
    });

    return await Promise.all(uploadPromises);
  }

  /**
   * Hilfsfunktion für bestehende Medien-Konvertierung von Base64 zu Firebase Storage
   */
  static async migrateBase64ToStorage(
    base64Data: string,
    fileName: string,
    galleryId: string
  ): Promise<string> {
    try {
      // Base64 zu Blob konvertieren
      const response = await fetch(base64Data);
      const blob = await response.blob();
      
      // Upload zu Firebase Storage
      const uploadPath = `galleries/${galleryId}/media/migrated-${fileName}`;
      const storageRef = ref(storage, uploadPath);
      const snapshot = await uploadBytes(storageRef, blob);
      
      return await getDownloadURL(snapshot.ref);
      
    } catch (error) {
      console.error(`❌ Migration failed for ${fileName}:`, error);
      throw error;
    }
  }
}

export default OptimizedMediaHandler;