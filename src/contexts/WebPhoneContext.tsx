import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

interface LeadInfo {
  id: string;
  name: string;
  company: string;
}

interface WebPhoneContextType {
  dialedNumber: string;
  isExpanded: boolean;
  currentLead: LeadInfo | null;
  setDialedNumber: (number: string) => void;
  setIsExpanded: (expanded: boolean) => void;
  dialNumber: (number: string, lead?: LeadInfo) => void;
  clearNumber: () => void;
}

const WebPhoneContext = createContext<WebPhoneContextType | undefined>(undefined);

export const WebPhoneProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dialedNumber, setDialedNumber] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentLead, setCurrentLead] = useState<LeadInfo | null>(null);

  const dialNumber = useCallback((number: string, lead?: LeadInfo) => {
    setDialedNumber(number);
    setCurrentLead(lead || null);
    setIsExpanded(true);
  }, []);

  const clearNumber = useCallback(() => {
    setDialedNumber('');
    setCurrentLead(null);
  }, []);

  const value = useMemo(() => ({
    dialedNumber,
    isExpanded,
    currentLead,
    setDialedNumber,
    setIsExpanded,
    dialNumber,
    clearNumber,
  }), [dialedNumber, isExpanded, currentLead, dialNumber, clearNumber]);

  return (
    <WebPhoneContext.Provider value={value}>
      {children}
    </WebPhoneContext.Provider>
  );
};

export const useWebPhone = () => {
  const context = useContext(WebPhoneContext);
  if (!context) {
    throw new Error('useWebPhone must be used within WebPhoneProvider');
  }
  return context;
};
