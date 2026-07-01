"use client";

import { useEffect, useRef } from "react";
import Hls from "hls.js";
import { isSafeUrl } from "@/lib/api";

const HLS_CONFIG = {
  enableWorker: true,
  lowLatencyMode: false,
} as const;

function attachNativeHLS(video: HTMLVideoElement, src: string) {
  video.src = src;
}

function createHlsPlayer(video: HTMLVideoElement, src: string) {
  const hls = new Hls(HLS_CONFIG);
  hls.loadSource(src);
  hls.attachMedia(video);
  return hls;
}

export function HLSPlayer({ src, className }: { src: string; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src || !isSafeUrl(src)) return;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      attachNativeHLS(video, src);
    } else if (Hls.isSupported()) {
      const hls = createHlsPlayer(video, src);
      return () => hls.destroy();
    }
  }, [src]);

  return (
    <video
      ref={videoRef}
      controls
      playsInline
      className={className || "w-full rounded-lg"}
      style={{ maxHeight: "500px" }}
    />
  );
}
