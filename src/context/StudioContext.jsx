'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import {
  getComfyAudioCapabilities,
  isComfyOnline,
  resetComfyCapabilityCache,
} from '@/lib/comfyui';

const StudioContext = createContext(null);

function setDocumentDarkMode(enabled) {
  if (typeof document === 'undefined') {
    return;
  }
  document.documentElement.classList.toggle('dark', enabled);
}

export function StudioProvider({ children }) {
  const [comfyOnline, setComfyOnline] = useState(null);
  const [audioCapabilities, setAudioCapabilities] = useState(null);

  // Always dark theme.
  useEffect(() => {
    setDocumentDarkMode(true);
  }, []);

  // Ensure locale classes exist even if LocaleProvider hydrates later.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (!root.dataset.locale) {
      root.dataset.locale = 'en';
      root.classList.add('locale-en');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const online = await isComfyOnline();
      if (cancelled) {
        return;
      }
      setComfyOnline(online);
      if (!online) {
        setAudioCapabilities(null);
        resetComfyCapabilityCache();
        return;
      }

      const audioCaps = await getComfyAudioCapabilities();
      if (!cancelled) {
        setAudioCapabilities(audioCaps);
      }
    };

    check();
    const intervalMs = comfyOnline === false ? 5000 : 15000;
    const intervalId = setInterval(check, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [comfyOnline]);

  const value = useMemo(
    () => ({
      comfyOnline,
      audioCapabilities,
    }),
    [comfyOnline, audioCapabilities],
  );

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio() {
  const context = useContext(StudioContext);
  if (!context) {
    throw new Error('useStudio must be used within StudioProvider');
  }
  return context;
}
