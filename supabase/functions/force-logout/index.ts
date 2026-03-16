import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Verify caller identity
    const { data: { user: caller }, error: callerError } = await adminClient.auth.getUser(token)
    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Check caller is admin
    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .eq('role', 'admin')
      .maybeSingle()

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { user_id } = await req.json()
    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Ban briefly to invalidate all sessions, then unban
    const { error: banError } = await adminClient.auth.admin.updateUserById(user_id, { ban_duration: '1s' })
    if (banError) {
      console.error('Ban error:', banError)
      return new Response(JSON.stringify({ error: banError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Wait a moment to ensure ban takes effect
    await new Promise(resolve => setTimeout(resolve, 1500))

    // Unban so user can log in again
    const { error: unbanError } = await adminClient.auth.admin.updateUserById(user_id, { ban_duration: 'none' })
    if (unbanError) {
      console.error('Unban error:', unbanError)
      // Try again
      await adminClient.auth.admin.updateUserById(user_id, { ban_duration: 'none' })
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('Error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})