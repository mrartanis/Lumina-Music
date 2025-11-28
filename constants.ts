export const APP_NAME = "Lumina Music";
export const PLEX_PRODUCT = "Lumina Web Player";
export const PLEX_VERSION = "1.0.0";
export const CLIENT_ID_STORAGE_KEY = "lumina_client_id";
export const PLEX_TOKEN_STORAGE_KEY = "lumina_plex_token";

// Helper to get or create a persistent client ID
export const getClientId = (): string => {
  let cid = localStorage.getItem(CLIENT_ID_STORAGE_KEY);
  if (!cid) {
    cid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    localStorage.setItem(CLIENT_ID_STORAGE_KEY, cid);
  }
  return cid;
};
