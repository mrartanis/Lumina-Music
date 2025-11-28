import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPin, checkPin, getResources, getLibraries, searchHub, getRandomTracks, getStreamUrl, getAlbumTracks, getArtistTracks, getTranscodeUrl } from './services/plexService';
import { PLEX_TOKEN_STORAGE_KEY } from './constants';
import { PlexResource, PlexDirectory, PlexTrack, PlayQueueItem } from './types';
import PlayerBar from './components/PlayerBar';
import LibraryView, { LibraryNavRequest } from './components/LibraryView';
import FullScreenPlayer from './components/FullScreenPlayer';
import QueueView from './components/QueueView';
import { Server, Music, Search, Settings, Check, Copy, Disc, Image, ChevronDown, List, MoreVertical, ListPlus, ListStart, CornerUpRight } from './components/Icons';

// Simple polyfill for Promise.any if not available (older iOS/Android)
const promiseAny = (promises: Promise<any>[]) => {
  if ((Promise as any).any) return (Promise as any).any(promises);
  return Promise.all(
    promises.map(p => p.then(
      val => Promise.reject(val),
      err => Promise.resolve(err)
    ))
  ).then(
    errors => Promise.reject(errors),
    val => Promise.resolve(val)
  );
};

const App: React.FC = () => {
  // Auth State
  const [authToken, setAuthToken] = useState<string | null>(localStorage.getItem(PLEX_TOKEN_STORAGE_KEY));
  const [pinId, setPinId] = useState<number | null>(null);
  const [pinCode, setPinCode] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Data State
  const [servers, setServers] = useState<PlexResource[]>([]);
  const [selectedServer, setSelectedServer] = useState<{ uri: string; accessToken: string; name: string } | null>(null);
  const [libraries, setLibraries] = useState<PlexDirectory[]>([]);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isFetchingLibs, setIsFetchingLibs] = useState(false);
  const [connectingServerId, setConnectingServerId] = useState<string | null>(null);
  const [selectedLibrary, setSelectedLibrary] = useState<PlexDirectory | null>(null);
  
  // Navigation Request (Search -> Library)
  const [libraryNavRequest, setLibraryNavRequest] = useState<LibraryNavRequest | null>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchContextMenu, setSearchContextMenu] = useState<{ visible: boolean; x: number; y: number; item: any | null }>({ visible: false, x: 0, y: 0, item: null });

  // View State
  const [activeTab, setActiveTab] = useState<'library' | 'search' | 'settings'>('library');
  const [fullPlayerOpen, setFullPlayerOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);

  // Player State
  const [queue, setQueue] = useState<PlayQueueItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSmartShuffle, setIsSmartShuffle] = useState(false);
  
  // Audio State
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // --- Audio Logic ---
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration || 0);
    const handleEnded = () => onNext();

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
        audio.pause();
        audio.removeEventListener('timeupdate', updateTime);
        audio.removeEventListener('loadedmetadata', updateDuration);
        audio.removeEventListener('ended', handleEnded);
        audioRef.current = null;
    };
  }, [currentIndex, queue]); 

  // Handle Track Source Change
  useEffect(() => {
      if (!audioRef.current) return;
      
      if (currentIndex >= 0 && currentIndex < queue.length) {
          const track = queue[currentIndex];
          const src = getStreamUrl(track.serverUri, track.serverToken, track.track.Media[0].Part[0].key);
          
          if (audioRef.current.src !== src) {
              audioRef.current.src = src;
              audioRef.current.load();
              if (isPlaying) {
                  audioRef.current.play().catch(e => console.error("Play failed", e));
              }
          }
      } else {
          audioRef.current.pause();
          audioRef.current.src = '';
      }
  }, [currentIndex, queue]);

  // Handle Play/Pause Toggle
  useEffect(() => {
      if (!audioRef.current || !audioRef.current.src) return;
      if (isPlaying) {
          audioRef.current.play().catch(console.error);
      } else {
          audioRef.current.pause();
      }
  }, [isPlaying]);

  // Click outside to close search context menu
  useEffect(() => {
      const handleClick = () => {
          if (searchContextMenu.visible) setSearchContextMenu(prev => ({ ...prev, visible: false }));
      };
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
  }, [searchContextMenu.visible]);

  const handleSeek = (time: number) => {
      if (audioRef.current) {
          audioRef.current.currentTime = time;
          setCurrentTime(time);
      }
  };

  // --- Auth Logic ---
  const startAuth = async () => {
    setAuthLoading(true);
    try {
      const pin = await createPin();
      setPinId(pin.id);
      setPinCode(pin.code);
    } catch (e) {
      console.error(e);
      setAuthLoading(false);
    }
  };

  const copyCode = () => {
    if (pinCode) {
      navigator.clipboard.writeText(pinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  useEffect(() => {
    if (!pinId || authToken) return;

    const interval = setInterval(async () => {
      try {
        const pin = await checkPin(pinId);
        if (pin.authToken) {
          setAuthToken(pin.authToken);
          localStorage.setItem(PLEX_TOKEN_STORAGE_KEY, pin.authToken);
          setPinId(null);
          setPinCode(null);
          setAuthLoading(false);
        }
      } catch (e) {
        console.error("Error checking PIN", e);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [pinId, authToken]);

  const handleLogout = () => {
    localStorage.removeItem(PLEX_TOKEN_STORAGE_KEY);
    setAuthToken(null);
    setServers([]);
    setSelectedServer(null);
    setLibraries([]);
    setSelectedLibrary(null);
    setQueue([]);
    setIsPlaying(false);
    setActiveTab('library');
    if(audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
    }
  };

  // --- Resource Fetching ---
  const fetchResources = useCallback(async () => {
    if (!authToken) return;
    try {
      const resources = await getResources(authToken);
      const validServers = resources.filter(r => r.provides.split(',').includes('server'));
      setServers(validServers);
      
      if (validServers.length === 1 && !selectedServer) {
        attemptConnectServer(validServers[0]);
      }
    } catch (e) {
      console.error("Failed to fetch resources", e);
      if (String(e).includes("401")) handleLogout();
    }
  }, [authToken, selectedServer]);

  useEffect(() => {
    if (authToken) fetchResources();
  }, [authToken, fetchResources]);

  // --- Server Connection Logic ---
  const attemptConnectServer = async (resource: PlexResource) => {
    setLibraryError(null);
    setConnectionError(null);
    setIsFetchingLibs(true);
    setConnectingServerId(resource.clientIdentifier);
    setLibraries([]);
    setSelectedLibrary(null);
    setActiveTab('library');

    // 1. Check for Cached Connection URI
    const cacheKey = `lumina_last_uri_${resource.clientIdentifier}`;
    const cachedUri = localStorage.getItem(cacheKey);

    if (cachedUri) {
      console.log("Attempting cached connection:", cachedUri);
      try {
        const data = await getLibraries(cachedUri, resource.accessToken);
        finishConnection(resource, cachedUri, data);
        return;
      } catch (e) {
        console.warn("Cached connection failed, falling back to discovery.");
        localStorage.removeItem(cacheKey); // Clear bad cache
      }
    }

    // 2. Race All HTTPS Connections (Parallel)
    const secureConnections = resource.connections.filter(c => c.protocol === 'https');
    if (secureConnections.length === 0) {
      setConnectionError("No HTTPS connections available.");
      setIsFetchingLibs(false);
      setConnectingServerId(null);
      return;
    }

    try {
      // Create a promise for each connection attempt
      const connectionPromises = secureConnections.map(async (conn) => {
         const data = await getLibraries(conn.uri, resource.accessToken);
         return { uri: conn.uri, data };
      });

      // Wait for the first successful connection
      // Use the polyfill-like logic or native Promise.any
      const winner = await promiseAny(connectionPromises);
      
      // Save cache for next time
      localStorage.setItem(cacheKey, winner.uri);
      
      finishConnection(resource, winner.uri, winner.data);

    } catch (aggregateError) {
      console.error("All connections failed", aggregateError);
      setConnectionError(`Could not connect to ${resource.name}. Check your network settings.`);
      setIsFetchingLibs(false);
      setConnectingServerId(null);
    }
  };

  const finishConnection = (resource: PlexResource, uri: string, data: PlexDirectory | any) => {
      setSelectedServer({
        uri: uri,
        accessToken: resource.accessToken,
        name: resource.name
      });

      if (data.MediaContainer.Directory) {
         setLibraries(data.MediaContainer.Directory);
      } else {
         setLibraries([]); 
      }
      setIsFetchingLibs(false);
      setConnectingServerId(null);
  };

  // --- Smart Shuffle Logic ---
  const loadRandomTracks = async (append: boolean = false) => {
    if (!selectedServer || !selectedLibrary) return;
    try {
      const data = await getRandomTracks(selectedServer.uri, selectedServer.accessToken, selectedLibrary.key, 10);
      const newTracks = data.MediaContainer.Metadata || [];
      
      const newQueueItems = newTracks.map(track => ({
        track,
        serverUri: selectedServer.uri,
        serverToken: selectedServer.accessToken,
        uuid: crypto.randomUUID()
      }));

      if (append) {
        setQueue(prev => [...prev, ...newQueueItems]);
      } else {
        setQueue(newQueueItems);
        setCurrentIndex(0);
        setIsPlaying(true);
        setIsSmartShuffle(true);
      }
    } catch (e) {
      console.error("Smart shuffle failed", e);
    }
  };

  useEffect(() => {
    if (!isSmartShuffle || queue.length === 0) return;
    if (currentIndex >= queue.length - 3) {
      loadRandomTracks(true);
    }
  }, [currentIndex, isSmartShuffle, queue.length]);


  // --- Player Logic ---
  const playTrack = (track: PlexTrack) => {
    if (!selectedServer) return;
    setIsSmartShuffle(false);
    
    const queueItem: PlayQueueItem = {
      track,
      serverUri: selectedServer.uri,
      serverToken: selectedServer.accessToken,
      uuid: crypto.randomUUID()
    };
    
    setQueue([queueItem]);
    setCurrentIndex(0);
    setIsPlaying(true);
  };

  const addTracksToQueue = (tracks: PlexTrack[], playNext: boolean) => {
    if (!selectedServer) return;
    const newItems = tracks.map(track => ({
      track,
      serverUri: selectedServer!.uri,
      serverToken: selectedServer!.accessToken,
      uuid: crypto.randomUUID()
    }));

    setQueue(prev => {
      const q = [...prev];
      if (queue.length === 0) {
          setCurrentIndex(0);
          setIsPlaying(true);
          return newItems;
      }
      
      if (playNext) {
          q.splice(currentIndex + 1, 0, ...newItems);
      } else {
          q.push(...newItems);
      }
      return q;
    });
  };

  const reorderQueue = (fromIndex: number, toIndex: number) => {
    if (fromIndex < 0 || fromIndex >= queue.length || toIndex < 0 || toIndex >= queue.length) return;
    
    setQueue(prev => {
      const newQ = [...prev];
      const [movedItem] = newQ.splice(fromIndex, 1);
      newQ.splice(toIndex, 0, movedItem);
      return newQ;
    });

    if (currentIndex === fromIndex) {
      setCurrentIndex(toIndex);
    } else if (currentIndex > fromIndex && currentIndex <= toIndex) {
      setCurrentIndex(c => c - 1);
    } else if (currentIndex < fromIndex && currentIndex >= toIndex) {
      setCurrentIndex(c => c + 1);
    }
  };

  const clearQueue = () => {
    setQueue([]);
    setCurrentIndex(-1);
    setIsPlaying(false);
    if(audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
    }
  };

  const handleShuffleAll = () => {
    loadRandomTracks(false);
  };

  const onNext = () => {
    if (currentIndex < queue.length - 1) {
      setCurrentIndex(c => c + 1);
    } else {
        setIsPlaying(false);
    }
  };

  const onPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(c => c - 1);
    } else {
        handleSeek(0);
    }
  };

  const togglePlay = () => setIsPlaying(!isPlaying);

  const removeFromQueue = (index: number) => {
    setQueue(prev => {
        const newQ = [...prev];
        newQ.splice(index, 1);
        return newQ;
    });
    if (index < currentIndex) {
        setCurrentIndex(c => c - 1);
    } else if (index === currentIndex) {
        if (queue.length <= 1) {
            setIsPlaying(false);
            setCurrentIndex(-1);
        } else {
             if (index === queue.length - 1) {
                 setCurrentIndex(c => c - 1);
             }
        }
    }
  };

  const jumpToQueueIndex = (index: number) => {
    setCurrentIndex(index);
    setIsPlaying(true);
  };

  // --- Search Logic ---
  const performSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServer || !searchQuery.trim()) return;

    setIsSearching(true);
    try {
        const data = await searchHub(selectedServer.uri, selectedServer.accessToken, searchQuery);
        if (data.MediaContainer.Hub) {
            const items = data.MediaContainer.Hub.flatMap((h: any) => h.Metadata || []);
            setSearchResults(items);
        } else {
            setSearchResults([]);
        }
    } catch (e) {
        console.error("Search failed", e);
    } finally {
        setIsSearching(false);
    }
  };

  const openSearchContextMenu = (e: React.MouseEvent, item: any) => {
      e.stopPropagation();
      e.preventDefault();
      let x = e.clientX;
      let y = e.clientY;
      if (window.innerWidth - x < 200) x = window.innerWidth - 210;
      if (window.innerHeight - y < 200) y = window.innerHeight - 200;
      setSearchContextMenu({ visible: true, x, y, item });
  };

  const handleSearchItemClick = (item: any) => {
      if (item.type === 'track') {
          playTrack(item);
      } else {
          handleSearchContextMenuAction('goTo', item);
      }
  };

  const handleSearchContextMenuAction = async (action: 'playNext' | 'addToQueue' | 'goTo', item?: any) => {
      const targetItem = item || searchContextMenu.item;
      if (!targetItem) return;
      
      setSearchContextMenu(prev => ({ ...prev, visible: false }));

      if (action === 'goTo') {
          const libId = targetItem.librarySectionID;
          const lib = libraries.find(l => l.key === String(libId));
          
          if (lib) {
              setSelectedLibrary(lib);
              setLibraryNavRequest({ 
                  level: targetItem.type as 'artist' | 'album', 
                  item: targetItem, 
                  timestamp: Date.now() 
              });
              setActiveTab('library');
          }
          return;
      }

      try {
        let tracks: PlexTrack[] = [];
        if (targetItem.type === 'track') {
            tracks = [targetItem];
        } else if (targetItem.type === 'album') {
             const data = await getAlbumTracks(selectedServer!.uri, selectedServer!.accessToken, targetItem.librarySectionID, targetItem.ratingKey);
             tracks = data.MediaContainer.Metadata || [];
        } else if (targetItem.type === 'artist') {
             const data = await getArtistTracks(selectedServer!.uri, selectedServer!.accessToken, targetItem.ratingKey);
             tracks = data.MediaContainer.Metadata || [];
        }
        
        if (tracks.length > 0) {
            addTracksToQueue(tracks, action === 'playNext');
        }
      } catch (e) {
          console.error("Failed to add search item to queue", e);
      }
  };


  // --- Render ---

  if (!authToken) {
    return (
      <div className="min-h-screen bg-dark-900 flex flex-col items-center justify-center p-4 pt-safe-top">
        <div className="max-w-md w-full text-center space-y-8">
          <div>
            <div className="w-20 h-20 bg-plex-500 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-plex-600/20 mb-6">
               <Music size={40} className="text-black" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Lumina Music</h1>
            <p className="text-gray-400 text-lg">Your high-fidelity Plex client</p>
          </div>

          {!pinCode ? (
            <button 
              onClick={startAuth}
              disabled={authLoading}
              className="w-full py-4 bg-white hover:bg-gray-100 text-black font-bold rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {authLoading ? (
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"/>
              ) : "Sign In with Plex"}
            </button>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-dark-800 border border-white/10 rounded-2xl p-6 relative overflow-hidden">
                <p className="text-gray-400 mb-4 text-sm font-medium uppercase tracking-wider">Enter code at plex.tv/link</p>
                <div className="flex items-center justify-center gap-3 mb-2">
                  <span className="text-5xl font-mono font-bold text-white tracking-widest select-all">{pinCode}</span>
                </div>
                <button 
                  onClick={copyCode}
                  className="mt-4 flex items-center justify-center gap-2 mx-auto px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-gray-300 transition-colors w-fit"
                >
                  {copied ? <Check size={16} className="text-green-500"/> : <Copy size={16}/>}
                  {copied ? "Copied!" : "Copy Code"}
                </button>
              </div>
              <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => window.open(`https://plex.tv/link`, '_blank')}
                    className="w-full py-3 bg-plex-500 hover:bg-plex-600 text-black font-bold rounded-xl transition-colors"
                  >
                    Open Plex Link Page
                  </button>
                  <button onClick={() => { setPinId(null); setPinCode(null); }} className="text-gray-500 hover:text-gray-300 text-sm py-2">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const renderContent = () => {
    if (activeTab === 'settings') {
        return (
            <div className="flex-1 flex flex-col bg-black p-4 md:p-8 animate-in fade-in duration-300 pt-safe-top">
                <h2 className="text-2xl font-bold text-white mb-6">Settings</h2>
                <div className="bg-dark-800 rounded-xl overflow-hidden mb-6">
                    <div className="p-4 border-b border-white/5 flex items-center justify-between">
                        <span className="text-gray-300">Connected Server</span>
                        <span className="text-white font-medium">{selectedServer?.name || "None"}</span>
                    </div>
                </div>
                <button onClick={handleLogout} className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 py-3 rounded-xl font-medium transition-colors border border-red-500/20">Sign Out</button>
            </div>
        );
    }

    if (activeTab === 'search') {
        if (!selectedServer) return <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-8 text-center pt-safe-top"><Search size={48} className="mb-4 opacity-20" /><p>Connect to a server to search.</p></div>;
        return (
            <div className="flex-1 flex flex-col bg-black h-full relative pt-safe-top">
                <div className="p-4 bg-dark-900 border-b border-white/10">
                    <form onSubmit={performSearch} className="relative">
                        <input 
                            type="text" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search..." 
                            className="w-full bg-dark-800 border-none rounded-xl py-3 pl-10 pr-4 text-white focus:ring-2 focus:ring-plex-500 transition-all placeholder:text-gray-500"
                            autoFocus
                        />
                        <Search className="absolute left-3 top-3.5 text-gray-500" size={18} />
                    </form>
                </div>
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar pb-32">
                    {isSearching ? <div className="flex justify-center p-8"><div className="w-8 h-8 border-4 border-plex-500 border-t-transparent rounded-full animate-spin"></div></div> :
                    searchResults.length > 0 ? (
                        <div className="space-y-4">
                            {searchResults.map((item) => (
                                <div 
                                    key={item.ratingKey} 
                                    className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg cursor-pointer group" 
                                    onClick={() => handleSearchItemClick(item)}
                                >
                                    <div className="w-12 h-12 bg-dark-700 rounded overflow-hidden flex-shrink-0">
                                        {item.thumb && <img src={getTranscodeUrl(selectedServer.uri, selectedServer.accessToken, item.thumb, 100, 100)} className="w-full h-full object-cover"/>}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-white font-medium truncate">{item.title}</div>
                                        <div className="text-gray-500 text-xs truncate capitalize flex items-center gap-2">
                                            {item.type} 
                                            {item.parentTitle && <span>• {item.parentTitle}</span>}
                                        </div>
                                    </div>
                                    <button 
                                        onClick={(e) => openSearchContextMenu(e, item)}
                                        className="p-2 text-gray-500 hover:text-white"
                                    >
                                        <MoreVertical size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : searchQuery && !isSearching ? <div className="text-center text-gray-500 mt-10">No results found</div> : <div className="text-center text-gray-600 mt-10">Type to search</div>}
                </div>

                {searchContextMenu.visible && (
                    <div 
                        className="fixed z-50 bg-dark-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[180px] animate-in fade-in zoom-in-95 duration-100"
                        style={{ top: searchContextMenu.y, left: searchContextMenu.x }}
                    >
                         <div className="p-3 border-b border-white/5 bg-white/5">
                            <p className="text-xs font-bold text-white truncate max-w-[150px]">{searchContextMenu.item?.title}</p>
                            <p className="text-[10px] text-gray-400 capitalize">{searchContextMenu.item?.type}</p>
                        </div>
                        {searchContextMenu.item?.type !== 'track' && (
                             <button 
                                onClick={() => handleSearchContextMenuAction('goTo')}
                                className="w-full text-left px-4 py-3 text-sm text-gray-200 hover:bg-white/10 flex items-center gap-2"
                            >
                                <CornerUpRight size={16} /> Go to {searchContextMenu.item?.type}
                            </button>
                        )}
                        <button 
                            onClick={() => handleSearchContextMenuAction('playNext')}
                            className="w-full text-left px-4 py-3 text-sm text-gray-200 hover:bg-white/10 flex items-center gap-2"
                        >
                            <ListStart size={16} /> Play Next
                        </button>
                        <button 
                            onClick={() => handleSearchContextMenuAction('addToQueue')}
                            className="w-full text-left px-4 py-3 text-sm text-gray-200 hover:bg-white/10 flex items-center gap-2"
                        >
                            <ListPlus size={16} /> Add to Queue
                        </button>
                    </div>
                )}
            </div>
        );
    }

    if (!selectedServer) {
        return (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-6 text-center animate-in fade-in pt-safe-top">
            <Server size={48} className="mb-4 opacity-20" />
            <p className="text-lg font-medium text-white mb-2">Select a server</p>
            {connectionError && <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs text-left w-full max-w-sm break-words">{connectionError}</div>}
            <div className="w-full max-w-sm space-y-3 md:hidden">
                {servers.map(s => (
                  <button key={s.clientIdentifier} onClick={() => attemptConnectServer(s)} disabled={!!connectingServerId} className="w-full p-4 bg-dark-800 hover:bg-dark-700 rounded-xl flex items-center justify-between">
                    <span className="font-medium text-white">{s.name}</span>
                    {connectingServerId === s.clientIdentifier ? <div className="w-4 h-4 border-2 border-plex-500 border-t-transparent rounded-full animate-spin"/> : <ChevronDown className="-rotate-90 text-gray-500" size={16}/>}
                  </button>
                ))}
            </div>
          </div>
        );
    }

    if (!selectedLibrary) {
         return (
           <div className="flex-1 flex flex-col p-4 md:hidden animate-in fade-in pt-safe-top">
              <div className="flex items-center justify-between mb-6">
                 <h2 className="text-xl font-bold text-white">{selectedServer.name}</h2>
              </div>
              {isFetchingLibs ? <div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-4 border-plex-500 border-t-transparent rounded-full animate-spin"/></div> : 
              libraryError ? <div className="text-red-400 text-center">{libraryError}</div> : (
                <div className="grid grid-cols-2 gap-4">
                   {libraries.map(lib => {
                       const isMusic = lib.type === 'artist';
                       return (
                           <button key={lib.key} onClick={() => isMusic && setSelectedLibrary(lib)} disabled={!isMusic} className={`aspect-square rounded-2xl p-4 flex flex-col items-center justify-center gap-3 text-center ${isMusic ? 'bg-dark-800 hover:bg-dark-700 text-white' : 'bg-dark-900/50 opacity-40 text-gray-500'}`}>
                              {isMusic ? <Disc size={32} className="text-plex-500"/> : <Image size={32}/>}
                              <span className="font-medium text-sm line-clamp-2">{lib.title}</span>
                           </button>
                       );
                   })}
                </div>
              )}
           </div>
         );
    }

    return (
        <LibraryView 
            server={selectedServer} 
            section={selectedLibrary} 
            onPlayTrack={playTrack}
            onAddTracksToQueue={addTracksToQueue}
            onShuffleAll={handleShuffleAll}
            navRequest={libraryNavRequest}
        />
    );
  };

  return (
    <div className="h-[100dvh] bg-black flex flex-col md:flex-row overflow-hidden">
      
      {/* Sidebar (Desktop) */}
      <div className="hidden md:flex flex-col w-64 bg-dark-900 border-r border-white/5 p-4 flex-shrink-0 pt-safe-top">
         <div className="flex items-center gap-2 mb-8 px-2">
            <div className="w-8 h-8 bg-plex-500 rounded-lg flex items-center justify-center"><Music size={16} className="text-black"/></div>
            <span className="font-bold text-xl text-white">Lumina</span>
         </div>
         <div className="space-y-6 flex-1 overflow-y-auto custom-scrollbar">
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-2 mb-2">Servers</h3>
              <div className="space-y-1">
                {servers.map(s => (
                  <button key={s.clientIdentifier} onClick={() => attemptConnectServer(s)} className={`w-full text-left px-3 py-2 rounded-md flex items-center gap-3 transition-colors ${selectedServer?.name === s.name ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
                    <Server size={18} /><span className="truncate">{s.name}</span>
                    {selectedServer?.name === s.name && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-green-500"/>}
                    {connectingServerId === s.clientIdentifier && <div className="ml-auto w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"/>}
                  </button>
                ))}
              </div>
            </div>
            {selectedServer && (
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-2 mb-2">Libraries</h3>
                <div className="space-y-1">
                    {libraries.map(lib => {
                        const isMusic = lib.type === 'artist';
                        return (
                          <button key={lib.key} onClick={() => { if(isMusic) { setSelectedLibrary(lib); setActiveTab('library'); }}} disabled={!isMusic} className={`w-full text-left px-3 py-2 rounded-md flex items-center gap-3 transition-colors ${selectedLibrary?.key === lib.key && activeTab === 'library' ? 'bg-plex-500/20 text-plex-500' : ''} ${isMusic ? 'text-gray-300 hover:bg-white/5 hover:text-white' : 'opacity-40'}`}>
                            {isMusic ? <Disc size={18}/> : <Image size={18}/>}<span className="truncate">{lib.title}</span>
                          </button>
                        );
                    })}
                </div>
              </div>
            )}
         </div>
         <div className="mt-auto space-y-1">
            <button onClick={() => setQueueOpen(true)} className="flex items-center gap-3 px-3 py-2 w-full text-left rounded-md text-gray-400 hover:text-white"><List size={18} /><span>Queue</span></button>
            <button onClick={() => setActiveTab('search')} className={`flex items-center gap-3 px-3 py-2 w-full text-left rounded-md ${activeTab === 'search' ? 'text-white bg-white/10' : 'text-gray-400 hover:text-white'}`}><Search size={18} /><span>Search</span></button>
            <button onClick={() => setActiveTab('settings')} className={`flex items-center gap-3 px-3 py-2 w-full text-left rounded-md ${activeTab === 'settings' ? 'text-white bg-white/10' : 'text-gray-400 hover:text-white'}`}><Settings size={18} /><span>Settings</span></button>
         </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative min-w-0 bg-black overflow-hidden">
        {renderContent()}
        {queue.length > 0 && (
          <PlayerBar 
            currentTrack={queue[currentIndex]}
            isPlaying={isPlaying}
            onPlayPause={togglePlay}
            onNext={onNext}
            onPrev={onPrev}
            onEnded={onNext}
            onExpand={() => setFullPlayerOpen(true)}
            currentTime={currentTime}
            duration={duration}
            onSeek={handleSeek}
          />
        )}
      </div>

      {/* Mobile Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-[84px] bg-dark-900 border-t border-white/5 flex items-center justify-around z-40 pb-safe shadow-lg">
         <button onClick={() => setActiveTab('library')} className={`flex flex-col items-center gap-1.5 w-full h-full pt-3 active:scale-90 transition-transform ${activeTab === 'library' ? 'text-plex-500' : 'text-gray-500'}`}><Server size={28} /><span className="text-xs font-medium">Library</span></button>
         <button onClick={() => setActiveTab('search')} className={`flex flex-col items-center gap-1.5 w-full h-full pt-3 active:scale-90 transition-transform ${activeTab === 'search' ? 'text-plex-500' : 'text-gray-500'}`}><Search size={28} /><span className="text-xs font-medium">Search</span></button>
         <button onClick={() => setQueueOpen(true)} className={`flex flex-col items-center gap-1.5 w-full h-full pt-3 active:scale-90 transition-transform text-gray-500`}><List size={28} /><span className="text-xs font-medium">Queue</span></button>
         <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center gap-1.5 w-full h-full pt-3 active:scale-90 transition-transform ${activeTab === 'settings' ? 'text-plex-500' : 'text-gray-500'}`}><Settings size={28} /><span className="text-xs font-medium">Settings</span></button>
      </div>

      {/* Full Player */}
      {fullPlayerOpen && queue[currentIndex] && (
        <FullScreenPlayer 
           track={queue[currentIndex]}
           isPlaying={isPlaying}
           onPlayPause={togglePlay}
           onNext={onNext}
           onPrev={onPrev}
           onClose={() => setFullPlayerOpen(false)}
           onToggleQueue={() => setQueueOpen(true)}
           currentTime={currentTime}
           duration={duration}
           onSeek={handleSeek}
        />
      )}

      {/* Queue Overlay */}
      {queueOpen && (
          <QueueView 
            queue={queue}
            currentIndex={currentIndex}
            onClose={() => setQueueOpen(false)}
            onPlayIndex={jumpToQueueIndex}
            onRemoveIndex={removeFromQueue}
            onReorder={reorderQueue}
            onClear={clearQueue}
          />
      )}
    </div>
  );
};

export default App;