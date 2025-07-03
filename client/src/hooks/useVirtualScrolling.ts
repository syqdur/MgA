import { useState, useEffect, useCallback, useRef } from 'react';

interface UseVirtualScrollingOptions {
  itemHeight: number;
  containerHeight?: number;
  overscan?: number; // Number of items to render outside viewport
}

interface UseVirtualScrollingReturn {
  startIndex: number;
  endIndex: number;
  totalHeight: number;
  offsetY: number;
  visibleRange: { start: number; end: number };
}

export const useVirtualScrolling = (
  itemCount: number,
  { itemHeight, containerHeight = window.innerHeight, overscan = 5 }: UseVirtualScrollingOptions
): UseVirtualScrollingReturn => {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerRect, setContainerRect] = useState({ height: containerHeight });

  // Calculate visible range
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    itemCount - 1,
    Math.floor((scrollTop + containerRect.height) / itemHeight) + overscan
  );

  // Total height for scrollbar
  const totalHeight = itemCount * itemHeight;
  
  // Offset for positioning visible items
  const offsetY = startIndex * itemHeight;

  // Handle scroll events
  const handleScroll = useCallback(() => {
    setScrollTop(window.pageYOffset || document.documentElement.scrollTop);
  }, []);

  // Handle resize events
  const handleResize = useCallback(() => {
    setContainerRect({ height: window.innerHeight });
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [handleScroll, handleResize]);

  return {
    startIndex,
    endIndex,
    totalHeight,
    offsetY,
    visibleRange: { start: startIndex, end: endIndex }
  };
};