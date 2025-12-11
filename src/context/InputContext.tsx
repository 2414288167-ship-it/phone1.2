import React, { createContext, useContext } from "react";

interface InputContextType {
  onInputChange: (value: string) => void;
  onSendAudio: (text: string, duration: number) => void;
  onSendText: () => void;
  input: string;
}

const InputContext = createContext<InputContextType | undefined>(undefined);

export function InputProvider({
  children,
  onInputChange,
  onSendAudio,
  onSendText,
  input,
}: {
  children: React.ReactNode;
  onInputChange: (value: string) => void;
  onSendAudio: (text: string, duration: number) => void;
  onSendText: () => void;
  input: string;
}) {
  return (
    <InputContext.Provider
      value={{ onInputChange, onSendAudio, onSendText, input }}
    >
      {children}
    </InputContext.Provider>
  );
}

export function useInputContext() {
  const context = useContext(InputContext);
  if (!context) {
    throw new Error("useInputContext must be used within InputProvider");
  }
  return context;
}
