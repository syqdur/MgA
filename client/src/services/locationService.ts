export interface LocationResult {
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
}

export interface GeoPosition {
  latitude: number;
  longitude: number;
}

export class LocationService {
  static async getCurrentLocation(): Promise<GeoPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 60000
        }
      );
    });
  }

  static async reverseGeocode(lat: number, lon: number): Promise<LocationResult> {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=de`
      );
      const data = await response.json();
      
      return {
        name: data.display_name || 'Unbekannter Ort',
        address: data.display_name || '',
        latitude: lat,
        longitude: lon
      };
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
      return {
        name: 'Aktueller Standort',
        address: '',
        latitude: lat,
        longitude: lon
      };
    }
  }

  static async searchLocations(query: string): Promise<LocationResult[]> {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=8&accept-language=de`
      );
      const data = await response.json();
      
      return data.map((item: any) => ({
        name: item.display_name.split(',')[0] || item.display_name,
        address: item.display_name,
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon)
      }));
    } catch (error) {
      console.error('Location search failed:', error);
      return [];
    }
  }
}