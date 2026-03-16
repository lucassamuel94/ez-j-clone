import { formatTimeAgo } from '@/utils/priorityCalculator';
import { formatDateBR, formatTimeBR } from '@/utils/dateFormat';
import { LeadNote } from '@/types/lead';

interface NoteDisplayProps {
  note: LeadNote;
}

// Parse note format: "[Status/Action] (User Name) observation text"
const parseNote = (noteText: string) => {
  // Match pattern: [Status info] (optional: (User Name)) observation
  const statusMatch = noteText.match(/^\[([^\]]+)\]/);
  const userMatch = noteText.match(/\]\s*\(([^)]+)\)\s*/);
  
  let status = '';
  let observation = noteText;
  let userName = '';
  
  if (statusMatch) {
    status = statusMatch[1];
    observation = noteText.replace(statusMatch[0], '').trim();
  }
  
  if (userMatch) {
    userName = userMatch[1];
    observation = observation.replace(`(${userName})`, '').trim();
  }
  
  return { status, observation, userName };
};

export const NoteDisplay = ({ note }: NoteDisplayProps) => {
  const { status, observation, userName } = parseNote(note.note);
  const noteDate = new Date(note.created_at);
  
  // Format date and time
  const formattedDate = formatDateBR(noteDate, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const formattedTime = formatTimeBR(noteDate);

  return (
    <div className="p-3 bg-accent/30 rounded-lg text-xs border-l-2 border-primary space-y-1">
      {/* Status, data e hora */}
      <p className="font-medium text-foreground text-xs">
        {status || 'Nota'}, {formattedDate}, {formattedTime}
      </p>
      
      {/* Observação */}
      {observation && (
        <p className="text-foreground text-xs whitespace-pre-wrap">
          <span className="text-muted-foreground">Observação: </span>
          {observation}
        </p>
      )}
      
      {/* Usuário que registrou */}
      {userName && (
        <p className="text-xs text-muted-foreground">
          Registrado por: {userName}
        </p>
      )}
      
      {/* Fallback: show time ago if no user name */}
      {!userName && (
        <p className="text-xs text-muted-foreground">
          {formatTimeAgo(noteDate)}
        </p>
      )}
    </div>
  );
};
