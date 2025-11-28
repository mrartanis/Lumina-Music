export interface PlexPin {
  id: number;
  code: string;
  product: string;
  trusted: boolean;
  clientIdentifier: string;
  location: {
    code: string;
    european_union_member: boolean;
    continent_code: string;
    country: string;
    city: string;
    time_zone: string;
    postal_code: string;
    subdivision_code: string;
    coordinates: string;
  };
  expiresIn: number;
  createdAt: string;
  expiresAt: string;
  authToken: string | null;
  newRegistration: string | null;
}

export interface PlexResource {
  name: string;
  product: string;
  productVersion: string;
  platform: string;
  platformVersion: string;
  device: string;
  clientIdentifier: string;
  createdAt: string;
  lastSeenAt: string;
  provides: string; // e.g., "server"
  ownerId: string | null;
  sourceTitle: string | null;
  publicAddress: string;
  accessToken: string;
  owned: boolean;
  home: boolean;
  synced: boolean;
  relay: boolean;
  presence: boolean;
  httpsRequired: boolean;
  publicAddressMatches: boolean;
  dnsRebindingProtection: boolean;
  connections: PlexConnection[];
}

export interface PlexConnection {
  protocol: string;
  address: string;
  port: number;
  uri: string;
  local: boolean;
  relay: boolean;
  IPv6: boolean;
}

export interface PlexMediaContainer<T> {
  MediaContainer: {
    size: number;
    allowSync: boolean;
    art: string;
    content: string;
    identifier: string;
    mediaTagPrefix: string;
    mediaTagVersion: number;
    thumb: string;
    title1: string;
    title2?: string;
    viewGroup?: string;
    viewMode?: number;
    Directory?: T[];
    Metadata?: T[];
    Hub?: {
      title: string;
      type: string;
      hubIdentifier: string;
      size: number;
      more: boolean;
      style: string;
      Metadata?: T[];
    }[];
  };
}

export interface PlexDirectory {
  allowSync: boolean;
  art: string;
  composite: string;
  filters: boolean;
  refreshing: boolean;
  thumb: string;
  key: string;
  type: string;
  title: string;
  agent: string;
  scanner: string;
  language: string;
  uuid: string;
  updatedAt: number;
  createdAt: number;
  scannedAt: number;
  content: boolean;
  directory: boolean;
  contentChangedAt: number;
  hidden: number;
  Location: { path: string }[];
}

// Base item for Search/Lists
export interface PlexItem {
  ratingKey: string;
  key: string;
  type: 'track' | 'album' | 'artist';
  title: string;
  thumb: string;
  art?: string;
  addedAt: number;
  updatedAt: number;
  summary?: string;
}

export interface PlexArtist extends PlexItem {
  type: 'artist';
  index: number;
  viewCount?: number;
  lastViewedAt?: number;
  genre?: { tag: string }[];
  country?: { tag: string }[];
}

export interface PlexAlbum extends PlexItem {
  type: 'album';
  parentRatingKey: string; // Artist ID
  parentKey: string;
  parentTitle: string; // Artist Name
  parentThumb?: string;
  year: number;
  index: number;
  studio?: string;
}

export interface PlexTrack extends PlexItem {
  type: 'track';
  parentRatingKey: string; // Album ID
  grandparentRatingKey: string; // Artist ID
  guid: string;
  parentGuid: string;
  grandparentGuid: string;
  parentKey: string;
  grandparentKey: string;
  librarySectionTitle: string;
  librarySectionID: number;
  librarySectionKey: string;
  grandparentTitle: string; // Artist
  parentTitle: string; // Album
  originalTitle?: string;
  index: number; // Track number
  parentIndex: number; // Disc number
  parentThumb: string;
  grandparentThumb: string;
  duration: number;
  Media: {
    id: number;
    duration: number;
    bitrate: number;
    width: number;
    height: number;
    aspectRatio: number;
    audioChannels: number;
    audioCodec: string;
    videoCodec: string;
    container: string;
    videoFrameRate: string;
    audioProfile: string;
    videoProfile: string;
    Part: {
      id: number;
      key: string;
      duration: number;
      file: string;
      size: number;
      audioProfile: string;
      container: string;
      has64bitOffsets: boolean;
      optimizedForStreaming: boolean;
    }[];
  }[];
}

export interface PlayQueueItem {
  track: PlexTrack;
  serverUri: string;
  serverToken: string;
  uuid: string; // Unique ID for queue management (handling duplicates)
}