import { RefObject, useLayoutEffect } from 'react';

import { useCanvasStore } from '../store/canvasStore';

export function useViewportSync(ref: RefObject<HTMLElement>): void {
  const setViewport = useCanvasStore((state) => state.setViewport);

  useLayoutEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    const update = () => {
      setViewport({
        width: element.clientWidth,
        height: element.clientHeight,
      });
    };

    update();

    const observer = new ResizeObserver(update);
    observer.observe(element);

    return () => observer.disconnect();
  }, [ref, setViewport]);
}
