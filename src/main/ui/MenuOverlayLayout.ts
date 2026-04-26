export type MenuControlId =
  | 'settings'
  | 'soon'
  | 'fullscreen'
  | 'mode-easy'
  | 'mode-normal'
  | 'mode-hard'
  | 'play'
  | 'training'
  | 'pets'
  | 'dungeon'
  | 'lab';

export type MenuControlKind = 'top-control' | 'mode' | 'launch' | 'teaser';

export type MenuControlLayout = Readonly<{
  id: MenuControlId;
  kind: MenuControlKind;
  src: string;
  label: string;
  leftPercent: number;
  topPercent: number;
  widthPercent: number;
  aspectRatio: number;
}>;

export type MenuImageLayout = Readonly<{
  id: 'logo';
  src: string;
  alt: string;
  leftPercent: number;
  topPercent: number;
  widthPercent: number;
  aspectRatio: number;
}>;

export const MAIN_MENU_STAGE = Object.freeze({
  width: 1000,
  height: 707,
  background: '/images/bg/bg-main.jpg'
});

export const MAIN_MENU_STAGE_WIDTH_VH = (MAIN_MENU_STAGE.width / MAIN_MENU_STAGE.height) * 100;

export const MAIN_MENU_LOGO = Object.freeze({
  id: 'logo',
  src: '/images/title-800.png',
  alt: 'Slime Escape',
  leftPercent: 1.5,
  topPercent: 1.2,
  widthPercent: 24,
  aspectRatio: 800 / 360
} as const satisfies MenuImageLayout);

export const MAIN_MENU_CONTROLS = Object.freeze([
  {
    id: 'settings',
    kind: 'top-control',
    src: '/images/menu/menu-main-settings.png',
    label: 'Settings',
    leftPercent: 81,
    topPercent: 0.8,
    widthPercent: 6,
    aspectRatio: 207 / 191
  },
  {
    id: 'soon',
    kind: 'top-control',
    src: '/images/menu/menu-main-soon.png',
    label: 'Soon',
    leftPercent: 87.5,
    topPercent: 0.8,
    widthPercent: 5,
    aspectRatio: 148 / 159
  },
  {
    id: 'fullscreen',
    kind: 'top-control',
    src: '/images/menu/menu-main-fullscreen.png',
    label: 'Fullscreen',
    leftPercent: 93,
    topPercent: 1,
    widthPercent: 5,
    aspectRatio: 183 / 163
  },
  {
    id: 'mode-easy',
    kind: 'mode',
    src: '/images/menu/menu-main-mode-easy.png',
    label: 'Easy mode',
    leftPercent: 14,
    topPercent: 26,
    widthPercent: 16,
    aspectRatio: 573 / 235
  },
  {
    id: 'mode-normal',
    kind: 'mode',
    src: '/images/menu/menu-main-mode-normal.png',
    label: 'Normal mode',
    leftPercent: 33,
    topPercent: 23,
    widthPercent: 17,
    aspectRatio: 582 / 242
  },
  {
    id: 'mode-hard',
    kind: 'mode',
    src: '/images/menu/menu-main-mode-hard.png',
    label: 'Hard mode',
    leftPercent: 54,
    topPercent: 18,
    widthPercent: 17,
    aspectRatio: 592 / 330
  },
  {
    id: 'play',
    kind: 'launch',
    src: '/images/menu/menu-main-play.png',
    label: 'Play',
    leftPercent: 24,
    topPercent: 35,
    widthPercent: 36,
    aspectRatio: 1271 / 352
  },
  {
    id: 'training',
    kind: 'launch',
    src: '/images/menu/menu-main-training.png',
    label: 'Training',
    leftPercent: 24,
    topPercent: 53,
    widthPercent: 37,
    aspectRatio: 1314 / 431
  },
  {
    id: 'pets',
    kind: 'teaser',
    src: '/images/menu/menu-main-pets.png',
    label: 'Pets',
    leftPercent: 0,
    topPercent: 54.998,
    widthPercent: 23,
    aspectRatio: 407 / 563
  },
  {
    id: 'dungeon',
    kind: 'teaser',
    src: '/images/menu/menu-main-dungeon.png',
    label: 'Dungeon',
    leftPercent: 18,
    topPercent: 71.976,
    widthPercent: 46,
    aspectRatio: 801 / 345
  },
  {
    id: 'lab',
    kind: 'teaser',
    src: '/images/menu/menu-main-lab.png',
    label: 'Lab',
    leftPercent: 69,
    topPercent: 32.322,
    widthPercent: 31,
    aspectRatio: 552 / 852
  }
] as const satisfies ReadonlyArray<MenuControlLayout>);
