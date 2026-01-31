import React, { createContext, useContext, useEffect } from 'react';
import { useSelector } from '@xstate/react';
import { createActor } from 'xstate';
import { uiMachine } from '@/lib/state/uiMachine';

// Create the actor once at the module level and start it.
const uiActor = createActor(uiMachine).start();

// Context value is the actor reference
const UIActorContext = createContext<typeof uiActor | null>(
  null
);

export const UIStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    // ===== State transition logging =====
    const unsub = uiActor.subscribe((snap) => {
      // eslint-disable-next-line no-console
      console.log('[uiMachine] state →', snap.value, snap.context);
    });

    // ===== IPC → uiMachine bridges =====
    // chat API result mapping
    const onApiSuccess = () => {
      // eslint-disable-next-line no-console
      console.log('[IPC] api-success');
      uiActor.send({ type: 'API_SUCCESS', data: null });
    };
    const onApiError = (err: any) => {
      // eslint-disable-next-line no-console
      console.log('[IPC] api-error', err);
      uiActor.send({ type: 'API_ERROR', error: err });
    };
    const onLiveReady = () => {
      // eslint-disable-next-line no-console
      console.log('[IPC] live-audio-ready');
      uiActor.send({ type: 'LIVE_READY' });
    };
    const onLiveError = (err: any) => {
      // eslint-disable-next-line no-console
      console.log('[IPC] live-audio-error', err);
      uiActor.send({ type: 'LIVE_ERROR', error: err });
    };

    window.api.receive('api-success', onApiSuccess);
    window.api.receive('api-error', onApiError);
    window.api.receive('live-audio-ready', onLiveReady);
    window.api.receive('live-audio-error', onLiveError);

    const onCtrlEnter = () => {
      const snap = uiActor.getSnapshot();

      // Helper to focus the chat input if available
      const focusInput = () => {
        (window as any).chatInputAPI?.focus?.();
      };

      // If chat pane already open → close it
      if (snap.matches('chat')) {
        uiActor.send({ type: 'ESC' });
        return;
      }

      // Otherwise, not in chat yet → open chat mode
      uiActor.send({ type: 'OPEN_CHAT' });

      // Focus input shortly after opening
      setTimeout(() => focusInput(), 0);
    };

    const onEsc = () => uiActor.send({ type: 'ESC' });

    const onToggleSession = () => {
      window.dispatchEvent(new CustomEvent('toggle-session'));
    };

    const onToggleVoice = () => {
      window.dispatchEvent(new CustomEvent('toggle-voice'));
    };

    window.api.receive('shortcut:ctrl-enter', onCtrlEnter);
    window.api.receive('shortcut:esc', onEsc);
    window.api.receive('shortcut:toggle-session', onToggleSession);
    window.api.receive('shortcut:toggle-voice', onToggleVoice);

    return () => {
      unsub.unsubscribe();
      window.api.removeAllListeners('api-success');
      window.api.removeAllListeners('api-error');
      window.api.removeAllListeners('live-audio-ready');
      window.api.removeAllListeners('live-audio-error');
      window.api.removeAllListeners('shortcut:ctrl-enter');
      window.api.removeAllListeners('shortcut:esc');
      window.api.removeAllListeners('shortcut:toggle-session');
      window.api.removeAllListeners('shortcut:toggle-voice');
    };
  }, []);

  return <UIActorContext.Provider value={uiActor}>{children}</UIActorContext.Provider>;
};

export function useUIActor() {
  const actor = useContext(UIActorContext);
  if (!actor) {
    throw new Error('useUIActor must be used within UIStateProvider');
  }
  return actor;
}

// Convenience hook for selecting state inside the machine
export function useUIState<T>(selector: (state: any) => T): T {
  const actor = useUIActor();
  return useSelector(actor, selector);
}
