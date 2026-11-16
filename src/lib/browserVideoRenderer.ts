export interface BrowserRenderResult {
  videoUrl: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  durationSec: number;
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = 4000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function pickSupportedRecorderMime(): { mimeType: string; ext: 'mp4' | 'webm' } {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('MediaRecorder não suportado neste navegador.');
  }
  const candidates: Array<{ mime: string; ext: 'mp4' | 'webm' }> = [
    { mime: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', ext: 'mp4' },
    { mime: 'video/mp4', ext: 'mp4' },
    { mime: 'video/webm;codecs=vp9,opus', ext: 'webm' },
    { mime: 'video/webm;codecs=vp8,opus', ext: 'webm' },
    { mime: 'video/webm', ext: 'webm' },
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c.mime)) {
      return { mimeType: c.mime, ext: c.ext };
    }
  }
  return { mimeType: '', ext: 'webm' };
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  source: HTMLImageElement | HTMLVideoElement,
  srcWidth: number,
  srcHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  zoom = 1
) {
  if (!srcWidth || !srcHeight) return;
  const targetRatio = canvasWidth / canvasHeight;
  const srcRatio = srcWidth / srcHeight;

  let drawW = canvasWidth;
  let drawH = canvasHeight;
  if (srcRatio > targetRatio) {
    drawH = canvasHeight * zoom;
    drawW = drawH * srcRatio;
  } else {
    drawW = canvasWidth * zoom;
    drawH = drawW / srcRatio;
  }

  const dx = (canvasWidth - drawW) / 2;
  const dy = (canvasHeight - drawH) / 2;
  ctx.drawImage(source, dx, dy, drawW, drawH);
}

async function decodeOptionalAudio(audioUrl?: string | null): Promise<{
  audioCtx: AudioContext | null;
  audioBuffer: AudioBuffer | null;
}> {
  if (!audioUrl) return { audioCtx: null, audioBuffer: null };
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return { audioCtx: null, audioBuffer: null };
    const res = await fetch(audioUrl);
    if (!res.ok) return { audioCtx: null, audioBuffer: null };
    const arrBuf = await res.arrayBuffer();
    const audioCtx = new AudioCtx();
    const audioBuffer = await audioCtx.decodeAudioData(arrBuf);
    return { audioCtx, audioBuffer };
  } catch {
    return { audioCtx: null, audioBuffer: null };
  }
}

export async function renderKenBurnsVideoInBrowser(params: {
  imageUrl: string;
  title?: string;
  audioUrl?: string | null;
  durationSec?: number;
  itemId?: string;
  slotNumber?: number;
}): Promise<BrowserRenderResult> {
  const width = 1080;
  const height = 1920;
  const fps = 30;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Contexto 2D de Canvas indisponível no navegador.');
  }

  const [img, audioDecoded] = await Promise.all([
    loadImage(params.imageUrl),
    decodeOptionalAudio(params.audioUrl),
  ]);

  const { audioCtx, audioBuffer } = audioDecoded;
  const targetDurationSec = audioBuffer
    ? Math.max(4, Math.min(28, Number(audioBuffer.duration.toFixed(1))))
    : Math.max(4, Math.min(10, Math.round(params.durationSec || 5)));

  const { mimeType, ext } = pickSupportedRecorderMime();
  const canvasStream = canvas.captureStream(fps);
  let audioSource: AudioBufferSourceNode | null = null;

  const combinedStream = new MediaStream();
  canvasStream.getVideoTracks().forEach((t) => combinedStream.addTrack(t));

  if (audioCtx && audioBuffer) {
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume().catch(() => {});
    }
    const dest = audioCtx.createMediaStreamDestination();
    audioSource = audioCtx.createBufferSource();
    audioSource.buffer = audioBuffer;
    audioSource.connect(dest);
    dest.stream.getAudioTracks().forEach((t) => combinedStream.addTrack(t));
  }

  const chunks: BlobPart[] = [];
  const recorder = mimeType
    ? new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: 2_800_000 })
    : new MediaRecorder(combinedStream);

  const renderFrame = (progress: number) => {
    ctx.save();
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, height);

    const zoom = 1 + 0.2 * Math.min(1, Math.max(0, progress));
    if (img) {
      if ('filter' in ctx) {
        ctx.filter = 'contrast(1.04) saturate(1.06) brightness(1.01)';
      }
      drawCoverImage(ctx, img, img.naturalWidth, img.naturalHeight, width, height, zoom);
      if ('filter' in ctx) {
        ctx.filter = 'none';
      }
    }

    const topGrad = ctx.createLinearGradient(0, 0, 0, height * 0.34);
    topGrad.addColorStop(0, 'rgba(0,0,0,0.68)');
    topGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, width, height * 0.34);

    const bottomGrad = ctx.createLinearGradient(0, height * 0.68, 0, height);
    bottomGrad.addColorStop(0, 'rgba(0,0,0,0)');
    bottomGrad.addColorStop(1, 'rgba(0,0,0,0.78)');
    ctx.fillStyle = bottomGrad;
    ctx.fillRect(0, height * 0.68, width, height * 0.32);

    if (params.title) {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 62px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 12;
      ctx.fillText(params.title.slice(0, 32), width / 2, 190);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  };

  renderFrame(0);

  try {
    const blob = await new Promise<Blob>((resolve, reject) => {
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
      };
      recorder.onerror = () => reject(new Error('Falha durante gravação Canvas MediaRecorder.'));
      recorder.onstop = () => {
        const finalType = mimeType || chunks[0]?.constructor?.name || 'video/webm';
        resolve(new Blob(chunks, { type: mimeType || (typeof finalType === 'string' ? finalType : 'video/webm') }));
      };

      const startTime = performance.now();
      const durationMs = targetDurationSec * 1000;

      recorder.start(250);
      if (audioSource) {
        audioSource.start(0);
      }

      const interval = window.setInterval(() => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(1, elapsed / durationMs);
        renderFrame(progress);
        if (elapsed >= durationMs) {
          window.clearInterval(interval);
          if (recorder.state !== 'inactive') {
            recorder.stop();
          }
        }
      }, Math.round(1000 / fps));
    });

    const safeId = String(params.itemId || 'produto').replace(/[^a-zA-Z0-9_-]/g, '');
    const slot = Number(params.slotNumber || 1);
    const filename = `slot${slot}_${safeId}_canvas.${ext}`;
    const videoUrl = URL.createObjectURL(blob);

    return {
      videoUrl,
      filename,
      mimeType: blob.type || mimeType || `video/${ext}`,
      sizeBytes: blob.size,
      durationSec: targetDurationSec,
    };
  } finally {
    canvasStream.getTracks().forEach((t) => t.stop());
    combinedStream.getTracks().forEach((t) => t.stop());
    if (audioSource) {
      try {
        audioSource.stop();
      } catch {
        // ignore if already stopped
      }
    }
    if (audioCtx) {
      await audioCtx.close().catch(() => {});
    }
  }
}

export async function muxFlowVideoInBrowser(params: {
  file: File;
  audioUrl?: string | null;
  itemId?: string;
  slotNumber?: number;
}): Promise<BrowserRenderResult> {
  const { file, audioUrl } = params;
  const safeId = String(params.itemId || 'flow').replace(/[^a-zA-Z0-9_-]/g, '');
  const slot = Number(params.slotNumber || 1);

  if (!audioUrl) {
    return {
      videoUrl: URL.createObjectURL(file),
      filename: file.name || `flow_slot${slot}_${safeId}.mp4`,
      mimeType: file.type || 'video/mp4',
      sizeBytes: file.size,
      durationSec: 8,
    };
  }

  const audioDecoded = await decodeOptionalAudio(audioUrl);
  if (!audioDecoded.audioCtx || !audioDecoded.audioBuffer) {
    return {
      videoUrl: URL.createObjectURL(file),
      filename: file.name || `flow_slot${slot}_${safeId}.mp4`,
      mimeType: file.type || 'video/mp4',
      sizeBytes: file.size,
      durationSec: 8,
    };
  }

  const width = 1080;
  const height = 1920;
  const fps = 30;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    await audioDecoded.audioCtx.close().catch(() => {});
    throw new Error('Contexto 2D indisponível para mixagem no navegador.');
  }

  const rawVideoUrl = URL.createObjectURL(file);
  const videoEl = document.createElement('video');
  videoEl.src = rawVideoUrl;
  videoEl.muted = true;
  videoEl.loop = true;
  videoEl.playsInline = true;

  await new Promise<void>((resolve, reject) => {
    videoEl.onloadeddata = () => resolve();
    videoEl.onerror = () => reject(new Error('Não foi possível ler o arquivo .mp4 no navegador.'));
  });

  const { audioCtx, audioBuffer } = audioDecoded;
  const targetDurationSec = Math.max(4, Math.min(28, Number(audioBuffer.duration.toFixed(1))));
  const { mimeType, ext } = pickSupportedRecorderMime();

  const canvasStream = canvas.captureStream(fps);
  const combinedStream = new MediaStream();
  canvasStream.getVideoTracks().forEach((t) => combinedStream.addTrack(t));

  if (audioCtx.state === 'suspended') {
    await audioCtx.resume().catch(() => {});
  }
  const dest = audioCtx.createMediaStreamDestination();
  const audioSource = audioCtx.createBufferSource();
  audioSource.buffer = audioBuffer;
  audioSource.connect(dest);
  dest.stream.getAudioTracks().forEach((t) => combinedStream.addTrack(t));

  const chunks: BlobPart[] = [];
  const recorder = mimeType
    ? new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: 3_000_000 })
    : new MediaRecorder(combinedStream);

  try {
    await videoEl.play().catch(() => {});
    const blob = await new Promise<Blob>((resolve, reject) => {
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
      };
      recorder.onerror = () => reject(new Error('Erro durante mixagem MediaRecorder.'));
      recorder.onstop = () => {
        resolve(new Blob(chunks, { type: mimeType || 'video/webm' }));
      };

      const startTime = performance.now();
      const durationMs = targetDurationSec * 1000;
      recorder.start(250);
      audioSource.start(0);

      const interval = window.setInterval(() => {
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(0, 0, width, height);
        drawCoverImage(ctx, videoEl, videoEl.videoWidth, videoEl.videoHeight, width, height, 1);
        if (performance.now() - startTime >= durationMs) {
          window.clearInterval(interval);
          if (recorder.state !== 'inactive') {
            recorder.stop();
          }
        }
      }, Math.round(1000 / fps));
    });

    const filename = `flow_slot${slot}_${safeId}_canvas.${ext}`;
    return {
      videoUrl: URL.createObjectURL(blob),
      filename,
      mimeType: blob.type || mimeType || `video/${ext}`,
      sizeBytes: blob.size,
      durationSec: targetDurationSec,
    };
  } finally {
    videoEl.pause();
    URL.revokeObjectURL(rawVideoUrl);
    canvasStream.getTracks().forEach((t) => t.stop());
    combinedStream.getTracks().forEach((t) => t.stop());
    try {
      audioSource.stop();
    } catch {
      // ignore
    }
    await audioCtx.close().catch(() => {});
  }
}
