import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatPhoneWithFlag, countryData } from '@/utils/phoneMask';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export const PhoneInput = ({
  value,
  onChange,
  onBlur,
  placeholder = '(00) 00000-0000',
  className,
  autoFocus,
}: PhoneInputProps) => {
  const [displayValue, setDisplayValue] = useState('');
  const [phoneData, setPhoneData] = useState(() => formatPhoneWithFlag(value));
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const data = formatPhoneWithFlag(value);
    setPhoneData(data);
    setDisplayValue(data.localNumber);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    // Keep only digits and format
    const digits = inputValue.replace(/[^\d]/g, '');
    
    // Combine with current country code
    const fullNumber = phoneData.countryCode.replace('+', '') + digits;
    const newData = formatPhoneWithFlag(fullNumber);
    
    setPhoneData(newData);
    setDisplayValue(newData.localNumber);
    onChange(`${newData.countryCode} ${newData.localNumber}`.trim());
  };

  const handleCountrySelect = (code: string) => {
    const currentLocalDigits = phoneData.localNumber.replace(/[^\d]/g, '');
    const fullNumber = code + currentLocalDigits;
    const newData = formatPhoneWithFlag(fullNumber);
    
    setPhoneData(newData);
    setDisplayValue(newData.localNumber);
    onChange(`${newData.countryCode} ${newData.localNumber}`.trim());
    setIsOpen(false);
  };

  // Get sorted country list for dropdown
  const countries = Object.entries(countryData)
    .map(([code, data]) => ({
      code,
      ...data,
      flagUrl: `https://flagcdn.com/w20/${data.flag}.png`
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Check if className contains border-0 to apply borderless style
  const isBorderless = className?.includes('border-0');

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {/* Country Selector */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex items-center gap-1 h-8 px-2 rounded-md transition-colors",
              isBorderless 
                ? "bg-transparent hover:bg-accent/50" 
                : "border border-input bg-background hover:bg-accent"
            )}
          >
            <img 
              src={phoneData.flagUrl} 
              alt="Country flag" 
              className="w-5 h-auto rounded-sm"
            />
            <span className="text-sm text-muted-foreground">{phoneData.countryCode}</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0 max-h-64 overflow-y-auto" align="start">
          <div className="flex flex-col">
            {countries.map((country) => (
              <button
                key={country.code}
                type="button"
                className={cn(
                  "flex items-center gap-3 px-3 py-2 hover:bg-accent transition-colors text-left",
                  phoneData.countryCode === `+${country.code}` && "bg-accent"
                )}
                onClick={() => handleCountrySelect(country.code)}
              >
                <img 
                  src={country.flagUrl} 
                  alt={country.name} 
                  className="w-5 h-auto rounded-sm"
                />
                <span className="text-sm flex-1">{country.name}</span>
                <span className="text-sm text-muted-foreground">+{country.code}</span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      
      {/* Local Number */}
      <Input
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        className={cn(
          "h-8 text-sm flex-1",
          isBorderless 
            ? "border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0" 
            : "bg-background"
        )}
        autoFocus={autoFocus}
        onBlur={onBlur}
        type="tel"
      />
    </div>
  );
};
