let leafletLoader: Promise<void> | null = null;

/** Loads Leaflet JS + CSS once, shared by DeliveryMap and LocationPickerMap. Free, no API key. */
export function loadLeaflet(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.L) return Promise.resolve();
  if (leafletLoader) return leafletLoader;

  leafletLoader = new Promise((resolve, reject) => {
    const existingCss = document.querySelector('link[data-gharkaswad-leaflet="true"]');
    if (!existingCss) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.dataset.gharkaswadLeaflet = 'true';
      document.head.appendChild(link);
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-gharkaswad-leaflet="true"]',
    );
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Map failed to load')));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.dataset.gharkaswadLeaflet = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Map failed to load'));
    document.head.appendChild(script);
  });

  return leafletLoader;
}