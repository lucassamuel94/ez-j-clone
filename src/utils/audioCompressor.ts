import lamejs from '@breezystack/lamejs';

export interface CompressionProgress {
  phase: 'decoding' | 'encoding' | 'done';
  percent: number;
}

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB (vídeos de Meet podem ser grandes)
const SKIP_COMPRESSION_SIZE = 25 * 1024 * 1024; // 25MB
const TARGET_BITRATE = 128;
const VIDEO_BITRATE = 48; // bitrate fixo para extração de áudio de vídeo (mono, 16kHz)
const BLOCK_SIZE = 1152;

export const shouldCompress = (file: File): boolean => {
  // Skip if already a small MP3
  if (file.type === 'audio/mpeg' && file.size <= SKIP_COMPRESSION_SIZE) {
    return false;
  }
  return true;
};

export const validateFileSize = (file: File): string | null => {
  if (file.size > MAX_FILE_SIZE) {
    return `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(0)}MB). Máximo permitido: 2GB.`;
  }
  return null;
};

export const compressAudio = async (
  file: File,
  onProgress?: (progress: CompressionProgress) => void,
  signal?: AbortSignal,
  options?: { forceMonoLowBitrate?: boolean }
): Promise<File> => {
  if (!shouldCompress(file)) {
    onProgress?.({ phase: 'done', percent: 100 });
    return file;
  }

  const checkAbort = () => {
    if (signal?.aborted) throw new DOMException('Compressão cancelada', 'AbortError');
  };

  // Phase 1: Decode audio
  onProgress?.({ phase: 'decoding', percent: 0 });
  
  const arrayBuffer = await file.arrayBuffer();
  onProgress?.({ phase: 'decoding', percent: 30 });

  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  let audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  onProgress?.({ phase: 'decoding', percent: 80 });

  const useLowBitrate = options?.forceMonoLowBitrate === true;

  // Resample to 16kHz for Whisper compatibility when using low bitrate mode
  const WHISPER_SAMPLE_RATE = 16000;
  if (useLowBitrate && audioBuffer.sampleRate > WHISPER_SAMPLE_RATE) {
    const offlineCtx = new OfflineAudioContext(
      1, // mono
      Math.ceil(audioBuffer.duration * WHISPER_SAMPLE_RATE),
      WHISPER_SAMPLE_RATE
    );
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);
    audioBuffer = await offlineCtx.startRendering();
  }

  onProgress?.({ phase: 'decoding', percent: 100 });

  // Phase 2: Encode to MP3
  onProgress?.({ phase: 'encoding', percent: 0 });

  const outChannels = useLowBitrate ? 1 : Math.min(audioBuffer.numberOfChannels, 2);
  const bitrate = useLowBitrate ? VIDEO_BITRATE : TARGET_BITRATE;
  const sampleRate = audioBuffer.sampleRate;

  // Convert Float32 to Int16 — mix to mono if needed
  const int16Data: Int16Array[] = [];
  if (useLowBitrate && audioBuffer.numberOfChannels >= 2) {
    // Mix stereo to mono
    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.getChannelData(1);
    const mono = new Int16Array(left.length);
    for (let i = 0; i < left.length; i++) {
      mono[i] = Math.max(-32768, Math.min(32767, Math.round(((left[i] + right[i]) / 2) * 32767)));
    }
    int16Data.push(mono);
  } else {
    for (let ch = 0; ch < outChannels; ch++) {
      const floatData = audioBuffer.getChannelData(ch);
      const intData = new Int16Array(floatData.length);
      for (let i = 0; i < floatData.length; i++) {
        intData[i] = Math.max(-32768, Math.min(32767, Math.round(floatData[i] * 32767)));
      }
      int16Data.push(intData);
    }
  }

  const encoder = new lamejs.Mp3Encoder(outChannels, sampleRate, bitrate);
  const mp3Data: Uint8Array[] = [];
  const totalSamples = int16Data[0].length;

  for (let i = 0; i < totalSamples; i += BLOCK_SIZE) {
    // Check abort every ~2% to stay responsive
    if (i % (BLOCK_SIZE * 20) === 0) {
      checkAbort();
      const percent = Math.round((i / totalSamples) * 100);
      onProgress?.({ phase: 'encoding', percent });
      // Yield to main thread for UI updates
      await new Promise(r => setTimeout(r, 0));
    }

    const left = int16Data[0].subarray(i, i + BLOCK_SIZE);
    const right = outChannels === 2 ? int16Data[1].subarray(i, i + BLOCK_SIZE) : undefined;

    let mp3buf: any;
    if (outChannels === 2 && right) {
      mp3buf = encoder.encodeBuffer(left, right);
    } else {
      mp3buf = encoder.encodeBuffer(left);
    }

    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }
  }

  const lastBuf: any = encoder.flush();
  if (lastBuf.length > 0) {
    mp3Data.push(lastBuf);
  }

  audioContext.close();

  onProgress?.({ phase: 'done', percent: 100 });

  const mp3Blob = new Blob(mp3Data as unknown as BlobPart[], { type: 'audio/mp3' });
  const compressedName = file.name.replace(/\.[^.]+$/, '') + '.mp3';
  return new File([mp3Blob], compressedName, { type: 'audio/mp3' });
};
