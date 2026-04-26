export type ComicTextShadow = 'regular' | 'strong';

export type ComicTextStyleOptions = Readonly<{
  fontSize: string;
  color: string;
  fontWeight?: number;
  lineHeight?: string;
  textAlign?: 'left' | 'center' | 'right';
  shadow?: ComicTextShadow;
}>;

export const COMIC_TEXT_FONT_FAMILY =
  '"M PLUS Rounded 1c", "Noto Sans Display", system-ui, sans-serif';

const REGULAR_TEXT_SHADOW = [
  '1px 0 0 #000000',
  '-1px 0 0 #000000',
  '0 1px 0 #000000',
  '0 -1px 0 #000000',
  '3px 3px 0 #000000'
].join(', ');

const STRONG_TEXT_SHADOW = [
  '2px 0 0 #000000',
  '-2px 0 0 #000000',
  '0 2px 0 #000000',
  '0 -2px 0 #000000',
  '4px 4px 0 #000000'
].join(', ');

export function comicTextStyle(options: ComicTextStyleOptions): string[] {
  const declarations = [
    `font-family:${COMIC_TEXT_FONT_FAMILY}`,
    `font-size:${options.fontSize}`,
    `font-weight:${options.fontWeight ?? 900}`,
    'letter-spacing:0',
    `line-height:${options.lineHeight ?? '1.15'}`,
    `color:${options.color}`,
    `text-shadow:${options.shadow === 'strong' ? STRONG_TEXT_SHADOW : REGULAR_TEXT_SHADOW}`
  ];

  if (options.textAlign !== undefined) {
    declarations.push(`text-align:${options.textAlign}`);
  }

  return declarations;
}
