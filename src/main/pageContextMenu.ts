type ContextMenuTarget = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;

export type ContextMenuBlocker = Readonly<{
  dispose(): void;
}>;

type PageInteractionDocument = ContextMenuTarget &
  Pick<Document, 'createElement'> &
  Readonly<{
    head: Pick<HTMLElement, 'appendChild'>;
  }>;

export type PageInteractionBlockers = Readonly<{
  dispose(): void;
}>;

export function installPageContextMenuBlocker(target: ContextMenuTarget): ContextMenuBlocker {
  function onContextMenu(event: Event): void {
    event.preventDefault();
  }

  target.addEventListener('contextmenu', onContextMenu);

  return {
    dispose(): void {
      target.removeEventListener('contextmenu', onContextMenu);
    }
  };
}

export function installPageInteractionBlockers(
  documentTarget: PageInteractionDocument
): PageInteractionBlockers {
  const contextMenuBlocker = installPageContextMenuBlocker(documentTarget);
  const selectionBlocker = installPageTextSelectionBlocker(documentTarget);
  const style = documentTarget.createElement('style');
  style.dataset['role'] = 'page-interaction-blockers';
  style.textContent = [
    'html, body, #app, #app * {',
    '-webkit-user-select:none;',
    'user-select:none;',
    '-webkit-touch-callout:none;',
    '}'
  ].join('');
  documentTarget.head.appendChild(style);

  return {
    dispose(): void {
      contextMenuBlocker.dispose();
      selectionBlocker.dispose();
      style.remove();
    }
  };
}

function installPageTextSelectionBlocker(target: ContextMenuTarget): ContextMenuBlocker {
  function onSelectStart(event: Event): void {
    event.preventDefault();
  }

  target.addEventListener('selectstart', onSelectStart);

  return {
    dispose(): void {
      target.removeEventListener('selectstart', onSelectStart);
    }
  };
}
