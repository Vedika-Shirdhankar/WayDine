/**
 * @file toastBus.js
 * Headless event emitter for application-wide notifications.
 * Can safely be imported anywhere in data, services, or UI without circular JSX dependencies.
 */

let globalToastDispatcher = null;

/**
 * Registers a global callback for showing toasts outside React components.
 * @param {(message: string, type?: string, duration?: number) => void} fn
 */
export function registerGlobalToast(fn) {
  globalToastDispatcher = fn;
  return () => {
    if (globalToastDispatcher === fn) globalToastDispatcher = null;
  };
}

/**
 * Emits a toast notification from anywhere in the application.
 * @param {string} message
 * @param {'info' | 'success' | 'warning' | 'danger'} [type]
 * @param {number} [duration]
 */
export function showToast(message, type = 'info', duration = 3500) {
  if (typeof globalToastDispatcher === 'function') {
    globalToastDispatcher(message, type, duration);
  } else if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('waydine:toast', { detail: { message, type, duration } }));
  }
}
