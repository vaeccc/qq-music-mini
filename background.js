import { MessageType, PlayerEvent, emptyPlayerState } from "./api/types.js";
import { getPlayerState, setPlayerState } from "./storage/store.js";

let playerState = emptyPlayerState();
let initialized = false;

async function ensureOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL("offscreen/offscreen.html");
  const contexts = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"], documentUrls: [offscreenUrl] });
  if (!contexts.length) {
    await chrome.offscreen.createDocument({
      url: "offscreen/offscreen.html",
      reasons: ["AUDIO_PLAYBACK"],
      justification: "在关闭扩展弹窗后继续播放用户有权播放的音乐。"
    });
  }
}

async function initialize() {
  if (initialized) return;
  playerState = (await getPlayerState()) || emptyPlayerState();
  initialized = true;
}

async function publishState() {
  await setPlayerState(playerState);
  chrome.runtime.sendMessage({ type: MessageType.PLAYER_STATE_CHANGED, state: playerState }).catch(() => undefined);
}

async function sendToPlayer(message) {
  await ensureOffscreenDocument();
  return chrome.runtime.sendMessage({ ...message, target: "offscreen" });
}

async function playQueueSong(queue, index) {
  await initialize();
  if (!Array.isArray(queue) || index < 0 || index >= queue.length) return { ok: false, error: "INVALID_QUEUE" };
  // Stage 2 architecture test: a caller may supply a short-lived, lawful test URL.
  const song = queue[index];
  if (!song.playUrl) return { ok: false, error: "PLAY_URL_REQUIRED" };
  playerState = { queue, currentIndex: index, currentSong: song, playing: false };
  await publishState();
  const result = await sendToPlayer({ type: MessageType.PLAY_SONG, url: song.playUrl });
  if (!result?.ok) return result || { ok: false, error: "PLAYBACK_FAILED" };
  return { ok: true, state: playerState };
}

async function move(offset) {
  await initialize();
  const nextIndex = playerState.currentIndex + offset;
  if (nextIndex < 0 || nextIndex >= playerState.queue.length) return { ok: true, state: playerState };
  return playQueueSong(playerState.queue, nextIndex);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    await initialize();
    if (message.target === "background" && message.type === MessageType.PLAYER_EVENT) {
      if (message.event === PlayerEvent.PLAYING) playerState.playing = true;
      if (message.event === PlayerEvent.PAUSED || message.event === PlayerEvent.ERROR || message.event === PlayerEvent.ENDED) playerState.playing = false;
      await publishState();
      if (message.event === PlayerEvent.ENDED) await move(1);
      sendResponse({ ok: true });
      return;
    }
    if (message.type === MessageType.GET_PLAYER_STATE) {
      sendResponse({ ok: true, state: playerState });
      return;
    }
    if (message.type === MessageType.PLAY_SONG) {
      sendResponse(await playQueueSong(message.queue, message.index));
      return;
    }
    if (message.type === MessageType.PLAY) {
      const result = await sendToPlayer({ type: MessageType.PLAY });
      sendResponse(result);
      return;
    }
    if (message.type === MessageType.PAUSE) {
      sendResponse(await sendToPlayer({ type: MessageType.PAUSE }));
      return;
    }
    if (message.type === MessageType.PREVIOUS) {
      sendResponse(await move(-1));
      return;
    }
    if (message.type === MessageType.NEXT) {
      sendResponse(await move(1));
      return;
    }
    sendResponse({ ok: false, error: "UNKNOWN_MESSAGE" });
  })().catch((error) => {
    console.error("Background message failed", error);
    sendResponse({ ok: false, error: "UNEXPECTED_ERROR" });
  });
  return true;
});

initialize().catch((error) => console.error("Player initialization failed", error));
