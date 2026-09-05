import { useCallback, useEffect, useRef } from 'react';
import { useLocalParticipant, useRoomContext } from '@livekit/components-react';
import { ConnectionState, RoomEvent } from 'livekit-client';
import { SESSION_TEST_TOPIC, type SessionTestMessage, type SessionTestState } from './types';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function decodePayload(args: unknown[]): { msg: SessionTestMessage | null; topic?: string } {
  const first = args[0] as { payload?: Uint8Array; topic?: string } | Uint8Array | undefined;
  let payload: Uint8Array | undefined;
  let topic: string | undefined;
  if (first instanceof Uint8Array) {
    payload = first;
    if (typeof args[3] === 'string') topic = args[3];
    else if (typeof args[2] === 'string') topic = args[2];
  } else if (first && first.payload instanceof Uint8Array) {
    payload = first.payload;
    topic = first.topic;
  }
  if (!payload) return { msg: null, topic };
  try {
    return { msg: JSON.parse(decoder.decode(payload)) as SessionTestMessage, topic };
  } catch {
    return { msg: null, topic };
  }
}

function isSessionTestMessage(msg: SessionTestMessage | null): msg is SessionTestMessage {
  return Boolean(msg && typeof msg === 'object' && 'type' in msg);
}

export function useSessionTestSync(
  state: SessionTestState,
  setState: (next: SessionTestState | ((prev: SessionTestState) => SessionTestState)) => void,
  isTherapist: boolean,
  onClientMessage?: (msg: SessionTestMessage) => void
) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const stateRef = useRef(state);
  const handlerRef = useRef(onClientMessage);
  const pendingRef = useRef<SessionTestMessage | null>(null);
  stateRef.current = state;
  handlerRef.current = onClientMessage;

  const publish = useCallback(
    (msg: SessionTestMessage) => {
      if (room.state !== ConnectionState.Connected) return;
      const bytes = encoder.encode(JSON.stringify(msg));
      void localParticipant.publishData(bytes, { reliable: true, topic: SESSION_TEST_TOPIC }).catch(() => {
        /* PC can be closed mid-reconnect */
      });
    },
    [localParticipant, room]
  );

  const send = useCallback(
    (msg: SessionTestMessage) => {
      if (msg.type !== 'hello') pendingRef.current = msg;
      if (room.state !== ConnectionState.Connected) return;
      publish(msg);
    },
    [publish, room]
  );

  const broadcastState = useCallback(
    (next: SessionTestState) => {
      send({ type: 'state', state: next });
    },
    [send]
  );

  useEffect(() => {
    const onData = (...args: unknown[]) => {
      const { msg, topic } = decodePayload(args);
      if (!isSessionTestMessage(msg)) return;
      if (topic && topic !== SESSION_TEST_TOPIC) return;

      if (msg.type === 'hello') {
        if (isTherapist && stateRef.current) publish({ type: 'state', state: stateRef.current });
        return;
      }
      if (msg.type === 'state') {
        setState(msg.state);
        return;
      }
      if (msg.type === 'close') {
        pendingRef.current = null;
        setState(null);
        return;
      }
      if (!isTherapist) return;
      handlerRef.current?.(msg);
    };

    const flush = () => {
      if (room.state !== ConnectionState.Connected) return;
      if (isTherapist && stateRef.current) {
        publish({ type: 'state', state: stateRef.current });
        return;
      }
      if (pendingRef.current) {
        publish(pendingRef.current);
        return;
      }
      if (!isTherapist) publish({ type: 'hello' });
    };

    const onRemoteJoined = () => {
      if (room.state !== ConnectionState.Connected) return;
      if (isTherapist && stateRef.current) publish({ type: 'state', state: stateRef.current });
    };

    const onPacket = onData as Parameters<typeof room.on>[1];
    room.on(RoomEvent.DataReceived, onPacket);
    room.on(RoomEvent.Connected, flush);
    room.on(RoomEvent.Reconnected, flush);
    room.on(RoomEvent.ParticipantConnected, onRemoteJoined);
    flush();

    return () => {
      room.off(RoomEvent.DataReceived, onPacket);
      room.off(RoomEvent.Connected, flush);
      room.off(RoomEvent.Reconnected, flush);
      room.off(RoomEvent.ParticipantConnected, onRemoteJoined);
    };
  }, [room, isTherapist, publish, setState]);

  return { send, broadcastState };
}
