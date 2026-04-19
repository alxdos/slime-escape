export type FitInput = Readonly<{
  viewportWidth: number;
  viewportHeight: number;
  arenaAspect: number;
}>;

export type FitResult = Readonly<{
  width: number;
  height: number;
}>;

export function fitCanvasToViewport(input: FitInput): FitResult {
  const { viewportWidth, viewportHeight, arenaAspect } = input;
  if (viewportWidth <= 0 || viewportHeight <= 0 || arenaAspect <= 0) {
    return { width: 0, height: 0 };
  }
  const viewportAspect = viewportWidth / viewportHeight;
  if (viewportAspect >= arenaAspect) {
    const height = viewportHeight;
    const width = height * arenaAspect;
    return { width, height };
  }
  const width = viewportWidth;
  const height = width / arenaAspect;
  return { width, height };
}
