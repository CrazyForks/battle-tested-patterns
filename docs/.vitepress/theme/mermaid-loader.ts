/**
 * Mermaid conditional loader.
 *
 * - Only loads the mermaid library on pages that contain .mermaid elements
 * - Listens for VitePress theme toggle (.dark class) and re-renders with correct theme
 * - Handles VitePress SPA navigation (re-checks on route change)
 *
 * Returns the render function with an attached `dispose()` that disconnects the
 * theme-change MutationObserver. Production uses a single long-lived loader so
 * dispose is optional there; tests call it in teardown to stop the observer from
 * firing floating re-renders across test boundaries (which otherwise leak a
 * real-mermaid render attempt and a stray console.warn into the next test).
 */
export type MermaidRenderer = (() => Promise<void>) & { dispose: () => void };

export function initMermaidLoader(): MermaidRenderer {
  if (typeof window === 'undefined') {
    const noop = (async () => {}) as MermaidRenderer;
    noop.dispose = () => {};
    return noop;
  }

  let mermaidModule: typeof import('mermaid') | null = null;

  async function renderMermaid() {
    const elements = document.querySelectorAll<HTMLPreElement>('pre.mermaid');
    if (elements.length === 0) return;

    try {
      // Lazy load mermaid only when needed
      if (!mermaidModule) {
        mermaidModule = await import('mermaid');
      }

      const isDark = document.documentElement.classList.contains('dark');
      mermaidModule.default.initialize({
        startOnLoad: false,
        theme: isDark ? 'dark' : 'default',
      });

      // Preserve original source for re-rendering on theme change
      elements.forEach((el) => {
        if (!el.dataset.mermaidSource) {
          el.dataset.mermaidSource = el.textContent || '';
        }
      });

      // Restore original definitions before re-rendering
      elements.forEach((el) => {
        if (el.dataset.mermaidSource) {
          el.textContent = el.dataset.mermaidSource;
          el.removeAttribute('data-processed');
          // Reset status so CSS hides source during re-render (theme switch)
          delete el.dataset.mermaidStatus;
        }
      });

      await mermaidModule.default.run({ nodes: elements });

      // Mark all elements as rendered — CSS uses this to reveal the SVG
      elements.forEach((el) => {
        el.dataset.mermaidStatus = 'rendered';
      });
    } catch (err) {
      // A malformed diagram (or a library error) must never crash the page or
      // break SPA navigation. Log for observability and restore visibility so
      // the user can still read the raw diagram source.
      console.warn('[mermaid-loader] Failed to render diagram(s):', err);
      elements.forEach((el) => {
        el.dataset.mermaidStatus = 'error';
      });
    }
  }

  // Watch for theme changes (.dark class toggle on <html>)
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.attributeName === 'class') {
        // renderMermaid handles its own errors internally; mark the floating
        // promise as intentionally unawaited.
        void renderMermaid();
        break;
      }
    }
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });

  const renderer = renderMermaid as MermaidRenderer;
  renderer.dispose = () => observer.disconnect();
  return renderer;
}
