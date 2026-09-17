const paths = Object.freeze({
  note: '<path d="M9 17V6.5L19 4v10.5"/><circle cx="6.5" cy="17.5" r="2.5" fill="currentColor" stroke="none"/><circle cx="16.5" cy="15" r="2.5" fill="currentColor" stroke="none"/>',
  previous: '<rect x="5.5" y="5" width="2.5" height="14" rx="1.25" fill="currentColor" stroke="none"/><path d="M18.25 5.75a1 1 0 0 1 1.6.8v10.9a1 1 0 0 1-1.6.8l-7.15-5.45a1 1 0 0 1 0-1.6l7.15-5.45Z" fill="currentColor" stroke="none"/>',
  next: '<rect x="16" y="5" width="2.5" height="14" rx="1.25" fill="currentColor" stroke="none"/><path d="M5.75 5.75a1 1 0 0 0-1.6.8v10.9a1 1 0 0 0 1.6.8l7.15-5.45a1 1 0 0 0 0-1.6L5.75 5.75Z" fill="currentColor" stroke="none"/>',
  play: '<path d="M8.5 5.65a1.15 1.15 0 0 1 1.76-.97l10 6.35a1.15 1.15 0 0 1 0 1.94l-10 6.35a1.15 1.15 0 0 1-1.76-.97V5.65Z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6.75" y="5" width="4" height="14" rx="1.35" fill="currentColor" stroke="none"/><rect x="13.25" y="5" width="4" height="14" rx="1.35" fill="currentColor" stroke="none"/>',
  order: '<path d="M4.5 6.5h14M4.5 11.5h14M4.5 16.5h9.5M17 14l3 3-3 3"/>',
  repeatOne: '<path d="m17 4 3 3-3 3M20 7H8a4 4 0 0 0-4 4v1M7 20l-3-3 3-3M4 17h12a4 4 0 0 0 4-4v-1M10.75 11l1.75-1.25V15"/>',
  shuffle: '<path d="M3.5 7h2.25c4.75 0 7 10 12 10h2.75M17.5 14l3 3-3 3M3.5 17h2.25c1.8 0 3.15-1.35 4.35-3.1M13.9 9.8C15 8.2 16.3 7 18.25 7h2.25M17.5 4l3 3-3 3"/>',
  back: '<path d="m13.5 5-7 7 7 7M7 12h11"/>'
});

export function icon(name, label = "") {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="${label ? "false" : "true"}">${paths[name] || paths.note}</svg>`;
}
