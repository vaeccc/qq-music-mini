import { ErrorCode, MessageType, PlaybackMode, PlayerEvent, emptyPlayerState } from "./api/types.js";
import { applyBrandIcon } from "./api/brand-icon.js";
import { clearCredential, getCredential, getPlayerState, setCredential, setPlayerState } from "./storage/store.js";
import { createQrLogin, pollQrLogin } from "./api/auth.js";
import { getPlayUrl, getLikedSongs, getPlaylistDetail, getSingerSongs, getToplistDetail, getToplists, getUserLibrary, QQMusicError, refreshCredential, searchSongs, validateCredential } from "./api/qqmusic.js";

let playerState = emptyPlayerState();
let initialized = false;
let loginAttempt = null;
let offscreenCreating = null;
let offscreenReady = false;
let playRequestId = 0;
// Indices of the tracks played so far in shuffle mode, used by "previous".
const shuffleHistory = [];
const skippablePlaybackErrors = new Set([ErrorCode.NO_PERMISSION, ErrorCode.NO_COPYRIGHT, ErrorCode.PLAY_URL, ErrorCode.PLAYBACK_FAILED]);

function describePlaybackError(error, song, skipped = false) {
  const title = song?.title ? `《${song.title}》` : "当前歌曲";
  const messages = {
    [ErrorCode.LOGIN_EXPIRED]: "QQ 音乐登录已失效，请重新登录",
    [ErrorCode.NETWORK]: "网络连接失败，请检查网络后重试",
    [ErrorCode.NO_PERMISSION]: `${title}：当前账号无播放权限`,
    [ErrorCode.NO_COPYRIGHT]: `${title}：因版权限制暂不可播放`,
    [ErrorCode.PLAY_URL]: `${title}：播放地址获取失败`,
    [ErrorCode.PLAYBACK_FAILED]: `${title}：音频加载失败`
  };
  const code = error instanceof QQMusicError ? error.code : error?.code || ErrorCode.NETWORK;
  return { code, message: `${messages[code] || error?.message || "播放失败"}${skipped ? "，已自动跳过" : ""}` };
}

/**
 * Checks whether the offscreen document already exists.
 *
 * `chrome.runtime.getContexts` only exists from Chrome 116 onwards, while the
 * extension supports Chrome 109. On older browsers the document is probed by
 * asking the player itself, which answers only when it is alive.
 */
async function hasOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL("offscreen/offscreen.html");
  if (typeof chrome.runtime.getContexts === "function") {
    const contexts = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"], documentUrls: [offscreenUrl] });
    return contexts.length > 0;
  }
  try {
    const pong = await chrome.runtime.sendMessage({ type: MessageType.PING, target: "offscreen" });
    return Boolean(pong?.ok);
  } catch (error) {
    return false;
  }
}

async function ensureOffscreenDocument() {
  if (offscreenCreating) return offscreenCreating;
  offscreenCreating = (async () => {
    if (await hasOffscreenDocument()) {
      offscreenReady = true;
      return;
    }
    const offscreenUrl = chrome.runtime.getURL("offscreen/offscreen.html");
    await chrome.offscreen.createDocument({
      url: "offscreen/offscreen.html",
      reasons: ["AUDIO_PLAYBACK"],
      justification: "在关闭扩展弹窗后继续播放用户有权播放的音乐。"
    });
    await waitForOffscreenReady();
  })();
  try { await offscreenCreating; } finally { offscreenCreating = null; }
}

/**
 * Waits until the offscreen document has registered its message listener.
 *
 * `createDocument` resolves as soon as the document exists, but its module
 * script may not have run yet. Sending a message in that window yields
 * `undefined`, which the caller cannot distinguish from a failed playback.
 */
async function waitForOffscreenReady(timeoutMs = 3000) {
  if (offscreenReady) return true;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const pong = await chrome.runtime.sendMessage({ type: MessageType.PING, target: "offscreen" });
      if (pong?.ok) {
        offscreenReady = true;
        return true;
      }
    } catch (error) {
      // The document is not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
}

async function initialize() {
  if (initialized) return;
  playerState = { ...emptyPlayerState(), ...((await getPlayerState()) || {}) };
  if (!Object.values(PlaybackMode).includes(playerState.playMode)) playerState.playMode = PlaybackMode.ORDER;
  // Audio URLs are intentionally never persisted, so a browser restart restores the queue as paused.
  playerState.playing = false;
  // A restored error message describes a failure from a previous session; keeping
  // it would make the first "play" press skip a track for no visible reason.
  playerState.errorCode = "";
  playerState.errorMessage = "";
  initialized = true;
}

async function requireCredential() {
  const credential = await getCredential();
  if (!credential) throw new QQMusicError("LOGIN_EXPIRED", "QQ 音乐登录已失效，请重新登录");
  const validity = await validateCredential(credential);
  if (validity === true) return credential;
  if (validity === false) {
    try {
      const refreshed = await refreshCredential(credential);
      if (await validateCredential(refreshed) === true) {
        await setCredential(refreshed);
        return refreshed;
      }
    } catch (error) {
      console.error("Credential refresh failed", error);
    }
    await clearCredential();
    throw new QQMusicError("LOGIN_EXPIRED", "QQ 音乐登录已失效，请重新登录");
  }
  // The check could not reach QQ Music. Keep the stored credential so a flaky
  // network does not log the user out, and report the network problem instead.
  throw new QQMusicError(ErrorCode.NETWORK, "网络连接失败，请检查网络后重试");
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

/**
 * Chooses the next track to play.
 *
 * In shuffle mode a history stack is kept so that "previous" returns to the
 * track that was playing before, instead of picking another random one.
 */
function getNextQueueIndex(queue, currentIndex, offset, { automatic = false, failed = false, excluded = new Set() } = {}) {
  if (!queue.length) return -1;
  if (playerState.playMode === PlaybackMode.REPEAT_ONE && automatic && !failed && !excluded.has(currentIndex)) return currentIndex;
  if (playerState.playMode === PlaybackMode.SHUFFLE) {
    if (offset < 0) {
      // Walk back through the shuffle history. The current track is located in
      // the history and the entry before it becomes the previous track; the
      // forward part of the history is dropped so that "next" stays random.
      let position = -1;
      for (let index = shuffleHistory.length - 1; index >= 0; index--) {
        if (shuffleHistory[index] === currentIndex) { position = index; break; }
      }
      if (position <= 0) return -1;
      const candidate = shuffleHistory[position - 1];
      if (excluded.has(candidate)) return -1;
      shuffleHistory.length = position;
      return candidate;
    }
    const candidates = queue.map((_, index) => index).filter((index) => index !== currentIndex && !excluded.has(index));
    if (candidates.length) return candidates[Math.floor(Math.random() * candidates.length)];
    return automatic && !failed && !excluded.has(currentIndex) ? currentIndex : -1;
  }
  const direction = offset < 0 ? -1 : 1;
  for (let index = currentIndex + direction; index >= 0 && index < queue.length; index += direction) {
    if (!excluded.has(index)) return index;
  }
  return -1;
}

function rememberShuffleIndex(index) {
  if (playerState.playMode !== PlaybackMode.SHUFFLE) return;
  if (shuffleHistory[shuffleHistory.length - 1] === index) return;
  shuffleHistory.push(index);
  if (shuffleHistory.length > 200) shuffleHistory.shift();
}

/**
 * Plays a track from the queue, skipping over tracks that cannot be played.
 *
 * The skip loop is iterative on purpose: a recursive implementation would
 * build one stack frame per skipped track, and a chart where every track is
 * unavailable would recurse hundreds of times while writing the whole queue
 * to storage on every step.
 */
async function playQueueSong(queue, index, excluded = new Set()) {
  await initialize();
  if (!Array.isArray(queue) || index < 0 || index >= queue.length) return { ok: false, error: "INVALID_QUEUE" };
  let cursor = index;
  const skipped = new Set(excluded);
  let lastDiagnostic = null;

  while (cursor >= 0 && cursor < queue.length) {
    const requestId = ++playRequestId;
    const song = queue[cursor];
    playerState = { queue, currentIndex: cursor, currentSong: song, playing: false, currentTime: 0, duration: 0, playMode: playerState.playMode || PlaybackMode.ORDER, errorCode: "", errorMessage: "" };
    await publishState();
    let playUrl;
    try {
      const credential = await requireCredential();
      playUrl = song.playUrl || await getPlayUrl(song, credential);
    } catch (error) {
      if (requestId !== playRequestId) return { ok: true, discarded: true };
      const skippable = error instanceof QQMusicError && skippablePlaybackErrors.has(error.code);
      let nextIndex = -1;
      if (skippable) {
        skipped.add(cursor);
        nextIndex = getNextQueueIndex(queue, cursor, 1, { failed: true, excluded: skipped });
      }
      const diagnostic = describePlaybackError(error, song, nextIndex >= 0);
      lastDiagnostic = diagnostic;
      playerState.playing = false;
      playerState.errorCode = diagnostic.code;
      playerState.errorMessage = diagnostic.message;
      await publishState();
      if (nextIndex >= 0) {
        cursor = nextIndex;
        continue;
      }
      throw new QQMusicError(diagnostic.code, diagnostic.message, error?.detail);
    }
    // The user may have picked another track while the URL was being fetched.
    if (requestId !== playRequestId) return { ok: true, discarded: true };
    const result = await sendToPlayer({ type: MessageType.PLAY_SONG, url: playUrl, playbackId: requestId });
    // Re-check after awaiting the player: a newer request supersedes this one,
    // and a rejection caused by that newer request must not be read as a
    // failure of the current track.
    if (requestId !== playRequestId) return { ok: true, discarded: true };
    if (!result?.ok) {
      skipped.add(cursor);
      const nextIndex = getNextQueueIndex(queue, cursor, 1, { failed: true, excluded: skipped });
      const diagnostic = describePlaybackError({ code: ErrorCode.PLAYBACK_FAILED }, song, nextIndex >= 0);
      lastDiagnostic = diagnostic;
      playerState.playing = false;
      playerState.errorCode = diagnostic.code;
      playerState.errorMessage = diagnostic.message;
      await publishState();
      if (nextIndex >= 0) {
        cursor = nextIndex;
        continue;
      }
      return { ok: false, error: diagnostic.code, message: diagnostic.message };
    }
    rememberShuffleIndex(cursor);
    return { ok: true, state: playerState };
  }
  return { ok: false, error: lastDiagnostic?.code || ErrorCode.PLAYBACK_FAILED, message: lastDiagnostic?.message || "队列中没有可播放的歌曲" };
}

function serializeError(error) {
  if (!(error instanceof QQMusicError) || error.code !== "LOGIN_EXPIRED") console.error("QQ Music Mini operation failed", error);
  if (error instanceof QQMusicError) return { ok: false, error: error.code, message: error.message };
  return { ok: false, error: "NETWORK", message: "网络请求失败" };
}

async function move(offset, options = {}) {
  await initialize();
  const excluded = options.excluded || new Set();
  const nextIndex = getNextQueueIndex(playerState.queue, playerState.currentIndex, offset, { ...options, excluded });
  if (nextIndex < 0) {
    // Report the boundary so the UI can tell the user instead of silently
    // doing nothing, which reads as a frozen extension.
    return {
      ok: false,
      error: "QUEUE_BOUNDARY",
      message: offset < 0 ? "已经是第一首了" : "已经是最后一首了",
      state: playerState
    };
  }
  return playQueueSong(playerState.queue, nextIndex, excluded);
}

async function resumeCurrentSong() {
  await initialize();
  // Song-specific failures can be skipped; login and network failures retry the current song.
  if (playerState.errorMessage && skippablePlaybackErrors.has(playerState.errorCode)) return move(1);
  const playback = await sendToPlayer({ type: MessageType.GET_PLAYBACK_STATUS });
  if (playback?.hasSource) {
    const result = await sendToPlayer({ type: MessageType.PLAY });
    if (!result?.ok) {
      const diagnostic = describePlaybackError({ code: ErrorCode.PLAYBACK_FAILED }, playerState.currentSong);
      playerState.playing = false;
      playerState.errorCode = diagnostic.code;
      playerState.errorMessage = diagnostic.message;
      await publishState();
    }
    return result;
  }
  if (!playerState.currentSong || playerState.currentIndex < 0) {
    return { ok: false, error: "NO_SONG", message: "请先选择一首歌曲" };
  }
  return playQueueSong(playerState.queue, playerState.currentIndex);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Messages addressed to the offscreen document — including the liveness
  // probe — are none of the service worker's business. Chrome usually keeps a
  // sender from receiving its own broadcast, but answering here anyway could
  // race the player's response and win it.
  if (message.target === "offscreen") return false;
  (async () => {
    await initialize();
    if (message.target === "background" && message.type === MessageType.PLAYER_EVENT) {
      // The service worker can restart while the offscreen audio element keeps
      // playing. Adopt its first event after a restart, but ignore late events
      // once this worker has started a newer track.
      if (message.playbackId && playRequestId === 0) playRequestId = message.playbackId;
      if (message.playbackId && message.playbackId !== playRequestId) {
        sendResponse({ ok: true, discarded: true });
        return;
      }
      if (message.event === PlayerEvent.PROGRESS) {
        playerState.currentTime = Number(message.currentTime) || 0;
        playerState.duration = Number(message.duration) || 0;
        chrome.runtime.sendMessage({ type: MessageType.PLAYER_STATE_CHANGED, state: playerState }).catch(() => undefined);
        sendResponse({ ok: true });
        return;
      }
      let errorAdvance = null;
      if (message.event === PlayerEvent.PLAYING) playerState.playing = true;
      if (message.event === PlayerEvent.PAUSED || message.event === PlayerEvent.ERROR || message.event === PlayerEvent.ENDED) playerState.playing = false;
      if (message.event === PlayerEvent.ERROR) {
        const excluded = new Set([playerState.currentIndex]);
        const nextIndex = getNextQueueIndex(playerState.queue, playerState.currentIndex, 1, { failed: true, excluded });
        const diagnostic = describePlaybackError({ code: ErrorCode.PLAYBACK_FAILED }, playerState.currentSong, nextIndex >= 0);
        playerState.errorCode = diagnostic.code;
        playerState.errorMessage = diagnostic.message;
        if (nextIndex >= 0) errorAdvance = { nextIndex, excluded };
      }
      await publishState();
      if (message.event === PlayerEvent.ENDED) await move(1, { automatic: true });
      if (errorAdvance) await playQueueSong(playerState.queue, errorAdvance.nextIndex, errorAdvance.excluded);
      sendResponse({ ok: true });
      return;
    }
    if (message.target === "background" && message.type === MessageType.MEDIA_SESSION_ACTION) {
      if (message.action === "previous") sendResponse(await move(-1));
      else if (message.action === "next") sendResponse(await move(1));
      else if (message.action === "pause") sendResponse(await sendToPlayer({ type: MessageType.PAUSE }));
      else if (message.action === "play") sendResponse(await resumeCurrentSong());
      else sendResponse({ ok: false, error: "UNKNOWN_MEDIA_ACTION" });
      return;
    }
    if (message.type === MessageType.GET_PLAYER_STATE) {
      if (playerState.currentSong) {
        try {
          const playback = await sendToPlayer({ type: MessageType.GET_PLAYBACK_STATUS });
          if (playback?.ok) {
            playerState.playing = Boolean(playback.playing);
            playerState.currentTime = Number(playback.currentTime) || 0;
            playerState.duration = Number(playback.duration) || 0;
          }
        } catch (error) { console.warn("Playback position restore failed", error); }
      }
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
      const playMode = playerState.playMode || PlaybackMode.ORDER;
      const stopRequestId = ++playRequestId;
      playerState = { ...emptyPlayerState(), playMode };
      await publishState();
      try {
        await sendToPlayer({ type: MessageType.STOP, playbackId: stopRequestId });
      } catch (error) { console.warn("Player stop during logout failed", error); }
      sendResponse({ ok: true, state: playerState });
      return;
    }
    if (message.type === MessageType.GET_LIBRARY) {
      const credential = await requireCredential();
      sendResponse({ ok: true, library: await getUserLibrary(credential) });
      return;
    }
    if (message.type === MessageType.GET_LIKED_SONGS) {
      const credential = await requireCredential();
      sendResponse({ ok: true, ...(await getLikedSongs(credential, message.begin)) });
      return;
    }
    if (message.type === MessageType.GET_PLAYLIST_DETAIL) {
      const credential = await requireCredential();
      sendResponse({ ok: true, playlist: await getPlaylistDetail(message.playlist, credential, message.begin) });
      return;
    }
    if (message.type === MessageType.GET_TOPLISTS) {
      sendResponse({ ok: true, toplists: await getToplists() });
      return;
    }
    if (message.type === MessageType.GET_TOPLIST_DETAIL) {
      const credential = await requireCredential();
      sendResponse({ ok: true, toplist: await getToplistDetail(message.toplist, credential, message.offset) });
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
      sendResponse({ ok: true, singer: await getSingerSongs(message.singer, credential, message.begin) });
      return;
    }
    if (message.type === MessageType.PLAY) {
      const result = await resumeCurrentSong();
      sendResponse(result);
      return;
    }
    if (message.type === MessageType.PAUSE) {
      sendResponse(await sendToPlayer({ type: MessageType.PAUSE }));
      return;
    }
    if (message.type === MessageType.SEEK) {
      const result = await sendToPlayer({ type: MessageType.SEEK, position: message.position });
      if (result?.ok) {
        playerState.currentTime = Number(result.currentTime) || 0;
        playerState.duration = Number(result.duration) || 0;
        chrome.runtime.sendMessage({ type: MessageType.PLAYER_STATE_CHANGED, state: playerState }).catch(() => undefined);
      }
      sendResponse(result);
      return;
    }
    if (message.type === MessageType.SET_PLAY_MODE) {
      if (!Object.values(PlaybackMode).includes(message.mode)) {
        sendResponse({ ok: false, error: "INVALID_PLAY_MODE", message: "不支持的播放模式" });
        return;
      }
      playerState.playMode = message.mode;
      await publishState();
      sendResponse({ ok: true, state: playerState });
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
