import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { FieldConfig } from '@/components/admin/FormFieldBuilder';

export interface Form {
  id: string;
  name: string;
  description: string | null;
  fields: string[];
  fields_schema: FieldConfig[] | null;
  title: string;
  subtitle: string;
  button_text: string;
  success_message: string;
  source: string;
  primary_color: string;
  redirect_url: string | null;
  show_recaptcha: boolean;
  webhook_urls: string[];
  widget_type: 'form' | 'whatsapp_widget';
  whatsapp_number: string | null;
  whatsapp_message_template: string | null;
  post_action: string;
  assigned_closer_id: string | null;
  assigned_sdr_ids: string[] | null;
  active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface FormSubmission {
  id: string;
  form_id: string;
  data: Record<string, string>;
  source: string | null;
  ip_address: string | null;
  user_agent: string | null;
  lead_id: string | null;
  created_at: string;
}

export const useForms = () => {
  const queryClient = useQueryClient();

  const { data: forms = [], isLoading } = useQuery({
    queryKey: ['forms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forms')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as any[]).map(d => ({
        ...d,
        fields_schema: d.fields_schema ?? null,
      })) as Form[];
    },
  });

  const createForm = useMutation({
    mutationFn: async (form: Partial<Form> & { name: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');
      const { fields_schema, ...rest } = form as any;
      const insertPayload: any = { ...rest, created_by: user.id };
      if (fields_schema) insertPayload.fields_schema = fields_schema;
      const { data, error } = await supabase
        .from('forms')
        .insert(insertPayload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      toast.success('Formulário criado!');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateForm = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Form> & { id: string }) => {
      const { error } = await supabase.from('forms').update(updates as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      toast.success('Formulário atualizado!');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteForm = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('forms').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      toast.success('Formulário excluído!');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { forms, isLoading, createForm, updateForm, deleteForm };
};

export const useFormSubmissions = (formId: string | null) => {
  const queryClient = useQueryClient();

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ['form-submissions', formId],
    queryFn: async () => {
      if (!formId) return [];
      const { data, error } = await supabase
        .from('form_submissions')
        .select('*')
        .eq('form_id', formId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as FormSubmission[];
    },
    enabled: !!formId,
  });

  const deleteSubmissions = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('form_submissions')
        .delete()
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-submissions', formId] });
      toast.success('Respostas excluídas!');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { submissions, isLoading, deleteSubmissions };
};
