import { MessageType, PlayerEvent } from "../api/types.js";

const audio = new Audio();
audio.preload = "auto";
const mediaSession = navigator.mediaSession;

function sendMediaAction(action) {
  chrome.runtime.sendMessage({ type: MessageType.MEDIA_SESSION_ACTION, target: "background", action }).catch(() => undefined);
}

if (mediaSession) {
  const actions = { play: "play", pause: "pause", previoustrack: "previous", nexttrack: "next" };
  Object.entries(actions).forEach(([name, action]) => {
    try { mediaSession.setActionHandler(name, () => sendMediaAction(action)); } catch (error) { console.warn(`Media Session action unavailable: ${name}`, error); }
  });
}

function updateMediaSession(song, playing) {
  if (!mediaSession || typeof MediaMetadata === "undefined") return;
  mediaSession.playbackState = playing ? "playing" : "paused";
  if (!song) { mediaSession.metadata = null; return; }
  mediaSession.metadata = new MediaMetadata({
    title: song.title || "QQ Music Mini",
    artist: song.artist || "",
    album: song.album || "",
    artwork: song.cover ? [{ src: song.cover, sizes: "300x300", type: "image/jpeg" }] : []
  });
}

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
  if (message.type === MessageType.SET_MEDIA_SESSION) {
    updateMediaSession(message.song, message.playing);
    sendResponse({ ok: true });
  }
});
