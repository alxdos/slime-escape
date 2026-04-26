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

export const MAIN_MENU_STAGE = Object.freeze({
  width: 1000,
  height: 707,
  background: '/images/bg/bg-main.jpg'
});

export const MAIN_MENU_CONTROLS = Object.freeze([
  {
    id: 'settings',
    kind: 'top-control',
    src: '/images/menu/menu-main-settings.png',
    label: 'Settings',
    leftPercent: 83.4,
    topPercent: 0.8,
    widthPercent: 6.2,
    aspectRatio: 207 / 191
  },
  {
    id: 'soon',
    kind: 'top-control',
    src: '/images/menu/menu-main-soon.png',
    label: 'Soon',
    leftPercent: 89.2,
    topPercent: 1.6,
    widthPercent: 5.1,
    aspectRatio: 148 / 159
  },
  {
    id: 'fullscreen',
    kind: 'top-control',
    src: '/images/menu/menu-main-fullscreen.png',
    label: 'Fullscreen',
    leftPercent: 94.5,
    topPercent: 0.9,
    widthPercent: 5.2,
    aspectRatio: 183 / 163
  },
  {
    id: 'mode-easy',
    kind: 'mode',
    src: '/images/menu/menu-main-mode-easy.png',
    label: 'Easy mode',
    leftPercent: 7.9,
    topPercent: 20.5,
    widthPercent: 23,
    aspectRatio: 573 / 235
  },
  {
    id: 'mode-normal',
    kind: 'mode',
    src: '/images/menu/menu-main-mode-normal.png',
    label: 'Normal mode',
    leftPercent: 33.1,
    topPercent: 17.6,
    widthPercent: 19.4,
    aspectRatio: 582 / 242
  },
  {
    id: 'mode-hard',
    kind: 'mode',
    src: '/images/menu/menu-main-mode-hard.png',
    label: 'Hard mode',
    leftPercent: 53.1,
    topPercent: 14.4,
    widthPercent: 20.5,
    aspectRatio: 592 / 330
  },
  {
    id: 'play',
    kind: 'launch',
    src: '/images/menu/menu-main-play.png',
    label: 'Play',
    leftPercent: 23.5,
    topPercent: 28.9,
    widthPercent: 40.3,
    aspectRatio: 1271 / 352
  },
  {
    id: 'training',
    kind: 'launch',
    src: '/images/menu/menu-main-training.png',
    label: 'Training',
    leftPercent: 23.6,
    topPercent: 48.6,
    widthPercent: 36.2,
    aspectRatio: 1314 / 431
  },
  {
    id: 'pets',
    kind: 'teaser',
    src: '/images/menu/menu-main-pets.png',
    label: 'Pets',
    leftPercent: 0,
    topPercent: 51.7,
    widthPercent: 19.4,
    aspectRatio: 407 / 563
  },
  {
    id: 'dungeon',
    kind: 'teaser',
    src: '/images/menu/menu-main-dungeon.png',
    label: 'Dungeon',
    leftPercent: 30.1,
    topPercent: 68.6,
    widthPercent: 35.8,
    aspectRatio: 801 / 345
  },
  {
    id: 'lab',
    kind: 'teaser',
    src: '/images/menu/menu-main-lab.png',
    label: 'Lab',
    leftPercent: 76.5,
    topPercent: 27.9,
    widthPercent: 23.2,
    aspectRatio: 552 / 852
  }
] as const satisfies ReadonlyArray<MenuControlLayout>);
