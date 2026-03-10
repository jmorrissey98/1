import React, { useState, useRef, useCallback } from 'react';
import { Mic, MicOff, Loader2, Square } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

/**
 * Speech-to-Text Button Component
 * 
 * A reusable microphone button that records audio and transcribes it using OpenAI Whisper.
 * The transcribed text is passed to the onTranscribe callback.
 * 
 * @param {function} onTranscribe - Callback function receiving the transcribed text
 * @param {string} className - Additional CSS classes
 * @param {boolean} disabled - Whether the button is disabled
 * @param {string} size - Button size: 'sm', 'default', 'lg', 'icon'
 */
export function SpeechToTextButton({ 
  onTranscribe, 
  className = '', 
  disabled = false,
  size = 'icon'
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

  const startRecording = useCallback(async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });
      
      streamRef.current = stream;
      audioChunksRef.current = [];
      
      // Create MediaRecorder with webm format (widely supported)
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        
        // Create blob from chunks
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Only transcribe if we have audio
        if (audioBlob.size > 0) {
          await transcribeAudio(audioBlob);
        }
      };
      
      // Start recording
      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      if (error.name === 'NotAllowedError') {
        toast.error('Microphone access denied. Please allow microphone access in your browser settings.');
      } else if (error.name === 'NotFoundError') {
        toast.error('No microphone found. Please connect a microphone and try again.');
      } else {
        toast.error('Failed to start recording. Please try again.');
      }
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const transcribeAudio = async (audioBlob) => {
    setIsTranscribing(true);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Please log in to use speech-to-text');
        return;
      }
      
      // Create form data with audio file
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      
      const response = await fetch(`${API_URL}/api/speech-to-text`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Transcription failed' }));
        throw new Error(error.detail || 'Transcription failed');
      }
      
      const result = await response.json();
      
      if (result.success && result.text) {
        // Call the callback with transcribed text
        onTranscribe(result.text);
        toast.success('Transcription complete');
      } else {
        toast.warning('No speech detected. Please try again.');
      }
      
    } catch (error) {
      console.error('Transcription error:', error);
      toast.error(error.message || 'Failed to transcribe audio');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Determine button state and appearance
  const getButtonVariant = () => {
    if (isRecording) return 'destructive';
    if (isTranscribing) return 'secondary';
    return 'outline';
  };

  const getIcon = () => {
    if (isTranscribing) {
      return <Loader2 className="h-4 w-4 animate-spin" />;
    }
    if (isRecording) {
      return <Square className="h-4 w-4" />;
    }
    return <Mic className="h-4 w-4" />;
  };

  const getTooltip = () => {
    if (isTranscribing) return 'Transcribing...';
    if (isRecording) return 'Stop recording';
    return 'Start voice input';
  };

  return (
    <Button
      type="button"
      variant={getButtonVariant()}
      size={size}
      onClick={handleClick}
      disabled={disabled || isTranscribing}
      className={`${className} ${isRecording ? 'animate-pulse' : ''}`}
      title={getTooltip()}
      data-testid="speech-to-text-btn"
    >
      {getIcon()}
    </Button>
  );
}

export default SpeechToTextButton;
