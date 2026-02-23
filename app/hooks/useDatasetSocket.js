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
  const lockedCellsRef = useRef({}); // Synchronous access to locked cells for immediate checking

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
      console.log('[DEBUG REFRESH] [Socket] Connected successfully', { timestamp: new Date().toISOString() });
      console.log('[Socket] Connected successfully');
      console.log('[Socket] Sending Hello with user:', user);
      socket.emit('Hello', { user: user.user });
      socket.emit('getActiveLocks', dsName);
      setConnectedState(true);
      console.log('[DEBUG REFRESH] [Socket] setConnectedState(true) called - this should NOT trigger table refresh');
    });

    socket.on('disconnect', (reason) => {
      console.log('[DEBUG REFRESH] [Socket] Disconnected', { reason, timestamp: new Date().toISOString() });
      console.log('[Socket] Disconnected, reason:', reason);
      setConnectedState(false);
      console.log('[DEBUG REFRESH] [Socket] setConnectedState(false) called - this should NOT trigger table refresh');
    });

    socket.on('dbConnectivityState', (isDbConnected) => {
      console.log('[DEBUG REFRESH] [Socket] dbConnectivityState changed', { dbState: isDbConnected.dbState, timestamp: new Date().toISOString() });
      setDbConnectivityState(isDbConnected.dbState);
      console.log('[DEBUG REFRESH] [Socket] setDbConnectivityState called - this should NOT trigger table refresh');
    });

    socket.on('Hello', () => {});

    // Handle active locks from server
    socket.on('activeLocks', (activeLocksJson) => {
      console.log('[Socket] Received activeLocks:', activeLocksJson);
      if (!tabulatorRef.current) {
        console.warn('[Socket] tabulatorRef.current not available yet');
        return;
      }
      if (!tabulatorRef.current.table) {
        console.warn('[Socket] tabulatorRef.current.table not available yet');
        return;
      }
      
      const activeLocks = JSON.parse(activeLocksJson);
      console.log('[Socket] Parsed activeLocks:', activeLocks);
      const newLockedCells = {};
      
      Object.keys(activeLocks).forEach(_id => {
        const rows = tabulatorRef.current.table.searchRows("_id", "=", _id);
        console.log(`[Socket] Searching for _id=${_id}, found ${rows.length} rows`);
        if (!rows.length) return;
        
        newLockedCells[_id] = {};
        Object.keys(activeLocks[_id]).forEach(field => {
          const cell = rows[0].getCell(field);
          if (!cell) {
            console.warn(`[Socket] Cell not found for field=${field}`);
            return;
          }
          
          newLockedCells[_id][field] = cell;
          cell.getElement().style.backgroundColor = 'lightGray';
          console.log(`[Socket] Locked cell: _id=${_id}, field=${field}`);
        });
      });
      
      console.log('[Socket] Total locked cells:', Object.keys(newLockedCells).length);
      lockedCellsRef.current = newLockedCells; // Update ref synchronously
      setLockedCells(newLockedCells);
    });

    // Handle new lock from another user
    socket.on('locked', (lockedObj) => {
      if (!tabulatorRef.current || lockedObj.dsName !== dsName) return;
      
      const rows = tabulatorRef.current.table.searchRows("_id", "=", lockedObj._id);
      if (!rows.length) return;
      
      const cell = rows[0].getCell(lockedObj.field);
      if (!cell) return;
      
      // Update ref synchronously for immediate checking
      if (!lockedCellsRef.current[lockedObj._id]) {
        lockedCellsRef.current[lockedObj._id] = {};
      }
      lockedCellsRef.current[lockedObj._id][lockedObj.field] = cell;
      
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
          
          // Also delete from ref synchronously
          if (lockedCellsRef.current[unlockedObj._id]) {
            delete lockedCellsRef.current[unlockedObj._id][unlockedObj.field];
          }
          
          // CRITICAL FIX: Blur the cell if it has focus to prevent auto-edit on unlock
          try {
            const cellElement = cell.getElement();
            if (cellElement && document.activeElement === cellElement) {
              cellElement.blur();
              console.log('[Socket unlocked] Blurred cell to prevent auto-edit after unlock');
            }
          } catch (blurError) {
            console.warn('[Socket unlocked] Could not blur cell:', blurError);
          }
          
          // Clear background and re-apply formatter BEFORE updateData
          // (updateData will recreate the cell, making current reference stale)
          cell.getElement().style.backgroundColor = '';
          const colDef = cell.getColumn().getDefinition();
          if (colDef.formatter) {
            colDef.formatter(cell, colDef.formatterParams);
          }
          
          // Update cell value if provided (after clearing styling)
          if (unlockedObj.newVal !== undefined && unlockedObj.newVal !== null) {
            const update = { _id: unlockedObj._id, [unlockedObj.field]: unlockedObj.newVal };
            
            // CRITICAL FIX: Temporarily disable cell editor before updateData to prevent
            // automatic entry into edit mode when cell is unlocked
            const originalEditor = colDef.editor;
            colDef.editor = false;
            
            tabulatorRef.current.table.updateData([update]);
            
            // Restore editor after updateData completes
            // Use setTimeout to ensure updateData has fully processed
            setTimeout(() => {
              colDef.editor = originalEditor;
            }, 0);
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
      socketRef.current.emit('lockReq', lockData);
    }
  }, []);

  // Helper to emit unlock event
  const emitUnlock = useCallback((unlockData) => {
    if (socketRef.current) {
      socketRef.current.emit('unlockReq', unlockData);
    }
  }, []);

  // Helper to check if cell is locked by another user
  // Use ref for synchronous checking (state updates are async)
  const isCellLocked = useCallback((_id, field) => {
    return !!(lockedCellsRef.current[_id] && lockedCellsRef.current[_id][field]);
  }, []);

  // Helper to request active locks from server
  const requestActiveLocks = useCallback(() => {
    if (socketRef.current && dsName) {
      console.log('[Socket] Requesting active locks for:', dsName);
      socketRef.current.emit('getActiveLocks', dsName);
    }
  }, [dsName]);

  return {
    socket: socketRef.current,
    connectedState,
    dbConnectivityState,
    lockedCells,
    emitLock,
    emitUnlock,
    isCellLocked,
    requestActiveLocks,
  };
}

export default useDatasetSocket;
