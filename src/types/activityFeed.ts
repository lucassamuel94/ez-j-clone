import type { UseMutationResult } from '@tanstack/react-query';

export interface ActivityItem {
  id: string;
  source?: 'note' | 'log';
  action_type: string;
  description: string;
  user_name: string;
  user_id: string | null;
  user_avatar_url?: string | null;
  created_at: string;
  updated_at?: string | null;
  parent_id?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  field_name?: string | null;
  attachments?: Array<{ name: string; path: string; size: number; type: string }>;
  task_id?: string | null;
  _replies?: ActivityItem[];
}

export interface FilterOption {
  value: string;
  label: string;
  icon: React.ReactNode;
  activeClass?: string;
  hoverClass?: string;
}

export interface ActivityFeedConfig {
  /** Action type → icon mapping */
  actionIcons: Record<string, React.ReactNode>;
  /** Action type → color classes mapping */
  actionColors: Record<string, string>;
  /** Action type → human label mapping */
  actionLabels: Record<string, string>;
  /** Filter tab options */
  filterOptions: FilterOption[];
  /** Filter value → allowed action_types mapping. Empty array = show all */
  filterActionMap: Record<string, string[]>;
  /** Set of system (auto-generated) action types */
  systemActionTypes: Set<string>;
  /** Storage bucket name for attachments */
  storageBucket: 'lead-attachments' | 'project-attachments';
  /** Whether replies are supported */
  supportsReplies: boolean;
  /** If true, Enter sends (Shift+Enter = newline). If false, Shift+Enter / Ctrl+Enter sends */
  sendOnEnter: boolean;
  /** Storage path builder */
  buildStoragePath: (entityId: string, fileName: string, userId: string) => string;
}

export interface ActivityFeedAdapter {
  /** All items (already sorted chronologically ascending) */
  items: ActivityItem[];
  isLoading: boolean;
  /** Create a comment/observation */
  createComment: (text: string, attachments?: Array<{ name: string; path: string; size: number; type: string }>) => void;
  isCreating: boolean;
  /** Update a comment */
  updateComment: (id: string, text: string) => void;
  isUpdating: boolean;
  /** Delete a comment */
  deleteComment: (id: string) => void;
  isDeleting: boolean;
  /** Reply to a comment (optional, only for projects) */
  replyToComment?: (parentId: string, text: string) => void;
  isReplying?: boolean;
  /** File upload handler (attaches file and creates activity) */
  handleFileUpload: (files: FileList, entityId: string) => Promise<void>;
  /** Task map for inline task rendering */
  taskMap: Map<string, any>;
  /** Callbacks for task actions */
  onToggleTask?: (task: any) => void;
  onEditTask?: (task: any) => void;
}

export interface ActivityFeedCallbacks {
  onTaskCreated?: (data: { taskId: string; title: string; assignedUserName?: string; dueDate?: string }) => void;
  onEmailSent?: (details: { to: string; subject: string; body?: string } | null) => void;
  onCalendarCreated?: (details: { title: string; date: string; startTime: string; endTime: string; attendee?: string; meetLink?: string } | null) => void;
}
