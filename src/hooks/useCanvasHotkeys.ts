import { useEffect, useState } from 'react';

import { useCanvasStore } from '../store/canvasStore';

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName;

  return (
    target.isContentEditable ||
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT'
  );
}

export function useCanvasHotkeys(): boolean {
  const [spacePressed, setSpacePressed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const store = useCanvasStore.getState();

      if (event.code === 'Escape') {
        if (store.activeDialog) {
          event.preventDefault();
          store.closeDialog();
          return;
        }
      }

      if ((event.ctrlKey || event.metaKey) && event.code === 'KeyN') {
        event.preventDefault();
        const id = store.createNote();
        store.openNoteDialog(id);
        return;
      }

      if (event.code === 'Slash' && event.shiftKey) {
        event.preventDefault();
        store.toggleSettingsNote();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.code === 'Comma') {
        event.preventDefault();
        store.toggleSettingsNote();
        return;
      }

      if (event.code === 'Space') {
        if (!isTypingTarget(event.target)) {
          event.preventDefault();
          setSpacePressed(true);
        }
        return;
      }

      if (isTypingTarget(event.target)) {
        return;
      }

      switch (event.code) {
        case 'KeyP':
          if (store.selectedNoteId) {
            event.preventDefault();
            store.focusNote(store.selectedNoteId);
          }
          break;
        case 'Enter':
          if (store.selectedNoteId && !event.repeat) {
            event.preventDefault();
            store.openNoteDialog(store.selectedNoteId);
          }
          break;
        case 'Delete':
        case 'Backspace':
          if (store.selectedNoteId) {
            event.preventDefault();
            store.deleteSelectedNote();
          }
          break;
        case 'Escape':
          store.cancelLink();
          store.selectNote(null);
          if (store.settingsNoteVisible) {
            store.toggleSettingsNote();
          }
          setSpacePressed(false);
          break;
        default:
          break;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        setSpacePressed(false);
      }
    };

    const handleBlur = () => {
      setSpacePressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  return spacePressed;
}
