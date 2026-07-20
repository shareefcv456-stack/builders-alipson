import { createContext, useContext, type ReactNode } from 'react';

type UICtx = {
  openQuote: () => void;
  openBrochure: () => void;
  openVideo: () => void;
};

const UIContext = createContext<UICtx>({ openQuote: () => {}, openBrochure: () => {}, openVideo: () => {} });

export function UIProvider({ value, children }: { value: UICtx; children: ReactNode }) {
  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export const useUI = () => useContext(UIContext);
