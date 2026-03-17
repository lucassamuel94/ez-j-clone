import { createClient } from 'npm:@supabase/supabase-js@2'
import * as XLSX from 'npm:xlsx@0.18.5'

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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { job_id } = await req.json()
    if (!job_id) {
      return new Response(JSON.stringify({ error: 'job_id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: job, error: jobError } = await adminClient
      .from('import_jobs')
      .select('*')
      .eq('id', job_id)
      .single()

    if (jobError || !job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (job.status === 'completed') {
      return new Response(JSON.stringify({ 
        success: true,
        processed: job.processed_rows,
        successCount: job.success_count,
        errorCount: job.error_count,
        duplicateCount: job.duplicate_count,
        errors: [],
        duplicates: [],
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (job.status !== 'pending') {
      return new Response(JSON.stringify({ error: 'Job already processing' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    await adminClient.from('import_jobs').update({ status: 'processing' }).eq('id', job_id)

    const { data: fileData, error: downloadError } = await adminClient.storage
      .from('imports')
      .download(job.storage_path)

    if (downloadError || !fileData) {
      await adminClient.from('import_jobs').update({ status: 'failed', error_message: 'Failed to download file' }).eq('id', job_id)
      return new Response(JSON.stringify({ error: 'Failed to download file' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const arrayBuffer = await fileData.arrayBuffer()
    const workbook = XLSX.read(new Uint8Array(arrayBuffer))
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: null })

    if (rows.length === 0) {
      await adminClient.from('import_jobs').update({ status: 'failed', error_message: 'Empty file' }).eq('id', job_id)
      return new Response(JSON.stringify({ error: 'Empty file' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    await adminClient.from('import_jobs').update({ total_rows: rows.length }).eq('id', job_id)

    const mappings = job.mappings as Array<{ fileColumn: string; dbColumn: string }>
    const allocationType = job.allocation_type
    const selectedSdrId = job.selected_sdr_id
    const importStatus = job.import_status
    const importerUserId = job.user_id
    const statusMappings = (job.status_mappings || null) as Record<string, string> | null

    const { data: profiles } = await adminClient
      .from('profiles')
      .select('id, name, role, active')
      .eq('active', true)
      .order('name')

    const activeSdrs = profiles || []
    let sdrIndex = 0

    // --- PRE-FETCH existing ClickUp IDs for bulk dedup ---
    const existingClickupIds = new Set<string>()

    let from = 0
    const PAGE = 1000
    while (true) {
      const { data } = await adminClient.from('leads').select('clickup_id').not('clickup_id', 'is', null).range(from, from + PAGE - 1)
      if (!data || data.length === 0) break
      data.forEach((r: any) => { if (r.clickup_id) existingClickupIds.add(String(r.clickup_id).trim()) })
      if (data.length < PAGE) break
      from += PAGE
    }

    // Also track ClickUp IDs within this import to detect intra-file duplicates
    const importClickupIds = new Set<string>()

    let successCount = 0
    let errorCount = 0
    let duplicateCount = 0
    const errors: Array<{ row_number: number; name: string; email?: string; cnpj?: string; reason: string }> = []
    const duplicates: Array<{ row_number: number; name: string; email?: string; cnpj?: string }> = []

    // --- PREPARE all leads first (no DB calls per row) ---
    const isCloserAllocation = allocationType === 'specific_closer' || allocationType === 'distribute_closers'

    interface PreparedLead {
      rowIndex: number
      lead: Record<string, unknown>
      observationNote: string
      ownerId: string | null
      isDuplicate: boolean
      closerId: string | null
      opportunityStage: string | null
    }

    const preparedLeads: PreparedLead[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as Record<string, unknown>

      try {
        let ownerId: string | null = null
        const ownerNameMapping = mappings.find(m => m.dbColumn === 'owner_name')
        const ownerNameFromFile = ownerNameMapping ? String(row[ownerNameMapping.fileColumn] || '').trim() : ''

        if (ownerNameFromFile) {
          const matched = activeSdrs.find(s => s.name.toLowerCase() === ownerNameFromFile.toLowerCase())
          if (matched) ownerId = matched.id
        }

        if (!ownerId) {
          if (allocationType === 'importer') {
            ownerId = importerUserId
          } else if (allocationType === 'specific' || allocationType === 'specific_closer') {
            ownerId = selectedSdrId
          } else if (allocationType === 'distribute' && activeSdrs.length > 0) {
            const sdrs = activeSdrs.filter(s => s.role === 'sdr')
            if (sdrs.length > 0) {
              ownerId = sdrs[sdrIndex % sdrs.length].id
              sdrIndex++
            }
          } else if (allocationType === 'distribute_closers' && activeSdrs.length > 0) {
            const closers = activeSdrs.filter(s => s.role === 'closer')
            if (closers.length > 0) {
              ownerId = closers[sdrIndex % closers.length].id
              sdrIndex++
            }
          }
        }

        const lead: Record<string, unknown> = {
          lead_type: 'OUTBOUND',
          status: importStatus,
          priority_score: 50,
          attempts_count: 0,
          next_action_at: new Date().toISOString(),
          source: 'Importação Mailing',
          owner_user_id: ownerId,
        }

        let observationNote = ''
        let statusFromFile: string | null = null
        let closerId: string | null = null
        mappings.forEach(({ fileColumn, dbColumn }) => {
          if (dbColumn === 'observation_note') {
            observationNote = String(row[fileColumn] || '').trim()
          } else if (dbColumn === 'status_column') {
            statusFromFile = row[fileColumn] != null ? String(row[fileColumn]).trim() : null
          } else if (dbColumn === 'closer_name') {
            const closerNameFromFile = String(row[fileColumn] || '').trim()
            if (closerNameFromFile) {
              const matchedCloser = activeSdrs.find(s => s.role === 'closer' && s.name.toLowerCase() === closerNameFromFile.toLowerCase())
              if (matchedCloser) {
                closerId = matchedCloser.id
              }
            }
          } else if (dbColumn !== 'skip' && dbColumn !== 'owner_name' && row[fileColumn] != null) {
            const val = String(row[fileColumn]).trim()
            if (dbColumn === 'last_contact_at') {
              if (val) {
                let parsedDate: Date | null = null
                // Check if it's an Excel serial date number (typically 1-80000 range)
                const numVal = Number(val)
                if (!isNaN(numVal) && numVal > 0 && numVal < 100000 && !val.includes('-') && !val.includes('/')) {
                  // Excel serial date: days since 1899-12-30
                  const excelEpoch = new Date(1899, 11, 30)
                  parsedDate = new Date(excelEpoch.getTime() + numVal * 86400000)
                } else {
                  // Try standard date parsing
                  const parsed = new Date(val)
                  if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 1900 && parsed.getFullYear() <= 2100) {
                    parsedDate = parsed
                  }
                }
                if (parsedDate) {
                  lead[dbColumn] = parsedDate.toISOString()
                }
                // If no valid date could be parsed, skip the field silently
              }
            } else {
              lead[dbColumn] = val
            }
          }
        })

        // For closer allocations, status mappings are opportunity stages, not lead statuses
        let opportunityStage: string | null = null
        if (isCloserAllocation) {
          // Lead always gets 'Oportunidade criada' status for closer imports
          lead.status = 'Oportunidade criada'
          if (statusFromFile && statusMappings && statusMappings[statusFromFile]) {
            opportunityStage = statusMappings[statusFromFile]
          } else {
            opportunityStage = importStatus // Use the default import status as stage
          }
        } else {
          // For SDR allocations, apply status mapping normally
          if (statusFromFile && statusMappings && statusMappings[statusFromFile]) {
            lead.status = statusMappings[statusFromFile]
          }
        }

        if (!lead.name) lead.name = lead.razao_social || lead.nome_fantasia || 'Lead Importado'
        if (!lead.company) lead.company = lead.razao_social || lead.nome_fantasia || 'Empresa não informada'

        // Sanitize CNPJ
        if (lead.cnpj) {
          const cnpjClean = String(lead.cnpj).replace(/\D/g, '').trim()
          if (!cnpjClean || cnpjClean === '0' || cnpjClean.length < 5) {
            lead.cnpj = null
          } else {
            lead.cnpj = cnpjClean
          }
        }

        // Check duplicates using ClickUp ID only (unique identifier)
        let isDuplicate = false

        if (lead.clickup_id) {
          const cid = String(lead.clickup_id).trim()
          if (existingClickupIds.has(cid) || importClickupIds.has(cid)) {
            isDuplicate = true
          } else {
            importClickupIds.add(cid)
          }
        }

        if (isDuplicate) {
          duplicateCount++
          duplicates.push({
            row_number: i + 1,
            name: String(lead.name || ''),
            email: lead.email ? String(lead.email) : undefined,
            cnpj: lead.cnpj ? String(lead.cnpj) : undefined,
          })
        }

        preparedLeads.push({ rowIndex: i, lead, observationNote, ownerId, isDuplicate, closerId, opportunityStage })
      } catch (err) {
        errorCount++
        errors.push({
          row_number: i + 1,
          name: String(row.name || row.razao_social || 'Desconhecido'),
          email: row.email ? String(row.email) : undefined,
          cnpj: row.cnpj ? String(row.cnpj) : undefined,
          reason: err instanceof Error ? err.message : 'Erro desconhecido',
        })
      }
    }

    // --- BATCH INSERT non-duplicate leads ---
    const leadsToInsert = preparedLeads.filter(p => !p.isDuplicate)
    const BATCH_SIZE = 500
    const PROGRESS_INTERVAL = 5 // Update progress every N batches

    for (let b = 0; b < leadsToInsert.length; b += BATCH_SIZE) {
      const batch = leadsToInsert.slice(b, b + BATCH_SIZE)
      const batchData = batch.map(p => p.lead)

      try {
        const { data: insertedLeads, error } = await adminClient
          .from('leads')
          .insert(batchData)
          .select('id')

        if (error) {
          console.error('Batch insert error:', error)
          // Fallback: smaller sub-batches of 100 instead of one-by-one
          const SUB_BATCH = 100
          for (let sb = 0; sb < batch.length; sb += SUB_BATCH) {
            const subBatch = batch.slice(sb, sb + SUB_BATCH)
            const { data: subInserted, error: subError } = await adminClient
              .from('leads')
              .insert(subBatch.map(p => p.lead))
              .select('id')

            if (subError) {
              // Last resort: one-by-one for this sub-batch
              for (const item of subBatch) {
                const { data: singleLead, error: singleError } = await adminClient
                  .from('leads')
                  .insert(item.lead)
                  .select('id')
                  .single()

                if (singleError) {
                  errorCount++
                  errors.push({
                    row_number: item.rowIndex + 1,
                    name: String(item.lead.name || ''),
                    email: item.lead.email ? String(item.lead.email) : undefined,
                    cnpj: item.lead.cnpj ? String(item.lead.cnpj) : undefined,
                    reason: singleError.message || 'Erro ao inserir lead',
                  })
                } else if (singleLead) {
                  successCount++
                  if (item.observationNote) {
                    await adminClient.from('lead_notes').insert({
                      lead_id: singleLead.id,
                      user_id: item.ownerId || importerUserId,
                      note: `[Importação Mailing] ${item.observationNote}`,
                    })
                  }
                  if (isCloserAllocation && item.opportunityStage) {
                    await adminClient.from('opportunities').insert({
                      lead_id: singleLead.id,
                      created_by_user_id: importerUserId,
                      assigned_to_user_id: item.closerId || item.ownerId || importerUserId,
                      sdr_user_id: importerUserId,
                      stage: item.opportunityStage,
                    })
                  }
                }
              }
            } else {
              successCount += (subInserted?.length || subBatch.length)
              if (subInserted) {
                const notesBatch: Array<{ lead_id: string; user_id: string; note: string }> = []
                const opportunitiesBatch: Array<{ lead_id: string; created_by_user_id: string; assigned_to_user_id: string; sdr_user_id: string; stage: string }> = []
                for (let j = 0; j < subBatch.length; j++) {
                  if (subInserted[j]) {
                    if (subBatch[j].observationNote) {
                      notesBatch.push({ lead_id: subInserted[j].id, user_id: subBatch[j].ownerId || importerUserId, note: `[Importação Mailing] ${subBatch[j].observationNote}` })
                    }
                    if (isCloserAllocation && subBatch[j].opportunityStage) {
                      opportunitiesBatch.push({ lead_id: subInserted[j].id, created_by_user_id: importerUserId, assigned_to_user_id: subBatch[j].closerId || subBatch[j].ownerId || importerUserId, sdr_user_id: importerUserId, stage: subBatch[j].opportunityStage! })
                    }
                  }
                }
                if (notesBatch.length > 0) await adminClient.from('lead_notes').insert(notesBatch)
                if (opportunitiesBatch.length > 0) await adminClient.from('opportunities').insert(opportunitiesBatch)
              }
            }
          }
        } else {
          successCount += (insertedLeads?.length || batch.length)

          // Batch insert notes and opportunities in one call each
          if (insertedLeads) {
            const notesBatch: Array<{ lead_id: string; user_id: string; note: string }> = []
            const opportunitiesBatch: Array<{ lead_id: string; created_by_user_id: string; assigned_to_user_id: string; sdr_user_id: string; stage: string }> = []
            for (let j = 0; j < batch.length; j++) {
              if (insertedLeads[j]) {
                if (batch[j].observationNote) {
                  notesBatch.push({ lead_id: insertedLeads[j].id, user_id: batch[j].ownerId || importerUserId, note: `[Importação Mailing] ${batch[j].observationNote}` })
                }
                if (isCloserAllocation && batch[j].opportunityStage) {
                  opportunitiesBatch.push({ lead_id: insertedLeads[j].id, created_by_user_id: importerUserId, assigned_to_user_id: batch[j].closerId || batch[j].ownerId || importerUserId, sdr_user_id: importerUserId, stage: batch[j].opportunityStage! })
                }
              }
            }
            // Fire notes and opportunities in parallel
            const promises: Promise<any>[] = []
            if (notesBatch.length > 0) promises.push((adminClient.from('lead_notes') as any).insert(notesBatch))
            if (opportunitiesBatch.length > 0) promises.push((adminClient.from('opportunities') as any).insert(opportunitiesBatch))
            if (promises.length > 0) await Promise.all(promises)
          }
        }
      } catch (err) {
        console.error('Batch error:', err)
        for (const item of batch) {
          errorCount++
          errors.push({
            row_number: item.rowIndex + 1,
            name: String(item.lead.name || ''),
            reason: err instanceof Error ? err.message : 'Erro desconhecido',
          })
        }
      }

      // Update progress less frequently to save time
      const batchIndex = Math.floor(b / BATCH_SIZE)
      const isLastBatch = (b + BATCH_SIZE) >= leadsToInsert.length
      if (isLastBatch || (batchIndex % PROGRESS_INTERVAL === 0)) {
        const processed = Math.min(b + BATCH_SIZE, leadsToInsert.length) + duplicateCount + errorCount
        await adminClient.from('import_jobs').update({
          processed_rows: Math.min(processed, rows.length),
          success_count: successCount,
          error_count: errorCount,
          duplicate_count: duplicateCount,
          error_details: errors.slice(0, 5000),
          duplicate_details: duplicates.slice(0, 5000),
          updated_at: new Date().toISOString(),
        }).eq('id', job_id)
      }
    }

    // If there were only duplicates/errors and no inserts, update progress
    if (leadsToInsert.length === 0) {
      await adminClient.from('import_jobs').update({
        processed_rows: rows.length,
        success_count: successCount,
        error_count: errorCount,
        duplicate_count: duplicateCount,
        error_details: errors.slice(0, 5000),
        duplicate_details: duplicates.slice(0, 5000),
        updated_at: new Date().toISOString(),
      }).eq('id', job_id)
    }

    // Mark as completed
    await adminClient.from('import_jobs').update({
      status: 'completed',
      processed_rows: rows.length,
      success_count: successCount,
      error_count: errorCount,
      duplicate_count: duplicateCount,
      error_details: errors.slice(0, 5000),
      duplicate_details: duplicates.slice(0, 5000),
      updated_at: new Date().toISOString(),
    }).eq('id', job_id)

    // Clean up file from storage
    await adminClient.storage.from('imports').remove([job.storage_path])

    return new Response(JSON.stringify({ 
      success: true,
      processed: rows.length,
      successCount,
      errorCount,
      duplicateCount,
      errors,
      duplicates,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('Error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
