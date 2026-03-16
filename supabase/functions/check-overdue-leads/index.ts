import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    // Check leads that became overdue in the last 2 minutes for near-real-time notifications
    const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000).toISOString();
    
    const { data: overdueLeads, error: leadsError } = await supabase
      .from('leads')
      .select('id, name, company, next_action_at, owner_user_id, status')
      .lt('next_action_at', now.toISOString())
      .gt('next_action_at', twoMinutesAgo)
      .not('status', 'in', '("Descartado","Oportunidade criada")')
      .not('owner_user_id', 'is', null)
      .order('next_action_at', { ascending: false });

    if (leadsError) {
      console.error('Error fetching overdue leads:', leadsError);
      throw leadsError;
    }

    console.log(`Found ${overdueLeads?.length || 0} overdue leads`);

    if (!overdueLeads || overdueLeads.length === 0) {
      return new Response(
        JSON.stringify({ success: true, notifications_sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Group leads by owner
    const leadsByOwner = new Map<string, typeof overdueLeads>();
    for (const lead of overdueLeads) {
      if (!lead.owner_user_id) continue;
      const existing = leadsByOwner.get(lead.owner_user_id) || [];
      existing.push(lead);
      leadsByOwner.set(lead.owner_user_id, existing);
    }

    // Get profiles with notification preferences + emails
    const ownerIds = [...leadsByOwner.keys()];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, notify_overdue_push, notify_overdue_email, notify_overdue_sound')
      .in('id', ownerIds);

    // Get user emails from auth
    const { data: { users: authUsers } } = await supabase.auth.admin.listUsers();
    const emailMap = new Map<string, string>();
    for (const u of authUsers || []) {
      if (u.email) emailMap.set(u.id, u.email);
    }

    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    // Check which users already got a recent overdue notification (within last 5 min to avoid duplicates between cron runs)
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    const { data: recentNotifications } = await supabase
      .from('notifications')
      .select('user_id')
      .eq('type', 'overdue_lead')
      .gt('created_at', fiveMinAgo)
      .in('user_id', ownerIds);

    const recentlyNotifiedUsers = new Set((recentNotifications || []).map(n => n.user_id));

    const notificationsToCreate: any[] = [];
    let emailsSent = 0;

    for (const [userId, leads] of leadsByOwner) {
      try {
        const profile = profileMap.get(userId);
        if (!profile) continue;
        if (!profile.notify_overdue_push) continue;
        if (recentlyNotifiedUsers.has(userId)) continue;

        const count = leads.length;
        const firstLead = leads[0];

        const formatDateTime = (dateStr: string) => {
          const d = new Date(dateStr);
          const date = d.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            timeZone: 'America/Sao_Paulo',
          });
          const time = d.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Sao_Paulo',
          });
          return `${date} | ${time}`;
        };

        const message = count === 1
          ? `O lead "${firstLead.name}" (${firstLead.company}) tinha retorno agendado para ${formatDateTime(firstLead.next_action_at)} e está vencido.`
          : `Você tem ${count} leads com retorno vencido. O mais recente: "${firstLead.name}" (${firstLead.company}).`;

        const leadLink = count === 1
          ? `/leads?lead=${firstLead.id}`
          : '/leads?filter=overdue';

        notificationsToCreate.push({
          user_id: userId,
          title: 'Retorno vencido',
          message,
          type: 'overdue_lead',
          link: leadLink,
        });

        // Send email if user opted in
        if (profile.notify_overdue_email) {
          try {
            const userEmail = emailMap.get(userId);
            if (userEmail) {
              const appUrl = Deno.env.get('SITE_URL') || 'https://ez-journey.lovable.app';

              const topLeads = leads.slice(0, 5);
              const leadCards = topLeads.map(l => 
                buildEmailCard(`
                  <a href="${appUrl}/leads?lead=${l.id}" style="text-decoration: none; color: inherit;">
                    <div style="font-weight: 600; font-size: 14px; color: #1a1a2e; margin-bottom: 2px;">${l.company}</div>
                    <div style="font-size: 12px; color: #666; display: flex; justify-content: space-between;">
                      <span>${l.name}</span>
                      <span style="color: #e53e3e; font-weight: 500;">⏰ ${formatDateTime(l.next_action_at)}</span>
                    </div>
                  </a>
                `)
              ).join('');
              const moreText = count > 5 
                ? `<p style="text-align: center; color: #888; font-size: 13px; margin-top: 4px;">...e mais <strong>${count - 5}</strong> lead${count - 5 > 1 ? 's' : ''} vencido${count - 5 > 1 ? 's' : ''}</p>` 
                : '';

              const bodyHtml = `
                <p style="color: #333; font-size: 15px; margin-top: 0;">Olá <strong>${profile.name}</strong>,</p>
                <p style="color: #555; font-size: 14px; line-height: 1.6;">
                  Você tem <span style="background: #fee2e2; color: #dc2626; padding: 2px 8px; border-radius: 4px; font-weight: 600;">${count} lead${count > 1 ? 's' : ''}</span> com retorno vencido. Clique para acessar:
                </p>
                <div style="margin: 20px 0;">${leadCards}</div>
                ${moreText}
                ${buildEmailButton('Ver todos os leads vencidos', `${appUrl}/leads?filter=overdue`)}
              `;

              await sendNotificationEmail({
                to: userEmail,
                subject: `⏰ Retorno vencido — ${count} lead${count > 1 ? 's' : ''} aguardando ação`,
                bodyHtml,
                headerTitle: 'Retorno Vencido',
              });
              emailsSent++;
            }
          } catch (emailErr) {
            console.error(`Email send failed for user ${userId}:`, emailErr);
          }
        }
      } catch (userErr) {
        console.error(`Error processing overdue notifications for user ${userId}:`, userErr);
      }
    }

    if (notificationsToCreate.length > 0) {
      const { error: notifError } = await supabase
        .from('notifications')
        .insert(notificationsToCreate);

      if (notifError) {
        console.error('Error creating notifications:', notifError);
      }
    }

    console.log(`Sent ${notificationsToCreate.length} overdue notifications, ${emailsSent} emails`);

    return new Response(
      JSON.stringify({ success: true, notifications_sent: notificationsToCreate.length, emails_sent: emailsSent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in check-overdue-leads:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
