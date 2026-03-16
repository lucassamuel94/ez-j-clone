// Shared field validation utility
// Returns empty string if valid, or error message in Portuguese

export type FieldType = 'text' | 'email' | 'phone' | 'number' | 'date' | 'url' | 'cpf' | 'cnpj' | 'cpf_cnpj' | 'textarea' | 'checkbox' | 'combobox' | 'option_list' | 'file_upload' | 'hidden' | 'divider' | 'html_info';

interface ValidationOptions {
  min?: number;
  max?: number;
  regex?: string;
  regexMessage?: string;
}

export function validateField(
  type: FieldType | string,
  value: string,
  required?: boolean,
  validation?: ValidationOptions
): string {
  const v = (value || '').trim();

  // Required check
  if (required && !v) {
    return 'Campo obrigatório';
  }

  // Skip further checks if empty and not required
  if (!v) return '';

  switch (type) {
    case 'email':
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'E-mail inválido';
      if (v.length > 255) return 'E-mail muito longo (máx 255)';
      break;

    case 'phone': {
      const digits = v.replace(/\D/g, '');
      if (digits.length < 10) return 'Telefone incompleto (mín. 10 dígitos)';
      if (digits.length > 15) return 'Telefone inválido (máx. 15 dígitos)';
      break;
    }

    case 'url':
      if (!/^https?:\/\/.+/.test(v) && !/^[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}/.test(v))
        return 'URL inválida';
      break;

    case 'number': {
      const num = Number(v);
      if (isNaN(num)) return 'Deve ser um número';
      if (validation?.min !== undefined && num < validation.min)
        return `Deve ser no mínimo ${validation.min}`;
      if (validation?.max !== undefined && num > validation.max)
        return `Deve ser no máximo ${validation.max}`;
      break;
    }

    case 'cpf': {
      const cpfDigits = v.replace(/\D/g, '');
      if (cpfDigits.length !== 11) return 'CPF deve ter 11 dígitos';
      break;
    }

    case 'cnpj': {
      const cnpjDigits = v.replace(/\D/g, '');
      if (cnpjDigits.length !== 14) return 'CNPJ deve ter 14 dígitos';
      break;
    }

    case 'cpf_cnpj': {
      const d = v.replace(/\D/g, '');
      if (d.length !== 11 && d.length !== 14) return 'CPF ou CNPJ inválido';
      break;
    }

    case 'date':
      if (isNaN(Date.parse(v))) return 'Data inválida';
      break;

    default:
      if (v.length > 500) return 'Texto muito longo';
      break;
  }

  // Custom regex validation
  if (validation?.regex && type !== 'number') {
    try {
      const re = new RegExp(validation.regex);
      if (!re.test(v)) return validation.regexMessage || 'Formato inválido';
    } catch {
      // ignore invalid regex
    }
  }

  return '';
}
