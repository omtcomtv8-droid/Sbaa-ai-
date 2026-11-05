import { useState, useEffect, useRef, useCallback } from 'react';

export type LayoutMode = 'VERY_NARROW' | 'NARROW' | 'COMPACT' | 'MEDIUM' | 'WIDE' | 'VERY_WIDE';
export type DeviceOrientation = 'portrait' | 'landscape';
export type NavigationMode = 'BOTTOM_NAV' | 'HYBRID_TOP' | 'SIDEBAR_COLLAPSED' | 'SIDEBAR_EXPANDED';

export interface DeviceScaleMetrics {
  viewportWidth: number;
  viewportHeight: number;
  orientation: DeviceOrientation;
  devicePixelRatio: number;
  layoutMode: LayoutMode;
  isTouch: boolean;
  isLandscape: boolean;
  isPhone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isUltrawide: boolean;
  navigationMode: NavigationMode;
  optimalChartHeight: number;
}

export function getLayoutMode(width: number): LayoutMode {
  if (width < 380) return 'VERY_NARROW';
  if (width < 600) return 'NARROW';
  if (width < 900) return 'COMPACT';
  if (width < 1200) return 'MEDIUM';
  if (width < 1800) return 'WIDE';
  return 'VERY_WIDE';
}

export function computeOptimalChartHeight(
  viewportHeight: number,
  layoutMode: LayoutMode,
  isLandscape: boolean
): number {
  if (isLandscape && (layoutMode === 'VERY_NARROW' || layoutMode === 'NARROW' || layoutMode === 'COMPACT')) {
    // Phone or small tablet in landscape: maximize vertical space for candles
    return Math.max(220, Math.min(480, Math.floor(viewportHeight * 0.72)));
  }

  switch (layoutMode) {
    case 'VERY_NARROW':
      return Math.max(260, Math.min(360, Math.floor(viewportHeight * 0.42)));
    case 'NARROW':
      return Math.max(290, Math.min(420, Math.floor(viewportHeight * 0.46)));
    case 'COMPACT':
      return Math.max(340, Math.min(500, Math.floor(viewportHeight * 0.50)));
    case 'MEDIUM':
      return Math.max(400, Math.min(580, Math.floor(viewportHeight * 0.56)));
    case 'WIDE':
      return Math.max(460, Math.min(680, Math.floor(viewportHeight * 0.60)));
    case 'VERY_WIDE':
      return Math.max(520, Math.min(850, Math.floor(viewportHeight * 0.65)));
    default:
      return 450;
  }
}

/**
 * Global Window & Viewport Scale Hook
 */
export function useDeviceScale(): DeviceScaleMetrics {
  const getMetrics = useCallback((): DeviceScaleMetrics => {
    if (typeof window === 'undefined') {
      return {
        viewportWidth: 1280,
        viewportHeight: 800,
        orientation: 'landscape',
        devicePixelRatio: 1,
        layoutMode: 'WIDE',
        isTouch: false,
        isLandscape: true,
        isPhone: false,
        isTablet: false,
        isDesktop: true,
        isUltrawide: false,
        navigationMode: 'SIDEBAR_EXPANDED',
        optimalChartHeight: 520,
      };
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const isLandscape = vw >= vh;
    const orientation: DeviceOrientation = isLandscape ? 'landscape' : 'portrait';
    const dpr = window.devicePixelRatio || 1;
    const isTouch = 'ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) || false;
    const layoutMode = getLayoutMode(vw);

    const isPhone = vw < 600 || (!isLandscape && vw < 768);
    const isTablet = !isPhone && vw < 1100;
    const isDesktop = vw >= 1100 && vw < 1800;
    const isUltrawide = vw >= 1800;

    let navigationMode: NavigationMode = 'SIDEBAR_EXPANDED';
    if (vw < 768) {
      navigationMode = 'BOTTOM_NAV';
    } else if (vw < 1024) {
      navigationMode = 'HYBRID_TOP';
    } else if (vw < 1280) {
      navigationMode = 'SIDEBAR_COLLAPSED';
    } else {
      navigationMode = 'SIDEBAR_EXPANDED';
    }

    const optimalChartHeight = computeOptimalChartHeight(vh, layoutMode, isLandscape);

    return {
      viewportWidth: vw,
      viewportHeight: vh,
      orientation,
      devicePixelRatio: dpr,
      layoutMode,
      isTouch,
      isLandscape,
      isPhone,
      isTablet,
      isDesktop,
      isUltrawide,
      navigationMode,
      optimalChartHeight,
    };
  }, []);

  const [metrics, setMetrics] = useState<DeviceScaleMetrics>(getMetrics);

  useEffect(() => {
    let rafId: number | null = null;

    const handleResize = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setMetrics(getMetrics());
      });
    };

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize, { passive: true });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [getMetrics]);

  return metrics;
}

/**
 * Container-Aware Resize Observer Hook
 * Adapts individual components (Chart, Strategy Grid, Panels) to their actual parent container space
 */
export function useContainerSize<T extends HTMLElement = HTMLDivElement>() {
  const containerRef = useRef<T | null>(null);
  const [size, setSize] = useState<{ width: number; height: number; layoutMode: LayoutMode }>({
    width: 0,
    height: 0,
    layoutMode: 'MEDIUM',
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let rafId: number | null = null;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          setSize({
            width: Math.floor(width),
            height: Math.floor(height),
            layoutMode: getLayoutMode(width),
          });
        });
      }
    });

    observer.observe(el);

    // Initial measure
    const rect = el.getBoundingClientRect();
    if (rect.width > 0) {
      setSize({
        width: Math.floor(rect.width),
        height: Math.floor(rect.height),
        layoutMode: getLayoutMode(rect.width),
      });
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, []);

  return { containerRef, ...size };
}
