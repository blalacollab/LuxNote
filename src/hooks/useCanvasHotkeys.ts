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

      const store = useCanvasStore.getState();

      switch (event.code) {
        case 'KeyN':
          if (!event.repeat) {
            event.preventDefault();
            store.createNote();
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
