import React, { useRef, useEffect, useState } from 'react';
import { Phone, PhoneOff, Minimize2, Mic, MicOff, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useWebPhone } from '@/contexts/WebPhoneContext';
import { useCallHistory, useStartCall, useEndCall } from '@/hooks/useCallHistory';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const WebPhoneWidget = () => {
  const {
    dialedNumber,
    isExpanded,
    currentLead,
    setDialedNumber,
    setIsExpanded,
    clearNumber,
  } = useWebPhone();

  const { data: callHistory } = useCallHistory();
  const startCallMutation = useStartCall();
  const endCallMutation = useEndCall();

  const [isInCall, setIsInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [ramalStatus] = useState<'online' | 'offline' | 'busy'>('online');
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [callStartTime, setCallStartTime] = useState<Date | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  
  // Drag state
  const [position, setPosition] = useState({ x: 24, y: 24 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  // Timer for call duration
  // Timer for call duration
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isInCall && callStartTime) {
      interval = setInterval(() => {
        const seconds = Math.floor((Date.now() - callStartTime.getTime()) / 1000);
        setCallDuration(seconds);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isInCall, callStartTime]);

  // Keyboard shortcuts for dialer
  useEffect(() => {
    if (!isExpanded || isInCall) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        handleBackspace();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded, isInCall, dialedNumber]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDial = (digit: string) => {
    setDialedNumber(dialedNumber + digit);
  };

  const handleBackspace = () => {
    setDialedNumber(dialedNumber.slice(0, -1));
  };

  const handleCall = async () => {
    if (dialedNumber.trim()) {
      setIsInCall(true);
      setCallStartTime(new Date());
      setCallDuration(0);
      
      try {
        const result = await startCallMutation.mutateAsync({
          phone_number: dialedNumber,
          lead_id: currentLead?.id,
          lead_name: currentLead?.name,
          lead_company: currentLead?.company,
          direction: 'outbound',
        });
        setCurrentCallId(result.id);
      } catch (error) {
        console.error('Erro ao registrar chamada:', error);
      }
    }
  };

  const handleHangup = async () => {
    if (currentCallId) {
      try {
        await endCallMutation.mutateAsync({
          call_id: currentCallId,
          status: 'completed',
          duration_seconds: callDuration,
        });
      } catch (error) {
        console.error('Erro ao finalizar chamada:', error);
      }
    }
    
    setIsInCall(false);
    setCurrentCallId(null);
    setCallStartTime(null);
    setCallDuration(0);
    clearNumber();
    setIsMuted(false);
  };

  const handleClickHistoryItem = (phoneNumber: string, leadName?: string | null, leadCompany?: string | null, leadId?: string | null) => {
    setDialedNumber(phoneNumber);
  };

  const statusColors = {
    online: 'bg-success',
    offline: 'bg-muted-foreground',
    busy: 'bg-warning',
  };

  const statusLabels = {
    online: 'Online',
    offline: 'Offline',
    busy: 'Em chamada',
  };

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsDragging(true);
    dragStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      posX: position.x,
      posY: position.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const deltaX = dragStartRef.current.x - e.clientX;
      const deltaY = dragStartRef.current.y - e.clientY;
      
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - 100, dragStartRef.current.posX + deltaX)),
        y: Math.max(0, Math.min(window.innerHeight - 100, dragStartRef.current.posY + deltaY)),
      });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      
      const touch = e.touches[0];
      const deltaX = dragStartRef.current.x - touch.clientX;
      const deltaY = dragStartRef.current.y - touch.clientY;
      
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - 100, dragStartRef.current.posX + deltaX)),
        y: Math.max(0, Math.min(window.innerHeight - 100, dragStartRef.current.posY + deltaY)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging]);

  if (!isExpanded) {
    return (
      <div
        ref={dragRef}
        style={{ right: position.x, bottom: position.y }}
        className="fixed z-40"
      >
        <button
          onClick={() => setIsExpanded(true)}
          className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-110 transition-all flex items-center justify-center"
          title="Abrir webphone"
        >
          <Phone className="h-6 w-6" />
        </button>
      </div>
    );
  }

  return (
    <Card 
      ref={dragRef}
      style={{ right: position.x, bottom: position.y }}
      className="fixed w-80 shadow-xl z-40 bg-card"
    >
      {/* Header with drag handle */}
      <div className="bg-primary text-primary-foreground p-4 rounded-t-lg flex items-center justify-between">
        <div 
          className="flex items-center gap-2 cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          <GripVertical className="h-4 w-4 opacity-60" />
          <div className={`h-3 w-3 rounded-full ${statusColors[ramalStatus]}`} />
          <div>
            <p className="text-sm font-medium">Ramal 101</p>
            <p className="text-xs opacity-80">{statusLabels[ramalStatus]}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-primary-foreground hover:bg-secondary/20"
          onClick={() => setIsExpanded(false)}
        >
          <Minimize2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Display */}
      <div className="p-4 border-b bg-muted/50">
        {isInCall ? (
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Em chamada com</p>
            {currentLead ? (
              <>
                <p className="text-lg font-bold text-foreground">{currentLead.name}</p>
                <p className="text-sm text-muted-foreground">{currentLead.company}</p>
              </>
            ) : (
              <p className="text-2xl font-bold text-foreground">{dialedNumber}</p>
            )}
            <p className="text-sm font-mono text-primary mt-2">{formatDuration(callDuration)}</p>
          </div>
        ) : (
          <div className="text-center">
            {currentLead && (
              <div className="mb-2">
                <p className="text-sm font-medium text-foreground">{currentLead.name}</p>
                <p className="text-xs text-muted-foreground">{currentLead.company}</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground mb-1">Número</p>
            <p className="text-3xl font-mono font-bold text-foreground min-h-10">
              {dialedNumber || '—'}
            </p>
          </div>
        )}
      </div>

      {/* Keypad */}
      {!isInCall && (
        <div className="p-4 border-b bg-background">
          <div className="grid grid-cols-3 gap-2 mb-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, '*', 0, '#'].map((digit) => (
              <Button
                key={digit}
                variant="outline"
                className="h-12 text-lg font-semibold hover:bg-secondary/10"
                onClick={() => handleDial(digit.toString())}
              >
                {digit}
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            className="w-full text-sm"
            onClick={handleBackspace}
            disabled={!dialedNumber}
          >
            ← Apagar
          </Button>
        </div>
      )}

      {/* Call Controls */}
      <div className="p-4 flex gap-2">
        {isInCall ? (
          <>
            <Button
              variant={isMuted ? 'secondary' : 'outline'}
              size="icon"
              className="flex-1 h-10"
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Button
              variant="destructive"
              className="flex-1 h-10"
              onClick={handleHangup}
            >
              <PhoneOff className="h-4 w-4 mr-2" />
              Desligar
            </Button>
          </>
        ) : (
          <Button
            className="w-full bg-chart-3 hover:bg-chart-3/90 text-primary-foreground h-10"
            onClick={handleCall}
            disabled={!dialedNumber.trim()}
          >
            <Phone className="h-4 w-4 mr-2" />
            Ligar
          </Button>
        )}
      </div>

      {/* Recent Calls from DB */}
      {!isInCall && (
        <div className="p-4 border-t bg-muted/20">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Chamadas Recentes</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {callHistory && callHistory.length > 0 ? (
              callHistory.slice(0, 5).map((call) => (
                <div 
                  key={call.id}
                  className="flex justify-between items-center text-sm p-2 rounded hover:bg-muted cursor-pointer"
                  onClick={() => handleClickHistoryItem(call.phone_number, call.lead_name, call.lead_company, call.lead_id)}
                >
                  <div>
                    <p className="font-medium text-foreground">
                      {call.lead_name || call.phone_number}
                    </p>
                    {call.lead_name && (
                      <p className="text-xs text-muted-foreground">{call.phone_number}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(call.started_at), { addSuffix: true, locale: ptBR })}
                    </p>
                    {call.duration_seconds > 0 && (
                      <p className="text-xs text-muted-foreground">{formatDuration(call.duration_seconds)}</p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground text-center py-2">
                Nenhuma chamada recente
              </p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
};
