/** Keyboard and focus ownership for stacked dialogs. */
const stack = [];
const selector = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const candidates = (root) => [...root.querySelectorAll(selector)].filter(
  (node) => !node.closest('[hidden], [inert], [aria-hidden="true"]') && node.getClientRects().length > 0,
);

export function mountModalFocus(root, onClose) {
  const previous = document.activeElement;
  const entry = { root, overflow: document.body.style.overflow };
  stack.push(entry);
  document.body.style.overflow = 'hidden';
  const focusFirst = () => (candidates(root)[0] || root).focus();
  const isTop = () => stack.at(-1) === entry;
  const keydown = (event) => {
    if (!isTop()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose?.();
    } else if (event.key === 'Tab') {
      const nodes = candidates(root);
      const first = nodes[0] || root;
      const last = nodes.at(-1) || root;
      if (!nodes.length || !root.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === root)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === root)) {
        event.preventDefault();
        first.focus();
      }
    }
  };
  const focusin = () => {
    if (isTop() && !root.contains(document.activeElement)) focusFirst();
  };
  document.addEventListener('keydown', keydown, true);
  document.addEventListener('focusin', focusin);
  focusFirst();
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    document.removeEventListener('keydown', keydown, true);
    document.removeEventListener('focusin', focusin);
    const top = isTop();
    const index = stack.indexOf(entry);
    const next = stack[index + 1];
    if (next) next.overflow = entry.overflow;
    stack.splice(index, 1);
    if (!stack.length) document.body.style.overflow = entry.overflow;
    if (top && previous?.isConnected) previous.focus();
  };
}
