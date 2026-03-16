import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub;

    const { job_id } = await req.json();
    if (!job_id) {
      return new Response(JSON.stringify({ error: 'job_id required' }), { status: 400, headers: corsHeaders });
    }

    // Fetch job
    const { data: job, error: jobError } = await supabase
      .from('bulk_reassign_jobs')
      .select('*')
      .eq('id', job_id)
      .single();

    if (jobError || !job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), { status: 404, headers: corsHeaders });
    }

    if (job.status !== 'pending') {
      return new Response(JSON.stringify({ error: 'Job already processed', status: job.status }), { status: 400, headers: corsHeaders });
    }

    // Mark as running
    await supabase.from('bulk_reassign_jobs').update({ status: 'running', updated_at: new Date().toISOString() }).eq('id', job_id);

    const module = job.module as string;
    const entityIds = job.entity_ids as string[];
    const distributionMode = job.distribution_mode as string;
    const targetUserId = job.target_user_id as string;
    const targetUserIds = (job.target_user_ids as string[]) || [];
    const total = entityIds.length;

    let targetUsers: string[] = [];

    if (distributionMode === 'specific') {
      targetUsers = [targetUserId];
    } else if (distributionMode === 'auto_all') {
      // Fetch all active SDRs/Closers
      const roles = module === 'closer' ? ['closer', 'admin', 'manager'] : ['sdr', 'admin', 'manager'];
      const { data: roleRows } = await supabase.from('user_roles').select('user_id').in('role', roles);
      if (roleRows && roleRows.length > 0) {
        const uids = [...new Set(roleRows.map((r: any) => r.user_id))];
        const { data: profiles } = await supabase.from('profiles').select('id').in('id', uids).eq('active', true);
        targetUsers = profiles?.map((p: any) => p.id) || [];
      }
    } else if (distributionMode === 'auto_selected') {
      targetUsers = targetUserIds;
    }

    if (targetUsers.length === 0) {
      await supabase.from('bulk_reassign_jobs').update({
        status: 'error',
        error_message: 'Nenhum usuário alvo encontrado',
        updated_at: new Date().toISOString(),
      }).eq('id', job_id);
      return new Response(JSON.stringify({ error: 'No target users' }), { status: 400, headers: corsHeaders });
    }

    const tableName = module === 'closer' ? 'opportunities' : 'leads';
    const ownerColumn = module === 'closer' ? 'assigned_to_user_id' : 'owner_user_id';
    const BATCH = 50;
    let processed = 0;
    let success = 0;
    let errors = 0;

    for (let i = 0; i < total; i += BATCH) {
      const batch = entityIds.slice(i, i + BATCH);

      if (distributionMode === 'specific') {
        // All go to same user
        const { error } = await supabase
          .from(tableName)
          .update({ [ownerColumn]: targetUserId } as any)
          .in('id', batch);

        if (error) {
          errors += batch.length;
          console.error('Batch error:', error.message);
        } else {
          success += batch.length;
        }
      } else {
        // Round-robin distribution
        const grouped = new Map<string, string[]>();
        for (let j = 0; j < batch.length; j++) {
          const uid = targetUsers[(i + j) % targetUsers.length];
          if (!grouped.has(uid)) grouped.set(uid, []);
          grouped.get(uid)!.push(batch[j]);
        }

        for (const [uid, ids] of grouped) {
          const { error } = await supabase
            .from(tableName)
            .update({ [ownerColumn]: uid } as any)
            .in('id', ids);

          if (error) {
            errors += ids.length;
            console.error('Batch error:', error.message);
          } else {
            success += ids.length;
          }
        }
      }

      processed += batch.length;

      // Update progress
      await supabase.from('bulk_reassign_jobs').update({
        processed_count: processed,
        success_count: success,
        error_count: errors,
        updated_at: new Date().toISOString(),
      }).eq('id', job_id);
    }

    // Mark completed
    await supabase.from('bulk_reassign_jobs').update({
      status: 'completed',
      processed_count: processed,
      success_count: success,
      error_count: errors,
      updated_at: new Date().toISOString(),
    }).eq('id', job_id);

    return new Response(
      JSON.stringify({ success: true, processed, success_count: success, error_count: errors }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in bulk-reassign:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
