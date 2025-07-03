import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase';

interface InstagramCompressionOptions {
  adaptiveQuality: boolean;
  connectionSpeed: 'fast' | 'medium' | 'slow';
  contentType: 'feed' | 'story' | 'reel';
}

interface CompressionResult {
  url: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  processingTime: number;
}

/**
 * Instagram-ähnlicher Komprimierungsservice mit adaptiver Qualität
 */
export class InstagramCompressionService {
  
  // Instagram-konforme Dimensionen und Qualität
  private static readonly COMPRESSION_PRESETS = {
    feed: {
      maxWidth: 1080,
      maxHeight: 1080,
      quality: 0.85,
      targetSizeKB: 200
    },
    story: {
      maxWidth: 1080,
      maxHeight: 1920,
      quality: 0.80,
      targetSizeKB: 250
    },
    reel: {
      maxWidth: 1080,
      maxHeight: 1920,
      quality: 0.82,
      targetSizeKB: 300
    }
  };

  /**
   * Hauptfunktion für Instagram-ähnliche Bildkomprimierung
   */
  static async compressAndUploadImage(
    file: File,
    galleryId: string,
    options: Partial<InstagramCompressionOptions> = {}
  ): Promise<CompressionResult> {
    const startTime = Date.now();
    const originalSize = file.size;
    
    console.log(`📸 Instagram-style compression starting: ${file.name} (${(originalSize / 1024).toFixed(1)}KB)`);
    
    const {
      adaptiveQuality = true,
      connectionSpeed = 'medium',
      contentType = 'feed'
    } = options;

    try {
      // 1. Adaptive Qualitätsberechnung basierend auf Verbindung
      const preset = this.COMPRESSION_PRESETS[contentType];
      const adaptedQuality = adaptiveQuality 
        ? this.calculateAdaptiveQuality(preset.quality, connectionSpeed, originalSize)
        : preset.quality;

      // 2. Instagram-konforme Komprimierung
      const compressedBlob = await this.performInstagramCompression(
        file, 
        preset, 
        adaptedQuality
      );

      // 3. Upload zu Firebase Storage
      const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const uploadPath = `galleries/${galleryId}/media/${fileName}`;
      
      const storageRef = ref(storage, uploadPath);
      const snapshot = await uploadBytes(storageRef, compressedBlob);
      const downloadURL = await getDownloadURL(snapshot.ref);

      const processingTime = Date.now() - startTime;
      const compressionRatio = ((originalSize - compressedBlob.size) / originalSize) * 100;

      console.log(`✅ Instagram compression complete: ${(compressedBlob.size / 1024).toFixed(1)}KB (${compressionRatio.toFixed(1)}% reduction, ${processingTime}ms)`);

      return {
        url: downloadURL,
        originalSize,
        compressedSize: compressedBlob.size,
        compressionRatio,
        processingTime
      };

    } catch (error) {
      console.error('❌ Instagram compression failed:', error);
      throw new Error(`Komprimierung fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    }
  }

  /**
   * Instagram-konforme Bildkomprimierung mit Canvas
   */
  private static async performInstagramCompression(
    file: File,
    preset: any,
    quality: number
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();

      img.onload = () => {
        try {
          // Instagram-ähnliche Dimensionsberechnung
          const dimensions = this.calculateInstagramDimensions(
            img.width,
            img.height,
            preset.maxWidth,
            preset.maxHeight
          );

          canvas.width = dimensions.width;
          canvas.height = dimensions.height;

          // Instagram-Qualität: High-Quality Resampling
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
          // Optimiertes Zeichnen für bessere Qualität
          ctx.drawImage(img, 0, 0, dimensions.width, dimensions.height);

          // Progressive Komprimierung wie Instagram
          this.progressiveInstagramCompress(canvas, quality, preset.targetSizeKB * 1024)
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
   * Instagram-ähnliche progressive Komprimierung
   */
  private static async progressiveInstagramCompress(
    canvas: HTMLCanvasElement,
    initialQuality: number,
    targetSize: number
  ): Promise<Blob> {
    let quality = initialQuality;
    let attempts = 0;
    const maxAttempts = 6; // Instagram-ähnlicher Bereich

    while (attempts < maxAttempts) {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Komprimierung fehlgeschlagen'));
        }, 'image/jpeg', quality);
      });

      // Instagram-ähnliche Zielerreichung
      if (blob.size <= targetSize || attempts >= maxAttempts - 1) {
        return blob;
      }

      // Instagram-ähnliche Qualitätsreduktion
      quality = Math.max(quality * 0.8, 0.3); // Nie unter 30% Qualität
      attempts++;
    }

    throw new Error('Komprimierung konnte Instagram-Standards nicht erreichen');
  }

  /**
   * Adaptive Qualitätsberechnung basierend auf Verbindung und Dateigröße
   */
  private static calculateAdaptiveQuality(
    baseQuality: number,
    connectionSpeed: 'fast' | 'medium' | 'slow',
    fileSize: number
  ): number {
    let qualityMultiplier = 1.0;

    // Verbindungsgeschwindigkeit berücksichtigen
    switch (connectionSpeed) {
      case 'fast':
        qualityMultiplier = 1.1; // Höhere Qualität bei schneller Verbindung
        break;
      case 'medium':
        qualityMultiplier = 1.0; // Standard-Qualität
        break;
      case 'slow':
        qualityMultiplier = 0.8; // Reduzierte Qualität für langsamere Verbindung
        break;
    }

    // Dateigröße berücksichtigen (größere Dateien = stärkere Komprimierung)
    const sizeMB = fileSize / (1024 * 1024);
    if (sizeMB > 5) {
      qualityMultiplier *= 0.9; // Zusätzliche Reduktion für große Dateien
    } else if (sizeMB > 10) {
      qualityMultiplier *= 0.8;
    }

    const adaptedQuality = Math.max(Math.min(baseQuality * qualityMultiplier, 0.95), 0.3);
    console.log(`🎯 Adaptive quality: ${(adaptedQuality * 100).toFixed(0)}% (base: ${(baseQuality * 100).toFixed(0)}%, speed: ${connectionSpeed}, size: ${sizeMB.toFixed(1)}MB)`);
    
    return adaptedQuality;
  }

  /**
   * Instagram-konforme Dimensionsberechnung
   */
  private static calculateInstagramDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    const aspectRatio = originalWidth / originalHeight;
    
    let width = originalWidth;
    let height = originalHeight;

    // Instagram-ähnliche Größenberechnung
    if (width > maxWidth || height > maxHeight) {
      if (aspectRatio > 1) {
        // Landscape
        width = Math.min(width, maxWidth);
        height = width / aspectRatio;
      } else {
        // Portrait oder quadratisch
        height = Math.min(height, maxHeight);
        width = height * aspectRatio;
      }
    }

    // Instagram rundet auf gerade Zahlen für bessere Kodierung
    return {
      width: Math.round(width / 2) * 2,
      height: Math.round(height / 2) * 2
    };
  }

  /**
   * Batch-Upload mit Instagram-Komprimierung
   */
  static async batchInstagramCompress(
    files: File[],
    galleryId: string,
    options: Partial<InstagramCompressionOptions> = {},
    onProgress?: (fileIndex: number, result: CompressionResult) => void
  ): Promise<CompressionResult[]> {
    console.log(`📸 Starting Instagram batch compression: ${files.length} files`);
    
    const results: CompressionResult[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        let result: CompressionResult;
        
        if (file.type.startsWith('image/')) {
          result = await this.compressAndUploadImage(file, galleryId, options);
        } else if (file.type.startsWith('video/')) {
          // Für Videos: Vereinfachter Upload mit Größenbegrenzung
          result = await this.handleVideoUpload(file, galleryId);
        } else {
          throw new Error(`Nicht unterstützter Dateityp: ${file.type}`);
        }

        results.push(result);
        
        if (onProgress) {
          onProgress(i, result);
        }

      } catch (error) {
        console.error(`❌ File ${i + 1} failed:`, error);
        throw error;
      }
    }

    const totalOriginalSize = results.reduce((sum, r) => sum + r.originalSize, 0);
    const totalCompressedSize = results.reduce((sum, r) => sum + r.compressedSize, 0);
    const overallCompressionRatio = ((totalOriginalSize - totalCompressedSize) / totalOriginalSize) * 100;

    console.log(`✅ Instagram batch complete: ${results.length} files, ${overallCompressionRatio.toFixed(1)}% total compression`);
    return results;
  }

  /**
   * Vereinfachte Video-Behandlung (da Browser-basierte H.264-Kodierung komplex ist)
   */
  private static async handleVideoUpload(
    file: File,
    galleryId: string
  ): Promise<CompressionResult> {
    const startTime = Date.now();
    const originalSize = file.size;

    // Für Videos unter 15MB: Direkter Upload
    if (originalSize < 15 * 1024 * 1024) {
      const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const uploadPath = `galleries/${galleryId}/media/${fileName}`;
      
      const storageRef = ref(storage, uploadPath);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      return {
        url: downloadURL,
        originalSize,
        compressedSize: originalSize, // Keine Komprimierung
        compressionRatio: 0,
        processingTime: Date.now() - startTime
      };
    } else {
      throw new Error('Video zu groß (>15MB). Bitte komprimieren Sie das Video vor dem Upload.');
    }
  }
}

export default InstagramCompressionService;