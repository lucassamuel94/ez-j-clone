import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

function generateWidgetScript(submitUrl: string, config: {
  formId: string;
  fieldsSchema: any[];
  source: string;
  title: string;
  subtitle: string;
  buttonText: string;
  primaryColor: string;
  whatsappNumber: string;
  whatsappMessageTemplate: string;
}): string {
  return `
(function() {
  var scripts = document.querySelectorAll('script[data-ez-whatsapp]');
  var scriptTag = scripts[scripts.length - 1];

  var config = {
    formId: ${JSON.stringify(config.formId)},
    fieldsSchema: ${JSON.stringify(config.fieldsSchema)},
    source: ${JSON.stringify(config.source)},
    title: ${JSON.stringify(config.title)},
    subtitle: ${JSON.stringify(config.subtitle)},
    buttonText: ${JSON.stringify(config.buttonText)},
    primaryColor: ${JSON.stringify(config.primaryColor)},
    whatsappNumber: ${JSON.stringify(config.whatsappNumber)},
    whatsappMessageTemplate: ${JSON.stringify(config.whatsappMessageTemplate)},
    submitUrl: ${JSON.stringify(submitUrl)}
  };

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // Collect UTMs + referrer
  function getUtms() {
    var utms = {};
    try {
      var params = new URLSearchParams(window.location.search);
      ['utm_source','utm_medium','utm_campaign','utm_term','utm_content'].forEach(function(p) {
        var v = params.get(p);
        if (v) utms[p] = v;
      });
      utms._referrer = document.referrer || '';
      utms._page_url = window.location.href;
    } catch(e) {}
    return utms;
  }

  // Validation
  function validateField(id, value, fc) {
    var type = fc.type || 'text';
    var required = fc.required || false;
    var v = (typeof value === 'string') ? value.trim() : (value || '');
    if (required && !v) return fc.label + ' é obrigatório';
    if (!v) return '';
    switch (type) {
      case 'email':
        if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/.test(v)) return 'E-mail inválido';
        break;
      case 'phone':
        var digits = v.replace(/\\D/g, '');
        if (digits.length < 10) return 'Telefone incompleto';
        if (digits.length > 15) return 'Telefone inválido';
        break;
    }
    return '';
  }

  function maskPhone(v) {
    v = v.replace(/\\D/g, '').slice(0, 11);
    if (v.length > 10) v = v.replace(/(\\d{2})(\\d{5})(\\d{1,4})/, '($1) $2-$3');
    else if (v.length > 6) v = v.replace(/(\\d{2})(\\d{4})(\\d{1,4})/, '($1) $2-$3');
    else if (v.length > 2) v = v.replace(/(\\d{2})(\\d{1,5})/, '($1) $2');
    else if (v.length > 0) v = v.replace(/(\\d{1,2})/, '($1');
    return v;
  }

  // Inject CSS
  var style = document.createElement('style');
  style.textContent = \`
    .ez-wa-fab { position: fixed; bottom: 24px; right: 24px; z-index: 999990; width: 60px; height: 60px; border-radius: 50%; background: #25D366; border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: center; transition: transform 0.2s, box-shadow 0.2s; }
    .ez-wa-fab:hover { transform: scale(1.08); box-shadow: 0 6px 20px rgba(0,0,0,0.3); }
    .ez-wa-fab svg { width: 32px; height: 32px; fill: #fff; }
    .ez-wa-fab .ez-wa-pulse { position: absolute; top: -2px; right: -2px; width: 14px; height: 14px; background: #ff4444; border-radius: 50%; border: 2px solid #fff; }
    .ez-wa-popup-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.4); z-index: 999991; display: none; animation: ezWaFadeIn 0.2s ease; }
    .ez-wa-popup-overlay.ez-open { display: flex; align-items: flex-end; justify-content: flex-end; padding: 24px; }
    @media (max-width: 480px) { .ez-wa-popup-overlay.ez-open { padding: 0; align-items: flex-end; } }
    .ez-wa-popup { background: #fff; border-radius: 16px; width: 360px; max-width: 100vw; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); animation: ezWaSlideUp 0.3s ease; overflow: hidden; }
    @media (max-width: 480px) { .ez-wa-popup { border-radius: 16px 16px 0 0; width: 100%; } }
    .ez-wa-header { padding: 20px 24px; display: flex; align-items: center; gap: 12px; }
    .ez-wa-header-icon { width: 40px; height: 40px; border-radius: 50%; background: #25D366; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .ez-wa-header-icon svg { width: 22px; height: 22px; fill: #fff; }
    .ez-wa-header-text h3 { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; font-weight: 700; color: #111827; margin: 0; }
    .ez-wa-header-text p { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: #6b7280; margin: 4px 0 0 0; line-height: 1.4; }
    .ez-wa-close { position: absolute; top: 16px; right: 16px; background: none; border: none; cursor: pointer; color: #9ca3af; font-size: 20px; line-height: 1; padding: 4px; }
    .ez-wa-close:hover { color: #374151; }
    .ez-wa-body { padding: 0 24px 24px; }
    .ez-wa-group { margin-bottom: 14px; }
    .ez-wa-label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .ez-wa-label .ez-req { color: #ef4444; margin-left: 2px; }
    .ez-wa-input { width: 100%; padding: 10px 14px; font-size: 14px; border: 1px solid #d1d5db; border-radius: 8px; background: #fff; color: #111827; outline: none; transition: border-color 0.2s, box-shadow 0.2s; box-sizing: border-box; font-family: inherit; }
    .ez-wa-input:focus { border-color: #25D366; box-shadow: 0 0 0 3px rgba(37,211,102,0.15); }
    .ez-wa-input.ez-err { border-color: #dc2626; }
    .ez-wa-field-error { font-size: 12px; color: #dc2626; margin-top: 3px; min-height: 0; }
    .ez-wa-btn { width: 100%; padding: 12px; font-size: 15px; font-weight: 600; color: #fff; background: #25D366; border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .ez-wa-btn:hover { background: #20bd5a; }
    .ez-wa-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .ez-wa-btn svg { width: 18px; height: 18px; fill: #fff; }
    .ez-wa-error { font-size: 13px; color: #dc2626; margin-top: 8px; display: none; font-family: inherit; }
    .ez-wa-error.visible { display: block; }
    .ez-wa-powered { text-align: center; margin-top: 16px; padding-top: 12px; border-top: 1px solid rgba(0,0,0,0.06); font-size: 11px; color: #9ca3af; font-family: inherit; }
    .ez-wa-powered a { color: #9ca3af; text-decoration: none; }
    @keyframes ezWaFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes ezWaSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  \`;
  document.head.appendChild(style);

  var waSvg = '<svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';

  // FAB button
  var fab = document.createElement('button');
  fab.className = 'ez-wa-fab';
  fab.setAttribute('aria-label', 'Abrir WhatsApp');
  fab.innerHTML = waSvg + '<span class="ez-wa-pulse"></span>';
  document.body.appendChild(fab);

  // Popup overlay
  var overlay = document.createElement('div');
  overlay.className = 'ez-wa-popup-overlay';
  overlay.innerHTML = '<div class="ez-wa-popup" style="position:relative;">' +
    '<button class="ez-wa-close" aria-label="Fechar">&times;</button>' +
    '<div class="ez-wa-header">' +
      '<div class="ez-wa-header-icon">' + waSvg + '</div>' +
      '<div class="ez-wa-header-text">' +
        '<h3>' + escapeHtml(config.title || 'Fale conosco') + '</h3>' +
        '<p>' + escapeHtml(config.subtitle || 'Preencha seus dados para iniciar a conversa') + '</p>' +
      '</div>' +
    '</div>' +
    '<div class="ez-wa-body">' +
      '<form class="ez-wa-form" novalidate></form>' +
      '<div class="ez-wa-powered">Powered by <a href="https://ezsoft.com.br" target="_blank">EZ Soft</a></div>' +
    '</div>' +
  '</div>';
  document.body.appendChild(overlay);

  var popup = overlay.querySelector('.ez-wa-popup');
  var form = overlay.querySelector('.ez-wa-form');

  // Build form fields
  var fieldsHtml = '';
  config.fieldsSchema.forEach(function(f) {
    fieldsHtml += '<div class="ez-wa-group" data-field-id="' + f.id + '">';
    var reqStar = f.required ? '<span class="ez-req">*</span>' : '';
    var ph = f.placeholder ? ' placeholder="' + escapeHtml(f.placeholder) + '"' : '';
    var inputType = f.type === 'phone' ? 'tel' : (f.type || 'text');
    if (inputType === 'textarea') {
      fieldsHtml += '<label class="ez-wa-label">' + escapeHtml(f.label) + reqStar + '</label>';
      fieldsHtml += '<textarea class="ez-wa-input" name="' + f.id + '"' + ph + ' rows="2" style="resize:vertical;min-height:60px;"></textarea>';
    } else if (f.type === 'combobox') {
      fieldsHtml += '<label class="ez-wa-label">' + escapeHtml(f.label) + reqStar + '</label>';
      fieldsHtml += '<select class="ez-wa-input" name="' + f.id + '" style="appearance:auto;">';
      fieldsHtml += '<option value="">' + (f.placeholder || 'Selecione...') + '</option>';
      (f.options || []).forEach(function(o) { fieldsHtml += '<option value="' + escapeHtml(o) + '">' + escapeHtml(o) + '</option>'; });
      fieldsHtml += '</select>';
    } else {
      fieldsHtml += '<label class="ez-wa-label">' + escapeHtml(f.label) + reqStar + '</label>';
      fieldsHtml += '<input class="ez-wa-input" type="' + inputType + '" name="' + f.id + '"' + ph + ' />';
    }
    fieldsHtml += '<div class="ez-wa-field-error"></div>';
    fieldsHtml += '</div>';
  });

  fieldsHtml += '<div class="ez-wa-error" id="ez-wa-error"></div>';
  fieldsHtml += '<button type="submit" class="ez-wa-btn">' + waSvg + ' ' + escapeHtml(config.buttonText || 'Iniciar conversa') + '</button>';
  form.innerHTML = fieldsHtml;

  var errorEl = form.querySelector('#ez-wa-error');
  var btn = form.querySelector('.ez-wa-btn');

  // Phone masks
  config.fieldsSchema.forEach(function(f) {
    if (f.type === 'phone') {
      var input = form.querySelector('[name="' + f.id + '"]');
      if (input) {
        input.addEventListener('input', function() {
          var pos = this.selectionStart;
          var old = this.value.length;
          this.value = maskPhone(this.value);
          var diff = this.value.length - old;
          this.setSelectionRange(pos + diff, pos + diff);
        });
      }
    }
  });

  // Real-time validation
  config.fieldsSchema.forEach(function(fc) {
    var group = form.querySelector('[data-field-id="' + fc.id + '"]');
    if (!group) return;
    var input = group.querySelector('.ez-wa-input');
    if (input) {
      input.addEventListener('blur', function() {
        var msg = validateField(fc.id, this.value, fc);
        var errEl = group.querySelector('.ez-wa-field-error');
        if (errEl) errEl.textContent = msg;
        this.classList.toggle('ez-err', !!msg);
      });
      input.addEventListener('input', function() {
        var msg = validateField(fc.id, this.value, fc);
        var errEl = group.querySelector('.ez-wa-field-error');
        if (errEl) errEl.textContent = msg;
        this.classList.toggle('ez-err', !!msg);
      });
    }
  });

  // Open/close
  fab.addEventListener('click', function() {
    overlay.classList.add('ez-open');
    fab.style.display = 'none';
  });

  overlay.querySelector('.ez-wa-close').addEventListener('click', function() {
    overlay.classList.remove('ez-open');
    fab.style.display = 'flex';
  });

  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) {
      overlay.classList.remove('ez-open');
      fab.style.display = 'flex';
    }
  });

  // Submit
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    errorEl.classList.remove('visible');

    // Validate all
    var allValid = true;
    config.fieldsSchema.forEach(function(fc) {
      var input = form.querySelector('[name="' + fc.id + '"]');
      var value = input ? input.value : '';
      var msg = validateField(fc.id, value, fc);
      var group = form.querySelector('[data-field-id="' + fc.id + '"]');
      if (group) {
        var errEl = group.querySelector('.ez-wa-field-error');
        if (errEl) errEl.textContent = msg;
        if (input) input.classList.toggle('ez-err', !!msg);
      }
      if (msg) allValid = false;
    });

    if (!allValid) {
      errorEl.textContent = 'Corrija os campos destacados';
      errorEl.classList.add('visible');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Enviando...';

    var data = { source: config.source, form_id: config.formId };
    config.fieldsSchema.forEach(function(fc) {
      var input = form.querySelector('[name="' + fc.id + '"]');
      if (input) data[fc.id] = input.value;
    });

    // Add UTMs
    var utms = getUtms();
    for (var key in utms) { data[key] = utms[key]; }

    fetch(config.submitUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    .then(function(res) { return res.json().then(function(j) { return { ok: res.ok, body: j }; }); })
    .then(function(res) {
      if (!res.ok) throw new Error(res.body.error || 'Erro ao enviar');

      // Build WhatsApp URL
      var phone = config.whatsappNumber.replace(/\\D/g, '');
      var msg = config.whatsappMessageTemplate || '';

      // Replace {field_name} placeholders with values
      config.fieldsSchema.forEach(function(fc) {
        var input = form.querySelector('[name="' + fc.id + '"]');
        var val = input ? input.value.trim() : '';
        var key = fc.map_to || fc.name || fc.id;
        msg = msg.replace(new RegExp('\\\\{' + key + '\\\\}', 'gi'), val);
        msg = msg.replace(new RegExp('\\\\{' + fc.id + '\\\\}', 'gi'), val);
        if (fc.label) msg = msg.replace(new RegExp('\\\\{' + fc.label.toLowerCase().replace(/\\s+/g, '_') + '\\\\}', 'gi'), val);
      });

      var waUrl = 'https://api.whatsapp.com/send?phone=' + encodeURIComponent(phone);
      if (msg.trim()) waUrl += '&text=' + encodeURIComponent(msg.trim());

      window.open(waUrl, '_blank');

      // Reset form
      form.reset();
      overlay.classList.remove('ez-open');
      fab.style.display = 'flex';
      btn.disabled = false;
      btn.innerHTML = waSvg + ' ' + escapeHtml(config.buttonText || 'Iniciar conversa');
    })
    .catch(function(err) {
      errorEl.textContent = err.message;
      errorEl.classList.add('visible');
      btn.disabled = false;
      btn.innerHTML = waSvg + ' ' + escapeHtml(config.buttonText || 'Iniciar conversa');
    });
  });
})();
`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const formId = url.searchParams.get('id')

  if (!formId) {
    return new Response('// Error: missing form id', {
      headers: { ...corsHeaders, 'Content-Type': 'application/javascript; charset=utf-8' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: form, error } = await supabase
    .from('forms')
    .select('*')
    .eq('id', formId)
    .eq('active', true)
    .eq('widget_type', 'whatsapp_widget')
    .single()

  if (error || !form) {
    return new Response('// Error: widget not found or inactive', {
      headers: { ...corsHeaders, 'Content-Type': 'application/javascript; charset=utf-8' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const submitUrl = `${supabaseUrl}/functions/v1/lead-form-submit`

  const script = generateWidgetScript(submitUrl, {
    formId: form.id,
    fieldsSchema: form.fields_schema || [
      { id: 'name', type: 'text', label: 'Nome', placeholder: 'Seu nome', required: true },
      { id: 'phone', type: 'phone', label: 'Telefone', placeholder: '(00) 00000-0000', required: true, map_to: 'phone' },
    ],
    source: form.source || 'Widget WhatsApp',
    title: form.title || 'Fale conosco',
    subtitle: form.subtitle || 'Preencha seus dados para iniciar a conversa',
    buttonText: form.button_text || 'Iniciar conversa',
    primaryColor: form.primary_color || '#25D366',
    whatsappNumber: form.whatsapp_number || '',
    whatsappMessageTemplate: form.whatsapp_message_template || '',
  })

  return new Response(script, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
})
