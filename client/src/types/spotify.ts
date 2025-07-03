// Spotify API Type Definitions
declare namespace SpotifyApi {
  interface PlaylistTrackObject {
    added_at: string;
    added_by: {
      id: string;
    };
    is_local: boolean;
    track: TrackObjectFull;
  }

  interface TrackObjectFull {
    id: string;
    name: string;
    artists: ArtistObjectSimplified[];
    album: AlbumObjectSimplified;
    duration_ms: number;
    external_urls: {
      spotify: string;
    };
    preview_url: string | null;
    uri: string;
  }

  interface ArtistObjectSimplified {
    id: string;
    name: string;
    external_urls: {
      spotify: string;
    };
  }

  interface AlbumObjectSimplified {
    id: string;
    name: string;
    images: ImageObject[];
    external_urls: {
      spotify: string;
    };
  }

  interface ImageObject {
    height: number;
    url: string;
    width: number;
  }

  interface PlaylistObjectFull {
    id: string;
    name: string;
    description: string | null;
    snapshot_id: string;
    tracks: {
      items: PlaylistTrackObject[];
      total: number;
    };
  }

  interface UserObjectPublic {
    id: string;
    display_name: string | null;
  }
}

export {};