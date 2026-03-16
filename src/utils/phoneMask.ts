// Phone mask utility with country code support
// Supports multiple countries with flags

// Country code to flag image URL mapping (using flagcdn.com)
export const countryData: Record<string, { flag: string; code: string; name: string }> = {
  '1': { flag: 'us', code: 'US', name: 'Estados Unidos' },
  '55': { flag: 'br', code: 'BR', name: 'Brasil' },
  '54': { flag: 'ar', code: 'AR', name: 'Argentina' },
  '56': { flag: 'cl', code: 'CL', name: 'Chile' },
  '57': { flag: 'co', code: 'CO', name: 'Colômbia' },
  '58': { flag: 've', code: 'VE', name: 'Venezuela' },
  '51': { flag: 'pe', code: 'PE', name: 'Peru' },
  '52': { flag: 'mx', code: 'MX', name: 'México' },
  '53': { flag: 'cu', code: 'CU', name: 'Cuba' },
  '591': { flag: 'bo', code: 'BO', name: 'Bolívia' },
  '593': { flag: 'ec', code: 'EC', name: 'Equador' },
  '595': { flag: 'py', code: 'PY', name: 'Paraguai' },
  '598': { flag: 'uy', code: 'UY', name: 'Uruguai' },
  '351': { flag: 'pt', code: 'PT', name: 'Portugal' },
  '34': { flag: 'es', code: 'ES', name: 'Espanha' },
  '33': { flag: 'fr', code: 'FR', name: 'França' },
  '49': { flag: 'de', code: 'DE', name: 'Alemanha' },
  '44': { flag: 'gb', code: 'GB', name: 'Reino Unido' },
  '39': { flag: 'it', code: 'IT', name: 'Itália' },
  '81': { flag: 'jp', code: 'JP', name: 'Japão' },
  '86': { flag: 'cn', code: 'CN', name: 'China' },
};

export const getCountryFlagUrl = (countryCode: string): string => {
  const country = countryData[countryCode];
  if (country) {
    return `https://flagcdn.com/w20/${country.flag}.png`;
  }
  return `https://flagcdn.com/w20/br.png`; // Default to Brazil
};

export const getCountryCode2Letter = (countryCode: string): string => {
  const country = countryData[countryCode];
  return country?.code || 'BR';
};

export const extractCountryCode = (digits: string): { countryCode: string; localNumber: string } => {
  // Try to match known country codes (longest first)
  const sortedCodes = Object.keys(countryData).sort((a, b) => b.length - a.length);
  
  for (const code of sortedCodes) {
    if (digits.startsWith(code)) {
      return {
        countryCode: code,
        localNumber: digits.slice(code.length)
      };
    }
  }
  
  // Default to Brazil
  return { countryCode: '55', localNumber: digits };
};

export const formatLocalNumber = (localNumber: string, countryCode: string): string => {
  if (!localNumber) return '';
  
  // Brazilian format
  if (countryCode === '55') {
    let formatted = '';
    
    if (localNumber.length >= 2) {
      formatted += '(' + localNumber.slice(0, 2) + ')';
    } else {
      return localNumber;
    }
    
    if (localNumber.length > 2) {
      formatted += ' ';
      const rest = localNumber.slice(2);
      
      if (rest.length <= 4) {
        formatted += rest;
      } else if (rest.length <= 8) {
        if (rest.startsWith('9') && rest.length > 4) {
          formatted += rest.slice(0, 5) + '-' + rest.slice(5);
        } else {
          formatted += rest.slice(0, 4) + '-' + rest.slice(4);
        }
      } else {
        formatted += rest.slice(0, 5) + '-' + rest.slice(5, 9);
      }
    }
    
    return formatted;
  }
  
  // Generic format for other countries
  if (localNumber.length <= 4) {
    return localNumber;
  } else if (localNumber.length <= 7) {
    return localNumber.slice(0, 3) + '-' + localNumber.slice(3);
  } else {
    return localNumber.slice(0, 3) + '-' + localNumber.slice(3, 6) + '-' + localNumber.slice(6, 10);
  }
};

export const formatPhoneNumber = (value: string): string => {
  // Remove all non-digit characters
  let digits = value.replace(/[^\d]/g, '');
  
  if (!digits) return '';
  
  // Extract country code or default to Brazil
  const { countryCode, localNumber } = extractCountryCode(digits);
  
  // Limit local number length
  const maxLocalLength = countryCode === '55' ? 11 : 10;
  const trimmedLocal = localNumber.slice(0, maxLocalLength);
  
  return `+${countryCode} ${formatLocalNumber(trimmedLocal, countryCode)}`.trim();
};

export const formatPhoneWithFlag = (value: string): { flagUrl: string; countryCode: string; localNumber: string } => {
  const digits = value.replace(/[^\d]/g, '');
  
  if (!digits) {
    return { flagUrl: getCountryFlagUrl('55'), countryCode: '+55', localNumber: '' };
  }
  
  const { countryCode, localNumber } = extractCountryCode(digits);
  
  return {
    flagUrl: getCountryFlagUrl(countryCode),
    countryCode: `+${countryCode}`,
    localNumber: formatLocalNumber(localNumber, countryCode)
  };
};

export const unformatPhoneNumber = (value: string): string => {
  const digits = value.replace(/[^\d]/g, '');
  return digits ? '+' + digits : '';
};

export const isValidBrazilianPhone = (value: string): boolean => {
  const digits = value.replace(/[^\d]/g, '');
  return digits.length >= 12 && digits.length <= 13 && digits.startsWith('55');
};
