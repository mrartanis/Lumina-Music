import React from 'react';
import { PlayQueueItem } from '../types';
import { getTranscodeUrl } from '../services/plexService';
import { ChevronDown, SkipBack, Play, Pause, SkipForward, Repeat, Shuffle, List } from './Icons';

interface FullScreenPlayerProps {
  track: PlayQueueItem;
  isPlaying: boolean;
  onClose: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onToggleQueue: () => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}

const FullScreenPlayer: React.FC<FullScreenPlayerProps> = ({
  track, isPlaying, onClose, onPlayPause, onNext, onPrev, onToggleQueue, currentTime, duration, onSeek
}) => {
  
  const coverUrl = getTranscodeUrl(
    track.serverUri,
    track.serverToken,
    track.track.thumb,
    600,
    600
  );

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    onSeek(percentage * duration);
  };

  const formatTime = (ms: number) => {
      const seconds = Math.floor(ms / 1000);
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-[60] flex flex-col animate-in slide-in-from-bottom duration-300">
      <div 
        className="absolute inset-0 opacity-30 pointer-events-none blur-3xl scale-150 transition-opacity duration-1000"
        style={{ 
            backgroundImage: `url(${coverUrl})`, 
            backgroundPosition: 'center', 
            backgroundSize: 'cover' 
        }} 
      />
      
      <div className="relative flex items-center justify-between p-6 mt-safe-top z-10">
        <button onClick={onClose} className="text-white/80 hover:text-white p-2">
          <ChevronDown size={32} />
        </button>
        <div className="text-xs font-bold tracking-widest text-white/60 uppercase">Now Playing</div>
        <button onClick={onToggleQueue} className="text-white/80 hover:text-white p-2">
            <List size={28} />
        </button>
      </div>

      <div className="relative flex-1 flex flex-col items-center justify-center p-8 z-10">
        <div className="w-full max-w-sm aspect-square mb-8 shadow-2xl rounded-2xl overflow-hidden bg-dark-800 border border-white/5">
           <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
        </div>

        <div className="w-full max-w-sm text-left mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2 leading-tight line-clamp-2">{track.track.title}</h1>
            <h2 className="text-lg md:text-xl text-plex-500 font-medium truncate">{track.track.grandparentTitle}</h2>
            <h3 className="text-white/60 text-sm mt-1 truncate">{track.track.parentTitle}</h3>
        </div>

        <div className="w-full max-w-sm mb-8 group">
            <div 
                className="h-2 bg-white/20 rounded-full cursor-pointer relative"
                onClick={handleSeek}
            >
                <div 
                    className="h-full bg-white rounded-full relative" 
                    style={{ width: `${progress}%` }}
                >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity transform scale-125" />
                </div>
            </div>
            <div className="flex justify-between text-xs text-white/40 mt-2 font-mono">
                <span>{formatTime(currentTime * 1000)}</span>
                <span>{formatTime(duration * 1000)}</span>
            </div>
        </div>

        <div className="w-full max-w-sm flex items-center justify-between">
           <button className="text-white/40 hover:text-white"><Shuffle size={24} /></button>
           <button onClick={onPrev} className="text-white hover:text-plex-500 transition-colors"><SkipBack size={40} /></button>
           <button 
             onClick={onPlayPause}
             className="w-20 h-20 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition shadow-lg shadow-white/20"
           >
              {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
           </button>
           <button onClick={onNext} className="text-white hover:text-plex-500 transition-colors"><SkipForward size={40} /></button>
           <button className="text-white/40 hover:text-white"><Repeat size={24} /></button>
        </div>
      </div>
    </div>
  );
};

export default FullScreenPlayer;