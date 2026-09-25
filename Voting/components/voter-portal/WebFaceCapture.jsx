'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';

/**
 * Direct webcam capture for web beta voting.
 * Laptop cameras have no motion sensor — this must never wait on
 * DeviceMotion / surrounding / rotation monitoring.
 */
export default function WebFaceCapture({
  onCaptured,
  onError,
  disabled = false,
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    setLocalError('');
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 960 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraReady(true);
    } catch {
      setCameraReady(false);
      const msg = 'Camera access is blocked. Allow the camera, then capture again.';
      setLocalError(msg);
      onError?.(msg);
    }
  }, [onError]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const capture = useCallback(async () => {
    if (disabled || busy) return;
    const video = videoRef.current;
    if (!video || !cameraReady) {
      const msg = 'Camera is not ready yet.';
      setLocalError(msg);
      onError?.(msg);
      return;
    }
    setBusy(true);
    setLocalError('');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      stopCamera();
      onCaptured(dataUrl);
    } catch {
      const msg = 'Could not capture a frame. Try again.';
      setLocalError(msg);
      onError?.(msg);
    } finally {
      setBusy(false);
    }
  }, [busy, cameraReady, disabled, onCaptured, onError, stopCamera]);

  return (
    <div className="space-y-4">
      <div className="relative mx-auto w-full max-w-md aspect-3/4 rounded-4xl overflow-hidden border border-white/10 bg-black shadow-[0_0_0_1px_rgba(40,153,245,0.25)]">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="absolute inset-0 h-full w-full object-cover scale-x-[-1]"
          aria-label="Face capture preview"
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative h-[72%] w-[68%] rounded-[2.25rem] border border-white/25 bg-transparent shadow-[0_0_0_9999px_rgba(10,15,29,0.58)]">
            <div className="absolute left-4 top-4 h-8 w-8 rounded-tl-2xl border-l-2 border-t-2 border-[#7dd3fc]" />
            <div className="absolute right-4 top-4 h-8 w-8 rounded-tr-2xl border-r-2 border-t-2 border-[#7dd3fc]" />
            <div className="absolute bottom-4 left-4 h-8 w-8 rounded-bl-2xl border-b-2 border-l-2 border-[#7dd3fc]" />
            <div className="absolute bottom-4 right-4 h-8 w-8 rounded-br-2xl border-b-2 border-r-2 border-[#7dd3fc]" />
            <div className="absolute left-1/2 top-[20%] h-[56%] w-[54%] -translate-x-1/2 rounded-[999px] border border-dashed border-white/35" />
            <div className="absolute inset-x-6 bottom-6 rounded-full bg-[#0A0F1D]/75 px-3 py-2 text-center text-[11px] font-semibold tracking-wide text-white/85 backdrop-blur-sm">
              Align face and shoulders inside the frame
            </div>
          </div>
        </div>
        {!cameraReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0A0F1D]/90 px-6 text-center">
            <Camera className="text-[#2899F5] mb-3" size={36} aria-hidden="true" />
            <p className="text-sm text-white/80">Starting camera…</p>
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-[2px]">
            <Loader2 className="animate-spin text-[#2899F5] mb-2" size={32} aria-hidden="true" />
            <p className="text-xs font-semibold uppercase tracking-wider text-white">Capturing…</p>
          </div>
        )}
      </div>

      <p className="text-center text-sm text-white/65">
        Align your head and shoulders inside the guide, then capture. Web beta skips room-motion checks because laptop browsers do not expose motion sensors.
      </p>

      {localError && (
        <p className="text-sm text-red-300 text-center" role="alert">
          {localError}
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={capture}
          disabled={disabled || busy || !cameraReady}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-[#0078D4] hover:bg-[#2899F5] disabled:opacity-50 text-white font-semibold px-5 py-3.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2899F5] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0F1D]"
        >
          <Camera size={18} aria-hidden="true" />
          Capture face
        </button>
        <button
          type="button"
          onClick={startCamera}
          disabled={disabled || busy}
          className="inline-flex items-center justify-center rounded-full border border-white/15 hover:border-white/35 text-white/80 hover:text-white font-semibold px-5 py-3.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2899F5]"
        >
          Restart camera
        </button>
      </div>
    </div>
  );
}
