import React, { useRef, useEffect, useState } from 'react';
import { PlayQueueItem } from '../types';
import { getTranscodeUrl } from '../services/plexService';
import { X, Trash2, Play, GripVertical, ArrowUp, ArrowDown } from './Icons';

interface QueueViewProps {
  queue: PlayQueueItem[];
  currentIndex: number;
  onClose: () => void;
  onPlayIndex: (index: number) => void;
  onRemoveIndex: (index: number) => void;
  onReorder: (from: number, to: number) => void;
  onClear: () => void;
}

const QueueView: React.FC<QueueViewProps> = ({ queue, currentIndex, onClose, onPlayIndex, onRemoveIndex, onReorder, onClear }) => {
  const currentItemRef = useRef<HTMLDivElement>(null);
  const [editMode, setEditMode] = useState(false);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

  useEffect(() => {
    if (currentItemRef.current) {
      currentItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Firefox requires data to be set
    e.dataTransfer.setData('text/plain', index.toString());
    
    // Add a class or style to the ghost image if needed
    const target = e.target as HTMLElement;
    target.style.opacity = '0.5';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedItemIndex(null);
    const target = e.target as HTMLElement;
    target.style.opacity = '1';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault(); // Necessary to allow dropping
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItemIndex !== null && draggedItemIndex !== index) {
      onReorder(draggedItemIndex, index);
    }
  };

  const handleClear = () => {
      if (window.confirm("Are you sure you want to clear the entire queue?")) {
          onClear();
          setEditMode(false);
      }
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-[70] flex flex-col animate-in fade-in duration-200">
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-dark-900 safe-area-top mt-safe-top">
        <h2 className="text-lg font-bold text-white">Play Queue</h2>
        <div className="flex gap-2">
            {editMode && (
                <button 
                    onClick={handleClear}
                    className="px-3 py-1 rounded-full text-sm font-medium bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors mr-2"
                >
                    Clear All
                </button>
            )}
            <button 
                onClick={() => setEditMode(!editMode)} 
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${editMode ? 'bg-plex-500 text-black' : 'bg-white/10 text-white'}`}
            >
                {editMode ? 'Done' : 'Edit'}
            </button>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full">
                <X size={24} className="text-white" />
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 pb-safe">
        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <p>Queue is empty</p>
          </div>
        ) : (
          queue.map((item, index) => {
            const isCurrent = index === currentIndex;
            return (
              <div 
                key={item.uuid}
                ref={isCurrent ? currentItemRef : null}
                draggable={!editMode}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                className={`flex items-center gap-3 p-2 rounded-lg group select-none transition-colors
                    ${isCurrent ? 'bg-white/10 ring-1 ring-plex-500' : 'hover:bg-white/5'}
                    ${draggedItemIndex === index ? 'opacity-50 border-2 border-dashed border-gray-500' : ''}
                `}
              >
                {/* Drag Handle / Reorder Controls */}
                {editMode ? (
                    <div className="flex flex-col gap-1 mr-1">
                        <button 
                            disabled={index === 0}
                            onClick={(e) => { e.stopPropagation(); onReorder(index, index - 1); }}
                            className="p-1 text-gray-400 hover:text-white disabled:opacity-30"
                        >
                            <ArrowUp size={16} />
                        </button>
                        <button 
                            disabled={index === queue.length - 1}
                            onClick={(e) => { e.stopPropagation(); onReorder(index, index + 1); }}
                            className="p-1 text-gray-400 hover:text-white disabled:opacity-30"
                        >
                            <ArrowDown size={16} />
                        </button>
                    </div>
                ) : (
                    <div className="text-gray-600 cursor-grab active:cursor-grabbing hidden md:block">
                        <GripVertical size={20} />
                    </div>
                )}

                <div 
                    className="relative w-12 h-12 flex-shrink-0 cursor-pointer"
                    onClick={() => onPlayIndex(index)}
                >
                  <img 
                    src={getTranscodeUrl(item.serverUri, item.serverToken, item.track.thumb, 100, 100)} 
                    className={`w-full h-full object-cover rounded bg-dark-800 ${isCurrent ? 'opacity-50' : ''}`}
                    alt="" 
                  />
                  {isCurrent && (
                      <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-3 h-3 bg-plex-500 rounded-full animate-pulse shadow-[0_0_10px_#e5a00d]"/>
                      </div>
                  )}
                  {!isCurrent && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity rounded">
                        <Play size={20} className="text-white fill-current" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onPlayIndex(index)}>
                  <p className={`truncate font-medium ${isCurrent ? 'text-plex-500' : 'text-white'}`}>
                    {item.track.title}
                  </p>
                  <p className="truncate text-xs text-gray-400">
                    {item.track.grandparentTitle}
                  </p>
                </div>

                {/* Remove Button */}
                <button 
                  onClick={(e) => { e.stopPropagation(); onRemoveIndex(index); }}
                  className={`p-2 text-gray-600 hover:text-red-500 transition-all ${editMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                >
                  <Trash2 size={20} />
                </button>
              </div>
            );
          })
        )}
      </div>
      
      <div className="p-4 border-t border-white/10 bg-dark-900 text-center text-xs text-gray-500 pb-safe">
         {queue.length} Tracks • {currentIndex + 1} / {queue.length}
      </div>
    </div>
  );
};

export default QueueView;