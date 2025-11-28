import { PLEX_PRODUCT, PLEX_VERSION, getClientId } from '../constants';
import { PlexPin, PlexResource, PlexMediaContainer, PlexDirectory, PlexTrack, PlexArtist, PlexAlbum } from '../types';

const HEADERS = {
  'X-Plex-Product': PLEX_PRODUCT,
  'X-Plex-Version': PLEX_VERSION,
  'X-Plex-Client-Identifier': getClientId(),
  'Accept': 'application/json'
};

export const createPin = async (): Promise<PlexPin> => {
  const response = await fetch('https://plex.tv/api/v2/pins?strong=false', {
    method: 'POST',
    headers: HEADERS
  });
  if (!response.ok) throw new Error('Failed to create PIN');
  return response.json();
};

export const checkPin = async (id: number): Promise<PlexPin> => {
  const response = await fetch(`https://plex.tv/api/v2/pins/${id}`, {
    headers: HEADERS
  });
  if (!response.ok) throw new Error('Failed to check PIN');
  return response.json();
};

export const getResources = async (token: string): Promise<PlexResource[]> => {
  const response = await fetch('https://plex.tv/api/v2/resources?includeHttps=1&provides=server', {
    headers: {
      ...HEADERS,
      'X-Plex-Token': token
    }
  });
  if (!response.ok) throw new Error('Failed to get resources');
  const data = await response.json();
  return data;
};

// Generic fetcher for a specific Plex Server
export const fetchFromServer = async <T>(
  serverUri: string,
  serverToken: string,
  path: string,
  params: Record<string, string> = {}
): Promise<PlexMediaContainer<T>> => {
  const url = new URL(path, serverUri);
  
  url.searchParams.append('X-Plex-Token', serverToken);
  
  Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.append(key, value);
      }
  });

  const response = await fetch(url.toString(), {
    headers: HEADERS
  });

  if (!response.ok) {
     throw new Error(`Server request failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
};

export const getLibraries = async (serverUri: string, serverToken: string) => {
  return fetchFromServer<PlexDirectory>(serverUri, serverToken, '/library/sections');
};

// --- Browsing Methods ---

// Helper to add pagination params
const getParams = (params: Record<string, string>, start: number, size: number, query?: string) => {
    const p = {
        ...params,
        'X-Plex-Container-Start': start.toString(),
        'X-Plex-Container-Size': size.toString()
    };
    if (query) {
        // Simple filtering if supported
        p['title'] = query; 
    }
    return p;
};

export const getLibraryArtists = async (serverUri: string, serverToken: string, sectionId: string, start = 0, size = 50, query?: string) => {
  // type=8 is Artist
  return fetchFromServer<PlexArtist>(serverUri, serverToken, `/library/sections/${sectionId}/all`, 
    getParams({ type: '8', sort: 'titleSort' }, start, size, query)
  );
};

export const getLibraryAlbums = async (serverUri: string, serverToken: string, sectionId: string, start = 0, size = 50, query?: string) => {
  // type=9 is Album
  return fetchFromServer<PlexAlbum>(serverUri, serverToken, `/library/sections/${sectionId}/all`, 
    getParams({ type: '9', sort: 'titleSort' }, start, size, query)
  );
};

export const getLibraryTracks = async (serverUri: string, serverToken: string, sectionId: string, start = 0, size = 50, query?: string) => {
  // type=10 is Track
  return fetchFromServer<PlexTrack>(serverUri, serverToken, `/library/sections/${sectionId}/all`, 
    getParams({ type: '10', sort: 'titleSort' }, start, size, query)
  );
};

export const getArtistAlbums = async (serverUri: string, serverToken: string, sectionId: string, artistId: string, start = 0, size = 50) => {
  // Get albums where artist.id = artistId
  return fetchFromServer<PlexAlbum>(serverUri, serverToken, `/library/sections/${sectionId}/all`, 
    getParams({ type: '9', 'artist.id': artistId, sort: 'year:desc' }, start, size)
  );
};

export const getArtistTracks = async (serverUri: string, serverToken: string, artistId: string) => {
  // Get all leaves (tracks) for the artist
  return fetchFromServer<PlexTrack>(serverUri, serverToken, `/library/metadata/${artistId}/allLeaves`);
};

export const getAlbumTracks = async (serverUri: string, serverToken: string, sectionId: string, albumId: string) => {
  // Get tracks where album.id = albumId
  return fetchFromServer<PlexTrack>(serverUri, serverToken, `/library/sections/${sectionId}/all`, { 
    type: '10',
    'album.id': albumId,
    sort: 'index'
  });
};

export const getRandomTracks = async (serverUri: string, serverToken: string, sectionId: string, count: number = 20) => {
  // Fetch random tracks for shuffle
  return fetchFromServer<PlexTrack>(serverUri, serverToken, `/library/sections/${sectionId}/all`, { 
    type: '10',
    sort: 'random',
    limit: count.toString()
  });
};

// --- Utils ---

export const searchHub = async (serverUri: string, serverToken: string, query: string) => {
  return fetchFromServer<any>(serverUri, serverToken, '/hubs/search', { query, limit: '20' });
};

export const getTranscodeUrl = (
  serverUri: string,
  serverToken: string,
  path: string,
  width: number = 300,
  height: number = 300
): string => {
  const url = new URL('/photo/:/transcode', serverUri);
  url.searchParams.append('url', path);
  url.searchParams.append('width', width.toString());
  url.searchParams.append('height', height.toString());
  url.searchParams.append('minSize', '1');
  url.searchParams.append('upscale', '1');
  url.searchParams.append('X-Plex-Token', serverToken);
  return url.toString();
};

export const getStreamUrl = (serverUri: string, serverToken: string, partKey: string): string => {
  const url = new URL(partKey, serverUri);
  url.searchParams.append('X-Plex-Token', serverToken);
  return url.toString();
};