export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      account_activity_logs: {
        Row: {
          account_id: string
          action_type: string
          created_at: string
          description: string
          entity_id: string | null
          entity_type: string | null
          field_name: string | null
          id: string
          metadata: Json | null
          new_value: string | null
          old_value: string | null
          user_id: string | null
        }
        Insert: {
          account_id: string
          action_type: string
          created_at?: string
          description: string
          entity_id?: string | null
          entity_type?: string | null
          field_name?: string | null
          id?: string
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
          user_id?: string | null
        }
        Update: {
          account_id?: string
          action_type?: string
          created_at?: string
          description?: string
          entity_id?: string | null
          entity_type?: string | null
          field_name?: string | null
          id?: string
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_activity_logs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      account_contacts: {
        Row: {
          account_id: string
          created_at: string
          email: string | null
          id: string
          is_primary: boolean
          name: string
          phone: string | null
          phone_2: string | null
          role: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          phone?: string | null
          phone_2?: string | null
          role?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          phone?: string | null
          phone_2?: string | null
          role?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_contacts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      account_notes: {
        Row: {
          account_id: string
          attachments: Json | null
          created_at: string
          id: string
          note: string
          user_id: string | null
        }
        Insert: {
          account_id: string
          attachments?: Json | null
          created_at?: string
          id?: string
          note: string
          user_id?: string | null
        }
        Update: {
          account_id?: string
          attachments?: Json | null
          created_at?: string
          id?: string
          note?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_notes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          account_owner_id: string | null
          ai_enrichment_data: Json | null
          bairro: string | null
          capital_social: number | null
          cep: string | null
          city: string | null
          cnae_fiscal: number | null
          cnae_fiscal_descricao: string | null
          cnaes_secundarios: string | null
          cnpj: string | null
          company_name: string
          company_segment: string | null
          complemento: string | null
          contact_name: string | null
          country: string | null
          created_at: string
          data_inicio_atividade: string | null
          deleted_at: string | null
          email: string | null
          employee_count: string | null
          id: string
          lifecycle_stage: string
          logradouro: string | null
          nome_fantasia: string | null
          notes: string | null
          numero: string | null
          phone: string | null
          porte: string | null
          qsa: string | null
          razao_social: string | null
          revenue_range: string | null
          situacao_cadastral: string | null
          state: string | null
          status: string
          updated_at: string
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          account_owner_id?: string | null
          ai_enrichment_data?: Json | null
          bairro?: string | null
          capital_social?: number | null
          cep?: string | null
          city?: string | null
          cnae_fiscal?: number | null
          cnae_fiscal_descricao?: string | null
          cnaes_secundarios?: string | null
          cnpj?: string | null
          company_name: string
          company_segment?: string | null
          complemento?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          data_inicio_atividade?: string | null
          deleted_at?: string | null
          email?: string | null
          employee_count?: string | null
          id?: string
          lifecycle_stage?: string
          logradouro?: string | null
          nome_fantasia?: string | null
          notes?: string | null
          numero?: string | null
          phone?: string | null
          porte?: string | null
          qsa?: string | null
          razao_social?: string | null
          revenue_range?: string | null
          situacao_cadastral?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          account_owner_id?: string | null
          ai_enrichment_data?: Json | null
          bairro?: string | null
          capital_social?: number | null
          cep?: string | null
          city?: string | null
          cnae_fiscal?: number | null
          cnae_fiscal_descricao?: string | null
          cnaes_secundarios?: string | null
          cnpj?: string | null
          company_name?: string
          company_segment?: string | null
          complemento?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          data_inicio_atividade?: string | null
          deleted_at?: string | null
          email?: string | null
          employee_count?: string | null
          id?: string
          lifecycle_stage?: string
          logradouro?: string | null
          nome_fantasia?: string | null
          notes?: string | null
          numero?: string | null
          phone?: string | null
          porte?: string | null
          qsa?: string | null
          razao_social?: string | null
          revenue_range?: string | null
          situacao_cadastral?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      active_clients: {
        Row: {
          account_owner_id: string | null
          ai_enrichment_data: Json | null
          capital_social: number | null
          cep: string | null
          city: string | null
          cnae_fiscal: number | null
          cnae_fiscal_descricao: string | null
          cnaes_secundarios: string | null
          cnpj: string | null
          company: string
          contact_name: string | null
          created_at: string
          data_inicio_atividade: string | null
          email: string | null
          employee_count: string | null
          enriched_at: string | null
          id: string
          imported_by: string | null
          nome_fantasia: string | null
          notes: string | null
          phone: string | null
          porte: string | null
          razao_social: string | null
          revenue_range: string | null
          segment: string | null
          situacao_cadastral: string | null
          state: string | null
          status: string
          website: string | null
        }
        Insert: {
          account_owner_id?: string | null
          ai_enrichment_data?: Json | null
          capital_social?: number | null
          cep?: string | null
          city?: string | null
          cnae_fiscal?: number | null
          cnae_fiscal_descricao?: string | null
          cnaes_secundarios?: string | null
          cnpj?: string | null
          company: string
          contact_name?: string | null
          created_at?: string
          data_inicio_atividade?: string | null
          email?: string | null
          employee_count?: string | null
          enriched_at?: string | null
          id?: string
          imported_by?: string | null
          nome_fantasia?: string | null
          notes?: string | null
          phone?: string | null
          porte?: string | null
          razao_social?: string | null
          revenue_range?: string | null
          segment?: string | null
          situacao_cadastral?: string | null
          state?: string | null
          status?: string
          website?: string | null
        }
        Update: {
          account_owner_id?: string | null
          ai_enrichment_data?: Json | null
          capital_social?: number | null
          cep?: string | null
          city?: string | null
          cnae_fiscal?: number | null
          cnae_fiscal_descricao?: string | null
          cnaes_secundarios?: string | null
          cnpj?: string | null
          company?: string
          contact_name?: string | null
          created_at?: string
          data_inicio_atividade?: string | null
          email?: string | null
          employee_count?: string | null
          enriched_at?: string | null
          id?: string
          imported_by?: string | null
          nome_fantasia?: string | null
          notes?: string | null
          phone?: string | null
          porte?: string | null
          razao_social?: string | null
          revenue_range?: string | null
          segment?: string | null
          situacao_cadastral?: string | null
          state?: string | null
          status?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "active_clients_account_owner_id_fkey"
            columns: ["account_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_prompts: {
        Row: {
          description: string | null
          id: string
          label: string
          model: string
          system_prompt: string
          updated_at: string
          updated_by: string | null
          user_prompt_template: string
        }
        Insert: {
          description?: string | null
          id: string
          label: string
          model?: string
          system_prompt?: string
          updated_at?: string
          updated_by?: string | null
          user_prompt_template?: string
        }
        Update: {
          description?: string | null
          id?: string
          label?: string
          model?: string
          system_prompt?: string
          updated_at?: string
          updated_by?: string | null
          user_prompt_template?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_prompts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_logs: {
        Row: {
          created_at: string
          estimated_cost_usd: number
          id: string
          lead_id: string | null
          model: string
          prompt_id: string
          tokens_input: number
          tokens_output: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          estimated_cost_usd?: number
          id?: string
          lead_id?: string | null
          model: string
          prompt_id: string
          tokens_input?: number
          tokens_output?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          estimated_cost_usd?: number
          id?: string
          lead_id?: string | null
          model?: string
          prompt_id?: string
          tokens_input?: number
          tokens_output?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_logs_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "ai_prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      api_activation_history: {
        Row: {
          blocked_reason: string | null
          changed_at: string
          deal_id: string
          id: string
          stage: string
        }
        Insert: {
          blocked_reason?: string | null
          changed_at?: string
          deal_id: string
          id?: string
          stage: string
        }
        Update: {
          blocked_reason?: string | null
          changed_at?: string
          deal_id?: string
          id?: string
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_activation_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "api_oficial_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      api_analysis_requests: {
        Row: {
          analysis_response: string | null
          assigned_to: string | null
          created_at: string
          deadline_at: string | null
          description: string
          documentation_files: Json
          documentation_url: string
          feasibility: string | null
          id: string
          requested_by: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          analysis_response?: string | null
          assigned_to?: string | null
          created_at?: string
          deadline_at?: string | null
          description: string
          documentation_files?: Json
          documentation_url: string
          feasibility?: string | null
          id?: string
          requested_by: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          analysis_response?: string | null
          assigned_to?: string | null
          created_at?: string
          deadline_at?: string | null
          description?: string
          documentation_files?: Json
          documentation_url?: string
          feasibility?: string | null
          id?: string
          requested_by?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      api_oficial_deals: {
        Row: {
          assigned_to_user_id: string | null
          created_at: string | null
          created_by_user_id: string
          id: string
          lead_cnpj: string | null
          lead_company: string | null
          lead_email: string | null
          lead_id: string
          lead_name: string | null
          lead_phone: string | null
          lead_website: string | null
          lost_reason: string | null
          notes: string | null
          sdr_user_id: string | null
          stage: string
          updated_at: string | null
        }
        Insert: {
          assigned_to_user_id?: string | null
          created_at?: string | null
          created_by_user_id: string
          id?: string
          lead_cnpj?: string | null
          lead_company?: string | null
          lead_email?: string | null
          lead_id: string
          lead_name?: string | null
          lead_phone?: string | null
          lead_website?: string | null
          lost_reason?: string | null
          notes?: string | null
          sdr_user_id?: string | null
          stage?: string
          updated_at?: string | null
        }
        Update: {
          assigned_to_user_id?: string | null
          created_at?: string | null
          created_by_user_id?: string
          id?: string
          lead_cnpj?: string | null
          lead_company?: string | null
          lead_email?: string | null
          lead_id?: string
          lead_name?: string | null
          lead_phone?: string | null
          lead_website?: string | null
          lost_reason?: string | null
          notes?: string | null
          sdr_user_id?: string | null
          stage?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      automatic_messages: {
        Row: {
          ai_enabled: boolean
          ai_prompt: string | null
          body: string
          channels: string[] | null
          created_at: string
          created_by: string
          deactivation_reason: string | null
          dynamic_recipients: string[] | null
          id: string
          is_active: boolean
          last_dispatch_at: string | null
          last_dispatch_status: string | null
          message_type: string
          name: string
          schedule_day: number | null
          schedule_time: string | null
          schedule_type: string | null
          sender: string | null
          target_departments: string[] | null
          target_roles: string[] | null
          target_type: string | null
          target_user_ids: string[] | null
          title: string
          trigger_event: string | null
          trigger_key: string | null
          trigger_module: string | null
          trigger_phase: string | null
          trigger_stage: string | null
          updated_at: string
          webhook_urls: string[] | null
        }
        Insert: {
          ai_enabled?: boolean
          ai_prompt?: string | null
          body?: string
          channels?: string[] | null
          created_at?: string
          created_by: string
          deactivation_reason?: string | null
          dynamic_recipients?: string[] | null
          id?: string
          is_active?: boolean
          last_dispatch_at?: string | null
          last_dispatch_status?: string | null
          message_type?: string
          name: string
          schedule_day?: number | null
          schedule_time?: string | null
          schedule_type?: string | null
          sender?: string | null
          target_departments?: string[] | null
          target_roles?: string[] | null
          target_type?: string | null
          target_user_ids?: string[] | null
          title?: string
          trigger_event?: string | null
          trigger_key?: string | null
          trigger_module?: string | null
          trigger_phase?: string | null
          trigger_stage?: string | null
          updated_at?: string
          webhook_urls?: string[] | null
        }
        Update: {
          ai_enabled?: boolean
          ai_prompt?: string | null
          body?: string
          channels?: string[] | null
          created_at?: string
          created_by?: string
          deactivation_reason?: string | null
          dynamic_recipients?: string[] | null
          id?: string
          is_active?: boolean
          last_dispatch_at?: string | null
          last_dispatch_status?: string | null
          message_type?: string
          name?: string
          schedule_day?: number | null
          schedule_time?: string | null
          schedule_type?: string | null
          sender?: string | null
          target_departments?: string[] | null
          target_roles?: string[] | null
          target_type?: string | null
          target_user_ids?: string[] | null
          title?: string
          trigger_event?: string | null
          trigger_key?: string | null
          trigger_module?: string | null
          trigger_phase?: string | null
          trigger_stage?: string | null
          updated_at?: string
          webhook_urls?: string[] | null
        }
        Relationships: []
      }
      bulk_reassign_jobs: {
        Row: {
          created_at: string
          created_by: string
          distribution_mode: string
          entity_ids: string[]
          error_count: number
          error_message: string | null
          id: string
          module: string
          processed_count: number
          status: string
          success_count: number
          target_user_id: string
          target_user_ids: string[] | null
          total_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          distribution_mode?: string
          entity_ids?: string[]
          error_count?: number
          error_message?: string | null
          id?: string
          module?: string
          processed_count?: number
          status?: string
          success_count?: number
          target_user_id: string
          target_user_ids?: string[] | null
          total_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          distribution_mode?: string
          entity_ids?: string[]
          error_count?: number
          error_message?: string | null
          id?: string
          module?: string
          processed_count?: number
          status?: string
          success_count?: number
          target_user_id?: string
          target_user_ids?: string[] | null
          total_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      cadence_steps: {
        Row: {
          cadence_id: string
          channel: Database["public"]["Enums"]["channel_type"]
          created_at: string
          id: string
          objective: string
          script_template: string
          step_number: number
          wait_hours: number
        }
        Insert: {
          cadence_id: string
          channel: Database["public"]["Enums"]["channel_type"]
          created_at?: string
          id?: string
          objective: string
          script_template: string
          step_number: number
          wait_hours?: number
        }
        Update: {
          cadence_id?: string
          channel?: Database["public"]["Enums"]["channel_type"]
          created_at?: string
          id?: string
          objective?: string
          script_template?: string
          step_number?: number
          wait_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "cadence_steps_cadence_id_fkey"
            columns: ["cadence_id"]
            isOneToOne: false
            referencedRelation: "cadences"
            referencedColumns: ["id"]
          },
        ]
      }
      cadences: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      call_analyses: {
        Row: {
          ai_analysis: Json | null
          analysis_context: string
          audio_path: string
          auto_generated: boolean
          call_score: number | null
          completed_at: string | null
          connection_effective: boolean | null
          conversion_potential: number | null
          created_at: string
          duration_seconds: number | null
          early_pitch: boolean | null
          executive_summary: string | null
          ezcall_linkedid: string | null
          feedback: string | null
          id: string
          interest_level: string | null
          interruptions_count: number | null
          lead_id: string | null
          lead_talk_percentage: number | null
          media_type: string
          next_step_defined: boolean | null
          objections: Json | null
          open_questions_count: number | null
          original_filename: string | null
          sdr_talk_percentage: number | null
          sdr_user_id: string
          speaker_segments: Json | null
          status: string
          transcribed_at: string | null
          transcription: string | null
          uploaded_by: string
          worker_chunk_cursor: number | null
          worker_heartbeat_at: string | null
          worker_partial_text: string | null
          worker_retry_count: number | null
          worker_total_chunks: number | null
        }
        Insert: {
          ai_analysis?: Json | null
          analysis_context?: string
          audio_path: string
          auto_generated?: boolean
          call_score?: number | null
          completed_at?: string | null
          connection_effective?: boolean | null
          conversion_potential?: number | null
          created_at?: string
          duration_seconds?: number | null
          early_pitch?: boolean | null
          executive_summary?: string | null
          ezcall_linkedid?: string | null
          feedback?: string | null
          id?: string
          interest_level?: string | null
          interruptions_count?: number | null
          lead_id?: string | null
          lead_talk_percentage?: number | null
          media_type?: string
          next_step_defined?: boolean | null
          objections?: Json | null
          open_questions_count?: number | null
          original_filename?: string | null
          sdr_talk_percentage?: number | null
          sdr_user_id: string
          speaker_segments?: Json | null
          status?: string
          transcribed_at?: string | null
          transcription?: string | null
          uploaded_by: string
          worker_chunk_cursor?: number | null
          worker_heartbeat_at?: string | null
          worker_partial_text?: string | null
          worker_retry_count?: number | null
          worker_total_chunks?: number | null
        }
        Update: {
          ai_analysis?: Json | null
          analysis_context?: string
          audio_path?: string
          auto_generated?: boolean
          call_score?: number | null
          completed_at?: string | null
          connection_effective?: boolean | null
          conversion_potential?: number | null
          created_at?: string
          duration_seconds?: number | null
          early_pitch?: boolean | null
          executive_summary?: string | null
          ezcall_linkedid?: string | null
          feedback?: string | null
          id?: string
          interest_level?: string | null
          interruptions_count?: number | null
          lead_id?: string | null
          lead_talk_percentage?: number | null
          media_type?: string
          next_step_defined?: boolean | null
          objections?: Json | null
          open_questions_count?: number | null
          original_filename?: string | null
          sdr_talk_percentage?: number | null
          sdr_user_id?: string
          speaker_segments?: Json | null
          status?: string
          transcribed_at?: string | null
          transcription?: string | null
          uploaded_by?: string
          worker_chunk_cursor?: number | null
          worker_heartbeat_at?: string | null
          worker_partial_text?: string | null
          worker_retry_count?: number | null
          worker_total_chunks?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "call_analyses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_analyses_sdr_user_id_fkey"
            columns: ["sdr_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_analyses_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      call_history: {
        Row: {
          created_at: string
          direction: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          lead_company: string | null
          lead_id: string | null
          lead_name: string | null
          phone_number: string
          started_at: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          direction?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          lead_company?: string | null
          lead_id?: string | null
          lead_name?: string | null
          phone_number: string
          started_at?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          direction?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          lead_company?: string | null
          lead_id?: string | null
          lead_name?: string | null
          phone_number?: string
          started_at?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_sessions: {
        Row: {
          bairro: string | null
          cep: string | null
          city: string | null
          cnpj: string | null
          complemento: string | null
          created_at: string
          fin_email: string | null
          fin_name: string | null
          fin_phone: string | null
          id: string
          logradouro: string | null
          nome_fantasia: string | null
          numero: string | null
          proposal_id: string
          razao_social: string | null
          rep_cpf: string | null
          rep_email: string | null
          rep_name: string | null
          rep_phone: string | null
          rep_role: string | null
          state: string | null
          status: string
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          city?: string | null
          cnpj?: string | null
          complemento?: string | null
          created_at?: string
          fin_email?: string | null
          fin_name?: string | null
          fin_phone?: string | null
          id?: string
          logradouro?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          proposal_id: string
          razao_social?: string | null
          rep_cpf?: string | null
          rep_email?: string | null
          rep_name?: string | null
          rep_phone?: string | null
          rep_role?: string | null
          state?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          city?: string | null
          cnpj?: string | null
          complemento?: string | null
          created_at?: string
          fin_email?: string | null
          fin_name?: string | null
          fin_phone?: string | null
          id?: string
          logradouro?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          proposal_id?: string
          razao_social?: string | null
          rep_cpf?: string | null
          rep_email?: string | null
          rep_name?: string | null
          rep_phone?: string | null
          rep_role?: string | null
          state?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkout_sessions_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: true
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_locks: {
        Row: {
          expires_at: string
          job_name: string
          locked_at: string
        }
        Insert: {
          expires_at: string
          job_name: string
          locked_at?: string
        }
        Update: {
          expires_at?: string
          job_name?: string
          locked_at?: string
        }
        Relationships: []
      }
      email_sequence_enrollments: {
        Row: {
          created_at: string
          current_step: number
          enrolled_by: string
          id: string
          lead_id: string
          next_send_at: string | null
          processing_at: string | null
          sequence_id: string
          status: Database["public"]["Enums"]["enrollment_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_step?: number
          enrolled_by: string
          id?: string
          lead_id: string
          next_send_at?: string | null
          processing_at?: string | null
          sequence_id: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_step?: number
          enrolled_by?: string
          id?: string
          lead_id?: string
          next_send_at?: string | null
          processing_at?: string | null
          sequence_id?: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_sequence_enrollments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sequence_enrollments_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "email_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sequence_logs: {
        Row: {
          enrollment_id: string
          id: string
          opened_at: string | null
          replied_at: string | null
          resend_message_id: string | null
          sent_at: string
          step_id: string
        }
        Insert: {
          enrollment_id: string
          id?: string
          opened_at?: string | null
          replied_at?: string | null
          resend_message_id?: string | null
          sent_at?: string
          step_id: string
        }
        Update: {
          enrollment_id?: string
          id?: string
          opened_at?: string | null
          replied_at?: string | null
          resend_message_id?: string | null
          sent_at?: string
          step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_sequence_logs_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "email_sequence_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sequence_logs_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "email_sequence_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sequence_steps: {
        Row: {
          body: string
          created_at: string
          delay_hours: number
          id: string
          sequence_id: string
          step_number: number
          subject: string
        }
        Insert: {
          body: string
          created_at?: string
          delay_hours?: number
          id?: string
          sequence_id: string
          step_number: number
          subject: string
        }
        Update: {
          body?: string
          created_at?: string
          delay_hours?: number
          id?: string
          sequence_id?: string
          step_number?: number
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_sequence_steps_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "email_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sequences: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_template_teams: {
        Row: {
          created_at: string
          id: string
          team_id: string
          template_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          team_id: string
          template_id: string
        }
        Update: {
          created_at?: string
          id?: string
          team_id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_template_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_template_teams_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          active: boolean
          attachments: Json | null
          body: string
          created_at: string
          created_by: string
          id: string
          name: string
          subject: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          attachments?: Json | null
          body: string
          created_at?: string
          created_by: string
          id?: string
          name: string
          subject: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          attachments?: Json | null
          body?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      enrichment_jobs: {
        Row: {
          cnpja_success: number
          created_at: string
          error_count: number
          error_message: string | null
          id: string
          job_type: string
          logs: Json
          not_found_count: number
          options: Json
          perplexity_success: number
          processed: number
          skipped_count: number
          started_by: string
          status: string
          total_eligible: number
          total_processed: number
          updated_at: string
        }
        Insert: {
          cnpja_success?: number
          created_at?: string
          error_count?: number
          error_message?: string | null
          id?: string
          job_type?: string
          logs?: Json
          not_found_count?: number
          options?: Json
          perplexity_success?: number
          processed?: number
          skipped_count?: number
          started_by: string
          status?: string
          total_eligible?: number
          total_processed?: number
          updated_at?: string
        }
        Update: {
          cnpja_success?: number
          created_at?: string
          error_count?: number
          error_message?: string | null
          id?: string
          job_type?: string
          logs?: Json
          not_found_count?: number
          options?: Json
          perplexity_success?: number
          processed?: number
          skipped_count?: number
          started_by?: string
          status?: string
          total_eligible?: number
          total_processed?: number
          updated_at?: string
        }
        Relationships: []
      }
      form_submissions: {
        Row: {
          created_at: string
          data: Json
          form_id: string
          id: string
          ip_address: string | null
          lead_id: string | null
          source: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          data?: Json
          form_id: string
          id?: string
          ip_address?: string | null
          lead_id?: string | null
          source?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          data?: Json
          form_id?: string
          id?: string
          ip_address?: string | null
          lead_id?: string | null
          source?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          active: boolean
          assigned_closer_id: string | null
          assigned_sdr_ids: string[] | null
          button_hover_bg_color: string | null
          button_hover_text_color: string | null
          button_text: string
          card_bg_color: string
          card_bg_enabled: boolean
          card_border_color: string
          card_border_enabled: boolean
          card_border_radius: number
          card_border_width: number
          consent_url: string | null
          created_at: string
          created_by: string
          description: string | null
          field_bg_color: string
          field_border_color: string
          field_border_width: number
          fields: string[]
          fields_schema: Json | null
          id: string
          name: string
          notify_email: boolean
          notify_push: boolean
          notify_user_ids: string[] | null
          post_action: string
          primary_color: string
          redirect_url: string | null
          show_consent: boolean
          show_recaptcha: boolean
          source: string
          subtitle: string
          success_message: string
          title: string
          updated_at: string
          webhook_urls: string[] | null
          whatsapp_message_template: string | null
          whatsapp_number: string | null
          widget_type: string
        }
        Insert: {
          active?: boolean
          assigned_closer_id?: string | null
          assigned_sdr_ids?: string[] | null
          button_hover_bg_color?: string | null
          button_hover_text_color?: string | null
          button_text?: string
          card_bg_color?: string
          card_bg_enabled?: boolean
          card_border_color?: string
          card_border_enabled?: boolean
          card_border_radius?: number
          card_border_width?: number
          consent_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          field_bg_color?: string
          field_border_color?: string
          field_border_width?: number
          fields?: string[]
          fields_schema?: Json | null
          id?: string
          name: string
          notify_email?: boolean
          notify_push?: boolean
          notify_user_ids?: string[] | null
          post_action?: string
          primary_color?: string
          redirect_url?: string | null
          show_consent?: boolean
          show_recaptcha?: boolean
          source?: string
          subtitle?: string
          success_message?: string
          title?: string
          updated_at?: string
          webhook_urls?: string[] | null
          whatsapp_message_template?: string | null
          whatsapp_number?: string | null
          widget_type?: string
        }
        Update: {
          active?: boolean
          assigned_closer_id?: string | null
          assigned_sdr_ids?: string[] | null
          button_hover_bg_color?: string | null
          button_hover_text_color?: string | null
          button_text?: string
          card_bg_color?: string
          card_bg_enabled?: boolean
          card_border_color?: string
          card_border_enabled?: boolean
          card_border_radius?: number
          card_border_width?: number
          consent_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          field_bg_color?: string
          field_border_color?: string
          field_border_width?: number
          fields?: string[]
          fields_schema?: Json | null
          id?: string
          name?: string
          notify_email?: boolean
          notify_push?: boolean
          notify_user_ids?: string[] | null
          post_action?: string
          primary_color?: string
          redirect_url?: string | null
          show_consent?: boolean
          show_recaptcha?: boolean
          source?: string
          subtitle?: string
          success_message?: string
          title?: string
          updated_at?: string
          webhook_urls?: string[] | null
          whatsapp_message_template?: string | null
          whatsapp_number?: string | null
          widget_type?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          conversion_percentage: number | null
          created_at: string
          created_by: string
          goal_type: string
          id: string
          meetings_held_percentage: number
          meetings_scheduled_goal: number
          period_month: number
          period_year: number
          setup_revenue_goal: number | null
          sqo_percentage: number
          target_user_id: string | null
          updated_at: string
        }
        Insert: {
          conversion_percentage?: number | null
          created_at?: string
          created_by: string
          goal_type?: string
          id?: string
          meetings_held_percentage?: number
          meetings_scheduled_goal?: number
          period_month: number
          period_year: number
          setup_revenue_goal?: number | null
          sqo_percentage?: number
          target_user_id?: string | null
          updated_at?: string
        }
        Update: {
          conversion_percentage?: number | null
          created_at?: string
          created_by?: string
          goal_type?: string
          id?: string
          meetings_held_percentage?: number
          meetings_scheduled_goal?: number
          period_month?: number
          period_year?: number
          setup_revenue_goal?: number | null
          sqo_percentage?: number
          target_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          gmail_last_sync_at: string | null
          id: string
          refresh_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          gmail_last_sync_at?: string | null
          id?: string
          refresh_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          gmail_last_sync_at?: string | null
          id?: string
          refresh_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      icp_analyses: {
        Row: {
          ai_analysis: string | null
          clients_analyzed: number | null
          created_at: string
          created_by: string | null
          filters: Json | null
          id: string
          statistics: Json | null
        }
        Insert: {
          ai_analysis?: string | null
          clients_analyzed?: number | null
          created_at?: string
          created_by?: string | null
          filters?: Json | null
          id?: string
          statistics?: Json | null
        }
        Update: {
          ai_analysis?: string | null
          clients_analyzed?: number | null
          created_at?: string
          created_by?: string | null
          filters?: Json | null
          id?: string
          statistics?: Json | null
        }
        Relationships: []
      }
      icp_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      import_jobs: {
        Row: {
          allocation_type: string
          created_at: string
          duplicate_count: number
          duplicate_details: Json | null
          error_count: number
          error_details: Json | null
          error_message: string | null
          file_name: string
          id: string
          import_status: string
          mappings: Json
          processed_rows: number
          selected_sdr_id: string | null
          status: string
          status_mappings: Json | null
          storage_path: string
          success_count: number
          total_rows: number
          updated_at: string
          user_id: string
        }
        Insert: {
          allocation_type?: string
          created_at?: string
          duplicate_count?: number
          duplicate_details?: Json | null
          error_count?: number
          error_details?: Json | null
          error_message?: string | null
          file_name: string
          id?: string
          import_status?: string
          mappings?: Json
          processed_rows?: number
          selected_sdr_id?: string | null
          status?: string
          status_mappings?: Json | null
          storage_path: string
          success_count?: number
          total_rows?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          allocation_type?: string
          created_at?: string
          duplicate_count?: number
          duplicate_details?: Json | null
          error_count?: number
          error_details?: Json | null
          error_message?: string | null
          file_name?: string
          id?: string
          import_status?: string
          mappings?: Json
          processed_rows?: number
          selected_sdr_id?: string | null
          status?: string
          status_mappings?: Json | null
          storage_path?: string
          success_count?: number
          total_rows?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      interactions: {
        Row: {
          channel: Database["public"]["Enums"]["channel_type"]
          created_at: string
          direction: string
          id: string
          lead_id: string
          message_summary: string | null
          occurred_at: string
          outcome: Database["public"]["Enums"]["interaction_outcome"]
          user_id: string | null
        }
        Insert: {
          channel: Database["public"]["Enums"]["channel_type"]
          created_at?: string
          direction: string
          id?: string
          lead_id: string
          message_summary?: string | null
          occurred_at?: string
          outcome: Database["public"]["Enums"]["interaction_outcome"]
          user_id?: string | null
        }
        Update: {
          channel?: Database["public"]["Enums"]["channel_type"]
          created_at?: string
          direction?: string
          id?: string
          lead_id?: string
          message_summary?: string | null
          occurred_at?: string
          outcome?: Database["public"]["Enums"]["interaction_outcome"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_activity_logs: {
        Row: {
          action_type: string
          created_at: string
          description: string
          field_name: string | null
          id: string
          lead_id: string
          new_value: string | null
          old_value: string | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          description: string
          field_name?: string | null
          id?: string
          lead_id: string
          new_value?: string | null
          old_value?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          description?: string
          field_name?: string | null
          id?: string
          lead_id?: string
          new_value?: string | null
          old_value?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_activity_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_cadences: {
        Row: {
          cadence_id: string
          current_step_number: number
          finished_at: string | null
          id: string
          lead_id: string
          next_step_at: string | null
          result: string | null
          started_at: string
        }
        Insert: {
          cadence_id: string
          current_step_number?: number
          finished_at?: string | null
          id?: string
          lead_id: string
          next_step_at?: string | null
          result?: string | null
          started_at?: string
        }
        Update: {
          cadence_id?: string
          current_step_number?: number
          finished_at?: string | null
          id?: string
          lead_id?: string
          next_step_at?: string | null
          result?: string | null
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_cadences_cadence_id_fkey"
            columns: ["cadence_id"]
            isOneToOne: false
            referencedRelation: "cadences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_cadences_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_primary: boolean
          lead_id: string
          name: string
          phone: string | null
          phone_2: string | null
          role: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          lead_id: string
          name?: string
          phone?: string | null
          phone_2?: string | null
          role?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          lead_id?: string
          name?: string
          phone?: string | null
          phone_2?: string | null
          role?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_contacts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_notes: {
        Row: {
          attachments: Json | null
          created_at: string
          id: string
          lead_id: string
          note: string
          user_id: string | null
        }
        Insert: {
          attachments?: Json | null
          created_at?: string
          id?: string
          lead_id: string
          note: string
          user_id?: string | null
        }
        Update: {
          attachments?: Json | null
          created_at?: string
          id?: string
          lead_id?: string
          note?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_score_history: {
        Row: {
          calculated_at: string
          factors: Json
          id: string
          lead_id: string
          score: number
        }
        Insert: {
          calculated_at?: string
          factors?: Json
          id?: string
          lead_id: string
          score: number
        }
        Update: {
          calculated_at?: string
          factors?: Json
          id?: string
          lead_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "lead_score_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          account_id: string | null
          ai_enrichment_data: Json | null
          ai_insights_data: Json | null
          ai_insights_generated_at: string | null
          ai_next_action_suggestion: string | null
          ai_validation_alerts: Json | null
          attempts_count: number
          bairro: string | null
          behavioral_score: number | null
          cadence_id: string | null
          capital_social: number | null
          cep: string | null
          city: string | null
          clickup_id: string | null
          closing_probability: number | null
          closing_probability_reason: string | null
          cnae_fiscal: number | null
          cnae_fiscal_descricao: string | null
          cnaes_secundarios: string | null
          cnpj: string | null
          cnpja_last_searched_at: string | null
          company: string
          company_segment: string | null
          complemento: string | null
          contact_name_2: string | null
          country: string | null
          created_at: string
          current_cadence_step: number | null
          daily_service_volume: string | null
          data_inicio_atividade: string | null
          email: string | null
          email_2: string | null
          employee_count: string | null
          enriched_at: string | null
          entry_channel: Database["public"]["Enums"]["channel_type"] | null
          has_budget: string | null
          icp_fit: string | null
          id: string
          initial_message: string | null
          is_hot_lead: boolean
          last_contact_at: string | null
          last_score_calculated_at: string | null
          lead_type: Database["public"]["Enums"]["lead_type"]
          list_reason: string | null
          logradouro: string | null
          main_pain_point: string | null
          name: string
          next_action_at: string
          nome_fantasia: string | null
          numero: string | null
          owner_user_id: string | null
          phone: string | null
          phone_2: string | null
          phone_3: string | null
          phone_4: string | null
          porte: string | null
          priority_score: number
          product_interest: string | null
          qsa: string | null
          qualification_notes: string | null
          razao_social: string | null
          revenue_range: string | null
          score_variation_48h: number
          score_variation_reason: string | null
          situacao_cadastral: string | null
          solution_urgency: string | null
          source: string | null
          sqo_approved_at: string | null
          sqo_approved_by: string | null
          sqo_budget: string | null
          sqo_decision_maker: string | null
          sqo_icp_fit: string | null
          sqo_next_step: string | null
          sqo_pain_category: string | null
          sqo_pain_clear: boolean | null
          sqo_pain_financial_impact: boolean | null
          sqo_pain_other: string | null
          sqo_urgency: string | null
          state: string | null
          status: Database["public"]["Enums"]["lead_status"]
          temperature: string | null
          updated_at: string
          uses_platform: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          account_id?: string | null
          ai_enrichment_data?: Json | null
          ai_insights_data?: Json | null
          ai_insights_generated_at?: string | null
          ai_next_action_suggestion?: string | null
          ai_validation_alerts?: Json | null
          attempts_count?: number
          bairro?: string | null
          behavioral_score?: number | null
          cadence_id?: string | null
          capital_social?: number | null
          cep?: string | null
          city?: string | null
          clickup_id?: string | null
          closing_probability?: number | null
          closing_probability_reason?: string | null
          cnae_fiscal?: number | null
          cnae_fiscal_descricao?: string | null
          cnaes_secundarios?: string | null
          cnpj?: string | null
          cnpja_last_searched_at?: string | null
          company: string
          company_segment?: string | null
          complemento?: string | null
          contact_name_2?: string | null
          country?: string | null
          created_at?: string
          current_cadence_step?: number | null
          daily_service_volume?: string | null
          data_inicio_atividade?: string | null
          email?: string | null
          email_2?: string | null
          employee_count?: string | null
          enriched_at?: string | null
          entry_channel?: Database["public"]["Enums"]["channel_type"] | null
          has_budget?: string | null
          icp_fit?: string | null
          id?: string
          initial_message?: string | null
          is_hot_lead?: boolean
          last_contact_at?: string | null
          last_score_calculated_at?: string | null
          lead_type: Database["public"]["Enums"]["lead_type"]
          list_reason?: string | null
          logradouro?: string | null
          main_pain_point?: string | null
          name: string
          next_action_at?: string
          nome_fantasia?: string | null
          numero?: string | null
          owner_user_id?: string | null
          phone?: string | null
          phone_2?: string | null
          phone_3?: string | null
          phone_4?: string | null
          porte?: string | null
          priority_score?: number
          product_interest?: string | null
          qsa?: string | null
          qualification_notes?: string | null
          razao_social?: string | null
          revenue_range?: string | null
          score_variation_48h?: number
          score_variation_reason?: string | null
          situacao_cadastral?: string | null
          solution_urgency?: string | null
          source?: string | null
          sqo_approved_at?: string | null
          sqo_approved_by?: string | null
          sqo_budget?: string | null
          sqo_decision_maker?: string | null
          sqo_icp_fit?: string | null
          sqo_next_step?: string | null
          sqo_pain_category?: string | null
          sqo_pain_clear?: boolean | null
          sqo_pain_financial_impact?: boolean | null
          sqo_pain_other?: string | null
          sqo_urgency?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          temperature?: string | null
          updated_at?: string
          uses_platform?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          account_id?: string | null
          ai_enrichment_data?: Json | null
          ai_insights_data?: Json | null
          ai_insights_generated_at?: string | null
          ai_next_action_suggestion?: string | null
          ai_validation_alerts?: Json | null
          attempts_count?: number
          bairro?: string | null
          behavioral_score?: number | null
          cadence_id?: string | null
          capital_social?: number | null
          cep?: string | null
          city?: string | null
          clickup_id?: string | null
          closing_probability?: number | null
          closing_probability_reason?: string | null
          cnae_fiscal?: number | null
          cnae_fiscal_descricao?: string | null
          cnaes_secundarios?: string | null
          cnpj?: string | null
          cnpja_last_searched_at?: string | null
          company?: string
          company_segment?: string | null
          complemento?: string | null
          contact_name_2?: string | null
          country?: string | null
          created_at?: string
          current_cadence_step?: number | null
          daily_service_volume?: string | null
          data_inicio_atividade?: string | null
          email?: string | null
          email_2?: string | null
          employee_count?: string | null
          enriched_at?: string | null
          entry_channel?: Database["public"]["Enums"]["channel_type"] | null
          has_budget?: string | null
          icp_fit?: string | null
          id?: string
          initial_message?: string | null
          is_hot_lead?: boolean
          last_contact_at?: string | null
          last_score_calculated_at?: string | null
          lead_type?: Database["public"]["Enums"]["lead_type"]
          list_reason?: string | null
          logradouro?: string | null
          main_pain_point?: string | null
          name?: string
          next_action_at?: string
          nome_fantasia?: string | null
          numero?: string | null
          owner_user_id?: string | null
          phone?: string | null
          phone_2?: string | null
          phone_3?: string | null
          phone_4?: string | null
          porte?: string | null
          priority_score?: number
          product_interest?: string | null
          qsa?: string | null
          qualification_notes?: string | null
          razao_social?: string | null
          revenue_range?: string | null
          score_variation_48h?: number
          score_variation_reason?: string | null
          situacao_cadastral?: string | null
          solution_urgency?: string | null
          source?: string | null
          sqo_approved_at?: string | null
          sqo_approved_by?: string | null
          sqo_budget?: string | null
          sqo_decision_maker?: string | null
          sqo_icp_fit?: string | null
          sqo_next_step?: string | null
          sqo_pain_category?: string | null
          sqo_pain_clear?: boolean | null
          sqo_pain_financial_impact?: boolean | null
          sqo_pain_other?: string | null
          sqo_urgency?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          temperature?: string | null
          updated_at?: string
          uses_platform?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_cadence_id_fkey"
            columns: ["cadence_id"]
            isOneToOne: false
            referencedRelation: "cadences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          created_at: string
          executive_name: string
          google_calendar_event_id: string | null
          id: string
          lead_id: string
          meet_link: string | null
          meeting_datetime: string
          reminder_minutes_before: number | null
          reminder_sent: boolean | null
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          executive_name: string
          google_calendar_event_id?: string | null
          id?: string
          lead_id: string
          meet_link?: string | null
          meeting_datetime: string
          reminder_minutes_before?: number | null
          reminder_sent?: boolean | null
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          executive_name?: string
          google_calendar_event_id?: string | null
          id?: string
          lead_id?: string
          meet_link?: string | null
          meeting_datetime?: string
          reminder_minutes_before?: number | null
          reminder_sent?: boolean | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_dispatch_logs: {
        Row: {
          ai_response_time_ms: number | null
          ai_used: boolean | null
          channel: string | null
          created_at: string
          error_reason: string | null
          id: string
          message_body: string | null
          message_id: string | null
          recipients_ignored: Json | null
          recipients_resolved: Json | null
          status: string
          trigger_source: string
          triggered_at: string
        }
        Insert: {
          ai_response_time_ms?: number | null
          ai_used?: boolean | null
          channel?: string | null
          created_at?: string
          error_reason?: string | null
          id?: string
          message_body?: string | null
          message_id?: string | null
          recipients_ignored?: Json | null
          recipients_resolved?: Json | null
          status?: string
          trigger_source?: string
          triggered_at?: string
        }
        Update: {
          ai_response_time_ms?: number | null
          ai_used?: boolean | null
          channel?: string | null
          created_at?: string
          error_reason?: string | null
          id?: string
          message_body?: string | null
          message_id?: string | null
          recipients_ignored?: Json | null
          recipients_resolved?: Json | null
          status?: string
          trigger_source?: string
          triggered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_dispatch_logs_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "automatic_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      national_holidays: {
        Row: {
          date: string
          id: string
          name: string
          year: number
        }
        Insert: {
          date: string
          id?: string
          name: string
          year: number
        }
        Update: {
          date?: string
          id?: string
          name?: string
          year?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          read: boolean | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          read?: boolean | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          account_id: string | null
          active_objection: string | null
          assigned_to_user_id: string | null
          closer_notes: string | null
          created_at: string
          created_by_user_id: string
          deal_value: number | null
          decision_maker_identified: boolean | null
          expected_close_date: string | null
          id: string
          lead_id: string
          lost_reason: string | null
          lost_responsibility: string | null
          lost_sqo_impact: string | null
          meeting_datetime: string | null
          opportunity_type: string
          return_reason: string | null
          returned_to_sdr: boolean | null
          scheduled_by: string | null
          sdr_user_id: string | null
          stage: string
          updated_at: string
          won_at: string | null
        }
        Insert: {
          account_id?: string | null
          active_objection?: string | null
          assigned_to_user_id?: string | null
          closer_notes?: string | null
          created_at?: string
          created_by_user_id: string
          deal_value?: number | null
          decision_maker_identified?: boolean | null
          expected_close_date?: string | null
          id?: string
          lead_id: string
          lost_reason?: string | null
          lost_responsibility?: string | null
          lost_sqo_impact?: string | null
          meeting_datetime?: string | null
          opportunity_type?: string
          return_reason?: string | null
          returned_to_sdr?: boolean | null
          scheduled_by?: string | null
          sdr_user_id?: string | null
          stage?: string
          updated_at?: string
          won_at?: string | null
        }
        Update: {
          account_id?: string | null
          active_objection?: string | null
          assigned_to_user_id?: string | null
          closer_notes?: string | null
          created_at?: string
          created_by_user_id?: string
          deal_value?: number | null
          decision_maker_identified?: boolean | null
          expected_close_date?: string | null
          id?: string
          lead_id?: string
          lost_reason?: string | null
          lost_responsibility?: string | null
          lost_sqo_impact?: string | null
          meeting_datetime?: string | null
          opportunity_type?: string
          return_reason?: string | null
          returned_to_sdr?: boolean | null
          scheduled_by?: string | null
          sdr_user_id?: string | null
          stage?: string
          updated_at?: string
          won_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_assigned_to_user_id_fkey"
            columns: ["assigned_to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_sdr_user_id_fkey"
            columns: ["sdr_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          message: string
          resolved: boolean
          resolved_at: string | null
          severity: string
          user_id: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          message: string
          resolved?: boolean
          resolved_at?: string | null
          severity?: string
          user_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          message?: string
          resolved?: boolean
          resolved_at?: string | null
          severity?: string
          user_id?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          category: string
          description: string
          id: string
          name: string
        }
        Insert: {
          category?: string
          description?: string
          id?: string
          name: string
        }
        Update: {
          category?: string
          description?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      pipeline_statuses: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_system: boolean
          pipeline: string
          sort_order: number
          status_name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_system?: boolean
          pipeline: string
          sort_order?: number
          status_name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_system?: boolean
          pipeline?: string
          sort_order?: number
          status_name?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean
          category: string
          contacts_included: number
          created_at: string
          custom_pricing: boolean | null
          description: string | null
          excess_contact_price: number
          excess_message_price: number
          features: Json | null
          frequency: string | null
          id: string
          max_extensions: number | null
          messages_included: number
          min_extensions: number | null
          name: string
          price: number
          price_per_extension: number | null
          recommended: boolean
          sort_order: number
          subcategory: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: string
          contacts_included?: number
          created_at?: string
          custom_pricing?: boolean | null
          description?: string | null
          excess_contact_price?: number
          excess_message_price?: number
          features?: Json | null
          frequency?: string | null
          id?: string
          max_extensions?: number | null
          messages_included?: number
          min_extensions?: number | null
          name: string
          price?: number
          price_per_extension?: number | null
          recommended?: boolean
          sort_order?: number
          subcategory?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          contacts_included?: number
          created_at?: string
          custom_pricing?: boolean | null
          description?: string | null
          excess_contact_price?: number
          excess_message_price?: number
          features?: Json | null
          frequency?: string | null
          id?: string
          max_extensions?: number | null
          messages_included?: number
          min_extensions?: number | null
          name?: string
          price?: number
          price_per_extension?: number | null
          recommended?: boolean
          sort_order?: number
          subcategory?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          avatar_url: string | null
          created_at: string
          email: string | null
          email_signature: string | null
          exclude_from_auto_assign: boolean
          id: string
          last_seen_at: string | null
          name: string
          notify_overdue_email: boolean
          notify_overdue_push: boolean
          notify_overdue_sound: boolean
          ramal: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          email_signature?: string | null
          exclude_from_auto_assign?: boolean
          id: string
          last_seen_at?: string | null
          name: string
          notify_overdue_email?: boolean
          notify_overdue_push?: boolean
          notify_overdue_sound?: boolean
          ramal?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          email_signature?: string | null
          exclude_from_auto_assign?: boolean
          id?: string
          last_seen_at?: string | null
          name?: string
          notify_overdue_email?: boolean
          notify_overdue_push?: boolean
          notify_overdue_sound?: boolean
          ramal?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      project_activity_logs: {
        Row: {
          action_type: string
          created_at: string
          description: string
          id: string
          new_value: string | null
          old_value: string | null
          parent_id: string | null
          phase_name: string | null
          project_id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          description: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          parent_id?: string | null
          phase_name?: string | null
          project_id: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          description?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          parent_id?: string | null
          phase_name?: string | null
          project_id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_activity_logs_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "project_activity_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_activity_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_attachments: {
        Row: {
          content_type: string | null
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          project_id: string
          uploaded_by: string | null
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number
          id?: string
          project_id: string
          uploaded_by?: string | null
        }
        Update: {
          content_type?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          project_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_attachments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_deliveries: {
        Row: {
          admin_link: string
          closer_name: string | null
          cnpj: string | null
          company_name: string | null
          complexity_level: string | null
          created_at: string
          delivered_at: string
          dev_responsible: string | null
          has_integration: boolean
          id: string
          is_new_integration: boolean
          observations: string | null
          project_id: string
          project_type_label: string | null
          submitted_by: string
          uses_gpt: boolean
          ux_responsible: string | null
          version: string | null
        }
        Insert: {
          admin_link: string
          closer_name?: string | null
          cnpj?: string | null
          company_name?: string | null
          complexity_level?: string | null
          created_at?: string
          delivered_at?: string
          dev_responsible?: string | null
          has_integration?: boolean
          id?: string
          is_new_integration?: boolean
          observations?: string | null
          project_id: string
          project_type_label?: string | null
          submitted_by: string
          uses_gpt?: boolean
          ux_responsible?: string | null
          version?: string | null
        }
        Update: {
          admin_link?: string
          closer_name?: string | null
          cnpj?: string | null
          company_name?: string | null
          complexity_level?: string | null
          created_at?: string
          delivered_at?: string
          dev_responsible?: string | null
          has_integration?: boolean
          id?: string
          is_new_integration?: boolean
          observations?: string | null
          project_id?: string
          project_type_label?: string | null
          submitted_by?: string
          uses_gpt?: boolean
          ux_responsible?: string | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_deliveries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_integrations: {
        Row: {
          created_at: string
          delivery_id: string
          id: string
          integration_name: string
          is_new: boolean
          notes: string | null
          project_id: string
        }
        Insert: {
          created_at?: string
          delivery_id: string
          id?: string
          integration_name: string
          is_new?: boolean
          notes?: string | null
          project_id: string
        }
        Update: {
          created_at?: string
          delivery_id?: string
          id?: string
          integration_name?: string
          is_new?: boolean
          notes?: string | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_integrations_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "project_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_integrations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_phase_statuses: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_system: boolean
          phase_name: string
          sort_order: number
          status_name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_system?: boolean
          phase_name: string
          sort_order: number
          status_name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_system?: boolean
          phase_name?: string
          sort_order?: number
          status_name?: string
        }
        Relationships: []
      }
      project_phases: {
        Row: {
          assigned_user_id: string | null
          bm_data: Json | null
          completed_at: string | null
          created_at: string
          due_date: string | null
          id: string
          is_active: boolean | null
          notes: string | null
          paused_at: string | null
          phase_name: string
          project_id: string
          sort_order: number
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_user_id?: string | null
          bm_data?: Json | null
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          paused_at?: string | null
          phase_name: string
          project_id: string
          sort_order?: number
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_user_id?: string | null
          bm_data?: Json | null
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          paused_at?: string | null
          phase_name?: string
          project_id?: string
          sort_order?: number
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_phases_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          project_id: string
          reason: string | null
          status: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          project_id: string
          reason?: string | null
          status: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          project_id?: string
          reason?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_status_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_status_transitions: {
        Row: {
          changed_by_user_id: string | null
          duration_minutes: number | null
          entered_at: string
          exited_at: string | null
          id: string
          phase_name: string
          project_id: string
          status: string
        }
        Insert: {
          changed_by_user_id?: string | null
          duration_minutes?: number | null
          entered_at?: string
          exited_at?: string | null
          id?: string
          phase_name: string
          project_id: string
          status: string
        }
        Update: {
          changed_by_user_id?: string | null
          duration_minutes?: number | null
          entered_at?: string
          exited_at?: string | null
          id?: string
          phase_name?: string
          project_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_status_transitions_changed_by_user_id_fkey"
            columns: ["changed_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_status_transitions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tasks: {
        Row: {
          assigned_user_id: string | null
          completed_at: string | null
          created_at: string
          created_by_user_id: string
          description: string | null
          due_date: string | null
          id: string
          lead_id: string | null
          notify_before: string | null
          opportunity_id: string | null
          priority: string
          project_id: string | null
          reminder_sent_at: string | null
          status: string
          task_type: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_user_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by_user_id: string
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          notify_before?: string | null
          opportunity_id?: string | null
          priority?: string
          project_id?: string | null
          reminder_sent_at?: string | null
          status?: string
          task_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_user_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          notify_before?: string | null
          opportunity_id?: string | null
          priority?: string
          project_id?: string | null
          reminder_sent_at?: string | null
          status?: string
          task_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          account_id: string | null
          activation_phone: string | null
          api_type: string | null
          archived: boolean
          ativacao_user_id: string | null
          broker: string | null
          checklist_data: Json | null
          closer_name: string | null
          closer_user_id: string | null
          cnpj: string | null
          coexistence_quantity: number | null
          company_name: string
          complexity_level: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by_user_id: string | null
          current_phase: string | null
          deleted_at: string | null
          deleted_by_user_id: string | null
          deleted_from_status: string | null
          delivered_at: string | null
          dev_user_id: string | null
          due_date: string | null
          estimated_hours: number | null
          extra_storage: string | null
          figma_url: string | null
          go_live_user_id: string | null
          has_ai: boolean | null
          has_coexistence: boolean | null
          has_integration: boolean | null
          head_user_id: string | null
          id: string
          integrations_description: string | null
          lead_id: string | null
          notes: string | null
          opportunity_id: string | null
          overall_status: string
          plan_name: string | null
          priority: string
          project_description: string | null
          project_number: number
          project_type: string
          sdr_name: string | null
          sdr_user_id: string | null
          start_date: string | null
          storage_time: string | null
          tags: string[] | null
          treinamento_user_id: string | null
          updated_at: string
          ux_po_user_id: string | null
          verificacao_bm_user_id: string | null
          version: string | null
          website: string | null
        }
        Insert: {
          account_id?: string | null
          activation_phone?: string | null
          api_type?: string | null
          archived?: boolean
          ativacao_user_id?: string | null
          broker?: string | null
          checklist_data?: Json | null
          closer_name?: string | null
          closer_user_id?: string | null
          cnpj?: string | null
          coexistence_quantity?: number | null
          company_name?: string
          complexity_level?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by_user_id?: string | null
          current_phase?: string | null
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deleted_from_status?: string | null
          delivered_at?: string | null
          dev_user_id?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          extra_storage?: string | null
          figma_url?: string | null
          go_live_user_id?: string | null
          has_ai?: boolean | null
          has_coexistence?: boolean | null
          has_integration?: boolean | null
          head_user_id?: string | null
          id?: string
          integrations_description?: string | null
          lead_id?: string | null
          notes?: string | null
          opportunity_id?: string | null
          overall_status?: string
          plan_name?: string | null
          priority?: string
          project_description?: string | null
          project_number?: number
          project_type?: string
          sdr_name?: string | null
          sdr_user_id?: string | null
          start_date?: string | null
          storage_time?: string | null
          tags?: string[] | null
          treinamento_user_id?: string | null
          updated_at?: string
          ux_po_user_id?: string | null
          verificacao_bm_user_id?: string | null
          version?: string | null
          website?: string | null
        }
        Update: {
          account_id?: string | null
          activation_phone?: string | null
          api_type?: string | null
          archived?: boolean
          ativacao_user_id?: string | null
          broker?: string | null
          checklist_data?: Json | null
          closer_name?: string | null
          closer_user_id?: string | null
          cnpj?: string | null
          coexistence_quantity?: number | null
          company_name?: string
          complexity_level?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by_user_id?: string | null
          current_phase?: string | null
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deleted_from_status?: string | null
          delivered_at?: string | null
          dev_user_id?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          extra_storage?: string | null
          figma_url?: string | null
          go_live_user_id?: string | null
          has_ai?: boolean | null
          has_coexistence?: boolean | null
          has_integration?: boolean | null
          head_user_id?: string | null
          id?: string
          integrations_description?: string | null
          lead_id?: string | null
          notes?: string | null
          opportunity_id?: string | null
          overall_status?: string
          plan_name?: string | null
          priority?: string
          project_description?: string | null
          project_number?: number
          project_type?: string
          sdr_name?: string | null
          sdr_user_id?: string | null
          start_date?: string | null
          storage_time?: string | null
          tags?: string[] | null
          treinamento_user_id?: string | null
          updated_at?: string
          ux_po_user_id?: string | null
          verificacao_bm_user_id?: string | null
          version?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_ativacao_user_id_fkey"
            columns: ["ativacao_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_closer_user_id_fkey"
            columns: ["closer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_dev_user_id_fkey"
            columns: ["dev_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_go_live_user_id_fkey"
            columns: ["go_live_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_head_user_id_fkey"
            columns: ["head_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_sdr_user_id_fkey"
            columns: ["sdr_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_treinamento_user_id_fkey"
            columns: ["treinamento_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_ux_po_user_id_fkey"
            columns: ["ux_po_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_verificacao_bm_user_id_fkey"
            columns: ["verificacao_bm_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_views: {
        Row: {
          id: string
          ip_address: string | null
          proposal_id: string
          user_agent: string | null
          viewed_at: string
        }
        Insert: {
          id?: string
          ip_address?: string | null
          proposal_id: string
          user_agent?: string | null
          viewed_at?: string
        }
        Update: {
          id?: string
          ip_address?: string | null
          proposal_id?: string
          user_agent?: string | null
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_views_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          applied_excess_cost: number | null
          cancellation_fee_percent: number
          closer_name: string | null
          cnpj: string | null
          company_name: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contract_months: number
          created_at: string
          created_by_user_id: string
          estimated_contacts: number
          estimated_messages: number
          excess_contact_cost: number | null
          excess_contacts: number | null
          excess_message_cost: number | null
          excess_messages: number | null
          id: string
          integrations: Json
          meta_cost: number
          meta_cost_config: Json | null
          notes: string | null
          opportunity_id: string | null
          plan_contacts_included: number | null
          plan_excess_contact_price: number | null
          plan_excess_message_price: number | null
          plan_messages_included: number | null
          plan_name: string
          plan_price: number
          product_type: string
          project_objective: string | null
          razao_social: string | null
          sdr_name: string | null
          setup_installments: number
          setup_payment_method: string
          setup_total: number
          show_meta_costs: boolean
          status: string
          total_monthly: number
          updated_at: string
          validity_days: number
          view_count: number
        }
        Insert: {
          applied_excess_cost?: number | null
          cancellation_fee_percent?: number
          closer_name?: string | null
          cnpj?: string | null
          company_name?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contract_months?: number
          created_at?: string
          created_by_user_id: string
          estimated_contacts?: number
          estimated_messages?: number
          excess_contact_cost?: number | null
          excess_contacts?: number | null
          excess_message_cost?: number | null
          excess_messages?: number | null
          id?: string
          integrations?: Json
          meta_cost?: number
          meta_cost_config?: Json | null
          notes?: string | null
          opportunity_id?: string | null
          plan_contacts_included?: number | null
          plan_excess_contact_price?: number | null
          plan_excess_message_price?: number | null
          plan_messages_included?: number | null
          plan_name?: string
          plan_price?: number
          product_type?: string
          project_objective?: string | null
          razao_social?: string | null
          sdr_name?: string | null
          setup_installments?: number
          setup_payment_method?: string
          setup_total?: number
          show_meta_costs?: boolean
          status?: string
          total_monthly?: number
          updated_at?: string
          validity_days?: number
          view_count?: number
        }
        Update: {
          applied_excess_cost?: number | null
          cancellation_fee_percent?: number
          closer_name?: string | null
          cnpj?: string | null
          company_name?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contract_months?: number
          created_at?: string
          created_by_user_id?: string
          estimated_contacts?: number
          estimated_messages?: number
          excess_contact_cost?: number | null
          excess_contacts?: number | null
          excess_message_cost?: number | null
          excess_messages?: number | null
          id?: string
          integrations?: Json
          meta_cost?: number
          meta_cost_config?: Json | null
          notes?: string | null
          opportunity_id?: string | null
          plan_contacts_included?: number | null
          plan_excess_contact_price?: number | null
          plan_excess_message_price?: number | null
          plan_messages_included?: number | null
          plan_name?: string
          plan_price?: number
          product_type?: string
          project_objective?: string | null
          razao_social?: string | null
          sdr_name?: string | null
          setup_installments?: number
          setup_payment_method?: string
          setup_total?: number
          show_meta_costs?: boolean
          status?: string
          total_monthly?: number
          updated_at?: string
          validity_days?: number
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposals_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string
          id: string
          is_default: boolean
          is_system: boolean
          name: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          is_default?: boolean
          is_system?: boolean
          name: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_default?: boolean
          is_system?: boolean
          name?: string
        }
        Relationships: []
      }
      sdr_performance_snapshots: {
        Row: {
          avg_response_time_hours: number | null
          created_at: string
          id: string
          leads_lost_without_min_attempts: number | null
          leads_promoted_to_sqo: number | null
          leads_stalled_count: number | null
          period_date: string
          total_interactions: number | null
          total_leads: number | null
          user_id: string
        }
        Insert: {
          avg_response_time_hours?: number | null
          created_at?: string
          id?: string
          leads_lost_without_min_attempts?: number | null
          leads_promoted_to_sqo?: number | null
          leads_stalled_count?: number | null
          period_date?: string
          total_interactions?: number | null
          total_leads?: number | null
          user_id: string
        }
        Update: {
          avg_response_time_hours?: number | null
          created_at?: string
          id?: string
          leads_lost_without_min_attempts?: number | null
          leads_promoted_to_sqo?: number | null
          leads_stalled_count?: number | null
          period_date?: string
          total_interactions?: number | null
          total_leads?: number | null
          user_id?: string
        }
        Relationships: []
      }
      sent_emails: {
        Row: {
          body: string
          created_at: string
          gmail_message_id: string | null
          id: string
          lead_id: string
          status: string
          subject: string
          template_id: string | null
          to_email: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          gmail_message_id?: string | null
          id?: string
          lead_id: string
          status?: string
          subject: string
          template_id?: string | null
          to_email: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          gmail_message_id?: string | null
          id?: string
          lead_id?: string
          status?: string
          subject?: string
          template_id?: string | null
          to_email?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sent_emails_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sent_emails_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      system_config: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      team_capacity: {
        Row: {
          capacity_hours: number
          created_at: string
          headcount: number
          id: string
          month: string
          team_id: string
          updated_at: string
        }
        Insert: {
          capacity_hours?: number
          created_at?: string
          headcount?: number
          id?: string
          month: string
          team_id: string
          updated_at?: string
        }
        Update: {
          capacity_hours?: number
          created_at?: string
          headcount?: number
          id?: string
          month?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_capacity_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string | null
          id: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_phase_map: {
        Row: {
          created_at: string
          id: string
          phase_name: string
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          phase_name: string
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          phase_name?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_phase_map_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      transcription_vocabulary: {
        Row: {
          created_at: string
          from_text: string
          id: string
          is_active: boolean
          is_regex: boolean
          notes: string | null
          priority: number
          to_text: string
        }
        Insert: {
          created_at?: string
          from_text: string
          id?: string
          is_active?: boolean
          is_regex?: boolean
          notes?: string | null
          priority?: number
          to_text: string
        }
        Update: {
          created_at?: string
          from_text?: string
          id?: string
          is_active?: boolean
          is_regex?: boolean
          notes?: string | null
          priority?: number
          to_text?: string
        }
        Relationships: []
      }
      user_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          ramal: string | null
          role: Database["public"]["Enums"]["app_role"]
          role_id: string | null
          team_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          ramal?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          role_id?: string | null
          team_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          ramal?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          role_id?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_invitations_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invitations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          role_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          role_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          role_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_groups: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          phone_or_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          phone_or_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          phone_or_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { _invitation_id: string }; Returns: boolean }
      bulk_delete_leads: { Args: { lead_ids: string[] }; Returns: number }
      check_cnpj_duplicate: {
        Args: { p_cnpj: string; p_exclude_lead_id?: string }
        Returns: Json
      }
      check_cnpj_duplicate_v2: {
        Args: { p_cnpj: string; p_exclude_lead_id?: string }
        Returns: Json
      }
      get_closer_activity_breakdown: {
        Args: { p_range_end?: string; p_range_start?: string }
        Returns: {
          activities: number
          calls: number
          closer_id: string
          closer_name: string
          emails: number
          meetings: number
          opportunities_worked: number
          proposals: number
          stage_changes: number
        }[]
      }
      get_closer_activity_metrics: {
        Args: {
          p_closer_id?: string
          p_range_end?: string
          p_range_start?: string
        }
        Returns: Json
      }
      get_closer_breakdown_detail: {
        Args: {
          p_closer_id: string
          p_end: string
          p_metric: string
          p_start: string
        }
        Returns: {
          company: string
          contact_name: string
          detail: string
          event_date: string
          id: string
          lead_id: string
          opportunity_id: string
        }[]
      }
      get_closer_performance_breakdown: {
        Args: { p_range_end?: string; p_range_start?: string }
        Returns: {
          avg_cycle_days: number
          closer_id: string
          closer_name: string
          lost: number
          opportunities: number
          rate: number
          revenue: number
          won: number
        }[]
      }
      get_closer_ranking: {
        Args: never
        Returns: {
          closer_id: string
          closer_name: string
          mrr_revenue: number
          setup_revenue: number
          total_count: number
          won_count: number
        }[]
      }
      get_closer_report_metrics: {
        Args: {
          p_closer_id?: string
          p_range_end?: string
          p_range_start?: string
        }
        Returns: Json
      }
      get_closer_team_totals: { Args: never; Returns: Json }
      get_filtered_lead_ids: {
        Args: {
          p_limit?: number
          p_sdr_id?: string
          p_search?: string
          p_statuses?: string[]
          p_tab?: string
        }
        Returns: string[]
      }
      get_filtered_opportunity_ids:
        | {
            Args: {
              p_closer_id?: string
              p_limit?: number
              p_meeting_from?: string
              p_meeting_to?: string
              p_search?: string
              p_stages?: string[]
              p_tab?: string
              p_won_from?: string
              p_won_to?: string
            }
            Returns: string[]
          }
        | {
            Args: {
              p_closer_id?: string
              p_limit?: number
              p_meeting_from?: string
              p_meeting_to?: string
              p_opportunity_type?: string
              p_search?: string
              p_stages?: string[]
              p_tab?: string
              p_won_from?: string
              p_won_to?: string
            }
            Returns: string[]
          }
      get_lead_by_id: { Args: { p_lead_id: string }; Returns: Json }
      get_lead_tab_counts: { Args: { p_sdr_id?: string }; Returns: Json }
      get_least_loaded_users: { Args: never; Returns: Json }
      get_opportunity_tab_counts:
        | { Args: { p_closer_id?: string }; Returns: Json }
        | {
            Args: { p_closer_id?: string; p_opportunity_type?: string }
            Returns: Json
          }
      get_sdr_alert_counts: { Args: { p_sdr_id?: string }; Returns: Json }
      get_sdr_execution_stats: {
        Args: {
          p_month_start: string
          p_period_start: string
          p_user_ids: string[]
        }
        Returns: Json
      }
      get_sdr_stats_comparison: {
        Args: {
          p_current_end: string
          p_current_start: string
          p_previous_end: string
          p_previous_start: string
          p_user_ids: string[]
        }
        Returns: Json
      }
      get_sdr_team_totals: { Args: never; Returns: Json }
      get_system_config: { Args: { config_key: string }; Returns: string }
      get_user_permissions: { Args: { _user_id: string }; Returns: string[] }
      has_permission: {
        Args: { _perm_name: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      immutable_unaccent: { Args: { "": string }; Returns: string }
      increment_proposal_views:
        | { Args: { proposal_id: string }; Returns: undefined }
        | {
            Args: { p_user_agent?: string; proposal_id: string }
            Returns: undefined
          }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_manager: { Args: { _user_id: string }; Returns: boolean }
      is_project_member: { Args: { _user_id: string }; Returns: boolean }
      is_sqo_approved: {
        Args: {
          p_budget: string
          p_decision_maker: string
          p_icp_fit: string
          p_pain_category: string
          p_pain_clear: boolean
          p_pain_financial_impact: boolean
          p_urgency: string
        }
        Returns: boolean
      }
      populate_holidays_for_year: {
        Args: { p_year: number }
        Returns: undefined
      }
      save_checkout_registration: {
        Args: {
          p_bairro?: string
          p_cep?: string
          p_city?: string
          p_cnpj?: string
          p_complemento?: string
          p_fin_email?: string
          p_fin_name?: string
          p_fin_phone?: string
          p_logradouro?: string
          p_nome_fantasia?: string
          p_numero?: string
          p_proposal_id: string
          p_razao_social?: string
          p_rep_cpf?: string
          p_rep_email?: string
          p_rep_name?: string
          p_rep_phone?: string
          p_rep_role?: string
          p_state?: string
        }
        Returns: boolean
      }
      search_accounts_for_deal: {
        Args: { result_limit?: number; search_term: string }
        Returns: {
          account_owner_id: string
          account_owner_name: string
          ai_enrichment_data: Json
          capital_social: number
          cep: string
          city: string
          cnae_fiscal: number
          cnae_fiscal_descricao: string
          cnaes_secundarios: string
          cnpj: string
          company_name: string
          company_segment: string
          contact_name: string
          created_at: string
          data_inicio_atividade: string
          email: string
          employee_count: string
          id: string
          lifecycle_stage: string
          nome_fantasia: string
          notes: string
          phone: string
          porte: string
          razao_social: string
          revenue_range: string
          situacao_cadastral: string
          state: string
          status: string
          website: string
        }[]
      }
      search_all_leads_global: {
        Args: { p_limit?: number; p_search: string }
        Returns: {
          lead_cnpj: string
          lead_company: string
          lead_email: string
          lead_id: string
          lead_name: string
          lead_status: string
          opp_stage: string
          opportunity_id: string
          owner_name: string
          pipeline_label: string
        }[]
      }
      search_leads_by_status: {
        Args: {
          p_page?: number
          p_page_size?: number
          p_sdr_id?: string
          p_search?: string
          p_sort?: string
          p_status: string
        }
        Returns: Json
      }
      search_leads_paginated: {
        Args: {
          p_page?: number
          p_page_size?: number
          p_sdr_id?: string
          p_search?: string
          p_statuses?: string[]
          p_tab: string
        }
        Returns: Json
      }
      search_opportunities_kanban: {
        Args: {
          p_closer_id?: string
          p_meeting_from?: string
          p_meeting_to?: string
          p_opportunity_type?: string
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_sort?: string
          p_stage: string
          p_won_from?: string
          p_won_to?: string
        }
        Returns: Json
      }
      search_opportunities_paginated:
        | {
            Args: {
              p_closer_id?: string
              p_meeting_from?: string
              p_meeting_to?: string
              p_page?: number
              p_page_size?: number
              p_search?: string
              p_stages?: string[]
              p_tab?: string
              p_won_from?: string
              p_won_to?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_closer_id?: string
              p_meeting_from?: string
              p_meeting_to?: string
              p_opportunity_type?: string
              p_page?: number
              p_page_size?: number
              p_search?: string
              p_sort_column?: string
              p_sort_direction?: string
              p_stages?: string[]
              p_tab?: string
              p_won_from?: string
              p_won_to?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_closer_id?: string
              p_meeting_from?: string
              p_meeting_to?: string
              p_opportunity_type?: string
              p_page?: number
              p_page_size?: number
              p_search?: string
              p_stages?: string[]
              p_tab: string
              p_won_from?: string
              p_won_to?: string
            }
            Returns: Json
          }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      sync_lead_next_action_from_tasks: {
        Args: { p_lead_id: string }
        Returns: undefined
      }
      transfer_lead_owner: {
        Args: { p_lead_id: string; p_new_owner_id: string }
        Returns: boolean
      }
      transfer_opportunity_owner: {
        Args: { p_new_owner_id: string; p_opportunity_id: string }
        Returns: boolean
      }
      unaccent: { Args: { "": string }; Returns: string }
      update_proposal_status: {
        Args: { p_proposal_id: string; p_status: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "moderator"
        | "sdr"
        | "manager"
        | "closer"
        | "head_pos_venda"
        | "ux_po"
        | "dev_chatbot"
        | "treinamento"
        | "suporte"
        | "verificacao_bm"
        | "viewer"
      channel_type: "whatsapp" | "call" | "email" | "other"
      enrollment_status: "active" | "completed" | "replied" | "unsubscribed"
      interaction_outcome:
        | "sem_resposta"
        | "respondeu"
        | "qualificado"
        | "reagendado"
        | "descartado"
      lead_status:
        | "Novo"
        | "Em contato"
        | "Reagendar Reunião"
        | "Interesse"
        | "Interesse/Agendar Retorno"
        | "Oportunidade criada"
        | "Descartado"
        | "Não atendeu"
        | "Ocupado"
        | "Agendar retorno"
        | "Sem retorno"
        | "Reciclagem"
        | "Devolvido pelo Closer"
        | "Reunião agendada"
        | "Lead Quente"
        | "Reunião Agendada"
        | "Agendar Retorno"
        | "Reunião Confirmada"
        | "Oportunidade Futura"
      lead_type: "INBOUND" | "OUTBOUND" | "INDICACAO"
      user_role: "sdr" | "manager" | "admin" | "closer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "moderator",
        "sdr",
        "manager",
        "closer",
        "head_pos_venda",
        "ux_po",
        "dev_chatbot",
        "treinamento",
        "suporte",
        "verificacao_bm",
        "viewer",
      ],
      channel_type: ["whatsapp", "call", "email", "other"],
      enrollment_status: ["active", "completed", "replied", "unsubscribed"],
      interaction_outcome: [
        "sem_resposta",
        "respondeu",
        "qualificado",
        "reagendado",
        "descartado",
      ],
      lead_status: [
        "Novo",
        "Em contato",
        "Reagendar Reunião",
        "Interesse",
        "Interesse/Agendar Retorno",
        "Oportunidade criada",
        "Descartado",
        "Não atendeu",
        "Ocupado",
        "Agendar retorno",
        "Sem retorno",
        "Reciclagem",
        "Devolvido pelo Closer",
        "Reunião agendada",
        "Lead Quente",
        "Reunião Agendada",
        "Agendar Retorno",
        "Reunião Confirmada",
        "Oportunidade Futura",
      ],
      lead_type: ["INBOUND", "OUTBOUND", "INDICACAO"],
      user_role: ["sdr", "manager", "admin", "closer"],
    },
  },
} as const
