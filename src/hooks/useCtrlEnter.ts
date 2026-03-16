import { useEffect, useCallback } from 'react';

/**
 * Hook that triggers a callback on Ctrl+Enter (or Cmd+Enter on Mac).
 * @param callback Function to call when shortcut is pressed
 * @param enabled Whether the shortcut is active (e.g., form is valid)
 */
export const useCtrlEnter = (callback: () => void, enabled: boolean = true) => {
  const handler = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && enabled) {
      e.preventDefault();
      callback();
    }
  }, [callback, enabled]);

  useEffect(() => {
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handler]);
};
