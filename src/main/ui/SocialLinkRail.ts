export type SocialLinkId = 'github' | 'discord';

type SocialLinkSpec = Readonly<{
  id: SocialLinkId;
  href: string;
  iconSrc: string;
  label: string;
}>;

export const SOCIAL_LINKS: ReadonlyArray<SocialLinkSpec> = Object.freeze([
  {
    id: 'github',
    href: 'https://github.com/alxdos/slime-escape',
    iconSrc: '/images/social/github.svg',
    label: 'Open Slime Escape GitHub repository'
  },
  {
    id: 'discord',
    href: 'https://discord.gg/rUwc52wc6v',
    iconSrc: '/images/social/discord.svg',
    label: 'Open Slime Escape Discord community'
  }
]);

export function createSocialLinkRail(): HTMLElement {
  const rail = document.createElement('nav');
  rail.className = 'social-link-rail';
  rail.dataset['role'] = 'social-link-rail';
  rail.setAttribute('aria-label', 'Project links');
  rail.style.cssText = socialLinkRailStyle();

  const style = document.createElement('style');
  style.textContent = socialLinkRailCss();
  rail.appendChild(style);

  for (const link of SOCIAL_LINKS) {
    rail.appendChild(createSocialLinkAnchor(link));
  }

  return rail;
}

export function socialLinkRailStyle(): string {
  return [
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'gap:10px',
    'box-sizing:border-box',
    'pointer-events:auto'
  ].join(';');
}

function createSocialLinkAnchor(link: SocialLinkSpec): HTMLAnchorElement {
  const anchor = document.createElement('a');
  anchor.className = 'social-link-anchor';
  anchor.dataset['role'] = 'social-link';
  anchor.dataset['socialLinkId'] = link.id;
  anchor.setAttribute('href', link.href);
  anchor.setAttribute('target', '_blank');
  anchor.setAttribute('rel', 'noopener noreferrer');
  anchor.setAttribute('aria-label', link.label);
  anchor.title = link.label;
  anchor.style.cssText = socialLinkAnchorStyle();

  const icon = document.createElement('span');
  icon.dataset['role'] = 'social-link-icon';
  icon.dataset['socialLinkId'] = link.id;
  icon.setAttribute('aria-hidden', 'true');
  icon.style.cssText = socialLinkIconStyle(link.iconSrc);
  anchor.appendChild(icon);

  return anchor;
}

function socialLinkAnchorStyle(): string {
  return [
    'display:grid',
    'place-items:center',
    'box-sizing:border-box',
    'width:44px',
    'height:44px',
    'padding:8px',
    'color:rgba(255,255,255,0.72)',
    'background:rgba(5,5,5,0.42)',
    'border:2px solid rgba(5,5,5,0.72)',
    'border-radius:8px',
    'box-shadow:3px 3px 0 rgba(0,0,0,0.62)',
    'line-height:0',
    'text-decoration:none',
    'outline:none',
    'touch-action:manipulation',
    'transition:color 140ms ease, background 140ms ease, filter 140ms ease, transform 140ms ease'
  ].join(';');
}

function socialLinkIconStyle(iconSrc: string): string {
  return [
    'display:block',
    'width:100%',
    'height:100%',
    'background:currentColor',
    `mask:url("${iconSrc}") center / contain no-repeat`,
    `-webkit-mask:url("${iconSrc}") center / contain no-repeat`
  ].join(';');
}

function socialLinkRailCss(): string {
  return `
.social-link-anchor:hover,
.social-link-anchor:focus-visible {
  color: #7cf58f;
  background: rgba(5, 5, 5, 0.72);
  filter: brightness(1.08) saturate(1.08);
  transform: translate(-1px, -1px);
}

.social-link-anchor:focus-visible {
  outline: 3px solid #fff38b;
  outline-offset: 3px;
}

@media (prefers-reduced-motion: reduce) {
  .social-link-anchor {
    transition: none;
  }

  .social-link-anchor:hover,
  .social-link-anchor:focus-visible {
    transform: none;
  }
}
`;
}
