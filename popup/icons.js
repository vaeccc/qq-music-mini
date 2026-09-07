const paths = Object.freeze({
  note: '<path d="M14 3v11.2a3.5 3.5 0 1 1-2-3.15V6.4l8-1.7v8.8a3.5 3.5 0 1 1-2-3.15V3.2L14 4Z"/>',
  previous: '<path d="M6 5v14M18 6v12l-9-6 9-6Z"/>',
  next: '<path d="M18 5v14M6 6v12l9-6-9-6Z"/>',
  play: '<path d="m9 6 10 6-10 6V6Z"/>',
  pause: '<path d="M8 6h3v12H8V6Zm5 0h3v12h-3V6Z"/>',
  back: '<path d="m14.5 5-7 7 7 7M8 12h9"/>'
});

export function icon(name, label = "") {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="${label ? "false" : "true"}">${paths[name] || paths.note}</svg>`;
}
