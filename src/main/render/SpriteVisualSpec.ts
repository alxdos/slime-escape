export type SpriteSourceSizePx = Readonly<{
  width: number;
  height: number;
}>;

export type SpriteWorldSize = Readonly<{
  width: number;
  height: number;
}>;

export type SpriteAnchor = Readonly<{
  x: number;
  y: number;
}>;

export type SpriteVisualSpec = Readonly<{
  archetypeId: string;
  image: string;
  sourceSizePx: SpriteSourceSizePx;
  worldSize: SpriteWorldSize;
  anchor: SpriteAnchor;
}>;
