import { useEffect, useRef } from 'react';
import { ref, set, onValue, onDisconnect } from 'firebase/database';
import { db } from '../lib/firebase';

export function useSingleSession(dbPath, isActive, onKicked) {
  const sessionIdRef = useRef(null);

  useEffect(() => {
    if (!isActive || !dbPath) return;

    const newSessionId = crypto.randomUUID();
    sessionIdRef.current = newSessionId;
    const sessionRef = ref(db, `${dbPath}/activeSessionId`);

    set(sessionRef, newSessionId).catch(err => console.error("Error setting session ID", err));

    const unsubscribe = onValue(sessionRef, (snapshot) => {
      const remoteSessionId = snapshot.val();
      if (remoteSessionId && remoteSessionId !== sessionIdRef.current) {
        if (onKicked) onKicked();
      }
    });

    return () => unsubscribe();
  }, [dbPath, isActive, onKicked]);
}

export function useMultiSession(dbPath, isActive, onKicked, maxSessions = 6) {
  const sessionIdRef = useRef(null);

  useEffect(() => {
    if (!isActive || !dbPath) return;

    const sessionId = crypto.randomUUID();
    sessionIdRef.current = sessionId;
    const sessionsRef = ref(db, `${dbPath}/activeSessions`);
    const sessionRef = ref(db, `${dbPath}/activeSessions/${sessionId}`);
    let hasBeenKicked = false;

    onDisconnect(sessionRef).remove().catch(err => {
      console.error("Error registering admin session cleanup", err);
    });
    set(sessionRef, { createdAt: Date.now() }).catch(err => {
      console.error("Error registering admin session", err);
    });

    const unsubscribe = onValue(sessionsRef, (snapshot) => {
      const sessions = snapshot.val() || {};
      const activeSessionIds = Object.keys(sessions).sort((left, right) => {
        return (sessions[left].createdAt || 0) - (sessions[right].createdAt || 0) || left.localeCompare(right);
      });

      if (activeSessionIds.indexOf(sessionId) >= maxSessions) {
        hasBeenKicked = true;
        set(sessionRef, null).finally(() => onKicked?.());
      }
    });

    return () => {
      unsubscribe();
      if (!hasBeenKicked) {
        set(sessionRef, null).catch(err => console.error("Error removing admin session", err));
      }
    };
  }, [dbPath, isActive, maxSessions, onKicked]);
}
