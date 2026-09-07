import { MessageType, PlayerEvent } from "../api/types.js";

const audio = new Audio();
audio.preload = "auto";

function notify(event, detail = {}) {
  chrome.runtime.sendMessage({
    type: MessageType.PLAYER_EVENT,
    target: "background",
    event,
    ...detail
  }).catch(() => undefined);
}

audio.addEventListener("playing", () => notify(PlayerEvent.PLAYING));
audio.addEventListener("pause", () => {
  if (!audio.ended) notify(PlayerEvent.PAUSED);
});
audio.addEventListener("ended", () => notify(PlayerEvent.ENDED));
audio.addEventListener("error", () => notify(PlayerEvent.ERROR, { mediaError: audio.error?.code }));

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== "offscreen") return;

  if (message.type === MessageType.PLAY_SONG) {
    audio.src = message.url;
    audio.play().then(() => sendResponse({ ok: true })).catch((error) => {
      console.error("Audio playback failed", error);
      sendResponse({ ok: false, error: "PLAYBACK_FAILED" });
    });
    return true;
  }
  if (message.type === MessageType.PLAY) {
    audio.play().then(() => sendResponse({ ok: true })).catch((error) => {
      console.error("Audio resume failed", error);
      sendResponse({ ok: false, error: "PLAYBACK_FAILED" });
    });
    return true;
  }
  if (message.type === MessageType.PAUSE) {
    audio.pause();
    sendResponse({ ok: true });
  }
});
