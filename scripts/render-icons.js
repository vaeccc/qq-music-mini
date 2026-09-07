import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = new URL("../icons/", import.meta.url);

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const tag = Buffer.from(type);
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([tag, data])));
  return Buffer.concat([length, tag, data, checksum]);
}

function insideRoundRect(x, y, size, radius) {
  const dx = Math.max(Math.abs(x - size / 2) - (size / 2 - radius), 0);
  const dy = Math.max(Math.abs(y - size / 2) - (size / 2 - radius), 0);
  return dx * dx + dy * dy <= radius * radius;
}

function paint(size) {
  const pixels = Buffer.alloc(size * (size * 4 + 1));
  const margin = size * .07, radius = size * .22;
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1); pixels[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const index = row + 1 + x * 4;
      if (!insideRoundRect(x + .5 - margin, y + .5 - margin, size - margin * 2, radius)) continue;
      const shade = y / size;
      pixels[index] = Math.round(39 - shade * 27);
      pixels[index + 1] = Math.round(212 - shade * 45);
      pixels[index + 2] = Math.round(120 - shade * 34);
      pixels[index + 3] = 255;
      const dx = x + .5 - size * .5, dy = y + .5 - size * .5;
      const ring = Math.hypot(dx, dy);
      if (ring > size * .27 && ring < size * .31) { pixels[index] = 9; pixels[index + 1] = 134; pixels[index + 2] = 73; }
      // Musical eighth note: stem plus a circular note head, rendered in white.
      const scale = size / 100;
      const head = (x - 39 * scale) ** 2 + (y - 65 * scale) ** 2 <= (10 * scale) ** 2;
      const stem = x >= 47 * scale && x <= 56 * scale && y >= 29 * scale && y <= 65 * scale;
      const flag = y >= 27 * scale && y <= 37 * scale && x >= 54 * scale && x <= 76 * scale && y <= (x * -.32 + 54) * scale;
      if (head || stem || flag) { pixels[index] = 255; pixels[index + 1] = 255; pixels[index + 2] = 255; }
    }
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", header), chunk("IDAT", deflateSync(pixels)), chunk("IEND", Buffer.alloc(0))]);
}

mkdirSync(OUT, { recursive: true });
for (const size of [16, 32, 48, 128]) writeFileSync(new URL(`qq-music-mini-${size}.png`, OUT), paint(size));
