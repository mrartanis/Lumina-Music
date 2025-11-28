import React, { useState, useEffect, useRef } from 'react';
import { PlexTrack, PlexArtist, PlexAlbum, PlexDirectory } from '../types';
import { 
  getLibraryTracks, getLibraryArtists, getLibraryAlbums, 
  getArtistAlbums, getAlbumTracks, getArtistTracks, getTranscodeUrl 
} from '../services/plexService';
import { Play, Disc, Users, Music, ChevronDown, Shuffle, LayoutGrid, ChevronUp, MoreVertical, ListPlus, ListStart, CornerUpRight } from './Icons';

export interface LibraryNavRequest {
  level: 'artist' | 'album';
  item: PlexArtist | PlexAlbum;
  timestamp: number;
}

interface LibraryViewProps {
  server: { uri: string; accessToken: string; name: string } | null;
  section: PlexDirectory | null;
  onPlayTrack: (track: PlexTrack) => void;
  onAddTracksToQueue: (tracks: PlexTrack[], playNext: boolean) => void;
  onShuffleAll: () => void;
  navRequest?: LibraryNavRequest | null;
}

type ViewMode = 'artists' | 'albums' | 'tracks';
type NavigationLevel = 'root' | 'artist' | 'album';

interface NavigationState {
  level: NavigationLevel;
  artist?: PlexArtist;
  album?: PlexAlbum;
}

interface ContextMenuState {
    visible: boolean;
    x: number;
    y: number;
    item: any;
    type: 'artist' | 'album' | 'track';
}

const LibraryView: React.FC<LibraryViewProps> = ({ server, section, onPlayTrack, onAddTracksToQueue, onShuffleAll, navRequest }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('artists');
  const [navStack, setNavStack] = useState<NavigationState[]>([{ level: 'root' }]);
  
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  
  // Pagination State
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 50;
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Context Menu State
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, item: null, type: 'track' });

  const currentNav = navStack[navStack.length - 1];

  // Handle External Navigation Requests
  useEffect(() => {
    if (navRequest && section) {
        if (navRequest.level === 'artist') {
             setNavStack([{ level: 'root' }, { level: 'artist', artist: navRequest.item as PlexArtist }]);
             setViewMode('artists'); 
        } else if (navRequest.level === 'album') {
             setNavStack([{ level: 'root' }, { level: 'album', album: navRequest.item as PlexAlbum }]);
             setViewMode('albums');
        }
    }
  }, [navRequest]);

  // Debounce filter for server-side search
  useEffect(() => {
      const timer = setTimeout(() => {
          // Reset when filter changes
          setOffset(0);
          setItems([]);
          setHasMore(true);
          loadContent(true); 
      }, 500);
      return () => clearTimeout(timer);
  }, [filter]);

  useEffect(() => {
    setNavStack([{ level: 'root' }]);
    setViewMode('artists');
    setFilter('');
  }, [section?.key]);

  useEffect(() => {
    if (!server || !section) return;
    setOffset(0);
    setItems([]);
    setHasMore(true);
    loadContent(true);
  }, [server, section, viewMode, currentNav]);

  useEffect(() => {
      const handleClick = () => {
          if (contextMenu.visible) setContextMenu(prev => ({ ...prev, visible: false }));
      };
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
  }, [contextMenu.visible]);

  const loadContent = async (reset = false) => {
    if ((!reset && !hasMore) || loading) return;
    
    setLoading(true);
    try {
      let data;
      const currentOffset = reset ? 0 : offset;
      const size = PAGE_SIZE;

      if (currentNav.level === 'artist' && currentNav.artist) {
        data = await getArtistAlbums(
            server!.uri, server!.accessToken, section!.key, currentNav.artist.ratingKey, 
            currentOffset, size
        );
      } else if (currentNav.level === 'album' && currentNav.album) {
        data = await getAlbumTracks(server!.uri, server!.accessToken, section!.key, currentNav.album.ratingKey);
      } else {
        if (viewMode === 'artists') {
          data = await getLibraryArtists(server!.uri, server!.accessToken, section!.key, currentOffset, size, filter);
        } else if (viewMode === 'albums') {
          data = await getLibraryAlbums(server!.uri, server!.accessToken, section!.key, currentOffset, size, filter);
        } else {
          data = await getLibraryTracks(server!.uri, server!.accessToken, section!.key, currentOffset, size, filter);
        }
      }

      const newItems = data.MediaContainer.Metadata || [];
      
      if (reset || currentNav.level === 'album') {
          setItems(newItems);
      } else {
          setItems(prev => [...prev, ...newItems]);
      }

      if (newItems.length < size || currentNav.level === 'album') {
          setHasMore(false);
      } else {
          setOffset(currentOffset + size);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
      if (scrollHeight - scrollTop - clientHeight < 300 && !loading && hasMore) {
          loadContent(false);
      }
  };

  const handleBack = () => {
    if (navStack.length > 1) {
      setNavStack(prev => prev.slice(0, -1));
    }
  };

  const navigateToArtist = (artist: PlexArtist) => {
    setNavStack(prev => [...prev, { level: 'artist', artist }]);
  };

  const navigateToAlbum = (album: PlexAlbum) => {
    setNavStack(prev => [...prev, { level: 'album', album }]);
  };

  const openContextMenu = (e: React.MouseEvent, item: any, type: 'artist' | 'album' | 'track') => {
      e.stopPropagation();
      e.preventDefault();
      let x = e.clientX;
      let y = e.clientY;
      
      if (window.innerWidth - x < 200) x = window.innerWidth - 210;
      if (window.innerHeight - y < 200) y = window.innerHeight - 200;

      setContextMenu({
          visible: true,
          x,
          y,
          item,
          type
      });
  };

  const handleContextMenuAction = async (action: 'playNext' | 'addToQueue') => {
      if (!contextMenu.item) return;
      
      setContextMenu(prev => ({ ...prev, visible: false }));
      
      let tracksToAdd: PlexTrack[] = [];
      const playNext = action === 'playNext';
      const item = contextMenu.item;

      try {
        if (contextMenu.type === 'track') {
            tracksToAdd = [item];
        } else if (contextMenu.type === 'album') {
            const data = await getAlbumTracks(server!.uri, server!.accessToken, section!.key, item.ratingKey);
            tracksToAdd = data.MediaContainer.Metadata || [];
        } else if (contextMenu.type === 'artist') {
            const data = await getArtistTracks(server!.uri, server!.accessToken, item.ratingKey);
            tracksToAdd = data.MediaContainer.Metadata || [];
        }
        
        if (tracksToAdd.length > 0) {
            onAddTracksToQueue(tracksToAdd, playNext);
        }
      } catch (e) {
          console.error("Failed to add tracks to queue", e);
      }
  };

  const renderTabs = () => {
    if (navStack.length > 1) return null;

    return (
      <div className="flex gap-2 mb-4 px-4 overflow-x-auto custom-scrollbar pb-2">
        {(['artists', 'albums', 'tracks'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-colors
              ${viewMode === mode ? 'bg-white text-black' : 'bg-dark-800 text-gray-400 hover:text-white'}
            `}
          >
            {mode}
          </button>
        ))}
      </div>
    );
  };

  const renderBreadcrumbs = () => {
    if (navStack.length === 1) return null;
    
    return (
      <div className="flex items-center gap-2 px-4 mb-2 text-sm text-gray-400">
        <button onClick={() => setNavStack([{ level: 'root' }])} className="hover:text-white">Library</button>
        {navStack.map((nav, i) => {
          if (i === 0) return null;
          return (
            <React.Fragment key={i}>
              <span>/</span>
              <button 
                onClick={() => setNavStack(prev => prev.slice(0, i + 1))}
                className={`max-w-[100px] truncate ${i === navStack.length - 1 ? 'text-white font-bold' : 'hover:text-white'}`}
              >
                {nav.level === 'artist' ? nav.artist?.title : nav.album?.title}
              </button>
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const renderHeader = () => {
    let title = section?.title;
    if (currentNav.level === 'artist') title = currentNav.artist?.title;
    if (currentNav.level === 'album') title = currentNav.album?.title;

    return (
        <div className="sticky top-0 bg-black/90 backdrop-blur-xl z-20 border-b border-white/10 pb-2 pt-safe-top">
            <div className="p-4 pb-2 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 overflow-hidden">
                    {navStack.length > 1 && (
                        <button onClick={handleBack} className="p-1 -ml-2 hover:bg-white/10 rounded-full">
                            <ChevronDown size={24} className="rotate-90 text-white" />
                        </button>
                    )}
                    <h2 className="text-xl font-bold text-white truncate">{title}</h2>
                </div>
                
                {navStack.length === 1 && (
                    <button 
                        onClick={onShuffleAll}
                        className="flex items-center gap-2 bg-plex-500 hover:bg-plex-600 text-black px-4 py-2 rounded-full font-bold text-xs shadow-lg shadow-plex-500/20 active:scale-95 transition-all flex-shrink-0"
                    >
                        <Shuffle size={14} />
                        <span>Shuffle</span>
                    </button>
                )}
            </div>
            
            {renderBreadcrumbs()}
            {renderTabs()}

            <div className="px-4 pb-2">
                 <input 
                   type="text" 
                   placeholder={`Filter ${currentNav.level === 'root' ? viewMode : 'items'}...`}
                   className="w-full bg-dark-800 border-none rounded-lg px-4 py-2 text-sm text-white focus:ring-1 focus:ring-plex-500 placeholder:text-gray-600"
                   value={filter}
                   onChange={e => setFilter(e.target.value)}
                 />
            </div>
        </div>
    );
  };

  const renderGridItem = (item: any, type: 'artist' | 'album') => {
    const thumb = getTranscodeUrl(server!.uri, server!.accessToken, item.thumb, 300, 300);
    return (
      <div 
        key={item.ratingKey}
        onClick={() => type === 'artist' ? navigateToArtist(item) : navigateToAlbum(item)}
        className="group cursor-pointer flex flex-col gap-2 relative"
      >
        <div className="aspect-square relative rounded-md overflow-hidden bg-dark-800 shadow-lg">
           {item.thumb ? (
               <img src={thumb} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="" />
           ) : (
               <div className="w-full h-full flex items-center justify-center text-gray-700">
                  {type === 'artist' ? <Users size={48} /> : <Disc size={48} />}
               </div>
           )}
           <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
           
           <button 
             onClick={(e) => openContextMenu(e, item, type)}
             className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white opacity-0 group-hover:opacity-100 hover:bg-black/80 transition-all md:block hidden"
           >
               <MoreVertical size={16} />
           </button>
        </div>
        <div className="text-center flex items-start justify-between">
           <div className="flex-1 min-w-0">
               <h3 className="text-white font-medium text-sm truncate">{item.title}</h3>
               {type === 'album' && <p className="text-gray-500 text-xs truncate">{item.year}</p>}
           </div>
           <button 
             onClick={(e) => openContextMenu(e, item, type)}
             className="md:hidden text-gray-500 p-1 -mt-1"
           >
               <MoreVertical size={16} />
           </button>
        </div>
      </div>
    );
  };

  const renderTrackItem = (track: PlexTrack) => (
    <div 
      key={track.ratingKey}
      onClick={() => onPlayTrack(track)}
      className="group flex items-center p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
    >
        <div className="w-8 text-center text-gray-500 text-sm font-mono mr-2 group-hover:hidden">
            {track.index}
        </div>
        <div className="w-8 text-center hidden group-hover:flex items-center justify-center mr-2">
             <Play size={16} className="text-plex-500 fill-current" />
        </div>
      
      <div className="flex-1 min-w-0">
        <h3 className="text-white font-medium truncate text-sm">{track.title}</h3>
        {(viewMode === 'tracks' && currentNav.level === 'root') && (
            <p className="text-gray-500 text-xs truncate">{track.grandparentTitle}</p>
        )}
      </div>

      <div className="text-gray-500 text-xs tabular-nums mr-2">
         {Math.floor(track.duration / 60000)}:{(Math.floor(track.duration % 60000 / 1000)).toString().padStart(2, '0')}
      </div>
      
      <button 
         onClick={(e) => openContextMenu(e, track, 'track')}
         className="p-2 text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
      >
          <MoreVertical size={16} />
      </button>
    </div>
  );

  if (!server || !section) return null;

  return (
    <div className="h-full flex flex-col bg-black relative">
      {renderHeader()}

      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 pb-40 custom-scrollbar"
      >
        {items.length === 0 && loading ? (
          <div className="flex justify-center p-20">
            <div className="w-8 h-8 border-4 border-plex-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : items.length === 0 ? (
           <div className="text-center text-gray-600 mt-20">No items found</div>
        ) : (
            <>
                {currentNav.level === 'artist' && (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {items.map(item => renderGridItem(item, 'album'))}
                    </div>
                )}

                {currentNav.level === 'album' && (
                    <div className="flex flex-col">
                        <div className="flex gap-4 mb-6 items-end">
                            <img 
                                src={getTranscodeUrl(server.uri, server.accessToken, currentNav.album?.thumb || '', 200, 200)} 
                                className="w-32 h-32 rounded shadow-2xl bg-dark-800"
                            />
                            <div>
                                <h1 className="text-xl md:text-3xl font-bold text-white">{currentNav.album?.title}</h1>
                                <p className="text-plex-500 cursor-pointer hover:underline" onClick={handleBack}>{currentNav.album?.parentTitle}</p>
                                <p className="text-gray-500 text-sm mt-1">{currentNav.album?.year} • {items.length} Tracks</p>
                            </div>
                             <div className="ml-auto flex gap-2">
                                <button 
                                    onClick={() => handleContextMenuAction('playNext')}
                                    className="p-3 bg-plex-500 rounded-full text-black hover:bg-plex-600 transition shadow-lg"
                                >
                                    <Play size={24} fill="currentColor" />
                                </button>
                             </div>
                        </div>
                        <div className="space-y-1">
                            {items.map(item => renderTrackItem(item))}
                        </div>
                    </div>
                )}

                {currentNav.level === 'root' && (
                    <>
                        {viewMode === 'artists' && (
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {items.map(item => renderGridItem(item, 'artist'))}
                            </div>
                        )}
                        {viewMode === 'albums' && (
                             <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {items.map(item => renderGridItem(item, 'album'))}
                            </div>
                        )}
                        {viewMode === 'tracks' && (
                            <div className="space-y-1">
                                {items.map(item => renderTrackItem(item))}
                            </div>
                        )}
                    </>
                )}
                
                {loading && items.length > 0 && (
                    <div className="flex justify-center p-6">
                        <div className="w-6 h-6 border-2 border-white/20 border-t-plex-500 rounded-full animate-spin"></div>
                    </div>
                )}
            </>
        )}
      </div>

      {contextMenu.visible && (
          <div 
            className="fixed z-50 bg-dark-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[180px] animate-in fade-in zoom-in-95 duration-100"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
              <div className="p-3 border-b border-white/5 bg-white/5">
                  <p className="text-xs font-bold text-white truncate max-w-[150px]">{contextMenu.item?.title}</p>
                  <p className="text-[10px] text-gray-400 capitalize">{contextMenu.type}</p>
              </div>
              <button 
                onClick={() => handleContextMenuAction('playNext')}
                className="w-full text-left px-4 py-3 text-sm text-gray-200 hover:bg-white/10 flex items-center gap-2"
              >
                  <ListStart size={16} /> Play Next
              </button>
              <button 
                onClick={() => handleContextMenuAction('addToQueue')}
                className="w-full text-left px-4 py-3 text-sm text-gray-200 hover:bg-white/10 flex items-center gap-2"
              >
                  <ListPlus size={16} /> Add to Queue
              </button>
          </div>
      )}
    </div>
  );
};

export default LibraryView;