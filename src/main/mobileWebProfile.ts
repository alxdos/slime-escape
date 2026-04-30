export type MobileWebProfile = Readonly<{
  isMobile: boolean;
  screenLandscapeAspect: number;
}>;

export type MobileProfileInput = Readonly<{
  maxTouchPoints: number;
  screenWidth: number;
  screenHeight: number;
}>;

export type ViewportSize = Readonly<{
  width: number;
  height: number;
}>;

export type EffectiveGameViewport = Readonly<{
  width: number;
  height: number;
  isPortraitViewport: boolean;
}>;

export type GameViewportProvider = Readonly<{
  current(): ViewportSize;
  devicePixelRatio(): number;
  matchMedia?: Window['matchMedia'];
}>;

export type GameSurfaceController = GameViewportProvider &
  Readonly<{
    profile: MobileWebProfile;
    dispose(): void;
  }>;

type GameSurfaceWindowTarget = Pick<
  Window,
  'addEventListener' | 'removeEventListener' | 'innerWidth' | 'innerHeight' | 'devicePixelRatio'
> &
  Partial<Pick<Window, 'matchMedia'>>;

export function detectMobileWebProfile(input: MobileProfileInput): MobileWebProfile {
  const screenLandscapeAspect = landscapeAspect(input.screenWidth, input.screenHeight);
  return {
    isMobile: input.maxTouchPoints > 0 && input.screenHeight > input.screenWidth,
    screenLandscapeAspect
  };
}

export function resolveEffectiveGameViewport(
  profile: MobileWebProfile,
  viewport: ViewportSize
): EffectiveGameViewport {
  if (!profile.isMobile) {
    return {
      width: clampViewportSide(viewport.width),
      height: clampViewportSide(viewport.height),
      isPortraitViewport: viewport.height > viewport.width
    };
  }

  const width = clampViewportSide(viewport.width);
  const height = clampViewportSide(viewport.height);
  return {
    width: Math.max(width, height),
    height: Math.min(width, height),
    isPortraitViewport: height > width
  };
}

export function createGameSurfaceController(init: Readonly<{
  root: HTMLElement;
  profile: MobileWebProfile;
  windowTarget: GameSurfaceWindowTarget;
}>): GameSurfaceController {
  let effectiveViewport = resolveEffectiveGameViewport(init.profile, readViewport(init.windowTarget));
  const matchMedia = init.windowTarget.matchMedia;

  function applyLayout(): void {
    effectiveViewport = resolveEffectiveGameViewport(init.profile, readViewport(init.windowTarget));
    init.root.style.setProperty('--game-viewport-width', `${effectiveViewport.width}px`);
    init.root.style.setProperty('--game-viewport-height', `${effectiveViewport.height}px`);
    init.root.style.position = 'fixed';
    init.root.style.left = '0';
    init.root.style.top = '0';
    init.root.style.right = '';
    init.root.style.bottom = '';
    init.root.style.width = `${effectiveViewport.width}px`;
    init.root.style.height = `${effectiveViewport.height}px`;
    init.root.style.display = 'flex';
    init.root.style.alignItems = 'center';
    init.root.style.justifyContent = 'center';
    init.root.style.overflow = 'hidden';
    init.root.style.transformOrigin = 'top left';
    init.root.style.touchAction = init.profile.isMobile ? 'none' : '';

    if (init.profile.isMobile && effectiveViewport.isPortraitViewport) {
      init.root.style.transform = 'rotate(90deg) translateY(-100%)';
      return;
    }

    init.root.style.transform = 'none';
  }

  function onResize(): void {
    applyLayout();
  }

  applyLayout();
  init.windowTarget.addEventListener('resize', onResize);
  init.windowTarget.addEventListener('orientationchange', onResize);

  return {
    profile: init.profile,
    current(): ViewportSize {
      return {
        width: effectiveViewport.width,
        height: effectiveViewport.height
      };
    },
    devicePixelRatio(): number {
      return init.windowTarget.devicePixelRatio;
    },
    ...(matchMedia === undefined
      ? {}
      : {
          matchMedia(query: string): MediaQueryList {
            return matchMedia.call(init.windowTarget, query);
          }
        }),
    dispose(): void {
      init.windowTarget.removeEventListener('resize', onResize);
      init.windowTarget.removeEventListener('orientationchange', onResize);
    }
  };
}

function readViewport(windowTarget: Pick<Window, 'innerWidth' | 'innerHeight'>): ViewportSize {
  return {
    width: windowTarget.innerWidth,
    height: windowTarget.innerHeight
  };
}

function landscapeAspect(width: number, height: number): number {
  const safeWidth = clampViewportSide(width);
  const safeHeight = clampViewportSide(height);
  return Math.max(safeWidth, safeHeight) / Math.min(safeWidth, safeHeight);
}

function clampViewportSide(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}
