import { createClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@3.25'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const LEAD_FIELD_MAP: Record<string, string> = {
  name: 'name',
  email: 'email',
  phone: 'phone',
  whatsapp: 'whatsapp',
  company: 'company',
  cnpj: 'cnpj',
  razao_social: 'razao_social',
  nome_fantasia: 'nome_fantasia',
  employee_count: 'employee_count',
  company_segment: 'company_segment',
  website: 'website',
  city: 'city',
  state: 'state',
}

// Build a Zod schema dynamically from the fields_schema config
function buildZodSchema(fieldsSchema: any[]): z.ZodObject<any> {
  const shape: Record<string, z.ZodTypeAny> = {}

  for (const field of fieldsSchema) {
    let fieldSchema: z.ZodTypeAny

    switch (field.type) {
      case 'email':
        fieldSchema = z.string().trim().email('E-mail inválido').max(255)
        break
      case 'number':
        fieldSchema = z.preprocess(
          (v) => (v === '' || v === undefined || v === null ? undefined : Number(v)),
          (() => {
            let s = z.number({ invalid_type_error: `${field.label} deve ser um número` })
            if (field.validation?.min !== undefined) s = s.min(field.validation.min, `${field.label} deve ser no mínimo ${field.validation.min}`)
            if (field.validation?.max !== undefined) s = s.max(field.validation.max, `${field.label} deve ser no máximo ${field.validation.max}`)
            return s
          })()
        )
        break
      case 'phone':
        fieldSchema = z.string().trim().max(30)
        break
      case 'url':
        fieldSchema = z.string().trim().url('URL inválida').max(500)
        break
      case 'date':
        fieldSchema = z.string().trim().max(20)
        break
      case 'checkbox':
        // Checkbox with options sends comma-separated string; single checkbox sends "true"/"false"
        if (field.options && Array.isArray(field.options) && field.options.length > 0) {
          fieldSchema = z.string().trim().max(5000)
        } else {
          fieldSchema = z.preprocess((v) => v === 'true' || v === true, z.boolean())
        }
        break
      case 'textarea':
        fieldSchema = z.string().trim().max(5000)
        break
      default:
        // text, combobox, option_list, cpf_cnpj, hidden, etc.
        fieldSchema = z.string().trim().max(500)
        break
    }

    if (field.required) {
      if (field.type === 'checkbox' && !(field.options && Array.isArray(field.options) && field.options.length > 0)) {
        // Single checkbox must be true
        fieldSchema = z.preprocess((v) => v === 'true' || v === true, z.boolean().refine(v => v === true, `${field.label} é obrigatório`))
      } else if (field.type !== 'number') {
        fieldSchema = (fieldSchema as z.ZodString).min(1, `${field.label} é obrigatório`)
      }
    } else {
      fieldSchema = fieldSchema.optional().or(z.literal(''))
    }

    // Apply regex validation if defined
    if (field.validation?.regex && field.type !== 'number' && field.type !== 'checkbox') {
      const baseSchema = fieldSchema
      fieldSchema = z.preprocess((v) => v, baseSchema.pipe(
        z.string().regex(new RegExp(field.validation.regex), field.validation.regexMessage || `${field.label} formato inválido`)
      )).optional().or(z.literal('')) as any
    }

    shape[field.id] = fieldSchema
  }

  return z.object(shape).passthrough()
}

function errorResponse(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  try {
    const body = await req.json()
    const formId = (body.form_id || '').trim()
    const source = (body.source || 'Formulário Web').trim()
    const userAgent = req.headers.get('user-agent') || null
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
    const recaptchaToken = (body['g-recaptcha-response'] || '').trim()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch form config
    let fieldsSchema: any[] | null = null
    let webhookUrls: string[] = []
    let formName = ''
    let formPostAction = 'sdr'
    let formAssignedCloserId: string | null = null
    let formAssignedSdrIds: string[] = []
    let formNotifyPush = false
    let formNotifyEmail = false
    let formNotifyUserIds: string[] = []
    let formShowRecaptcha = false
    if (formId) {
      const { data: formData } = await supabase
        .from('forms')
        .select('fields_schema, fields, webhook_urls, name, source, post_action, assigned_closer_id, assigned_sdr_ids, notify_push, notify_email, notify_user_ids, show_recaptcha, active')
        .eq('id', formId)
        .single()

      // Reject submissions for inactive forms
      if (!formData || formData.active === false) {
        return errorResponse('Formulário não encontrado ou inativo', 404)
      }

      if (formData?.fields_schema && Array.isArray(formData.fields_schema) && formData.fields_schema.length > 0) {
        fieldsSchema = formData.fields_schema
      }
      if (formData?.webhook_urls && Array.isArray(formData.webhook_urls)) {
        webhookUrls = formData.webhook_urls.filter((u: string) => u.trim())
      }
      if (formData?.name) formName = formData.name
      if (formData?.post_action) formPostAction = formData.post_action
      if (formData?.assigned_closer_id) formAssignedCloserId = formData.assigned_closer_id
      if (formData?.assigned_sdr_ids && Array.isArray(formData.assigned_sdr_ids) && formData.assigned_sdr_ids.length > 0) {
        formAssignedSdrIds = formData.assigned_sdr_ids
      }
      formNotifyPush = formData?.notify_push ?? false
      formNotifyEmail = formData?.notify_email ?? false
      formShowRecaptcha = formData?.show_recaptcha ?? false
      if (formData?.notify_user_ids && Array.isArray(formData.notify_user_ids) && formData.notify_user_ids.length > 0) {
        formNotifyUserIds = formData.notify_user_ids
      }
    }

    // reCAPTCHA verification — enforced when the form requires it
    if (formShowRecaptcha) {
      if (!recaptchaToken) {
        return errorResponse('Por favor, complete o reCAPTCHA')
      }
      const recaptchaSecret = Deno.env.get('RECAPTCHA_SECRET_KEY')
      if (recaptchaSecret) {
        const verifyRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `secret=${encodeURIComponent(recaptchaSecret)}&response=${encodeURIComponent(recaptchaToken)}`,
        })
        const verifyData = await verifyRes.json()
        if (!verifyData.success) {
          return errorResponse('Verificação reCAPTCHA falhou')
        }
      }
    }

    const submissionData: Record<string, string> = {}
    const leadRecord: Record<string, any> = {
      lead_type: 'INBOUND',
      source: source.substring(0, 100),
      status: 'Novo',
      entry_channel: 'other',
    }

    if (fieldsSchema) {
      // ---- Zod validation for dynamic schema ----
      const zodSchema = buildZodSchema(fieldsSchema)
      const parseResult = zodSchema.safeParse(body)

      if (!parseResult.success) {
        const firstError = parseResult.error.errors[0]
        return errorResponse(firstError?.message || 'Dados inválidos')
      }

      const validatedData = parseResult.data

      for (const field of fieldsSchema) {
        const strValue = String(validatedData[field.id] ?? '').trim()
        if (!strValue) continue

        submissionData[field.id] = strValue

        // Use map_to from field config, fallback to field.id for legacy forms
        const mapKey = field.map_to || field.id
        const leadCol = LEAD_FIELD_MAP[mapKey]
        if (leadCol) {
          leadRecord[leadCol] = strValue
        }
        // Unmapped fields are stored once as a lead note (see below)
      }

      if (!leadRecord.name) leadRecord.name = 'Não informado'
      if (!leadRecord.company) leadRecord.company = leadRecord.nome_fantasia || leadRecord.razao_social || 'Não informado'
    } else {
      // ---- Legacy mode with Zod ----
      const legacySchema = z.object({
        name: z.string().trim().min(1, 'Nome é obrigatório').max(200, 'Nome: máx 200 caracteres'),
        email: z.string().trim().email('E-mail inválido').max(255).optional().or(z.literal('')),
        phone: z.string().trim().max(30).optional().or(z.literal('')),
        company: z.string().trim().max(200).optional().or(z.literal('')),
        message: z.string().trim().max(5000).optional().or(z.literal('')),
        cargo: z.string().trim().max(200).optional().or(z.literal('')),
        segmento: z.string().trim().max(200).optional().or(z.literal('')),
        cnpj: z.string().trim().max(20).optional().or(z.literal('')),
        razao_social: z.string().trim().max(300).optional().or(z.literal('')),
        nome_fantasia: z.string().trim().max(300).optional().or(z.literal('')),
        employee_count: z.string().trim().max(50).optional().or(z.literal('')),
        company_segment: z.string().trim().max(200).optional().or(z.literal('')),
        website: z.string().trim().max(500).optional().or(z.literal('')),
      }).passthrough()

      const parseResult = legacySchema.safeParse(body)
      if (!parseResult.success) {
        const firstError = parseResult.error.errors[0]
        return errorResponse(firstError?.message || 'Dados inválidos')
      }

      const d = parseResult.data
      const msgParts: string[] = []
      if (d.cargo) msgParts.push(`Cargo: ${d.cargo}`)
      if (d.segmento) msgParts.push(`Segmento: ${d.segmento}`)
      if (d.message) msgParts.push(d.message)

      leadRecord.name = d.name
      leadRecord.company = d.company || d.nome_fantasia || d.razao_social || 'Não informado'
      leadRecord.phone = d.phone || ''
      leadRecord.email = d.email || ''
      leadRecord.initial_message = msgParts.join('\n') || null
      leadRecord.company_segment = d.company_segment || d.segmento || null
      leadRecord.cnpj = d.cnpj || null
      leadRecord.razao_social = d.razao_social || null
      leadRecord.nome_fantasia = d.nome_fantasia || null
      leadRecord.employee_count = d.employee_count || null
      leadRecord.website = d.website || null

      const legacyFields = ['name', 'email', 'phone', 'company', 'cnpj', 'razao_social', 'nome_fantasia', 'employee_count', 'company_segment', 'website', 'message', 'cargo', 'segmento'] as const
      for (const key of legacyFields) {
        if (d[key]) submissionData[key] = d[key]
      }
    }

    // UTM params — save to submissionData AND leadRecord
    for (const utm of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const) {
      const v = (body[utm] || '').trim()
      if (v) {
        submissionData[utm] = v
        leadRecord[utm] = v
      }
    }

    // SDR round-robin: determine owner before creating lead
    if (formPostAction === 'sdr' && formAssignedSdrIds.length > 0) {
      // Count leads per SDR
      const { data: countData } = await supabase
        .from('leads')
        .select('owner_user_id')
        .in('owner_user_id', formAssignedSdrIds)

      const counts: Record<string, number> = {}
      for (const sdrId of formAssignedSdrIds) {
        counts[sdrId] = 0
      }
      if (countData) {
        for (const row of countData) {
          if (row.owner_user_id && counts[row.owner_user_id] !== undefined) {
            counts[row.owner_user_id]++
          }
        }
      }

      // Pick SDR with least leads (stable order for ties)
      let minCount = Infinity
      let selectedSdr: string | null = null
      for (const sdrId of formAssignedSdrIds) {
        if (counts[sdrId] < minCount) {
          minCount = counts[sdrId]
          selectedSdr = sdrId
        }
      }
      if (selectedSdr) {
        leadRecord.owner_user_id = selectedSdr
      }
    }

    // Create lead
    const { data: leadData, error: leadError } = await supabase
      .from('leads')
      .insert(leadRecord)
      .select('id')
      .single()

    if (leadError) {
      console.error('Error creating lead:', leadError)
      return errorResponse('Erro ao salvar dados', 500)
    }

    // If post_action is 'closer', update lead and create opportunity
    if (formId && formPostAction === 'closer' && formAssignedCloserId) {
      await supabase
        .from('leads')
        .update({ status: 'Oportunidade criada' })
        .eq('id', leadData.id)

      await supabase
        .from('opportunities')
        .insert({
          lead_id: leadData.id,
          created_by_user_id: formAssignedCloserId,
          assigned_to_user_id: formAssignedCloserId,
          sdr_user_id: null,
          stage: 'Demonstração',
        })
    }

    // Save unmapped fields as a lead note (Observação)
    if (fieldsSchema) {
      const unmappedParts: string[] = []
      for (const field of fieldsSchema) {
        const mapKey = field.map_to || field.id
        const leadCol = LEAD_FIELD_MAP[mapKey]
        const val = submissionData[field.id]
        if (!leadCol && val) {
          unmappedParts.push(`${field.label}: ${val}`)
        }
      }
      if (unmappedParts.length > 0) {
        const noteText = `[Formulário${formName ? ` - ${formName}` : ''}] ${unmappedParts.join(' | ')}`
        await supabase.from('lead_notes').insert({
          lead_id: leadData.id,
          note: noteText,
          user_id: null,
        })
      }
    }

    // Save form submission
    let submissionId: string | null = null
    if (formId) {
      const { data: subData } = await supabase.from('form_submissions').insert({
        form_id: formId,
        data: submissionData,
        source,
        lead_id: leadData.id,
        user_agent: userAgent,
        ip_address: ip,
      }).select('id').single()
      submissionId = subData?.id || null
    }

    // Fire webhooks with new format
    if (webhookUrls.length > 0) {
      // Build question/response pairs from fields_schema or legacy data
      const responseItems: Array<{ id: string; question: string; response: string }> = []

      if (fieldsSchema) {
        for (const field of fieldsSchema) {
          const val = submissionData[field.id]
          if (val !== undefined) {
            responseItems.push({
              id: field.id,
              question: field.label || field.id,
              response: val,
            })
          }
        }
      } else {
        // Legacy: use submissionData keys as both id and question
        const legacyLabels: Record<string, string> = {
          name: 'Nome', email: 'E-mail', phone: 'Telefone', company: 'Empresa',
          cnpj: 'CNPJ', razao_social: 'Razão Social', nome_fantasia: 'Nome Fantasia',
          employee_count: 'Nº Funcionários', company_segment: 'Segmento',
          website: 'Website', message: 'Mensagem', cargo: 'Cargo', segmento: 'Segmento',
        }
        for (const [key, val] of Object.entries(submissionData)) {
          if (!key.startsWith('utm_')) {
            responseItems.push({
              id: key,
              question: legacyLabels[key] || key,
              response: val,
            })
          }
        }
      }

      const webhookPayload = JSON.stringify({
        data: responseItems.map(item => ({
          id: item.id,
          question: item.question,
          response: item.response,
        })),
        metadata: {
          event: 'form_submission',
          form_id: formId,
          form_name: formName,
          lead_id: leadData.id,
          submission_id: submissionId,
          source,
          ip_address: ip,
          user_agent: userAgent,
          utm: {
            utm_source: submissionData.utm_source || null,
            utm_medium: submissionData.utm_medium || null,
            utm_campaign: submissionData.utm_campaign || null,
            utm_term: submissionData.utm_term || null,
            utm_content: submissionData.utm_content || null,
          },
          submitted_at: new Date().toISOString(),
        },
      })

      for (const url of webhookUrls) {
        try {
          fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: webhookPayload,
          }).catch(e => console.error('Webhook error:', url, e))
        } catch (e) {
          console.error('Webhook error:', url, e)
        }
      }
    }

    // Send push/email notifications
    if (formNotifyPush || formNotifyEmail) {
      try {
        let targetUserIds = formNotifyUserIds

        // If no specific users selected, notify all admins/managers
        if (targetUserIds.length === 0) {
          const { data: adminRoles } = await supabase
            .from('user_roles')
            .select('user_id')
            .in('role', ['admin', 'manager'])
          if (adminRoles) {
            targetUserIds = [...new Set(adminRoles.map((r: any) => r.user_id))]
          }
        }

        const leadName = leadRecord.name || 'Não informado'
        const leadCompany = leadRecord.company || ''
        const notifTitle = `Nova resposta: ${formName || 'Formulário'}`
        const notifMessage = `${leadName}${leadCompany ? ` — ${leadCompany}` : ''} preencheu o formulário "${formName || 'sem nome'}".`

        // Push notifications (in-app)
        if (formNotifyPush && targetUserIds.length > 0) {
          const notifications = targetUserIds.map((userId: string) => ({
            user_id: userId,
            title: notifTitle,
            message: notifMessage,
            type: 'form_submission',
            link: `/leads?lead=${leadData.id}`,
          }))
          await supabase.from('notifications').insert(notifications)
        }

        // Email notifications
        if (formNotifyEmail && targetUserIds.length > 0) {
          const { sendNotificationEmail, buildEmailCard, buildEmailButton } = await import('../_shared/email-sender.ts')
          const { data: profiles } = await supabase
            .from('profiles')
            .select('email')
            .in('id', targetUserIds)
            .not('email', 'is', null)

          if (profiles && profiles.length > 0) {
            const siteUrl = Deno.env.get('SITE_URL') || 'https://ez-journey.lovable.app'
            const leadLink = `${siteUrl}/leads?lead=${leadData.id}`

            const cardHtml = buildEmailCard(`
              <div style="font-weight: 600; font-size: 14px; color: #1a1a2e; margin-bottom: 4px;">📋 ${formName || 'Formulário'}</div>
              <div style="font-size: 12px; color: #666; margin-bottom: 2px;"><strong>Contato:</strong> ${leadRecord.name || 'Não informado'}</div>
              ${leadRecord.company ? `<div style="font-size: 12px; color: #666; margin-bottom: 2px;"><strong>Empresa:</strong> ${leadRecord.company}</div>` : ''}
              ${leadRecord.email ? `<div style="font-size: 12px; color: #666; margin-bottom: 2px;"><strong>E-mail:</strong> ${leadRecord.email}</div>` : ''}
              ${leadRecord.phone ? `<div style="font-size: 12px; color: #666;"><strong>Telefone:</strong> ${leadRecord.phone}</div>` : ''}
            `)

            const bodyHtml = `
              <p style="color: #333; font-size: 15px; margin-top: 0;">${notifMessage}</p>
              <div style="margin: 20px 0;">${cardHtml}</div>
              ${buildEmailButton('Ver no CRM', leadLink)}
            `

            for (const profile of profiles) {
              if (!profile.email) continue
              sendNotificationEmail({
                to: profile.email,
                subject: notifTitle,
                bodyHtml,
                headerTitle: 'Nova Resposta de Formulário',
              }).catch(e => console.error('Email notification error:', e))
            }
          }
        }
      } catch (notifErr) {
        console.error('Notification error:', notifErr)
      }
    }

    return new Response(JSON.stringify({ success: true, id: leadData.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Unexpected error:', err)
    return errorResponse('Erro interno', 500)
  }
})
