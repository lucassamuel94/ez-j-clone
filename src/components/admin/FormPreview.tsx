import { useState, useCallback } from 'react';
import { sanitizeHtml } from '@/utils/sanitize';
import { Button } from '@/components/ui/button';
import { Monitor, Smartphone, Eye, FormInput } from 'lucide-react';
import { validateField } from '@/utils/fieldValidation';
import type { FieldConfig, FieldType, ConditionalRule } from './FormFieldBuilder';

export interface FormPreviewProps {
  title: string;
  subtitle: string;
  buttonText: string;
  primaryColor: string;
  fields: FieldConfig[];
  showRecaptcha?: boolean;
  buttonWidth?: 'full' | 'auto';
  buttonAlign?: 'center' | 'left' | 'right';
  subtitleAlign?: 'center' | 'left' | 'right';
  showPoweredBy?: boolean;
  showConsent?: boolean;
  consentUrl?: string;
  successMessage?: string;
  cardBorderEnabled?: boolean;
  cardBorderColor?: string;
  cardBorderWidth?: number;
  cardBorderRadius?: number;
  cardBgEnabled?: boolean;
  cardBgColor?: string;
  fieldBorderColor?: string;
  fieldBorderWidth?: number;
  fieldBgColor?: string;
  buttonHoverBgColor?: string;
  buttonHoverTextColor?: string;
}

const widthClass = (w?: string) => {
  if (w === '50%') return 'w-[calc(50%-6px)]';
  if (w === '33%') return 'w-[calc(33.33%-8px)]';
  return 'w-full';
};

const isInputType = (type: FieldType) =>
  ['text', 'email', 'phone', 'number', 'date', 'url', 'cpf', 'cnpj'].includes(type);

const MaterialInput = ({ label, required, type, defaultValue, primaryColor, value, onValueChange, error, onBlur, fieldBorderColor, fieldBorderWidth, fieldBgColor }: {
  label: string; required?: boolean; type?: string; defaultValue?: string; primaryColor?: string;
  value?: string; onValueChange?: (v: string) => void; error?: string; onBlur?: () => void;
  fieldBorderColor?: string; fieldBorderWidth?: number; fieldBgColor?: string;
}) => (
  <div className="relative group">
    <input
      type={type || 'text'}
      placeholder=" "
      value={value ?? defaultValue ?? ''}
      onChange={(e) => onValueChange?.(e.target.value)}
      className={`peer w-full h-14 pt-5 pb-1 px-3 text-sm text-foreground rounded-md outline-none transition-all duration-200`}
      style={{
        border: `${fieldBorderWidth || 1}px solid ${error ? '' : (fieldBorderColor || '')}`,
        ...(error ? { borderColor: 'hsl(var(--destructive))' } : {}),
        backgroundColor: fieldBgColor || '#ffffff',
      }}
      onFocus={(e) => { if (!error) e.currentTarget.style.borderColor = primaryColor || '#5739F8'; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = fieldBorderColor || ''; onBlur?.(); }}
    />
    <label className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none transition-all duration-200 peer-focus:top-3 peer-focus:translate-y-0 peer-focus:text-[10px] peer-[:not(:placeholder-shown)]:top-3 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-[10px]">
      {label}{required && <span className="text-destructive ml-0.5">*</span>}
    </label>
    {error && <p className="text-[10px] text-destructive mt-1 px-3">{error}</p>}
  </div>
);

const MaterialTextarea = ({ label, required, defaultValue, primaryColor, value, onValueChange, error, onBlur, fieldBorderColor, fieldBorderWidth, fieldBgColor }: {
  label: string; required?: boolean; defaultValue?: string; primaryColor?: string;
  value?: string; onValueChange?: (v: string) => void; error?: string; onBlur?: () => void;
  fieldBorderColor?: string; fieldBorderWidth?: number; fieldBgColor?: string;
}) => (
  <div className="relative group">
    <textarea
      placeholder=" "
      value={value ?? defaultValue ?? ''}
      onChange={(e) => onValueChange?.(e.target.value)}
      rows={3}
      className={`peer w-full pt-6 pb-2 px-3 text-sm text-foreground rounded-md outline-none transition-all duration-200 resize-none`}
      style={{
        border: `${fieldBorderWidth || 1}px solid ${error ? '' : (fieldBorderColor || '')}`,
        ...(error ? { borderColor: 'hsl(var(--destructive))' } : {}),
        backgroundColor: fieldBgColor || '#ffffff',
      }}
      onFocus={(e) => { if (!error) e.currentTarget.style.borderColor = primaryColor || '#5739F8'; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = fieldBorderColor || ''; onBlur?.(); }}
    />
    <label className="absolute left-3 top-4 text-xs text-muted-foreground pointer-events-none transition-all duration-200 peer-focus:top-1.5 peer-focus:text-[10px] peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-[10px]">
      {label}{required && <span className="text-destructive ml-0.5">*</span>}
    </label>
    {error && <p className="text-[10px] text-destructive mt-1 px-3">{error}</p>}
  </div>
);

const MaterialSelect = ({ label, required, placeholder, options, primaryColor, value, onValueChange, error, onBlur, fieldBorderColor, fieldBorderWidth, fieldBgColor }: {
  label: string; required?: boolean; placeholder?: string; options?: string[]; primaryColor?: string;
  value?: string; onValueChange?: (v: string) => void; error?: string; onBlur?: () => void;
  fieldBorderColor?: string; fieldBorderWidth?: number; fieldBgColor?: string;
}) => (
  <div className="relative group">
    <select
      value={value || ''}
      onChange={(e) => onValueChange?.(e.target.value)}
      className={`peer w-full h-14 pt-5 pb-1 px-3 text-sm text-foreground rounded-md outline-none transition-all duration-200 appearance-none cursor-pointer`}
      style={{
        border: `${fieldBorderWidth || 1}px solid ${error ? '' : (fieldBorderColor || '')}`,
        ...(error ? { borderColor: 'hsl(var(--destructive))' } : {}),
        backgroundColor: fieldBgColor || '#ffffff',
      }}
      onFocus={(e) => { if (!error) e.currentTarget.style.borderColor = primaryColor || '#5739F8'; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = fieldBorderColor || ''; onBlur?.(); }}
    >
      <option value="">{placeholder || 'Selecione...'}</option>
      {(options || []).map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
    </select>
    <label className="absolute left-3 top-1.5 text-[10px] text-muted-foreground pointer-events-none">
      {label}{required && <span className="text-destructive ml-0.5">*</span>}
    </label>
    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">▾</div>
    {error && <p className="text-[10px] text-destructive mt-1 px-3">{error}</p>}
  </div>
);

const FormPreview = ({ title, subtitle, buttonText, primaryColor, fields, showRecaptcha, buttonWidth = 'full', buttonAlign = 'center', subtitleAlign = 'center', showPoweredBy = true, showConsent = false, consentUrl = '', successMessage = '', cardBorderEnabled = true, cardBorderColor = '#e5e7eb', cardBorderWidth = 1, cardBorderRadius = 12, cardBgEnabled = true, cardBgColor = '#ffffff', fieldBorderColor = '#d1d5db', fieldBorderWidth = 1, fieldBgColor = '#ffffff', buttonHoverBgColor, buttonHoverTextColor }: FormPreviewProps) => {
  const [mode, setMode] = useState<'desktop' | 'mobile'>('desktop');
  const [previewMode, setPreviewMode] = useState<'form' | 'success'>('form');
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const color = primaryColor || '#5739F8';

  const runValidation = useCallback((fieldId: string, fieldType: string, val: string, required?: boolean) => {
    const error = validateField(fieldType, val, required);
    setErrors(prev => ({ ...prev, [fieldId]: error }));
    return error;
  }, []);

  const setValue = useCallback((fieldId: string, val: string, fieldType: string, required?: boolean) => {
    setValues(prev => ({ ...prev, [fieldId]: val }));
    // Re-validate on change only if already touched
    if (touched[fieldId]) {
      runValidation(fieldId, fieldType, val, required);
    }
  }, [touched, runValidation]);

  const handleBlur = useCallback((fieldId: string, fieldType: string, required?: boolean) => {
    setTouched(prev => ({ ...prev, [fieldId]: true }));
    runValidation(fieldId, fieldType, values[fieldId] || '', required);
  }, [values, runValidation]);

  const evaluateCondition = useCallback((rule?: ConditionalRule): boolean => {
    if (!rule?.field_id) return true;
    const val = values[rule.field_id] || '';
    switch (rule.operator) {
      case 'not_empty': return val.trim().length > 0;
      case 'equals': return val === (rule.value || '');
      case 'not_equals': return val !== (rule.value || '');
      case 'contains': return val.toLowerCase().includes((rule.value || '').toLowerCase());
      default: return true;
    }
  }, [values]);

  const containerWidth = mode === 'mobile' ? 'max-w-[375px]' : 'w-full';
  const btnAlignClass = buttonAlign === 'left' ? 'justify-start' : buttonAlign === 'right' ? 'justify-end' : 'justify-center';

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3 h-full overflow-y-auto">
      {/* Mode toggles */}
      <div className="flex items-center justify-center gap-1 flex-wrap">
        <Button type="button" variant={mode === 'desktop' ? 'default' : 'ghost'} size="sm" className="h-7 text-xs gap-1" onClick={() => setMode('desktop')}>
          <Monitor className="h-3.5 w-3.5" /> Desktop
        </Button>
        <Button type="button" variant={mode === 'mobile' ? 'default' : 'ghost'} size="sm" className="h-7 text-xs gap-1" onClick={() => setMode('mobile')}>
          <Smartphone className="h-3.5 w-3.5" /> Mobile
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button type="button" variant={previewMode === 'form' ? 'default' : 'ghost'} size="sm" className="h-7 text-xs gap-1" onClick={() => setPreviewMode('form')}>
          <FormInput className="h-3.5 w-3.5" /> Formulário
        </Button>
        <Button type="button" variant={previewMode === 'success' ? 'default' : 'ghost'} size="sm" className="h-7 text-xs gap-1" onClick={() => setPreviewMode('success')}>
          <Eye className="h-3.5 w-3.5" /> Sucesso
        </Button>
      </div>

      <div
        className={`shadow-sm mx-auto ${containerWidth}`}
        style={{
          border: cardBorderEnabled ? `${cardBorderWidth}px solid ${cardBorderColor}` : 'none',
          borderRadius: `${cardBorderRadius}px`,
          backgroundColor: cardBgEnabled ? cardBgColor : 'transparent',
          padding: '24px',
        }}
      >
        {previewMode === 'success' ? (
          /* Success Modal Preview */
          <div className="relative flex items-center justify-center min-h-[300px]">
            <div className="absolute inset-0 bg-foreground/40 rounded-lg" />
            <div className="relative bg-background rounded-xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center space-y-4 border border-border animate-in fade-in zoom-in-95 duration-300">
              <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-foreground">Enviado com sucesso!</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {successMessage || 'Obrigado! Entraremos em contato em breve.'}
              </p>
              <button
                disabled
                className="mt-2 px-6 h-10 rounded-md text-sm font-medium"
                style={{ backgroundColor: color, color: '#fff' }}
              >
                Fechar
              </button>
            </div>
          </div>
        ) : (
          /* Form Preview */
          <div className="space-y-5">
            {title && <h3 className="text-lg font-semibold text-foreground text-center" style={{ fontFamily: "'Inter', sans-serif" }}>{title}</h3>}
            {subtitle && <p className={`text-[16px] text-muted-foreground -mt-3 ${subtitleAlign === 'left' ? 'text-left' : subtitleAlign === 'right' ? 'text-right' : 'text-center'}`} style={{ fontFamily: "'Inter', sans-serif" }}>{subtitle}</p>}

            {fields.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">Adicione campos para visualizar o formulário.</p>
            )}

            <div className="flex flex-wrap gap-3">
              {fields.map(field => {
                if (field.type === 'hidden') return null;
                if (!evaluateCondition(field.conditional)) return null;

                if (field.type === 'divider') {
                  return <div key={field.id} className="w-full"><hr className="border-border my-2" /></div>;
                }

                if (field.type === 'html_info') {
                  return (
                    <div key={field.id} className="w-full text-xs text-muted-foreground py-1" dangerouslySetInnerHTML={{ __html: sanitizeHtml(field.html_content || '') }} />
                  );
                }

                const w = mode === 'mobile' ? 'w-full' : widthClass(field.width);
                const fieldError = touched[field.id] ? errors[field.id] : undefined;

                return (
                  <div key={field.id} className={w}>
                    {isInputType(field.type) && (
                      <MaterialInput
                        label={field.label}
                        required={field.required}
                        type={field.type === 'phone' || field.type === 'cpf' || field.type === 'cnpj' ? 'text' : field.type}
                        defaultValue={field.default_value}
                        primaryColor={color}
                        value={values[field.id]}
                        onValueChange={(v) => setValue(field.id, v, field.type, field.required)}
                        error={fieldError}
                        onBlur={() => handleBlur(field.id, field.type, field.required)}
                        fieldBorderColor={fieldBorderColor}
                        fieldBorderWidth={fieldBorderWidth}
                        fieldBgColor={fieldBgColor}
                      />
                    )}

                    {field.type === 'textarea' && (
                      <MaterialTextarea
                        label={field.label}
                        required={field.required}
                        defaultValue={field.default_value}
                        primaryColor={color}
                        value={values[field.id]}
                        onValueChange={(v) => setValue(field.id, v, field.type, field.required)}
                        error={fieldError}
                        onBlur={() => handleBlur(field.id, field.type, field.required)}
                        fieldBorderColor={fieldBorderColor}
                        fieldBorderWidth={fieldBorderWidth}
                        fieldBgColor={fieldBgColor}
                      />
                    )}

                    {field.type === 'checkbox' && (
                      <div className="space-y-1 px-1">
                        <span className="text-[14px] text-muted-foreground font-medium">
                          {field.label}{field.required && <span className="text-destructive ml-0.5">*</span>}
                        </span>
                        {(field.options || []).map((opt, i) => {
                          const selected = (values[field.id] || '').split(',').filter(Boolean);
                          const isChecked = selected.includes(opt);
                          return (
                            <label key={i} className="flex items-center gap-3 py-1.5 cursor-pointer"
                              onClick={() => {
                                const next = isChecked ? selected.filter(v => v !== opt) : [...selected, opt];
                                setValue(field.id, next.join(','), field.type, field.required);
                              }}
                            >
                              <div className={`h-4 w-4 rounded-sm border shrink-0 flex items-center justify-center ${isChecked ? 'bg-primary border-primary' : 'border-input'}`}>
                                {isChecked && <span className="text-primary-foreground text-[10px]">✓</span>}
                              </div>
                              <span className="text-sm text-foreground">{opt}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {field.type === 'combobox' && (
                      <MaterialSelect
                        label={field.label}
                        required={field.required}
                        placeholder={field.placeholder}
                        options={field.options}
                        primaryColor={color}
                        value={values[field.id]}
                        onValueChange={(v) => setValue(field.id, v, field.type, field.required)}
                        error={fieldError}
                        onBlur={() => handleBlur(field.id, field.type, field.required)}
                        fieldBorderColor={fieldBorderColor}
                        fieldBorderWidth={fieldBorderWidth}
                        fieldBgColor={fieldBgColor}
                      />
                    )}

                    {field.type === 'option_list' && (
                      <div className="space-y-1 px-1">
                        <span className="text-[14px] text-muted-foreground font-medium">
                          {field.label}{field.required && <span className="text-destructive ml-0.5">*</span>}
                        </span>
                        {(field.options || []).map((opt, i) => (
                          <label key={i} className="flex items-center gap-3 py-1.5 cursor-pointer"
                            onClick={() => setValue(field.id, opt, field.type, field.required)}
                          >
                            <div className={`h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center ${values[field.id] === opt ? 'border-primary' : 'border-input'}`}>
                              {values[field.id] === opt && <div className="h-2 w-2 rounded-full bg-primary" />}
                            </div>
                            <span className="text-sm text-foreground">{opt}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {field.type === 'file_upload' && (
                      <div className="w-full h-14 rounded-md border border-dashed border-input bg-background px-3 flex items-center gap-2 text-sm text-muted-foreground">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        Escolher arquivo...
                      </div>
                    )}

                    {field.help_text && (
                      <p className="text-[10px] text-muted-foreground mt-1 px-3">{field.help_text}</p>
                    )}
                  </div>
                );
              })}
            </div>

            {fields.length > 0 && (
              <div className={`flex ${btnAlignClass}`}>
                  <button
                    disabled
                    className={`${buttonWidth === 'full' ? 'w-full' : 'px-8'} h-11 rounded-md text-sm font-medium tracking-wide shadow-sm transition-all duration-200`}
                    style={{
                      backgroundColor: color,
                      color: '#fff',
                    }}
                    onMouseEnter={(e) => {
                      if (buttonHoverBgColor) e.currentTarget.style.backgroundColor = buttonHoverBgColor;
                      if (buttonHoverTextColor) e.currentTarget.style.color = buttonHoverTextColor;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = color;
                      e.currentTarget.style.color = '#fff';
                    }}
                >
                  {buttonText || 'Enviar'}
                </button>
              </div>
            )}

            {fields.length > 0 && showRecaptcha && (
              <div className="flex justify-center">
                <div className="rounded-md border border-input bg-background px-4 py-2.5 flex items-center gap-2 shadow-sm">
                  <div className="h-4 w-4 rounded-sm border border-input" />
                  <span className="text-xs text-muted-foreground">Não sou um robô</span>
                  <img src="https://www.gstatic.com/recaptcha/api2/logo_48.png" alt="reCAPTCHA" className="h-5 w-5 opacity-60" />
                </div>
              </div>
            )}

            {showConsent && fields.length > 0 && (
              <label className="flex items-start gap-2 cursor-pointer">
                <div className="h-4 w-4 rounded-sm border border-input shrink-0 mt-0.5" />
                <span className="text-[11px] text-muted-foreground leading-tight">
                  Ao enviar este formulário, você concorda com o uso dos seus dados conforme nossa{' '}
                  {(consentUrl || '').trim() ? (
                    <a href={consentUrl} target="_blank" rel="noopener noreferrer" className="underline text-primary hover:text-primary/80">política de privacidade</a>
                  ) : (
                    <span>política de privacidade</span>
                  )}.
                </span>
              </label>
            )}

            {showPoweredBy && <p className="text-[9px] text-muted-foreground text-center">Powered by EZ Soft</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default FormPreview;
