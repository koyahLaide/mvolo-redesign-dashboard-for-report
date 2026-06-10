'use client';

import { createContext, useContext, useState } from 'react';
import { DOMAINS } from '@/lib/seo/mock-data';

interface DomainCtx {
  domain: string;
  setDomain: (d: string) => void;
}

export const DomainContext = createContext<DomainCtx>({
  domain: DOMAINS[0],
  setDomain: () => {},
});

export function DomainProvider({ children }: { children: React.ReactNode }) {
  const [domain, setDomain] = useState(DOMAINS[0]);
  return (
    <DomainContext.Provider value={{ domain, setDomain }}>
      {children}
    </DomainContext.Provider>
  );
}

export function useDomain() {
  return useContext(DomainContext);
}
