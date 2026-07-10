// HTML5 <video> implementation of ControllablePlayer.
// This is a plain local/authorized video element — NOT a protected streaming
// provider. It drives precise ticks via requestAnimationFrame while playing.
import type { ControllablePlayer } from "./types";

export function createHtml5Player(video: HTMLVideoElement): ControllablePlayer {
  return {
    getCurrentTime: () => video.currentTime || 0,
    getDuration: () => (Number.isFinite(video.duration) ? video.duration : 0),
    seekTo: (s: number) => {
      try {
        video.currentTime = Math.max(0, s);
      } catch {
        /* ignore */
      }
    },
    getMuted: () => video.muted,
    setMuted: (m: boolean) => {
      video.muted = m;
    },
    getVolume: () => video.volume,
    setVolume: (v: number) => {
      video.volume = Math.min(1, Math.max(0, v));
    },
    onTimeUpdate: (cb: (seconds: number) => void) => {
      let raf = 0;
      let stopped = false;
      const loop = () => {
        if (stopped) return;
        cb(video.currentTime || 0);
        raf = requestAnimationFrame(loop);
      };
      // rAF while playing (precise); also catch scrubs/pauses via events.
      const onPlay = () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(loop);
      };
      const onStop = () => {
        cancelAnimationFrame(raf);
        cb(video.currentTime || 0);
      };
      const onSeek = () => cb(video.currentTime || 0);
      video.addEventListener("play", onPlay);
      video.addEventListener("playing", onPlay);
      video.addEventListener("pause", onStop);
      video.addEventListener("ended", onStop);
      video.addEventListener("seeked", onSeek);
      video.addEventListener("timeupdate", onSeek);
      if (!video.paused) onPlay();
      return () => {
        stopped = true;
        cancelAnimationFrame(raf);
        video.removeEventListener("play", onPlay);
        video.removeEventListener("playing", onPlay);
        video.removeEventListener("pause", onStop);
        video.removeEventListener("ended", onStop);
        video.removeEventListener("seeked", onSeek);
        video.removeEventListener("timeupdate", onSeek);
      };
    },
    onSeek: (cb: (seconds: number) => void) => {
      const onSeek = () => cb(video.currentTime || 0);
      video.addEventListener("seeked", onSeek);
      return () => video.removeEventListener("seeked", onSeek);
    },
  };
}
