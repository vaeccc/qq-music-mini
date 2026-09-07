const sizes = [16, 32, 48, 128];

export async function applyBrandIcon() {
  const response = await fetch(chrome.runtime.getURL("icons/qq-music-1.svg"));
  const svg = await response.text();
  const bitmap = await createImageBitmap(new Blob([svg], { type: "image/svg+xml" }));
  const imageData = {};
  for (const size of sizes) {
    const canvas = new OffscreenCanvas(size, size);
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, size, size);
    context.drawImage(bitmap, 0, 0, size, size);
    imageData[size] = context.getImageData(0, 0, size, size);
  }
  bitmap.close();
  await chrome.action.setIcon({ imageData });
}
