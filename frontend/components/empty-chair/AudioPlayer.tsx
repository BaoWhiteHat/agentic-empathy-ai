'use client';

import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Volume2, VolumeX, X, Play, Pause } from 'lucide-react';

export type AudioTrack = 'rain' | 'ocean' | 'forest';

interface AudioPlayerProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_VOLUME = 70;

const TRACKS: { id: AudioTrack; label: string; emoji: string }[] = [
  { id: 'rain',   label: 'Rain',   emoji: '🌧️' },
  { id: 'ocean',  label: 'Ocean',  emoji: '🌊' },
  { id: 'forest', label: 'Forest', emoji: '🌲' },
];

export function AudioPlayer({ isOpen, onClose }: AudioPlayerProps) {
  const [selectedTrack, setSelectedTrack] = useState<AudioTrack | null>(null);
  const [isPlaying, setIsPlaying]         = useState(false);
  const [volume, setVolume]               = useState(DEFAULT_VOLUME);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Create and clean up the audio element once
  useEffect(() => {
    const audio = new Audio();
    audio.loop    = true;
    audio.preload = 'metadata';
    audio.volume  = DEFAULT_VOLUME / 100;
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  // Keep audio volume in sync with slider state
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  function selectTrack(track: AudioTrack) {
    const audio = audioRef.current;
    if (!audio || selectedTrack === track) return;

    audio.pause();
    audio.src = `/audio/${track}.mp3`;
    setSelectedTrack(track);

    void audio.play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
  }

  function togglePlayPause() {
    const audio = audioRef.current;
    if (!audio || !selectedTrack) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      void audio.play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  }

  function handleClose() {
    audioRef.current?.pause();
    setIsPlaying(false);
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') handleClose();
  }

  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    setVolume(Number(e.target.value));
  }

  function toggleMute() {
    setVolume(v => (v === 0 ? DEFAULT_VOLUME : 0));
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          className="fixed bottom-6 right-6 z-50 w-[280px] bg-card backdrop-blur-md border border-purple-500/30 rounded-2xl shadow-2xl shadow-purple-900/20"
          onKeyDown={handleKeyDown}
          role="dialog"
          aria-label="Calming sounds player"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="text-sm" aria-hidden="true">🎵</span>
              <span className="text-sm font-semibold text-foreground">Calming Sounds</span>
            </div>
            <button
              onClick={handleClose}
              className="text-foreground/40 hover:text-foreground transition-colors p-0.5 rounded"
              aria-label="Close audio player"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Track selector */}
          <div className="p-3 space-y-1.5">
            {TRACKS.map(track => (
              <button
                key={track.id}
                onClick={() => selectTrack(track.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  selectedTrack === track.id
                    ? 'bg-purple-600 text-white'
                    : 'bg-card border border-border hover:border-purple-500/40 text-foreground'
                }`}
                aria-label={`Play ${track.label} sounds`}
                aria-pressed={selectedTrack === track.id}
              >
                <span aria-hidden="true">{track.emoji}</span>
                {track.label}
              </button>
            ))}
          </div>

          {/* Playback controls */}
          <div className="flex items-center gap-3 px-4 pb-4">
            {/* Play / Pause */}
            <button
              onClick={togglePlayPause}
              disabled={selectedTrack === null}
              className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
                selectedTrack === null
                  ? 'bg-purple-600/30 text-white/30 opacity-50 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-500 text-white'
              }`}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying
                ? <Pause className="w-3.5 h-3.5" />
                : <Play  className="w-3.5 h-3.5 ml-0.5" />
              }
            </button>

            {/* Volume row */}
            <div className="flex-1 flex items-center gap-2">
              <button
                onClick={toggleMute}
                className="text-foreground/40 hover:text-foreground transition-colors shrink-0"
                aria-label={volume === 0 ? 'Unmute' : 'Mute'}
              >
                {volume === 0
                  ? <VolumeX className="w-3.5 h-3.5" />
                  : <Volume2 className="w-3.5 h-3.5" />
                }
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={volume}
                onChange={handleVolumeChange}
                className="flex-1 h-1 accent-purple-500 cursor-pointer"
                aria-label="Volume"
              />
              <span className="text-[11px] text-foreground/40 tabular-nums w-7 text-right shrink-0">
                {volume}%
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
