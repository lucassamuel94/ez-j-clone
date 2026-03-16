import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { sendNotificationEmail, buildEmailCard, buildEmailButton } from '../_shared/email-sender.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    
    // Get all meetings not yet reminded
    const { data: meetings, error: meetingsError } = await supabase
      .from('meetings')
      .select(`
        id,
        lead_id,
        user_id,
        title,
        executive_name,
        meeting_datetime,
        reminder_minutes_before,
        meet_link,
        leads!inner(company, name)
      `)
      .eq('reminder_sent', false);

    if (meetingsError) {
      console.error('Error fetching meetings:', meetingsError);
      throw meetingsError;
    }

    console.log(`Found ${meetings?.length || 0} meetings to check`);

    // Filter meetings that should be reminded now
    const meetingsToRemind = (meetings || []).filter((meeting) => {
      const meetingTime = new Date(meeting.meeting_datetime);
      const minutesUntilMeeting = (meetingTime.getTime() - now.getTime()) / (1000 * 60);
      const reminderWindow = meeting.reminder_minutes_before || 60;
      
      // Send reminder if meeting is within the reminder window
      // Also send if it's slightly past (up to 30 min) to catch edge cases
      return minutesUntilMeeting <= reminderWindow && minutesUntilMeeting > -30;
    });

    // Get user emails from auth
    const { data: { users: authUsers } } = await supabase.auth.admin.listUsers();
    const emailMap = new Map<string, string>();
    for (const u of authUsers || []) {
      if (u.email) emailMap.set(u.id, u.email);
    }

    // Get profiles for notification preferences
    const userIds = [...new Set(meetingsToRemind.map(m => m.user_id).filter(Boolean))];
    const { data: profiles } = userIds.length > 0 
      ? await supabase.from('profiles').select('id, name, notify_overdue_email').in('id', userIds)
      : { data: [] };
    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    const notificationsToCreate: any[] = [];
    const meetingsToUpdate: string[] = [];
    let emailsSent = 0;

    for (const meeting of meetingsToRemind) {
      const meetingTime = new Date(meeting.meeting_datetime);
      const minutesUntilMeeting = (meetingTime.getTime() - now.getTime()) / (1000 * 60);
      const isPast = minutesUntilMeeting <= 0;
      
      const formattedTime = meetingTime.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo',
      });
      const formattedDate = meetingTime.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        timeZone: 'America/Sao_Paulo',
      });

      const leadData = meeting.leads as any;
      const companyName = leadData?.company || '';
      const contactName = leadData?.name || '';
      
      const reminderMinutes = meeting.reminder_minutes_before || 60;
      const reminderLabel = isPast 
        ? 'agora' 
        : reminderMinutes <= 15 ? `${Math.round(minutesUntilMeeting)} minutos`
        : reminderMinutes <= 30 ? '30 minutos' 
        : reminderMinutes <= 60 ? '1 hora' 
        : '2 horas';

      const title = isPast 
        ? 'Reunião no horario!'
        : 'Lembrete de Reunião';

      const message = isPast
        ? `Reunião "${meeting.title}" com ${companyName} era às ${formattedTime} de ${formattedDate}. Verifique o status.`
        : `Reunião "${meeting.title}" com ${companyName} em ${reminderLabel} (${formattedDate} às ${formattedTime})`;

      // Create in-app notification (triggers realtime -> sound)
      notificationsToCreate.push({
        user_id: meeting.user_id,
        title,
        message,
        type: 'reminder',
        link: `/leads?lead=${meeting.lead_id}`,
      });

      meetingsToUpdate.push(meeting.id);

      // Send email
      const profile = profileMap.get(meeting.user_id);
      const userEmail = emailMap.get(meeting.user_id);
      if (userEmail) {
        const appUrl = Deno.env.get('SITE_URL') || Deno.env.get('APP_URL') || 'https://ez-journey.lovable.app';
        const leadLink = `${appUrl}/leads?lead=${meeting.lead_id}`;
        const headerColor = isPast ? '#e53e3e' : '#5738F9';
        const headerGradient = isPast 
          ? 'linear-gradient(135deg, #e53e3e 0%, #fc5c65 100%)' 
          : 'linear-gradient(135deg, #5738F9 0%, #7c5cfc 100%)';

        const meetCardHtml = buildEmailCard(`
          <div style="font-weight: 600; font-size: 14px; color: #1a1a2e; margin-bottom: 4px;">📅 ${meeting.title}</div>
          <div style="font-size: 12px; color: #666; margin-bottom: 2px;"><strong>Empresa:</strong> ${companyName} · <strong>Contato:</strong> ${contactName}</div>
          <div style="font-size: 12px; color: #666; margin-bottom: 2px;"><strong>Executivo:</strong> ${meeting.executive_name}</div>
          <div style="font-size: 12px; color: ${isPast ? '#e53e3e' : '#5738F9'}; font-weight: 500;">⏰ ${formattedDate} | ${formattedTime}</div>
          ${meeting.meet_link ? `<div style="margin-top: 8px;"><a href="${meeting.meet_link}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); color: white; text-decoration: none; padding: 8px 16px; border-radius: 6px; font-size: 12px; font-weight: 600;">📹 Entrar na reunião (Google Meet)</a></div>` : ''}
        `);

        const bodyHtml = `
          <p style="color: #333; font-size: 15px; margin-top: 0;">Olá <strong>${profile?.name || ''}</strong>,</p>
          <p style="color: #555; font-size: 14px; line-height: 1.6;">${message}</p>
          <div style="margin: 20px 0;">${meetCardHtml}</div>
          ${buildEmailButton('Ver lead', leadLink)}
        `;

        await sendNotificationEmail({
          to: userEmail,
          subject: `${title} - ${meeting.title} (${formattedDate} ${formattedTime})`,
          bodyHtml,
          headerTitle: title,
          headerGradient,
        });
        emailsSent++;
      }
    }

    // Insert all notifications
    if (notificationsToCreate.length > 0) {
      const { error: notifError } = await supabase
        .from('notifications')
        .insert(notificationsToCreate);

      if (notifError) {
        console.error('Error creating notifications:', notifError);
      }
    }

    // Mark meetings as reminded
    if (meetingsToUpdate.length > 0) {
      const { error: updateError } = await supabase
        .from('meetings')
        .update({ reminder_sent: true })
        .in('id', meetingsToUpdate);

      if (updateError) {
        console.error('Error updating meetings:', updateError);
      }
    }

    console.log(`Sent ${notificationsToCreate.length} reminders, ${emailsSent} emails`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        reminders_sent: notificationsToCreate.length,
        emails_sent: emailsSent,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error in send-meeting-reminders:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
