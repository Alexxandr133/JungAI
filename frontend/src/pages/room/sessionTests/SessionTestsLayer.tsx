import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import { Brain } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../../lib/api';
import { AssociationPanel } from './AssociationPanel';
import { PyramidPanel } from './PyramidPanel';
import { SessionTestPip } from './SessionTestPip';
import { TestSettingsModal } from './TestSettingsModal';
import { applyAssociationFlag, applyAssociationSubmit, associationReport, presentAssociationWord } from './sessionTestLogic';
import { defaultAssociationWords, loadSessionTestSettings, saveSessionTestSettings } from './sessionTestSettings';
import type { AssociationState, PyramidState, SessionTestMessage, SessionTestState } from './types';
import { freshAssociation, freshPyramid, newSessionId } from './types';
import { useSessionTestSync } from './useSessionTestSync';
import './sessionTests.css';

type Ctx = {
  isTherapist: boolean;
  enabled: boolean;
  overlayOpen: boolean;
  togglePicker: () => void;
  closeAll: () => void;
  openChat: () => void;
  pickerOpen: boolean;
  state: SessionTestState;
  notes: string;
  setNotes: (v: string) => void;
  startTest: (kind: 'association' | 'pyramid') => void;
  updateAssociation: (mut: (s: AssociationState) => AssociationState) => void;
  clientPyramidPatch: (patch: Partial<PyramidState>) => void;
  clientAssociationSubmit: (text: string, reactionMs: number) => void;
  completePyramid: () => void;
  localIdentity: string;
  settingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;
  wordBank: string[];
  saveResult: () => void;
  saving: boolean;
  saved: boolean;
  saveError: string | null;
};

const SessionTestsCtx = createContext<Ctx | null>(null);

export function SessionTestsProvider({
  isTherapist,
  enabled,
  clientId,
  eventId,
  onOpenChat,
  children
}: {
  isTherapist: boolean;
  enabled: boolean;
  clientId?: string | null;
  eventId?: string | null;
  onOpenChat: () => void;
  children: ReactNode;
}) {
  const { token } = useAuth();
  const { localParticipant } = useLocalParticipant();
  const localIdentity = localParticipant.identity || '';
  const [pickerOpen, setPickerOpen] = useState(false);
  const [state, setState] = useState<SessionTestState>(null);
  const [notes, setNotes] = useState('');
  const [wordBank, setWordBank] = useState<string[]>(defaultAssociationWords);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!isTherapist || !token) return;
    void loadSessionTestSettings(token).then((s) => setWordBank(s.associationWords));
  }, [isTherapist, token]);

  const onClientMessage = useCallback((msg: SessionTestMessage) => {
    setState((prev) => {
      if (!prev) return prev;
      if (msg.type === 'association_submit' && prev.kind === 'association') {
        const next = applyAssociationSubmit(prev, msg.wordIndex, msg.runNumber, msg.text, msg.reactionMs);
        queueMicrotask(() => broadcastRef.current(next));
        return next;
      }
      if (msg.type === 'pyramid_patch' && prev.kind === 'pyramid') {
        return {
          ...prev,
          query: msg.query ?? prev.query,
          step: msg.step ?? prev.step,
          currentLevel: msg.currentLevel ?? prev.currentLevel,
          levels: msg.levels ?? prev.levels,
          pauseEndsAt: msg.pauseEndsAt === undefined ? prev.pauseEndsAt : msg.pauseEndsAt
        };
      }
      return prev;
    });
  }, []);

  const { send, broadcastState } = useSessionTestSync(
    state,
    setState,
    isTherapist,
    isTherapist ? onClientMessage : undefined
  );
  const broadcastRef = useRef(broadcastState);
  broadcastRef.current = broadcastState;

  const overlayOpen = pickerOpen || Boolean(state);

  const closeAll = useCallback(() => {
    setPickerOpen(false);
    setState(null);
    setSaved(false);
    setSaveError(null);
    send({ type: 'close' });
  }, [send]);

  const togglePicker = useCallback(() => {
    if (state) {
      closeAll();
      return;
    }
    setPickerOpen((v) => !v);
  }, [state, closeAll]);

  const startTest = useCallback(
    (kind: 'association' | 'pyramid') => {
      const next =
        kind === 'association'
          ? freshAssociation(newSessionId(), localIdentity, wordBank)
          : freshPyramid(newSessionId(), localIdentity);
      setPickerOpen(false);
      setNotes('');
      setSaved(false);
      setSaveError(null);
      setState(next);
      broadcastState(next);
    },
    [broadcastState, localIdentity, wordBank]
  );

  const updateAssociation = useCallback(
    (mut: (s: AssociationState) => AssociationState) => {
      setState((prev) => {
        if (!prev || prev.kind !== 'association') return prev;
        const next = mut(prev);
        broadcastState(next);
        return next;
      });
    },
    [broadcastState]
  );

  const debouncePatch = useRef<number | null>(null);
  const clientPyramidPatch = useCallback(
    (patch: Partial<PyramidState>) => {
      setState((prev) => {
        if (!prev || prev.kind !== 'pyramid') return prev;
        const next = { ...prev, ...patch };
        if (debouncePatch.current) window.clearTimeout(debouncePatch.current);
        debouncePatch.current = window.setTimeout(() => {
          send({
            type: 'pyramid_patch',
            query: next.query,
            step: next.step,
            currentLevel: next.currentLevel,
            levels: next.levels,
            pauseEndsAt: next.pauseEndsAt
          });
        }, 180);
        return next;
      });
    },
    [send]
  );

  const clientAssociationSubmit = useCallback(
    (text: string, reactionMs: number) => {
      setState((prev) => {
        if (!prev || prev.kind !== 'association') return prev;
        const next = applyAssociationSubmit(prev, prev.idx, prev.runNumber, text, reactionMs);
        send({
          type: 'association_submit',
          wordIndex: prev.idx,
          runNumber: prev.runNumber,
          text,
          reactionMs
        });
        return next;
      });
    },
    [send]
  );

  const completePyramid = useCallback(() => {
    setState((prev) => {
      if (!prev || prev.kind !== 'pyramid') return prev;
      const next = { ...prev, step: 'done' as const };
      broadcastState(next);
      return next;
    });
  }, [broadcastState]);

  const saveResult = useCallback(async () => {
    if (!token) {
      setSaveError('Нужно войти в аккаунт, чтобы сохранить результат.');
      return;
    }
    if (!clientId) {
      setSaveError('У этой сессии нет клиента в карточке. Привяжите клиента и повторите.');
      return;
    }
    if (!state) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload =
        state.kind === 'association'
          ? { ...state, report: associationReport(state), notes, eventId }
          : { ...state, notes, eventId };
      await api('/api/tests/results', {
        method: 'POST',
        token,
        body: {
          testType: state.kind === 'association' ? 'association-session' : 'pyramid-session',
          clientId,
          result: payload
        }
      });
      setSaved(true);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Не удалось сохранить результат');
    } finally {
      setSaving(false);
    }
  }, [token, clientId, state, notes, eventId]);

  const value = useMemo<Ctx>(
    () => ({
      isTherapist,
      enabled,
      overlayOpen,
      togglePicker,
      closeAll,
      openChat: onOpenChat,
      pickerOpen,
      state,
      notes,
      setNotes,
      startTest,
      updateAssociation,
      clientPyramidPatch,
      clientAssociationSubmit,
      completePyramid,
      localIdentity,
      settingsOpen,
      setSettingsOpen,
      wordBank,
      saveResult,
      saving,
      saved,
      saveError
    }),
    [
      isTherapist,
      enabled,
      overlayOpen,
      togglePicker,
      closeAll,
      onOpenChat,
      pickerOpen,
      state,
      notes,
      startTest,
      updateAssociation,
      clientPyramidPatch,
      clientAssociationSubmit,
      completePyramid,
      localIdentity,
      settingsOpen,
      wordBank,
      saveResult,
      saving,
      saved,
      saveError
    ]
  );

  return (
    <SessionTestsCtx.Provider value={value}>
      <div className="session-tests-root">{children}</div>
      <TestSettingsModal
        open={settingsOpen}
        words={wordBank}
        saving={savingSettings}
        onClose={() => setSettingsOpen(false)}
        onSave={async (words) => {
          if (!token) return;
          setSavingSettings(true);
          try {
            const next = await saveSessionTestSettings(token, { associationWords: words });
            setWordBank(next.associationWords);
            setSettingsOpen(false);
          } finally {
            setSavingSettings(false);
          }
        }}
      />
    </SessionTestsCtx.Provider>
  );
}

export function SessionTestsStageGate({ children }: { children: ReactNode }) {
  const ctx = useContext(SessionTestsCtx);
  if (ctx?.overlayOpen) return null;
  return children;
}

export function useSessionTestsOverlay() {
  return Boolean(useContext(SessionTestsCtx)?.overlayOpen);
}

export function SessionTestsButton() {
  const ctx = useContext(SessionTestsCtx);
  if (!ctx?.enabled || !ctx.isTherapist) return null;
  return (
    <button
      type="button"
      className={`voice-room-ctrl-btn voice-room-ctrl-btn--pill${ctx.overlayOpen ? ' voice-room-ctrl-btn--active' : ''}`}
      title="Тесты"
      onClick={ctx.togglePicker}
    >
      <Brain size={18} strokeWidth={2} />
      <span className="voice-room-ctrl-label">Тесты</span>
    </button>
  );
}

export function SessionTestsLayerRoot() {
  const ctx = useContext(SessionTestsCtx);
  if (!ctx?.enabled) return null;

  const overlayOpen = ctx.pickerOpen || Boolean(ctx.state);
  const showTherapistUi =
    ctx.isTherapist && (!ctx.state || !ctx.state.therapistIdentity || ctx.state.therapistIdentity === ctx.localIdentity);

  return (
    <div className="session-tests-layer-root">
      {overlayOpen && (
        <>
          <div className={`session-test-overlay${showTherapistUi ? ' is-desk' : ''}`} aria-live="polite">
            {ctx.pickerOpen && showTherapistUi && !ctx.state && (
              <div className="st-pick">
                <div className="st-close-row">
                  <button type="button" className="st-close" onClick={() => ctx.setSettingsOpen(true)}>
                    Настройки теста
                  </button>
                  <button type="button" className="st-close" onClick={ctx.togglePicker}>
                    Закрыть
                  </button>
                </div>
                <h2>Какой тест открыть</h2>
                <p>Клиент видит только свою сторону, вы — только свою.</p>
                <ol>
                  <li>
                    <button type="button" onClick={() => ctx.startTest('association')}>
                      Ассоциативный тест
                      <small>{ctx.wordBank.length} слов и время реакции</small>
                    </button>
                  </li>
                  <li>
                    <button type="button" onClick={() => ctx.startTest('pyramid')}>
                      Пирамида ассоциаций
                      <small>от 16 слов к одному</small>
                    </button>
                  </li>
                </ol>
              </div>
            )}

            {ctx.state?.kind === 'association' && (
              <AssociationPanel
                state={ctx.state}
                isTherapist={showTherapistUi}
                finished={ctx.state.status === 'done'}
                onAdvance={() =>
                  ctx.updateAssociation((s) => presentAssociationWord(s.status === 'idle' ? { ...s, idx: -1 } : s))
                }
                onStartRun2={() =>
                  ctx.updateAssociation((s) => ({ ...s, runNumber: 2, idx: -1, word: null, status: 'idle' }))
                }
                onFinish={() => ctx.updateAssociation((s) => ({ ...s, status: 'done' }))}
                onFlag={(wordIndex, runNumber, flag) =>
                  ctx.updateAssociation((s) => applyAssociationFlag(s, wordIndex, runNumber, flag))
                }
                onSubmit={ctx.clientAssociationSubmit}
                onSaveResult={ctx.saveResult}
                onCloseTest={ctx.closeAll}
                onOpenSettings={() => ctx.setSettingsOpen(true)}
                saving={ctx.saving}
                saved={ctx.saved}
                saveError={ctx.saveError}
              />
            )}

            {ctx.state?.kind === 'pyramid' && (
              <PyramidPanel
                state={ctx.state}
                isTherapist={showTherapistUi}
                notes={ctx.notes}
                onNotes={ctx.setNotes}
                onComplete={ctx.completePyramid}
                onPatch={ctx.clientPyramidPatch}
                onSaveResult={ctx.saveResult}
                onCloseTest={ctx.closeAll}
                onOpenSettings={() => ctx.setSettingsOpen(true)}
                saving={ctx.saving}
                saved={ctx.saved}
                saveError={ctx.saveError}
              />
            )}

            {showTherapistUi && ctx.state && ctx.state.kind === 'association' && ctx.state.status !== 'done' && (
              <div className="st-close-row">
                <button type="button" className="st-close" onClick={() => ctx.setSettingsOpen(true)}>
                  Настройки теста
                </button>
                <button type="button" className="st-close" onClick={ctx.closeAll}>
                  Закрыть тест
                </button>
              </div>
            )}
            {showTherapistUi && ctx.state && ctx.state.kind === 'pyramid' && ctx.state.step !== 'done' && (
              <div className="st-close-row">
                <button type="button" className="st-close" onClick={() => ctx.setSettingsOpen(true)}>
                  Настройки теста
                </button>
                <button type="button" className="st-close" onClick={ctx.closeAll}>
                  Закрыть тест
                </button>
              </div>
            )}
          </div>
          <SessionTestPip />
        </>
      )}
    </div>
  );
}
