export type FitInput = Readonly<{
  viewportWidth: number;
  viewportHeight: number;
  visibleAspect: number;
}>;

export type FitResult = Readonly<{
  width: number;
  height: number;
}>;

export function fitCanvasToViewport(input: FitInput): FitResult {
  const { viewportWidth, viewportHeight, visibleAspect } = input;
  if (viewportWidth <= 0 || viewportHeight <= 0 || visibleAspect <= 0) {
    return { width: 0, height: 0 };
  }
  const viewportAspect = viewportWidth / viewportHeight;
  if (viewportAspect >= visibleAspect) {
    const height = viewportHeight;
    const width = height * visibleAspect;
    return { width, height };
  }
  const width = viewportWidth;
  const height = width / visibleAspect;
  return { width, height };
}
