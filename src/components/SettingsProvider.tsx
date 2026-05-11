"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface BusinessSettings {
  pharmacyName: string;
  dlNumber: string;
  gstin: string;
  contactInfo: string;
  ownerDetails: string;
}

interface SettingsContextType {
  settings: BusinessSettings;
  updateSettings: (newSettings: BusinessSettings) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ 
  children, 
  initialSettings 
}: { 
  children: React.ReactNode; 
  initialSettings: BusinessSettings 
}) {
  const [settings, setSettings] = useState(initialSettings);

  useEffect(() => {
    setSettings(initialSettings);
  }, [initialSettings]);

  const updateSettings = (newSettings: BusinessSettings) => {
    setSettings(newSettings);
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
