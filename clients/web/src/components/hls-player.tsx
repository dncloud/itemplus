"use client";

import { useEffect, useRef } from "react";
import Hls from "hls.js";
import { isSafeUrl } from "@/lib/api";

export function HLSPlayer({ src, className }: { src: string; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src || !isSafeUrl(src)) return;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari — native HLS support
      video.src = src;
    } else if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });
      hls.loadSource(src);
      hls.attachMedia(video);
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
