/**
 * Audio recording utilities using MediaRecorder API
 * Handles microphone input, audio visualization, and recording management
 */

export interface AudioRecorderOptions {
  mimeType?: string;
  audioBitsPerSecond?: number;
  onDataAvailable?: (blob: Blob) => void;
  onAudioLevel?: (level: number) => void;
}

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private startTime: number = 0;
  private pausedDuration: number = 0;
  private pausedAt: number = 0;
  private animationFrameId: number | null = null;

  /**
   * Request microphone permission and initialize audio recording
   */
  async initialize(): Promise<void> {
    try {
      // Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Create audio context for visualization
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;

      // Connect microphone to analyser
      this.microphone = this.audioContext.createMediaStreamSource(this.stream);
      this.microphone.connect(this.analyser);
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          throw new Error(
            'Microphone access denied. Please allow microphone access in your browser settings.'
          );
        } else if (error.name === 'NotFoundError') {
          throw new Error('No microphone found. Please connect a microphone and try again.');
        }
      }
      throw new Error('Failed to initialize audio recorder');
    }
  }

  /**
   * Start recording audio
   */
  start(options: AudioRecorderOptions = {}): void {
    if (!this.stream) {
      throw new Error('Audio recorder not initialized. Call initialize() first.');
    }

    this.chunks = [];
    this.startTime = Date.now();
    this.pausedDuration = 0;

    // Determine MIME type
    const mimeType =
      options.mimeType || this.getSupportedMimeType();

    // Create MediaRecorder
    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType,
      audioBitsPerSecond: options.audioBitsPerSecond || 128000,
    });

    // Handle data available
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
        if (options.onDataAvailable) {
          options.onDataAvailable(event.data);
        }
      }
    };

    // Start recording
    this.mediaRecorder.start(1000); // Collect data every second

    // Start audio level monitoring
    if (options.onAudioLevel) {
      this.startAudioLevelMonitoring(options.onAudioLevel);
    }
  }

  /**
   * Pause recording
   */
  pause(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      this.pausedAt = Date.now();
      this.stopAudioLevelMonitoring();
    }
  }

  /**
   * Resume recording
   */
  resume(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      this.pausedDuration += Date.now() - this.pausedAt;
      this.pausedAt = 0;

      // Restart audio level monitoring if there's a callback
      // (callback would need to be stored as instance variable)
    }
  }

  /**
   * Stop recording and return the audio blob
   */
  async stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No active recording'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, {
          type: this.mediaRecorder?.mimeType || 'audio/webm',
        });
        this.chunks = [];
        resolve(blob);
      };

      this.mediaRecorder.stop();
      this.stopAudioLevelMonitoring();
    });
  }

  /**
   * Get current recording duration in seconds
   */
  getDuration(): number {
    if (this.startTime === 0) return 0;

    const now = Date.now();
    const elapsed = now - this.startTime - this.pausedDuration;

    // If currently paused, don't count time since pause
    if (this.pausedAt > 0) {
      return (this.pausedAt - this.startTime - this.pausedDuration) / 1000;
    }

    return elapsed / 1000;
  }

  /**
   * Get current audio level (0-100)
   */
  getAudioLevel(): number {
    if (!this.analyser) return 0;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);

    // Calculate average volume
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
    }
    const average = sum / bufferLength;

    // Normalize to 0-100 scale
    return Math.min(100, (average / 255) * 200); // Amplify for better visual feedback
  }

  /**
   * Get frequency data for visualization
   */
  getFrequencyData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(0);

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);

    return dataArray;
  }

  /**
   * Get time domain data for waveform visualization
   */
  getTimeDomainData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(0);

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteTimeDomainData(dataArray);

    return dataArray;
  }

  /**
   * Start monitoring audio level
   */
  private startAudioLevelMonitoring(callback: (level: number) => void): void {
    const monitor = () => {
      const level = this.getAudioLevel();
      callback(level);
      this.animationFrameId = requestAnimationFrame(monitor);
    };
    monitor();
  }

  /**
   * Stop monitoring audio level
   */
  private stopAudioLevelMonitoring(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Get supported MIME type
   */
  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mp4',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return ''; // Let browser choose
  }

  /**
   * Check if recording is active
   */
  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  /**
   * Check if recording is paused
   */
  isPaused(): boolean {
    return this.mediaRecorder?.state === 'paused';
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.stopAudioLevelMonitoring();

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
    }

    if (this.microphone) {
      this.microphone.disconnect();
    }

    if (this.audioContext) {
      this.audioContext.close();
    }

    this.mediaRecorder = null;
    this.audioContext = null;
    this.analyser = null;
    this.microphone = null;
    this.stream = null;
    this.chunks = [];
  }
}

/**
 * Check if browser supports audio recording
 */
export function isAudioRecordingSupported(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  return !!(
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof window.MediaRecorder === 'function'
  );
}

/**
 * Format duration in MM:SS format
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format duration in human-readable format (e.g., "1h 23m")
 */
export function formatDurationLong(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

/**
 * Convert audio blob to base64 (useful for storage or transmission)
 */
export async function audioBlobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Convert base64 to audio blob
 */
export async function base64ToAudioBlob(base64: string): Promise<Blob> {
  const response = await fetch(base64);
  return await response.blob();
}
