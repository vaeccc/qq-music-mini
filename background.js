import { MessageType, PlayerEvent, emptyPlayerState } from "./api/types.js";
import { applyBrandIcon } from "./api/brand-icon.js";
import { clearCredential, getCredential, getPlayerState, setCredential, setPlayerState } from "./storage/store.js";
import { createQrLogin, pollQrLogin } from "./api/auth.js";
import { getPlayUrl, getPlaylistDetail, getSingerSongs, getUserLibrary, QQMusicError, refreshCredential, searchSongs, validateCredential } from "./api/qqmusic.js";

let playerState = emptyPlayerState();
let initialized = false;
let loginAttempt = null;
let offscreenCreating = null;
let playRequestId = 0;

async function ensureOffscreenDocument() {
  if (offscreenCreating) return offscreenCreating;
  offscreenCreating = (async () => {
    const offscreenUrl = chrome.runtime.getURL("offscreen/offscreen.html");
    const contexts = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"], documentUrls: [offscreenUrl] });
    if (!contexts.length) {
      await chrome.offscreen.createDocument({
        url: "offscreen/offscreen.html",
        reasons: ["AUDIO_PLAYBACK"],
        justification: "在关闭扩展弹窗后继续播放用户有权播放的音乐。"
      });
    }
  })();
  try { await offscreenCreating; } finally { offscreenCreating = null; }
}

async function initialize() {
  if (initialized) return;
  playerState = (await getPlayerState()) || emptyPlayerState();
  // Audio URLs are intentionally never persisted, so a browser restart restores the queue as paused.
  playerState.playing = false;
  initialized = true;
}

async function requireCredential() {
  const credential = await getCredential();
  if (!credential) throw new QQMusicError("LOGIN_EXPIRED", "QQ 音乐登录已失效，请重新登录");
  if (await validateCredential(credential)) return credential;
  try {
    const refreshed = await refreshCredential(credential);
    if (await validateCredential(refreshed)) {
      await setCredential(refreshed);
      return refreshed;
    }
  } catch (error) {
    console.error("Credential refresh failed", error);
  }
  await clearCredential();
  throw new QQMusicError("LOGIN_EXPIRED", "QQ 音乐登录已失效，请重新登录");
}

async function publishState() {
  await setPlayerState(playerState);
  if (playerState.currentSong) {
    sendToPlayer({ type: MessageType.SET_MEDIA_SESSION, song: playerState.currentSong, playing: playerState.playing })
      .catch((error) => console.error("Media Session sync failed", error));
  }
  chrome.runtime.sendMessage({ type: MessageType.PLAYER_STATE_CHANGED, state: playerState }).catch(() => undefined);
}

async function sendToPlayer(message) {
  await ensureOffscreenDocument();
  return chrome.runtime.sendMessage({ ...message, target: "offscreen" });
}

async function playQueueSong(queue, index) {
  await initialize();
  if (!Array.isArray(queue) || index < 0 || index >= queue.length) return { ok: false, error: "INVALID_QUEUE" };
  const requestId = ++playRequestId;
  const song = queue[index];
  const credential = await requireCredential();
  const playUrl = song.playUrl || await getPlayUrl(song, credential);
  if (requestId !== playRequestId) return { ok: true, discarded: true };
  playerState = { queue, currentIndex: index, currentSong: song, playing: false, errorMessage: "" };
  await publishState();
  const result = await sendToPlayer({ type: MessageType.PLAY_SONG, url: playUrl });
  if (!result?.ok) return result || { ok: false, error: "PLAYBACK_FAILED" };
  return { ok: true, state: playerState };
}

function serializeError(error) {
  if (!(error instanceof QQMusicError) || error.code !== "LOGIN_EXPIRED") console.error("QQ Music Mini operation failed", error);
  if (error instanceof QQMusicError) return { ok: false, error: error.code, message: error.message };
  return { ok: false, error: "NETWORK", message: "网络请求失败" };
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
      if (message.event === PlayerEvent.ERROR) playerState.errorMessage = "当前歌曲暂不可播放";
      await publishState();
      if (message.event === PlayerEvent.ENDED) await move(1);
      sendResponse({ ok: true });
      return;
    }
    if (message.target === "background" && message.type === MessageType.MEDIA_SESSION_ACTION) {
      if (message.action === "previous") sendResponse(await move(-1));
      else if (message.action === "next") sendResponse(await move(1));
      else if (message.action === "pause") sendResponse(await sendToPlayer({ type: MessageType.PAUSE }));
      else if (message.action === "play") sendResponse(await sendToPlayer({ type: MessageType.PLAY }));
      else sendResponse({ ok: false, error: "UNKNOWN_MEDIA_ACTION" });
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
    if (message.type === MessageType.LOGIN_START) {
      loginAttempt = await createQrLogin();
      sendResponse({ ok: true, imageUrl: loginAttempt.imageUrl });
      return;
    }
    if (message.type === MessageType.LOGIN_STATUS) {
      if (!loginAttempt?.qrsig) {
        sendResponse({ ok: false, error: "NO_LOGIN_ATTEMPT", message: "登录失败，请重新尝试" });
        return;
      }
      const login = await pollQrLogin(loginAttempt.qrsig);
      if (login.status === "done") {
        await setCredential(login.credential);
        loginAttempt = null;
      }
      sendResponse({ ok: true, ...login });
      return;
    }
    if (message.type === MessageType.LOGOUT) {
      await clearCredential();
      sendResponse({ ok: true });
      return;
    }
    if (message.type === MessageType.GET_LIBRARY) {
      const credential = await requireCredential();
      sendResponse({ ok: true, library: await getUserLibrary(credential) });
      return;
    }
    if (message.type === MessageType.GET_PLAYLIST_DETAIL) {
      const credential = await requireCredential();
      sendResponse({ ok: true, playlist: await getPlaylistDetail(message.playlist, credential) });
      return;
    }
    if (message.type === MessageType.SEARCH_SONGS) {
      const keyword = String(message.keyword || "").trim();
      if (!keyword) {
        sendResponse({ ok: true, songs: [], singers: [] });
        return;
      }
      const credential = await requireCredential();
      sendResponse({ ok: true, ...(await searchSongs(keyword, credential)) });
      return;
    }
    if (message.type === MessageType.GET_SINGER_SONGS) {
      const credential = await requireCredential();
      sendResponse({ ok: true, singer: await getSingerSongs(message.singer, credential) });
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
  })().catch((error) => sendResponse(serializeError(error)));
  return true;
});

initialize().catch((error) => console.error("Player initialization failed", error));
applyBrandIcon().catch((error) => console.error("Brand icon initialization failed", error));
