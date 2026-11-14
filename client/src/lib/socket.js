import { io } from 'socket.io-client';
import { useEffect, useRef } from 'react';
import { API_BASE, tokenStore } from './api.js';

let socket = null;

export function getSocket() {
  const token = tokenStore.get();
  if (!token) return null;
  if (!socket) {
    socket = io(API_BASE || undefined, { auth: { token }, transports: ['websocket', 'polling'] });
  }
  return socket;
}

export function closeSocket() {
  socket?.disconnect();
  socket = null;
}

// Subscribe to server events while a component is mounted.
// handlers: { 'task:updated': fn, ... }
export function useSocketEvents(handlers, teamId) {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const s = getSocket();
    if (!s) return undefined;
    if (teamId) s.emit('team:subscribe', teamId);
    const names = Object.keys(ref.current);
    const bound = names.map((name) => {
      const fn = (payload) => ref.current[name]?.(payload);
      s.on(name, fn);
      return [name, fn];
    });
    return () => bound.forEach(([name, fn]) => s.off(name, fn));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);
}
