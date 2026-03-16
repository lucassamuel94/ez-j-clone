import { useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';

interface UseSpeechRecognitionOptions {
  onResult: (text: string) => void;
  lang?: string;
}

export function useSpeechRecognition({ onResult, lang = 'pt-BR' }: UseSpeechRecognitionOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const start = useCallback(async () => {
    if (!isSupported) {
      toast.error('Seu navegador não suporta reconhecimento de voz. Use Chrome ou Edge.');
      return;
    }

    // Request microphone permission explicitly before starting recognition
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the stream immediately — we only needed to trigger the permission prompt
      stream.getTracks().forEach(track => track.stop());
    } catch (permErr) {
      console.error('Microphone permission error:', permErr);
      if (permErr instanceof DOMException) {
        if (permErr.name === 'NotAllowedError' || permErr.name === 'PermissionDeniedError') {
          toast.error('Permissão de microfone negada. Habilite nas configurações do navegador.');
        } else if (permErr.name === 'NotFoundError') {
          toast.error('Nenhum microfone encontrado. Conecte um microfone e tente novamente.');
        } else {
          toast.error(`Erro ao acessar microfone: ${permErr.message}`);
        }
      } else {
        toast.error('Erro ao acessar microfone. Verifique as permissões do navegador.');
      }
      return;
    }

    try {
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognitionAPI();
      recognition.lang = lang;
      recognition.continuous = true;
      recognition.interimResults = false;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            transcript += event.results[i][0].transcript;
          }
        }
        if (transcript.trim()) {
          onResult(transcript.trim());
        }
      };

      let retried = false;
      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          toast.error('Permissão de microfone negada. Habilite nas configurações do navegador.');
        } else if (event.error === 'no-speech') {
          toast.info('Nenhuma fala detectada. Tente novamente.');
          return; // don't reset — let it keep listening
        } else if (event.error === 'audio-capture') {
          toast.error('Nenhum microfone encontrado. Conecte um microfone e tente novamente.');
        } else if (event.error === 'network') {
          if (!retried) {
            retried = true;
            console.warn('Speech recognition network error — retrying...');
            try {
              recognition.stop();
            } catch (_) { /* ignore */ }
            setTimeout(() => {
              try {
                recognition.start();
                toast.info('Reconectando reconhecimento de voz...');
              } catch (retryErr) {
                console.error('Retry failed:', retryErr);
                toast.error('Reconhecimento de voz indisponível. Abra esta página diretamente no Chrome (não em iframe/preview).');
                setIsRecording(false);
                recognitionRef.current = null;
              }
            }, 500);
            return;
          }
          toast.error('Reconhecimento de voz indisponível neste ambiente. Abra a página publicada diretamente no Chrome para usar esta funcionalidade.');
        } else if (event.error === 'aborted') {
          // User or system aborted — silent
          return;
        } else {
          toast.error(`Erro no reconhecimento de voz (${event.error}). Tente novamente.`);
        }
        setIsRecording(false);
        recognitionRef.current = null;
      };

      recognition.onend = () => {
        setIsRecording(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
      toast.info('Gravando... Fale agora. Clique novamente para parar.');
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      toast.error('Não foi possível iniciar o reconhecimento de voz. Tente usar o Google Chrome.');
      setIsRecording(false);
    }
  }, [isSupported, lang, onResult]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const toggle = useCallback(() => {
    if (isRecording) {
      stop();
    } else {
      start();
    }
  }, [isRecording, start, stop]);

  return { isRecording, isSupported, toggle };
}
