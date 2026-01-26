import { useEffect, useRef, useState, useCallback } from 'react';
import io from 'socket.io-client';

/**
 * Hook for Socket.io real-time collaboration
 * Manages cell locking, connectivity state, and real-time updates
 * 
 * @param {string} dsName - Dataset name
 * @param {string} dsView - View name
 * @param {Object} user - User object with user.user property
 * @param {Object} tabulatorRef - Ref to tabulator instance
 * @param {Object} options - Additional options { apiUrl, onCellUnlocked }
 * @returns {Object} { socket, connectedState, dbConnectivityState, lockedCells, emitLock, emitUnlock }
 */
export function useDatasetSocket(dsName, dsView, user, tabulatorRef, options = {}) {
  const { apiUrl = '', onCellUnlocked } = options;
  
  const socketRef = useRef(null);
  const [connectedState, setConnectedState] = useState(false);
  const [dbConnectivityState, setDbConnectivityState] = useState(false);
  const [lockedCells, setLockedCells] = useState({}); // { [_id]: { [field]: cell } }

  // Initialize socket connection
  useEffect(() => {
    if (!dsName || !user) return;

    // Connect socket.io through the Vite proxy
    // Start with polling first, then upgrade to websocket (more reliable)
    const socket = io(apiUrl || window.location.origin, {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      extraHeaders: {
        Cookie: document.cookie
      }
    });

    socketRef.current = socket;

    // Debug logging
    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
    });

    socket.on('reconnect_attempt', () => {
      console.log('[Socket] Attempting to reconnect...');
    });

    socket.on('reconnect_failed', () => {
      console.error('[Socket] Reconnection failed after max attempts');
    });

    // Connection events
    socket.on('connect', () => {
      console.log('[Socket] Connected successfully');
      console.log('[Socket] Sending Hello with user:', user);
      socket.emit('Hello', { user: user.user });
      socket.emit('getActiveLocks', dsName);
      setConnectedState(true);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected, reason:', reason);
      setConnectedState(false);
    });

    socket.on('dbConnectivityState', (isDbConnected) => {
      setDbConnectivityState(isDbConnected.dbState);
    });

    socket.on('Hello', () => {});

    // Handle active locks from server
    socket.on('activeLocks', (activeLocksJson) => {
      if (!tabulatorRef.current) return;
      
      const activeLocks = JSON.parse(activeLocksJson);
      const newLockedCells = {};
      
      Object.keys(activeLocks).forEach(_id => {
        const rows = tabulatorRef.current.table.searchRows("_id", "=", _id);
        if (!rows.length) return;
        
        newLockedCells[_id] = {};
        Object.keys(activeLocks[_id]).forEach(field => {
          const cell = rows[0].getCell(field);
          if (!cell) return;
          
          newLockedCells[_id][field] = cell;
          cell.getElement().style.backgroundColor = 'lightGray';
        });
      });
      
      setLockedCells(newLockedCells);
    });

    // Handle new lock from another user
    socket.on('locked', (lockedObj) => {
      if (!tabulatorRef.current || lockedObj.dsName !== dsName) return;
      
      const rows = tabulatorRef.current.table.searchRows("_id", "=", lockedObj._id);
      if (!rows.length) return;
      
      const cell = rows[0].getCell(lockedObj.field);
      if (!cell) return;
      
      setLockedCells(prev => ({
        ...prev,
        [lockedObj._id]: {
          ...prev[lockedObj._id],
          [lockedObj.field]: cell
        }
      }));
      
      cell.getElement().style.backgroundColor = 'lightGray';
    });

    // Handle unlock from another user
    socket.on('unlocked', (unlockedObj) => {
      if (!tabulatorRef.current || unlockedObj.dsName !== dsName) return;
      
      setLockedCells(prev => {
        const newLocked = { ...prev };
        if (newLocked[unlockedObj._id] && newLocked[unlockedObj._id][unlockedObj.field]) {
          const cell = newLocked[unlockedObj._id][unlockedObj.field];
          delete newLocked[unlockedObj._id][unlockedObj.field];
          
          // Update cell value if provided
          if (unlockedObj.newVal !== undefined && unlockedObj.newVal !== null) {
            const update = { _id: unlockedObj._id, [unlockedObj.field]: unlockedObj.newVal };
            tabulatorRef.current.table.updateData([update]);
          }
          
          // Reset background color
          cell.getElement().style.backgroundColor = '';
          
          // Re-apply formatter
          const colDef = cell.getColumn().getDefinition();
          if (colDef.formatter) {
            colDef.formatter(cell, colDef.formatterParams);
          }
          
          // Callback for additional processing
          if (onCellUnlocked) {
            onCellUnlocked(unlockedObj);
          }
        }
        return newLocked;
      });
    });

    socket.on('exception', (msg) => {
      console.error('Socket exception:', msg);
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [dsName, user, apiUrl, onCellUnlocked]);

  // Helper to emit lock event
  const emitLock = useCallback((lockData) => {
    if (socketRef.current) {
      socketRef.current.emit('lock', lockData);
    }
  }, []);

  // Helper to emit unlock event
  const emitUnlock = useCallback((unlockData) => {
    if (socketRef.current) {
      socketRef.current.emit('unlock', unlockData);
    }
  }, []);

  // Helper to check if cell is locked by another user
  const isCellLocked = useCallback((_id, field) => {
    return !!(lockedCells[_id] && lockedCells[_id][field]);
  }, [lockedCells]);

  return {
    socket: socketRef.current,
    connectedState,
    dbConnectivityState,
    lockedCells,
    emitLock,
    emitUnlock,
    isCellLocked,
  };
}

export default useDatasetSocket;
