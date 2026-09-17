const paths = Object.freeze({
  note: '<path d="M14 3v11.2a3.5 3.5 0 1 1-2-3.15V6.4l8-1.7v8.8a3.5 3.5 0 1 1-2-3.15V3.2L14 4Z"/>',
  previous: '<path d="M6 5v14M18 6v12l-9-6 9-6Z"/>',
  next: '<path d="M18 5v14M6 6v12l9-6-9-6Z"/>',
  play: '<path fill="currentColor" stroke="none" d="m9 5.5 10.5 6.5L9 18.5v-13Z"/>',
  pause: '<path fill="currentColor" stroke="none" d="M7.5 5.5h3.6v13H7.5v-13Zm5.4 0h3.6v13h-3.6v-13Z"/>',
  order: '<path d="M5 7h11M5 12h14M5 17h11M16 4l3 3-3 3M16 14l3 3-3 3"/>',
  repeatOne: '<path d="M17 7h1a3 3 0 0 1 3 3v1M7 17H6a3 3 0 0 1-3-3v-1M7 4 4 7l3 3M17 20l3-3-3-3M12 9v6M10.5 10.5 12 9"/>',
  shuffle: '<path d="M4 7h2c5 0 7 10 12 10h2M17 14l3 3-3 3M4 17h2c2 0 3.5-1.5 4.8-3.4M14 8.4C15.1 7.5 16.3 7 18 7h2M17 4l3 3-3 3"/>',
  back: '<path d="m14.5 5-7 7 7 7M8 12h9"/>'
});

export function icon(name, label = "") {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="${label ? "false" : "true"}">${paths[name] || paths.note}</svg>`;
}
