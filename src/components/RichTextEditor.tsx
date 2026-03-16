import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Undo,
  Redo,
  Link as LinkIcon,
  RemoveFormatting,
  Sparkles,
  Loader2,
  Wand2,
  Minimize2,
  Maximize2,
  BriefcaseBusiness,
  SmilePlus,
  Target,
  Mic,
  MicOff,
} from 'lucide-react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  editorRef?: React.MutableRefObject<any>;
}

function ToolbarButton({
  onClick,
  active,
  children,
  title,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          title={title}
          className={cn(
            'inline-flex items-center justify-center h-8 w-8 rounded-md text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
            active && 'bg-accent text-accent-foreground'
          )}
          onMouseDown={(e) => {
            e.preventDefault();
            onClick();
          }}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {title}
      </TooltipContent>
    </Tooltip>
  );
}

const AI_ACTIONS = [
  { key: 'improve', label: 'Melhorar texto', icon: Wand2 },
  { key: 'shorten', label: 'Encurtar texto', icon: Minimize2 },
  { key: 'lengthen', label: 'Alongar texto', icon: Maximize2 },
  { key: 'formal', label: 'Tom mais formal', icon: BriefcaseBusiness },
  { key: 'friendly', label: 'Tom mais amigável', icon: SmilePlus },
  { key: 'persuasive', label: 'Mais persuasivo', icon: Target },
] as const;

export const RichTextEditor = ({
  content,
  onChange,
  placeholder = 'Escreva sua mensagem...',
  className,
  editorRef: externalEditorRef,
}: RichTextEditorProps) => {
  const [isAILoading, setIsAILoading] = useState(false);
  const editorRef = useRef<any>(null);

  const handleSpeechResult = useCallback((text: string) => {
    if (editorRef.current) {
      editorRef.current.chain().focus().insertContent(text + ' ').run();
    }
  }, []);

  const { isRecording, isSupported: isSpeechSupported, toggle: toggleRecording } = useSpeechRecognition({
    onResult: handleSpeechResult,
  });

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          'focus:outline-none min-h-[250px] px-4 py-3 text-foreground tiptap-editor',
      },
    },
  });

  useEffect(() => {
    editorRef.current = editor;
    if (externalEditorRef) {
      externalEditorRef.current = editor;
    }
  }, [editor, externalEditorRef]);

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content]);

  if (!editor) return null;

  const addLink = () => {
    const url = window.prompt('URL do link:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const handleAIAction = async (action: string) => {
    const { from, to } = editor.state.selection;
    const hasSelection = from !== to;
    const text = hasSelection
      ? editor.state.doc.textBetween(from, to, ' ')
      : editor.getText();

    if (!text.trim()) {
      toast.error('Escreva algum texto antes de usar a IA.');
      return;
    }

    setIsAILoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-text-improve', {
        body: { text, action },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const improvedText = data.improved_text;

      if (hasSelection) {
        editor.chain().focus().deleteRange({ from, to }).insertContentAt(from, improvedText).run();
      } else {
        editor.commands.setContent(improvedText);
      }

      toast.success('Texto melhorado com IA!');
    } catch (e: any) {
      console.error('AI improve error:', e);
      toast.error(e.message || 'Erro ao processar com IA. Tente novamente.');
    } finally {
      setIsAILoading(false);
    }
  };

  return (
    <div className={cn('rounded-md border border-input bg-background', className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-1 py-1">
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          title="Desfazer"
        >
          <Undo className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          title="Refazer"
        >
          <Redo className="h-4 w-4" />
        </ToolbarButton>

        <div className="mx-1 h-6 w-px bg-border" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Negrito"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Itálico"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
          title="Sublinhado"
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          title="Tachado"
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>

        <div className="mx-1 h-6 w-px bg-border" />

        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          active={editor.isActive({ textAlign: 'left' })}
          title="Alinhar à esquerda"
        >
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          active={editor.isActive({ textAlign: 'center' })}
          title="Centralizar"
        >
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          active={editor.isActive({ textAlign: 'right' })}
          title="Alinhar à direita"
        >
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>

        <div className="mx-1 h-6 w-px bg-border" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Lista com marcadores"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Lista numerada"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <div className="mx-1 h-6 w-px bg-border" />

        <ToolbarButton onClick={addLink} active={editor.isActive('link')} title="Link">
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
          title="Limpar formatação"
        >
          <RemoveFormatting className="h-4 w-4" />
        </ToolbarButton>

        {/* Mic button */}
        {isSpeechSupported && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                title={isRecording ? 'Parar gravação' : 'Gravar áudio (transcrição)'}
                className={cn(
                  'inline-flex items-center justify-center h-8 w-8 rounded-md text-sm transition-colors',
                  isRecording
                    ? 'bg-destructive text-destructive-foreground animate-pulse'
                    : 'hover:bg-accent hover:text-accent-foreground'
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  toggleRecording();
                }}
              >
                {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {isRecording ? 'Parar gravação' : 'Gravar áudio'}
            </TooltipContent>
          </Tooltip>
        )}

        <div className="mx-1 h-6 w-px bg-border" />

        {/* AI Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={isAILoading}
              className={cn(
                'inline-flex items-center justify-center h-8 gap-1 rounded-md px-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground text-primary',
                isAILoading && 'opacity-70 cursor-not-allowed'
              )}
            >
              {isAILoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              <span className="text-xs hidden sm:inline">IA</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            {AI_ACTIONS.map(({ key, label, icon: Icon }) => (
              <DropdownMenuItem
                key={key}
                onClick={() => handleAIAction(key)}
                disabled={isAILoading}
              >
                <Icon className="h-4 w-4 mr-2" />
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  );
};
