import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type OpenOpts = {
  roomId?: string | null;
  clientName?: string | null;
  draft?: string | null;
};

type MessengerUiContextValue = {
  open: boolean;
  roomId: string | null;
  clientName: string | null;
  draft: string | null;
  openMessenger: (opts?: OpenOpts) => void;
  closeMessenger: () => void;
  setRoomId: (id: string | null) => void;
};

const MessengerUiContext = createContext<MessengerUiContextValue | null>(null);

export function MessengerUiProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);

  const openMessenger = useCallback((opts?: OpenOpts) => {
    setRoomId(opts?.roomId ?? null);
    setClientName(opts?.clientName ?? null);
    setDraft(opts?.draft?.trim() || null);
    setOpen(true);
  }, []);

  const closeMessenger = useCallback(() => {
    setOpen(false);
    setDraft(null);
  }, []);

  const value = useMemo(
    () => ({
      open,
      roomId,
      clientName,
      draft,
      openMessenger,
      closeMessenger,
      setRoomId
    }),
    [open, roomId, clientName, draft, openMessenger, closeMessenger]
  );

  return <MessengerUiContext.Provider value={value}>{children}</MessengerUiContext.Provider>;
}

export function useMessengerUi() {
  const ctx = useContext(MessengerUiContext);
  if (!ctx) throw new Error('useMessengerUi must be used within MessengerUiProvider');
  return ctx;
}

export function useMessengerUiOptional() {
  return useContext(MessengerUiContext);
}
