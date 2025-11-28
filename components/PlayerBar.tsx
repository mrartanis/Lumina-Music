import React from 'react';
import { PlayQueueItem } from '../types';
import { getTranscodeUrl } from '../services/plexService';
import { Play, Pause, SkipBack, SkipForward, Volume2 } from './Icons';

interface PlayerBarProps {
  currentTrack: PlayQueueItem | null;
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onEnded: () => void;
  className?: string;
  onExpand: () => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}

const PlayerBar: React.FC<PlayerBarProps> = ({ 
  currentTrack, isPlaying, onPlayPause, onNext, onPrev, onExpand, currentTime, duration, onSeek
}) => {
  
  if (!currentTrack) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    onSeek(percentage * duration);
  };

  const thumbUrl = getTranscodeUrl(
    currentTrack.serverUri,
    currentTrack.serverToken,
    currentTrack.track.thumb,
    100,
    100
  );

  return (
    <div className="fixed bottom-[60px] md:bottom-0 left-0 right-0 bg-dark-800/95 backdrop-blur-md border-t border-white/10 p-2 md:p-4 z-50 shadow-2xl safe-area-bottom">
      {/* Progress Bar (Interactive) */}
      <div 
        className="absolute top-0 left-0 right-0 h-4 -mt-2 cursor-pointer group flex items-center"
        onClick={handleSeek}
      >
        <div className="w-full h-1 bg-gray-700/50 relative">
             <div 
               className="h-full bg-plex-600 transition-all duration-100 ease-linear relative" 
               style={{ width: `${progress}%` }} 
             >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 shadow-md transform scale-0 group-hover:scale-100 transition-all"/>
             </div>
        </div>
      </div>
      
      <div className="flex items-center justify-between max-w-7xl mx-auto pt-1">
        
        {/* Track Info */}
        <div className="flex items-center flex-1 min-w-0 cursor-pointer" onClick={onExpand}>
          <img 
            src={thumbUrl} 
            alt="Album Art" 
            className="w-12 h-12 md:w-14 md:h-14 rounded-md object-cover shadow-lg bg-dark-700 select-none"
          />
          <div className="ml-3 flex flex-col overflow-hidden select-none">
            <span className="text-white font-semibold text-sm md:text-base truncate">
              {currentTrack.track.title}
            </span>
            <span className="text-gray-400 text-xs md:text-sm truncate">
              {currentTrack.track.originalTitle || currentTrack.track.grandparentTitle}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4 md:gap-6 mx-4">
          <button onClick={onPrev} className="text-gray-300 hover:text-white hidden md:block">
            <SkipBack size={24} />
          </button>
          
          <button 
            onClick={(e) => { e.stopPropagation(); onPlayPause(); }}
            className="w-10 h-10 md:w-12 md:h-12 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition active:scale-95"
          >
            {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
          </button>
          
          <button onClick={onNext} className="text-gray-300 hover:text-white">
            <SkipForward size={24} />
          </button>
        </div>

        {/* Desktop Volume & Expand */}
        <div className="hidden md:flex items-center gap-4 w-32 justify-end">
           <Volume2 size={20} className="text-gray-400" />
           <div className="h-1 w-20 bg-gray-600 rounded-full overflow-hidden">
             <div className="h-full w-2/3 bg-gray-400"></div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerBar;