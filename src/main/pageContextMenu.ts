type ContextMenuTarget = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;

export type ContextMenuBlocker = Readonly<{
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
