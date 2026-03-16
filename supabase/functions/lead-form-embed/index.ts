import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

interface FieldSchema {
  id: string;
  type: string;
  label: string;
  placeholder: string;
  required: boolean;
  default_value: string;
  options?: string[];
  validation?: { min?: number; max?: number; regex?: string; regexMessage?: string };
}

// Shared CSS used by both schema and legacy generators
function sharedCss(primaryColor: string, styles?: {
  cardBorderEnabled?: boolean; cardBorderColor?: string; cardBorderWidth?: number;
  cardBorderRadius?: number; cardBgEnabled?: boolean; cardBgColor?: string;
  fieldBorderColor?: string; fieldBorderWidth?: number; fieldBgColor?: string;
  buttonHoverBgColor?: string; buttonHoverTextColor?: string;
}): string {
  const s = styles || {};
  const cardBorder = s.cardBorderEnabled !== false
    ? `${s.cardBorderWidth || 1}px solid ${s.cardBorderColor || '#e5e7eb'}`
    : 'none';
  const cardRadius = s.cardBorderRadius ?? 12;
  const cardBg = s.cardBgEnabled !== false ? (s.cardBgColor || '#ffffff') : 'transparent';
  const fieldBorder = `${s.fieldBorderWidth || 1}px solid ${s.fieldBorderColor || '#d1d5db'}`;
  const fieldBg = s.fieldBgColor || '#ffffff';

  return `
    .ez-form-wrapper { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; }
    .ez-form-card { background: ${cardBg} !important; border: ${cardBorder} !important; border-radius: ${cardRadius}px !important; padding: 32px !important; box-shadow: 0 1px 3px rgba(0,0,0,0.08) !important; }
    .ez-form-title { font-family: 'Inter', sans-serif; font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 6px 0; }
    .ez-form-subtitle { font-family: 'Inter', sans-serif; font-size: 14px; color: #6b7280; margin: 0 0 24px 0; line-height: 1.5; }
    .ez-form-group { margin-bottom: 16px; position: relative; }
    .ez-form-label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
    .ez-form-label .ez-required { color: ${primaryColor}; margin-left: 2px; }
    .ez-form-input, .ez-form-textarea, .ez-form-select { width: 100% !important; padding: 10px 14px !important; font-size: 14px !important; border: ${fieldBorder} !important; border-radius: 8px !important; background: ${fieldBg} !important; color: #111827 !important; outline: none !important; transition: border-color 0.2s, box-shadow 0.2s; box-sizing: border-box !important; }
    .ez-form-input:focus, .ez-form-textarea:focus, .ez-form-select:focus { border-color: ${primaryColor} !important; box-shadow: 0 0 0 3px ${primaryColor}22 !important; }
    .ez-form-input.ez-invalid, .ez-form-textarea.ez-invalid, .ez-form-select.ez-invalid { border-color: #dc2626 !important; }
    .ez-form-input.ez-invalid:focus, .ez-form-textarea.ez-invalid:focus, .ez-form-select.ez-invalid:focus { box-shadow: 0 0 0 3px #dc262622 !important; }
    .ez-form-input.ez-valid, .ez-form-textarea.ez-valid, .ez-form-select.ez-valid { border-color: #16a34a !important; }
    .ez-form-input::placeholder, .ez-form-textarea::placeholder { color: #9ca3af !important; }
    .ez-form-textarea { min-height: 90px; resize: vertical; font-family: inherit; }
    .ez-form-select { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%236b7280' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10l-5 5z'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 36px; }
    .ez-form-checkbox-row { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
    .ez-form-checkbox-row input[type="checkbox"], .ez-form-checkbox-row input[type="radio"] { width: 18px; height: 18px; accent-color: ${primaryColor}; cursor: pointer; }
    .ez-form-checkbox-row label { font-size: 14px; color: #374151; cursor: pointer; }
    .ez-form-field-error { font-size: 12px; color: #dc2626; margin-top: 4px; min-height: 0; overflow: hidden; transition: all 0.2s ease; }
    .ez-form-field-error:empty { margin-top: 0; }
    .ez-form-button { width: 100%; padding: 12px 24px; font-size: 15px; font-weight: 600; color: #ffffff; background: ${primaryColor}; border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s; margin-top: 8px; }
    .ez-form-button:hover { background: ${s.buttonHoverBgColor || primaryColor}; color: ${s.buttonHoverTextColor || '#ffffff'}; opacity: ${s.buttonHoverBgColor ? '1' : '0.9'}; }
    .ez-form-button:active { transform: scale(0.98); }
    .ez-form-button:disabled { opacity: 0.6; cursor: not-allowed; }
    .ez-form-success-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 999999; animation: ezFadeIn 0.3s ease; }
    .ez-form-success-modal { background: #fff; border-radius: 16px; padding: 40px 32px; max-width: 400px; width: 90%; text-align: center; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); animation: ezZoomIn 0.3s ease; }
    .ez-form-success-icon-circle { width: 64px; height: 64px; border-radius: 50%; background: ${primaryColor}15; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }
    .ez-form-success-icon-circle svg { width: 32px; height: 32px; stroke: ${primaryColor}; stroke-width: 2.5; fill: none; }
    .ez-form-success-title { font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 8px 0; }
    .ez-form-success-text { font-size: 15px; color: #6b7280; line-height: 1.6; margin: 0 0 24px 0; }
    .ez-form-success-btn { padding: 10px 28px; font-size: 14px; font-weight: 600; color: #fff; background: ${primaryColor}; border: none; border-radius: 8px; cursor: pointer; transition: opacity 0.2s; }
    .ez-form-success-btn:hover { opacity: 0.9; }
    @keyframes ezFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes ezZoomIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
    .ez-form-error { font-size: 13px; color: #dc2626; margin-top: 8px; display: none; }
    .ez-form-error.visible { display: block; }
    .ez-form-powered { text-align: center; margin-top: 20px; padding-top: 16px; border-top: 1px solid rgba(0,0,0,0.06); font-size: 11px; color: #9ca3af; }
    .ez-form-powered a { color: #9ca3af; text-decoration: none; }
  `;
}

// Shared JS validation engine injected into both generators
function validationEngine(): string {
  return `
  // ===== Validation Engine =====
  function validateField(fieldId, value, fieldConfig) {
    var type = fieldConfig.type || 'text';
    var required = fieldConfig.required || false;
    var label = fieldConfig.label || fieldId;
    var validation = fieldConfig.validation || {};
    var v = (typeof value === 'string') ? value.trim() : (value || '');

    // Required check
    if (required && !v) {
      return label + ' é obrigatório';
    }

    // Skip further checks if empty and not required
    if (!v) return '';

    // Type-based validation
    switch (type) {
      case 'email':
        if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/.test(v)) return 'E-mail inválido';
        if (v.length > 255) return 'E-mail muito longo (máx 255)';
        break;
      case 'phone':
      case 'tel':
        var digits = v.replace(/\\D/g, '');
        if (digits.length < 10) return 'Telefone incompleto (mín. 10 dígitos)';
        if (digits.length > 15) return 'Telefone inválido (máx. 15 dígitos)';
        break;
      case 'number':
        var num = Number(v);
        if (isNaN(num)) return label + ' deve ser um número';
        if (validation.min !== undefined && validation.min !== null && num < validation.min) return label + ' deve ser no mínimo ' + validation.min;
        if (validation.max !== undefined && validation.max !== null && num > validation.max) return label + ' deve ser no máximo ' + validation.max;
        break;
      case 'url':
        if (!/^https?:\\/\\/.+/.test(v) && !/^[a-zA-Z0-9][a-zA-Z0-9.-]*\\.[a-zA-Z]{2,}/.test(v)) return 'URL inválida';
        break;
      case 'date':
        if (isNaN(Date.parse(v))) return 'Data inválida';
        break;
      case 'cpf':
        var cpfD = v.replace(/\\D/g, '');
        if (cpfD.length !== 11) return 'CPF deve ter 11 dígitos';
        break;
      case 'cnpj':
        var cnpjD = v.replace(/\\D/g, '');
        if (cnpjD.length !== 14) return 'CNPJ deve ter 14 dígitos';
        break;
      case 'cpf_cnpj':
        var d = v.replace(/\\D/g, '');
        if (d.length !== 11 && d.length !== 14) return 'CPF ou CNPJ inválido';
        break;
      default:
        if (v.length > 500) return label + ' muito longo';
        break;
    }

    // Regex custom validation
    if (validation.regex && type !== 'number') {
      try {
        var re = new RegExp(validation.regex);
        if (!re.test(v)) return validation.regexMessage || (label + ' formato inválido');
      } catch(e) {}
    }

    return '';
  }

  // Show/clear inline error for a field
  function showFieldError(group, message) {
    var errEl = group.querySelector('.ez-form-field-error');
    var input = group.querySelector('.ez-form-input, .ez-form-textarea, .ez-form-select');
    if (!errEl) return;
    errEl.textContent = message;
    if (input) {
      input.classList.remove('ez-valid', 'ez-invalid');
      if (message) input.classList.add('ez-invalid');
      else if (input.value && input.value.trim()) input.classList.add('ez-valid');
    }
  }

  // Validate all fields and return true if valid
  function validateAllFields(form, fieldsConfig) {
    var allValid = true;
    fieldsConfig.forEach(function(fc) {
      var value = '';
      if (fc.type === 'checkbox') {
        var cbs = form.querySelectorAll('[name="' + fc.id + '"]:checked');
        var vals = [];
        cbs.forEach(function(c) { vals.push(c.value); });
        value = vals.join(', ');
      } else if (fc.type === 'option_list') {
        var checked = form.querySelector('[name="' + fc.id + '"]:checked');
        value = checked ? checked.value : '';
      } else {
        var input = form.querySelector('[name="' + fc.id + '"]');
        value = input ? input.value : '';
      }
      var msg = validateField(fc.id, value, fc);
      var group = form.querySelector('[data-field-id="' + fc.id + '"]');
      if (group) showFieldError(group, msg);
      if (msg) allValid = false;
    });
    return allValid;
  }

  // Attach onChange/onBlur validators to all fields
  function attachValidators(form, fieldsConfig) {
    fieldsConfig.forEach(function(fc) {
      var group = form.querySelector('[data-field-id="' + fc.id + '"]');
      if (!group) return;

      if (fc.type === 'checkbox') {
        var cbs = form.querySelectorAll('[name="' + fc.id + '"]');
        cbs.forEach(function(cb) {
          cb.addEventListener('change', function() {
            var checked = form.querySelectorAll('[name="' + fc.id + '"]:checked');
            var vals = [];
            checked.forEach(function(c) { vals.push(c.value); });
            showFieldError(group, validateField(fc.id, vals.join(', '), fc));
          });
        });
      } else if (fc.type === 'option_list') {
        var radios = form.querySelectorAll('[name="' + fc.id + '"]');
        radios.forEach(function(r) {
          r.addEventListener('change', function() {
            showFieldError(group, validateField(fc.id, this.value, fc));
          });
        });
      } else {
        var input = form.querySelector('[name="' + fc.id + '"]');
        if (input) {
          // Validate on blur
          input.addEventListener('blur', function() {
            showFieldError(group, validateField(fc.id, this.value, fc));
          });
          // Clear error on input (re-validate lightly)
          input.addEventListener('input', function() {
            var msg = validateField(fc.id, this.value, fc);
            // Only clear if currently invalid, or show if there's an error
            showFieldError(group, msg);
          });
        }
      }
    });
  }
  `;
}

const generateSchemaFormScript = (submitUrl: string, recaptchaSiteKey: string, config: {
  formId: string;
  fieldsSchema: FieldSchema[];
  source: string;
  title: string;
  subtitle: string;
  buttonText: string;
  successMessage: string;
  primaryColor: string;
  redirectUrl: string | null;
  showRecaptcha: boolean;
  cardStyles?: { cardBorderEnabled?: boolean; cardBorderColor?: string; cardBorderWidth?: number; cardBorderRadius?: number; cardBgEnabled?: boolean; cardBgColor?: string; fieldBorderColor?: string; fieldBorderWidth?: number; fieldBgColor?: string; buttonHoverBgColor?: string; buttonHoverTextColor?: string; };
}) => {
  const generatedCss = sharedCss(config.primaryColor, config.cardStyles);
  return `
(function() {
  var scripts = document.querySelectorAll('script[data-ez-form]');
  var scriptTag = scripts[scripts.length - 1];
  
  var config = {
    formId: '${config.formId}',
    fieldsSchema: ${JSON.stringify(config.fieldsSchema)},
    source: ${JSON.stringify(config.source)},
    title: ${JSON.stringify(config.title)},
    subtitle: ${JSON.stringify(config.subtitle)},
    buttonText: ${JSON.stringify(config.buttonText)},
    successMessage: ${JSON.stringify(config.successMessage)},
    primaryColor: ${JSON.stringify(config.primaryColor)},
    redirectUrl: ${JSON.stringify(config.redirectUrl || '')},
    showRecaptcha: ${config.showRecaptcha ? 'true' : 'false'},
    submitUrl: '${submitUrl}'
  };

  var container = document.createElement('div');
  container.id = 'ez-form-' + Math.random().toString(36).substr(2, 9);

  var style = document.createElement('style');
  style.textContent = ` + JSON.stringify(generatedCss) + `;
  container.appendChild(style);

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function showSuccessModal(message, color) {
    var overlay = document.createElement('div');
    overlay.className = 'ez-form-success-overlay';
    overlay.innerHTML = '<div class="ez-form-success-modal">' +
      '<div class="ez-form-success-icon-circle"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>' +
      '<h3 class="ez-form-success-title">Enviado com sucesso!</h3>' +
      '<p class="ez-form-success-text">' + escapeHtml(message) + '</p>' +
      '<button class="ez-form-success-btn">Fechar</button>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.querySelector('.ez-form-success-btn').addEventListener('click', function() {
      overlay.remove();
    });
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.remove();
    });
  }

  ${validationEngine()}

  function renderField(f) {
    var html = '<div class="ez-form-group" data-field-id="' + f.id + '">';
    var req = f.required ? ' required' : '';
    var reqStar = f.required ? '<span class="ez-required">*</span>' : '';
    var ph = f.placeholder ? ' placeholder="' + escapeHtml(f.placeholder) + '"' : '';
    var dv = f.default_value || '';

    if (f.type === 'checkbox') {
      if (f.options && f.options.length > 0) {
        html += '<label class="ez-form-label">' + escapeHtml(f.label) + reqStar + '</label>';
        f.options.forEach(function(o, i) {
          html += '<div class="ez-form-checkbox-row">';
          html += '<input type="checkbox" id="f_' + f.id + '_' + i + '" name="' + f.id + '" value="' + escapeHtml(o) + '" />';
          html += '<label for="f_' + f.id + '_' + i + '">' + escapeHtml(o) + '</label>';
          html += '</div>';
        });
      } else {
        html += '<div class="ez-form-checkbox-row">';
        html += '<input type="checkbox" id="f_' + f.id + '" name="' + f.id + '" value="true"' + (dv === 'true' ? ' checked' : '') + ' />';
        html += '<label for="f_' + f.id + '">' + escapeHtml(f.label) + reqStar + '</label>';
        html += '</div>';
      }
    } else if (f.type === 'combobox') {
      html += '<label class="ez-form-label">' + escapeHtml(f.label) + reqStar + '</label>';
      html += '<select class="ez-form-select" name="' + f.id + '">';
      html += '<option value="">' + (f.placeholder || 'Selecione...') + '</option>';
      (f.options || []).forEach(function(o) {
        html += '<option value="' + escapeHtml(o) + '"' + (dv === o ? ' selected' : '') + '>' + escapeHtml(o) + '</option>';
      });
      html += '</select>';
    } else if (f.type === 'option_list') {
      html += '<label class="ez-form-label">' + escapeHtml(f.label) + reqStar + '</label>';
      (f.options || []).forEach(function(o, i) {
        html += '<div class="ez-form-checkbox-row">';
        html += '<input type="radio" name="' + f.id + '" id="f_' + f.id + '_' + i + '" value="' + escapeHtml(o) + '"' + (dv === o ? ' checked' : '') + ' />';
        html += '<label for="f_' + f.id + '_' + i + '">' + escapeHtml(o) + '</label>';
        html += '</div>';
      });
    } else if (f.type === 'textarea') {
      html += '<label class="ez-form-label">' + escapeHtml(f.label) + reqStar + '</label>';
      html += '<textarea class="ez-form-textarea" name="' + f.id + '"' + ph + '>' + escapeHtml(dv) + '</textarea>';
    } else {
      var inputType = f.type;
      if (inputType === 'phone') inputType = 'tel';
      html += '<label class="ez-form-label">' + escapeHtml(f.label) + reqStar + '</label>';
      var extra = '';
      if (f.type === 'number' && f.validation) {
        if (f.validation.min !== undefined && f.validation.min !== null) extra += ' min="' + f.validation.min + '"';
        if (f.validation.max !== undefined && f.validation.max !== null) extra += ' max="' + f.validation.max + '"';
      }
      html += '<input class="ez-form-input" type="' + inputType + '" name="' + f.id + '"' + ph + extra + ' value="' + escapeHtml(dv) + '" />';
    }
    html += '<div class="ez-form-field-error"></div>';
    html += '</div>';
    return html;
  }

  var html = '<div class="ez-form-wrapper"><div class="ez-form-card">';
  if (config.title) { html += '<h3 class="ez-form-title">' + escapeHtml(config.title) + '</h3>'; }
  if (config.subtitle) { html += '<p class="ez-form-subtitle">' + escapeHtml(config.subtitle) + '</p>'; }
  html += '<form class="ez-form" novalidate>';

  config.fieldsSchema.forEach(function(f) {
    html += renderField(f);
  });

  if (config.showRecaptcha) {
    html += '<div class="ez-recaptcha-container" id="ez-recaptcha"></div>';
  }

  html += '<div class="ez-form-error" id="ez-error"></div>';
  html += '<button type="submit" class="ez-form-button">' + escapeHtml(config.buttonText) + '</button>';
  html += '</form>';
  html += '<div class="ez-form-powered">Powered by <a href="https://ezsoft.com.br" target="_blank">EZ Soft</a></div>';
  html += '</div></div>';

  var formDiv = document.createElement('div');
  formDiv.innerHTML = html;
  container.appendChild(formDiv);

  scriptTag.parentNode.insertBefore(container, scriptTag);

  var form = container.querySelector('.ez-form');
  var errorEl = container.querySelector('#ez-error');
  var btn = container.querySelector('.ez-form-button');

  // === Input Masks ===
  function maskPhone(v) {
    v = v.replace(/\\D/g, '').slice(0, 11);
    if (v.length > 10) v = v.replace(/(\\d{2})(\\d{5})(\\d{1,4})/, '($1) $2-$3');
    else if (v.length > 6) v = v.replace(/(\\d{2})(\\d{4})(\\d{1,4})/, '($1) $2-$3');
    else if (v.length > 2) v = v.replace(/(\\d{2})(\\d{1,5})/, '($1) $2');
    else if (v.length > 0) v = v.replace(/(\\d{1,2})/, '($1');
    return v;
  }

  // Apply phone mask
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
    // Auto-prefix URL fields
    if (f.type === 'url') {
      var urlInput = form.querySelector('[name="' + f.id + '"]');
      if (urlInput) {
        urlInput.addEventListener('blur', function() {
          var v = this.value.trim();
          if (v && !v.match(/^https?:\\/\\//)) {
            this.value = 'https://' + v;
          }
        });
      }
    }
  });

  // Attach real-time validators
  attachValidators(form, config.fieldsSchema);

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    errorEl.classList.remove('visible');

    // Run full validation before submit
    var isValid = validateAllFields(form, config.fieldsSchema);
    if (!isValid) {
      errorEl.textContent = 'Corrija os campos destacados antes de enviar';
      errorEl.classList.add('visible');
      // Scroll to first error
      var firstErr = form.querySelector('.ez-invalid');
      if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Enviando...';

    var data = { source: config.source, form_id: config.formId };
    config.fieldsSchema.forEach(function(f) {
      if (f.type === 'checkbox') {
        var cbs = form.querySelectorAll('[name="' + f.id + '"]:checked');
        var vals = [];
        cbs.forEach(function(c) { vals.push(c.value); });
        data[f.id] = vals.join(', ');
      } else if (f.type === 'option_list') {
        var checked = form.querySelector('[name="' + f.id + '"]:checked');
        data[f.id] = checked ? checked.value : '';
      } else {
        var input = form.querySelector('[name="' + f.id + '"]');
        if (input) data[f.id] = input.value;
      }
    });

    if (config.showRecaptcha && window.grecaptcha) {
      var token = window.grecaptcha.getResponse();
      if (!token) {
        errorEl.textContent = 'Por favor, complete o reCAPTCHA';
        errorEl.classList.add('visible');
        btn.disabled = false;
        btn.textContent = config.buttonText;
        return;
      }
      data['g-recaptcha-response'] = token;
    }

    try {
      var params = new URLSearchParams(window.location.search);
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(function(p) {
        var v = params.get(p);
        if (v) data[p] = v;
      });
    } catch(e) {}

    fetch(config.submitUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    .then(function(res) { return res.json().then(function(j) { return { ok: res.ok, body: j }; }); })
    .then(function(res) {
      if (!res.ok) {
        throw new Error(res.body.error || 'Erro ao enviar');
      }
      if (config.redirectUrl) {
        window.location.href = config.redirectUrl;
      } else {
        showSuccessModal(config.successMessage, config.primaryColor);
      }
    })
    .catch(function(err) {
      errorEl.textContent = err.message;
      errorEl.classList.add('visible');
      btn.disabled = false;
      btn.textContent = config.buttonText;
    });
  });

  if (config.showRecaptcha) {
    var recaptchaScript = document.createElement('script');
    recaptchaScript.src = 'https://www.google.com/recaptcha/api.js';
    recaptchaScript.async = true;
    recaptchaScript.defer = true;
    document.head.appendChild(recaptchaScript);
    recaptchaScript.onload = function() {
      var recaptchaEl = container.querySelector('#ez-recaptcha');
      if (recaptchaEl && window.grecaptcha) {
        window.grecaptcha.render(recaptchaEl, { sitekey: '${recaptchaSiteKey}' });
      }
    };
  }
})();
`;
}

// Legacy generator for old forms using fields[] array
const generateLegacyFormScript = (submitUrl: string, recaptchaSiteKey: string, config: {
  formId: string;
  fields: string[];
  source: string;
  title: string;
  subtitle: string;
  buttonText: string;
  successMessage: string;
  primaryColor: string;
  redirectUrl: string | null;
  showRecaptcha: boolean;
  cardStyles?: { cardBorderEnabled?: boolean; cardBorderColor?: string; cardBorderWidth?: number; cardBorderRadius?: number; cardBgEnabled?: boolean; cardBgColor?: string; fieldBorderColor?: string; fieldBorderWidth?: number; fieldBgColor?: string; buttonHoverBgColor?: string; buttonHoverTextColor?: string; };
}) => {
  // Build fieldsConfig from legacy field metadata for use in validation engine
  const fieldMeta: Record<string, { label: string; type: string; required: boolean; placeholder: string }> = {
    name: { label: 'Nome', type: 'text', placeholder: 'Seu nome completo', required: true },
    email: { label: 'E-mail', type: 'email', placeholder: 'seu@email.com', required: false },
    phone: { label: 'Telefone', type: 'phone', placeholder: '(00) 00000-0000', required: false },
    company: { label: 'Empresa', type: 'text', placeholder: 'Nome da empresa', required: false },
    cnpj: { label: 'CNPJ', type: 'cpf_cnpj', placeholder: '00.000.000/0000-00', required: false },
    razao_social: { label: 'Razão Social', type: 'text', placeholder: 'Razão social da empresa', required: false },
    nome_fantasia: { label: 'Nome Fantasia', type: 'text', placeholder: 'Nome fantasia', required: false },
    employee_count: { label: 'Qtd. Funcionários', type: 'text', placeholder: 'Ex: 10-50', required: false },
    company_segment: { label: 'Segmento da Empresa', type: 'text', placeholder: 'Ex: Tecnologia', required: false },
    cargo: { label: 'Cargo', type: 'text', placeholder: 'Seu cargo', required: false },
    website: { label: 'Site', type: 'url', placeholder: 'https://www.exemplo.com.br', required: false },
    message: { label: 'Mensagem', type: 'textarea', placeholder: 'Como podemos ajudar?', required: false },
  };

  const legacyFieldsConfig = config.fields
    .filter(f => fieldMeta[f])
    .map(f => ({ id: f, ...fieldMeta[f], default_value: '', options: [], validation: {} }));

  const generatedCss = sharedCss(config.primaryColor, config.cardStyles);
  return `
(function() {
  var scripts = document.querySelectorAll('script[data-ez-form]');
  var scriptTag = scripts[scripts.length - 1];
  
  var config = {
    formId: '${config.formId}',
    fields: ${JSON.stringify(config.fields)},
    source: ${JSON.stringify(config.source)},
    title: ${JSON.stringify(config.title)},
    subtitle: ${JSON.stringify(config.subtitle)},
    buttonText: ${JSON.stringify(config.buttonText)},
    successMessage: ${JSON.stringify(config.successMessage)},
    primaryColor: ${JSON.stringify(config.primaryColor)},
    redirectUrl: ${JSON.stringify(config.redirectUrl || '')},
    showRecaptcha: ${config.showRecaptcha ? 'true' : 'false'},
    submitUrl: '${submitUrl}'
  };

  var fieldsConfig = ${JSON.stringify(legacyFieldsConfig)};

  var fieldMeta = {
    name: { label: 'Nome', type: 'text', placeholder: 'Seu nome completo', required: true },
    email: { label: 'E-mail', type: 'email', placeholder: 'seu@email.com', required: false },
    phone: { label: 'Telefone', type: 'tel', placeholder: '(00) 00000-0000', required: false },
    company: { label: 'Empresa', type: 'text', placeholder: 'Nome da empresa', required: false },
    cnpj: { label: 'CNPJ', type: 'text', placeholder: '00.000.000/0000-00', required: false },
    razao_social: { label: 'Razão Social', type: 'text', placeholder: 'Razão social da empresa', required: false },
    nome_fantasia: { label: 'Nome Fantasia', type: 'text', placeholder: 'Nome fantasia', required: false },
    employee_count: { label: 'Qtd. Funcionários', type: 'text', placeholder: 'Ex: 10-50', required: false },
    company_segment: { label: 'Segmento da Empresa', type: 'text', placeholder: 'Ex: Tecnologia', required: false },
    cargo: { label: 'Cargo', type: 'text', placeholder: 'Seu cargo', required: false },
    website: { label: 'Site', type: 'url', placeholder: 'https://www.exemplo.com.br', required: false },
    message: { label: 'Mensagem', type: 'textarea', placeholder: 'Como podemos ajudar?', required: false }
  };

  var container = document.createElement('div');
  container.id = 'ez-form-' + Math.random().toString(36).substr(2, 9);

  var style = document.createElement('style');
  style.textContent = ` + JSON.stringify(generatedCss) + `;
  container.appendChild(style);

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  ${validationEngine()}

  function showSuccessModal(message, color) {
    var overlay = document.createElement('div');
    overlay.className = 'ez-form-success-overlay';
    overlay.innerHTML = '<div class="ez-form-success-modal">' +
      '<div class="ez-form-success-icon-circle"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>' +
      '<h3 class="ez-form-success-title">Enviado com sucesso!</h3>' +
      '<p class="ez-form-success-text">' + escapeHtml(message) + '</p>' +
      '<button class="ez-form-success-btn">Fechar</button>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.querySelector('.ez-form-success-btn').addEventListener('click', function() {
      overlay.remove();
    });
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.remove();
    });
  }

  var html = '<div class="ez-form-wrapper"><div class="ez-form-card">';
  if (config.title) { html += '<h3 class="ez-form-title">' + escapeHtml(config.title) + '</h3>'; }
  if (config.subtitle) { html += '<p class="ez-form-subtitle">' + escapeHtml(config.subtitle) + '</p>'; }
  html += '<form class="ez-form" novalidate>';

  config.fields.forEach(function(field) {
    var meta = fieldMeta[field];
    if (!meta) return;
    html += '<div class="ez-form-group" data-field-id="' + field + '">';
    html += '<label class="ez-form-label">' + meta.label;
    if (meta.required) html += '<span class="ez-required">*</span>';
    html += '</label>';
    if (meta.type === 'textarea') {
      html += '<textarea class="ez-form-textarea" name="' + field + '" placeholder="' + meta.placeholder + '"></textarea>';
    } else {
      html += '<input class="ez-form-input" type="' + meta.type + '" name="' + field + '" placeholder="' + meta.placeholder + '" />';
    }
    html += '<div class="ez-form-field-error"></div>';
    html += '</div>';
  });

  if (config.showRecaptcha) {
    html += '<div class="ez-recaptcha-container" id="ez-recaptcha"></div>';
  }

  html += '<div class="ez-form-error" id="ez-error"></div>';
  html += '<button type="submit" class="ez-form-button">' + escapeHtml(config.buttonText) + '</button>';
  html += '</form>';
  html += '<div class="ez-form-powered">Powered by <a href="https://ezsoft.com.br" target="_blank">EZ Soft</a></div>';
  html += '</div></div>';

  var formDiv = document.createElement('div');
  formDiv.innerHTML = html;
  container.appendChild(formDiv);

  scriptTag.parentNode.insertBefore(container, scriptTag);

  var form = container.querySelector('.ez-form');
  var errorEl = container.querySelector('#ez-error');
  var btn = container.querySelector('.ez-form-button');

  // === Input Masks ===
  function maskCNPJ(v) {
    v = v.replace(/\\D/g, '').slice(0, 14);
    if (v.length > 12) v = v.replace(/(\\d{2})(\\d{3})(\\d{3})(\\d{4})(\\d{1,2})/, '$1.$2.$3/$4-$5');
    else if (v.length > 8) v = v.replace(/(\\d{2})(\\d{3})(\\d{3})(\\d{1,4})/, '$1.$2.$3/$4');
    else if (v.length > 5) v = v.replace(/(\\d{2})(\\d{3})(\\d{1,3})/, '$1.$2.$3');
    else if (v.length > 2) v = v.replace(/(\\d{2})(\\d{1,3})/, '$1.$2');
    return v;
  }

  function maskPhone(v) {
    v = v.replace(/\\D/g, '').slice(0, 11);
    if (v.length > 10) v = v.replace(/(\\d{2})(\\d{5})(\\d{1,4})/, '($1) $2-$3');
    else if (v.length > 6) v = v.replace(/(\\d{2})(\\d{4})(\\d{1,4})/, '($1) $2-$3');
    else if (v.length > 2) v = v.replace(/(\\d{2})(\\d{1,5})/, '($1) $2');
    else if (v.length > 0) v = v.replace(/(\\d{1,2})/, '($1');
    return v;
  }

  var cnpjInput = form.querySelector('[name="cnpj"]');
  if (cnpjInput) {
    cnpjInput.addEventListener('input', function() {
      var pos = this.selectionStart;
      var old = this.value.length;
      this.value = maskCNPJ(this.value);
      var diff = this.value.length - old;
      this.setSelectionRange(pos + diff, pos + diff);
    });
  }

  var phoneInput = form.querySelector('[name="phone"]');
  if (phoneInput) {
    phoneInput.addEventListener('input', function() {
      var pos = this.selectionStart;
      var old = this.value.length;
      this.value = maskPhone(this.value);
      var diff = this.value.length - old;
      this.setSelectionRange(pos + diff, pos + diff);
    });
  }

  var siteInput = form.querySelector('[name="website"]');
  if (siteInput) {
    siteInput.addEventListener('blur', function() {
      var v = this.value.trim();
      if (v && !v.match(/^https?:\\/\\//)) {
        this.value = 'https://' + v;
      }
    });
  }

  // Attach real-time validators
  attachValidators(form, fieldsConfig);

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    errorEl.classList.remove('visible');

    // Run full validation
    var isValid = validateAllFields(form, fieldsConfig);
    if (!isValid) {
      errorEl.textContent = 'Corrija os campos destacados antes de enviar';
      errorEl.classList.add('visible');
      var firstErr = form.querySelector('.ez-invalid');
      if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Enviando...';

    var data = { source: config.source, form_id: config.formId };
    config.fields.forEach(function(field) {
      var input = form.querySelector('[name="' + field + '"]');
      if (input) data[field] = input.value;
    });

    if (config.showRecaptcha && window.grecaptcha) {
      var token = window.grecaptcha.getResponse();
      if (!token) {
        errorEl.textContent = 'Por favor, complete o reCAPTCHA';
        errorEl.classList.add('visible');
        btn.disabled = false;
        btn.textContent = config.buttonText;
        return;
      }
      data['g-recaptcha-response'] = token;
    }

    try {
      var params = new URLSearchParams(window.location.search);
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(function(p) {
        var v = params.get(p);
        if (v) data[p] = v;
      });
    } catch(e) {}

    fetch(config.submitUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    .then(function(res) { return res.json().then(function(j) { return { ok: res.ok, body: j }; }); })
    .then(function(res) {
      if (!res.ok) throw new Error(res.body.error || 'Erro ao enviar');
      if (config.redirectUrl) {
        window.location.href = config.redirectUrl;
      } else {
        showSuccessModal(config.successMessage, config.primaryColor);
      }
    })
    .catch(function(err) {
      errorEl.textContent = err.message;
      errorEl.classList.add('visible');
      btn.disabled = false;
      btn.textContent = config.buttonText;
    });
  });

  if (config.showRecaptcha) {
    var recaptchaScript = document.createElement('script');
    recaptchaScript.src = 'https://www.google.com/recaptcha/api.js';
    recaptchaScript.async = true;
    recaptchaScript.defer = true;
    document.head.appendChild(recaptchaScript);
    recaptchaScript.onload = function() {
      var recaptchaEl = container.querySelector('#ez-recaptcha');
      if (recaptchaEl && window.grecaptcha) {
        window.grecaptcha.render(recaptchaEl, { sitekey: '${recaptchaSiteKey}' });
      }
    };
  }
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
    return new Response('// Error: missing form id parameter', {
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
    .single()

  if (error || !form) {
    return new Response('// Error: form not found or inactive', {
      headers: { ...corsHeaders, 'Content-Type': 'application/javascript; charset=utf-8' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const submitUrl = `${supabaseUrl}/functions/v1/lead-form-submit`
  const recaptchaSiteKey = Deno.env.get('RECAPTCHA_SITE_KEY') || ''
  const isPreview = url.searchParams.get('preview') === '1' || url.searchParams.get('preview') === 'true'

  let script: string
  if (form.fields_schema && Array.isArray(form.fields_schema) && form.fields_schema.length > 0) {
    script = generateSchemaFormScript(submitUrl, recaptchaSiteKey, {
      formId: form.id,
      fieldsSchema: form.fields_schema,
      source: form.source || 'Formulário Web',
      title: form.title || '',
      subtitle: form.subtitle || '',
      buttonText: form.button_text || 'Enviar',
      successMessage: form.success_message || 'Obrigado!',
      primaryColor: form.primary_color || '#7c3aed',
      redirectUrl: form.redirect_url || null,
      showRecaptcha: form.show_recaptcha || false,
      cardStyles: {
        cardBorderEnabled: form.card_border_enabled ?? true,
        cardBorderColor: form.card_border_color || '#e5e7eb',
        cardBorderWidth: form.card_border_width ?? 1,
        cardBorderRadius: form.card_border_radius ?? 12,
        cardBgEnabled: form.card_bg_enabled ?? true,
        cardBgColor: form.card_bg_color || '#ffffff',
        fieldBorderColor: form.field_border_color || '#d1d5db',
        fieldBorderWidth: form.field_border_width ?? 1,
        fieldBgColor: form.field_bg_color || '#ffffff',
        buttonHoverBgColor: form.button_hover_bg_color || undefined,
        buttonHoverTextColor: form.button_hover_text_color || undefined,
      },
    })
  } else {
    script = generateLegacyFormScript(submitUrl, recaptchaSiteKey, {
      formId: form.id,
      fields: form.fields || ['name', 'email', 'phone', 'company'],
      source: form.source || 'Formulário Web',
      title: form.title || '',
      subtitle: form.subtitle || '',
      buttonText: form.button_text || 'Enviar',
      successMessage: form.success_message || 'Obrigado!',
      primaryColor: form.primary_color || '#7c3aed',
      redirectUrl: form.redirect_url || null,
      showRecaptcha: form.show_recaptcha || false,
      cardStyles: {
        cardBorderEnabled: form.card_border_enabled ?? true,
        cardBorderColor: form.card_border_color || '#e5e7eb',
        cardBorderWidth: form.card_border_width ?? 1,
        cardBorderRadius: form.card_border_radius ?? 12,
        cardBgEnabled: form.card_bg_enabled ?? true,
        cardBgColor: form.card_bg_color || '#ffffff',
        fieldBorderColor: form.field_border_color || '#d1d5db',
        fieldBorderWidth: form.field_border_width ?? 1,
        fieldBgColor: form.field_bg_color || '#ffffff',
        buttonHoverBgColor: form.button_hover_bg_color || undefined,
        buttonHoverTextColor: form.button_hover_text_color || undefined,
      },
    })
  }

  if (isPreview) {
    const embedUrl = `${supabaseUrl}/functions/v1/lead-form-embed?id=${formId}`
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${(form.title || form.name || 'Formulário').replace(/&/g, '&amp;').replace(/"/g, '&quot;')}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
  </style>
</head>
<body>
  <script data-ez-form src="${embedUrl}"></script>
</body>
</html>`
    return new Response(html, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    })
  }

  return new Response(script, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
})
