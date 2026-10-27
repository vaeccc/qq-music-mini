import { MessageType, PlaybackMode } from "../api/types.js";
import { icon } from "./icons.js";

const state = { tab: "liked", library: null, toplists: null, chartDetail: null, chartPaging: null, searchKeyword: "", searchResults: [], singerResults: [], albumResults: [], searchPaging: null, detail: null, detailPaging: null, singerDetail: null, albumDetail: null, player: null, seeking: false, poll: null, noticeTimer: null, viewRequestId: 0, errorShownFor: "", likedPaging: null };
const defaultTheme = { accent: "#18b768", dark: "#0c8d4d", wash: "#e9f8ef" };
const themeState = { cover: "", requestId: 0, cache: new Map() };
const elements = {
  notice: document.querySelector("#notice"), login: document.querySelector("#login-view"), music: document.querySelector("#music-view"), accountWrap: document.querySelector("#account-wrap"), account: document.querySelector("#account-button"), accountMenu: document.querySelector("#account-menu"), accountAvatar: document.querySelector("#account-avatar"), accountName: document.querySelector("#account-name"), accountId: document.querySelector("#account-id"), logout: document.querySelector("#logout-button"), qr: document.querySelector("#qr-panel"), qrImage: document.querySelector("#qr-image"), qrStatus: document.querySelector("#qr-status"), content: document.querySelector("#content"), brand: document.querySelector("#brand-mark"), playerTitle: document.querySelector("#player-title"), playerArtist: document.querySelector("#player-artist"), playerCover: document.querySelector("#player-cover"), mode: document.querySelector("#mode-button"), toggle: document.querySelector("#toggle-button"), progress: document.querySelector("#progress-slider"), currentTime: document.querySelector("#player-current-time"), duration: document.querySelector("#player-duration")
};
const playbackModes = [
  { value: PlaybackMode.ORDER, label: "顺序播放", icon: "order" },
  { value: PlaybackMode.REPEAT_ONE, label: "单曲循环", icon: "repeatOne" },
  { value: PlaybackMode.SHUFFLE, label: "随机播放", icon: "shuffle" }
];
function message(type, payload = {}) { return chrome.runtime.sendMessage({ type, ...payload }); }
function clear(node) { node.replaceChildren(); }
function showNotice(text = "", kind = "", hideAfter = 0) { clearTimeout(state.noticeTimer); state.noticeTimer = null; elements.notice.hidden = !text; elements.notice.textContent = text; elements.notice.className = `notice ${kind}`; if (text && hideAfter) state.noticeTimer = setTimeout(() => { state.noticeTimer = null; showNotice(); }, hideAfter); }
/**
 * Shows a playback error banner.
 *
 * The player publishes progress every 500 ms, and each of those updates
 * re-renders the player. Restarting the hide timer on every render would keep
 * the banner on screen forever, so the timer is only (re)armed when the
 * message itself changes.
 */
function showPlaybackError(message, hideAfter) {
  if (!message) { state.errorShownFor = ""; showNotice(); return; }
  if (state.errorShownFor === message) return;
  state.errorShownFor = message;
  showNotice(message, "", hideAfter);
}
function showError(error, fallback = "操作失败") { const defaults = { LOGIN_EXPIRED: "QQ 音乐登录已失效，请重新登录", NETWORK: "网络连接失败，请检查网络后重试", NO_PERMISSION: "当前账号无播放权限", NO_COPYRIGHT: "歌曲因版权限制暂不可播放", PLAY_URL: "播放地址获取失败", PLAYBACK_FAILED: "音频加载失败", QUEUE_BOUNDARY: "已经是队列的最后一首了" }; const message = !error?.message || error.message === "网络请求失败" ? defaults[error?.error] || fallback : error.message; if (error?.error === "LOGIN_EXPIRED") showLoginView(); state.errorShownFor = ""; showNotice(message); }
function closeAccountMenu() { elements.accountMenu.hidden = true; elements.account.setAttribute("aria-expanded", "false"); }
function showLoginView() { elements.login.hidden = false; elements.music.hidden = true; elements.accountWrap.hidden = true; closeAccountMenu(); }
function showMusicView() { elements.login.hidden = true; elements.music.hidden = false; elements.accountWrap.hidden = false; }
function renderAccount(user = {}) { const name = String(user.nickname || "QQ 音乐账号"); elements.accountName.textContent = name; elements.accountId.textContent = user.musicid ? `QQ 音乐 ID：${user.musicid}` : "已登录"; elements.accountAvatar.style.backgroundImage = user.avatar ? `url("${user.avatar}")` : ""; elements.accountAvatar.textContent = user.avatar ? "" : (name.trim().charAt(0) || "Q"); }
function setCover(node, url) { node.style.backgroundImage = url ? `url("${url}")` : ""; node.innerHTML = url ? "" : icon("note"); }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function rgbToHsl(red, green, blue) {
  const r = red / 255; const g = green / 255; const b = blue / 255; const max = Math.max(r, g, b); const min = Math.min(r, g, b); const lightness = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: lightness };
  const delta = max - min; const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min); let hue;
  if (max === r) hue = (g - b) / delta + (g < b ? 6 : 0); else if (max === g) hue = (b - r) / delta + 2; else hue = (r - g) / delta + 4;
  return { h: hue / 6, s: saturation, l: lightness };
}
function hslColor(h, s, l) { return `hsl(${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`; }
function applyTheme(theme = defaultTheme) { const root = document.documentElement; root.style.setProperty("--green", theme.accent); root.style.setProperty("--green-dark", theme.dark); root.style.setProperty("--green-wash", theme.wash); }
async function sampleCoverColor(url) {
  const response = await fetch(url, { credentials: "omit", cache: "force-cache" });
  if (!response.ok) throw new Error(`cover request failed: ${response.status}`);
  const bitmap = await createImageBitmap(await response.blob());
  const canvas = document.createElement("canvas"); canvas.width = 32; canvas.height = 32;
  const context = canvas.getContext("2d", { willReadFrequently: true }); context.drawImage(bitmap, 0, 0, 32, 32); bitmap.close();
  const pixels = context.getImageData(0, 0, 32, 32).data; let red = 0; let green = 0; let blue = 0; let weightSum = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3] / 255; if (alpha < 0.75) continue;
    const hsl = rgbToHsl(pixels[index], pixels[index + 1], pixels[index + 2]);
    if (hsl.l < 0.08 || hsl.l > 0.95) continue;
    const weight = Math.max(0.08, hsl.s) * alpha;
    red += pixels[index] * weight; green += pixels[index + 1] * weight; blue += pixels[index + 2] * weight; weightSum += weight;
  }
  if (!weightSum) return null;
  const color = rgbToHsl(red / weightSum, green / weightSum, blue / weightSum);
  const hue = color.s < 0.12 ? 0.4 : color.h;
  const saturation = clamp(Math.max(color.s, 0.55), 0.55, 0.82);
  const lightness = clamp(color.l, 0.42, 0.56);
  return { accent: hslColor(hue, saturation, lightness), dark: hslColor(hue, saturation, clamp(lightness - 0.16, 0.28, 0.42)), wash: hslColor(hue, 0.52, 0.94) };
}
function updateThemeFromCover(url) {
  if (themeState.cover === url) return;
  themeState.cover = url; const requestId = ++themeState.requestId;
  if (!url) { applyTheme(); return; }
  const cached = themeState.cache.get(url);
  if (cached) { applyTheme(cached); return; }
  sampleCoverColor(url).then((theme) => {
    if (requestId !== themeState.requestId) return;
    if (!theme) { applyTheme(); return; }
    themeState.cache.set(url, theme);
    if (themeState.cache.size > 32) themeState.cache.delete(themeState.cache.keys().next().value);
    applyTheme(theme);
  }).catch(() => { if (requestId === themeState.requestId) applyTheme(); });
}
function formatTime(seconds) { const value = Math.max(0, Math.floor(Number(seconds) || 0)); return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`; }
function renderPlayer(player) { state.player = player; const song = player?.currentSong; const songKey = String(song?.mid || song?.id || ""); const duration = Math.max(0, Number(player?.duration) || 0); const currentTime = Math.min(Math.max(0, Number(player?.currentTime) || 0), duration || Infinity); const mode = playbackModes.find((item) => item.value === player?.playMode) || playbackModes[0]; if (!state.seeking) { elements.progress.max = String(Math.max(0, Math.floor(duration))); elements.progress.value = String(Math.floor(currentTime)); elements.currentTime.textContent = formatTime(currentTime); } const displayTime = state.seeking ? Number(elements.progress.value) || 0 : currentTime; elements.playerTitle.textContent = song?.title || "暂无播放歌曲"; elements.playerArtist.textContent = song?.artist || ""; setCover(elements.playerCover, song?.cover); updateThemeFromCover(song?.cover || ""); elements.mode.innerHTML = icon(mode.icon); elements.mode.title = mode.label; elements.mode.setAttribute("aria-label", `播放模式：${mode.label}`); elements.toggle.innerHTML = icon(player?.playing ? "pause" : "play"); elements.toggle.setAttribute("aria-label", player?.playing ? "暂停" : "播放"); elements.duration.textContent = formatTime(duration); elements.progress.disabled = !song || duration <= 0; elements.progress.style.setProperty("--progress", duration > 0 ? `${displayTime / duration * 100}%` : "0%"); document.querySelectorAll(".song-row").forEach((row) => { const active = Boolean(songKey && row.dataset.songKey === songKey); row.classList.toggle("active", active); row.setAttribute("aria-current", active ? "true" : "false"); }); if (player?.errorMessage) showPlaybackError(player.errorMessage, skippableError(player.errorCode) ? 5000 : 0); else showPlaybackError("", 0); }
function skippableError(code) { return ["NO_PERMISSION", "NO_COPYRIGHT", "PLAY_URL", "PLAYBACK_FAILED"].includes(code); }
/**
 * Binds the "scroll to the bottom" handler of the content area.
 *
 * The content element is reused across renders, so registering a new listener
 * on every render would accumulate handlers. An AbortController removes the
 * previous listener before the next one is attached.
 */
let scrollAbortController = null;
function bindContentScroll(handler) {
  scrollAbortController?.abort();
  scrollAbortController = new AbortController();
  elements.content.addEventListener("scroll", handler, { signal: scrollAbortController.signal });
}

function makeSongRow(song, queue, index) {
  const row = document.createElement("button"); row.className = "song-row"; row.dataset.songKey = String(song.mid || song.id || "");
  const cover = document.createElement("span"); cover.className = "cover"; setCover(cover, song.cover);
  const info = document.createElement("span"); info.className = "song-info";
  const title = document.createElement("strong"); title.textContent = song.title;
  const sub = document.createElement("span"); sub.textContent = [song.artist, song.album].filter(Boolean).join(" · ");
  info.append(title, sub); row.append(cover, info);
  const currentKey = state.player?.currentSong?.mid || state.player?.currentSong?.id; if (currentKey && String(currentKey) === row.dataset.songKey) { row.classList.add("active"); row.setAttribute("aria-current", "true"); }
  row.addEventListener("click", async () => playSong(queue, index));
  return row;
}
async function playSong(queue, index) { showNotice(); const result = await message(MessageType.PLAY_SONG, { queue, index }); if (!result.ok) showError(result, "播放失败"); }
function renderSongs(songs, emptyText) { const list = document.createElement("div"); list.className = "list"; if (!songs.length) { const empty = document.createElement("p"); empty.className = "empty"; empty.textContent = emptyText; list.append(empty); return list; } songs.forEach((song, index) => list.append(makeSongRow(song, songs, index))); return list; }
function renderLiked() {
  clear(elements.content);
  const songs = state.library?.liked || [];
  elements.content.append(renderSongs(songs, "还没有喜欢的歌曲"));
  const paging = state.likedPaging;
  if (!paging) return;
  const status = document.createElement("p");
  status.className = "load-more";
  status.textContent = paging.loadingMore
    ? "正在加载更多歌曲…"
    : paging.complete
      ? `已加载全部 ${songs.length} 首歌曲`
      : `已加载 ${songs.length}${paging.total ? ` / ${paging.total}` : ""} 首，继续下滑加载更多`;
  elements.content.append(status);
  bindContentScroll(() => { if (elements.content.scrollTop + elements.content.clientHeight >= elements.content.scrollHeight - 80) loadMoreLikedSongs(); });
}
/** Loads the next page of the "liked" list and appends it. */
async function loadMoreLikedSongs() {
  const paging = state.likedPaging;
  if (!paging || paging.loadingMore || paging.complete) return;
  paging.loadingMore = true;
  const scrollTop = elements.content.scrollTop;
  renderLiked();
  const result = await message(MessageType.GET_LIKED_SONGS, { begin: state.library?.liked?.length || 0 });
  if (state.likedPaging !== paging) return;
  paging.loadingMore = false;
  if (!result.ok) { showError(result, "加载更多歌曲失败"); renderLiked(); return; }
  const known = new Set((state.library?.liked || []).map((song) => song.mid));
  const added = (result.songs || []).filter((song) => !known.has(song.mid));
  state.library.liked.push(...added);
  paging.total = result.total || paging.total;
  paging.complete = !added.length || (paging.total > 0 && state.library.liked.length >= paging.total);
  renderLiked();
  elements.content.scrollTop = scrollTop;
}
function renderPlaylists() {
  clear(elements.content); const list = document.createElement("div"); list.className = "list"; const playlists = state.library?.playlists || [];
  if (!playlists.length) { const empty = document.createElement("p"); empty.className = "empty"; empty.textContent = "还没有歌单"; list.append(empty); }
  playlists.forEach((playlist) => { const row = document.createElement("button"); row.className = "playlist-row"; const cover = document.createElement("span"); cover.className = "cover"; setCover(cover, playlist.cover); const info = document.createElement("span"); info.className = "playlist-info"; const title = document.createElement("strong"); title.textContent = playlist.title; const count = document.createElement("span"); count.textContent = `${playlist.count} 首歌曲`; info.append(title, count); row.append(cover, info); row.addEventListener("click", () => openPlaylist(playlist)); list.append(row); });
  elements.content.append(list);
}
async function openPlaylist(playlist) { showNotice("正在加载歌单…", "info"); const result = await message(MessageType.GET_PLAYLIST_DETAIL, { playlist }); if (!result.ok) { showError(result, "歌单加载失败"); return; } showNotice(); state.detail = result.playlist; const songs = state.detail?.songs || []; const total = Number(state.detail?.total || 0); state.detailPaging = { loadingMore: false, total, complete: !songs.length || (total > 0 && songs.length >= total) }; renderPlaylistDetail(); }
function makeDetailHeader(titleText, backLabel, onBack, onPlay) { const header = document.createElement("div"); header.className = "detail-header"; const back = document.createElement("button"); back.innerHTML = icon("back"); back.setAttribute("aria-label", backLabel); back.addEventListener("click", onBack); const title = document.createElement("strong"); title.textContent = titleText; header.append(back, title); if (onPlay) { const play = document.createElement("button"); play.className = "detail-actions"; play.textContent = "播放全部"; play.disabled = false; play.addEventListener("click", onPlay); header.append(play); } return header; }
function renderPlaylistDetail(scrollTop = 0) {
  clear(elements.content);
  const songs = state.detail?.songs || [];
  const header = makeDetailHeader(state.detail.title, "返回歌单", () => { state.detail = null; state.detailPaging = null; renderPlaylists(); }, songs.length ? () => playSong(songs, 0) : null);
  elements.content.append(header, renderSongs(songs, "歌单暂无歌曲"));
  const paging = state.detailPaging;
  if (paging) {
    const status = document.createElement("p");
    status.className = "load-more";
    status.textContent = paging.loadingMore
      ? "正在加载更多歌曲…"
      : paging.complete
        ? `已加载全部 ${songs.length} 首歌曲`
        : `已加载 ${songs.length}${paging.total ? ` / ${paging.total}` : ""} 首，继续下滑加载更多`;
    elements.content.append(status);
  }
  elements.content.scrollTop = scrollTop;
  bindContentScroll(() => { if (elements.content.scrollTop + elements.content.clientHeight >= elements.content.scrollHeight - 80) loadMorePlaylistSongs(); });
}
/** Loads the next page of the open playlist and appends it. */
async function loadMorePlaylistSongs() {
  const paging = state.detailPaging;
  if (!paging || paging.loadingMore || paging.complete) return;
  paging.loadingMore = true;
  const scrollTop = elements.content.scrollTop;
  renderPlaylistDetail(scrollTop);
  const result = await message(MessageType.GET_PLAYLIST_DETAIL, { playlist: { id: state.detail.id, dirid: state.detail.dirid, title: state.detail.title }, begin: state.detail.songs.length });
  if (state.detailPaging !== paging) return;
  paging.loadingMore = false;
  if (!result.ok) { showError(result, "加载更多歌曲失败"); renderPlaylistDetail(scrollTop); return; }
  const known = new Set(state.detail.songs.map((song) => song.mid));
  const added = (result.playlist?.songs || []).filter((song) => !known.has(song.mid));
  state.detail.songs.push(...added);
  paging.total = Number(result.playlist?.total || 0) || paging.total;
  paging.complete = !added.length || (paging.total > 0 && state.detail.songs.length >= paging.total);
  renderPlaylistDetail(scrollTop);
}
function renderToplists() {
  clear(elements.content); const list = document.createElement("div"); list.className = "list"; const toplists = state.toplists || [];
  if (!toplists.length) { const empty = document.createElement("p"); empty.className = "empty"; empty.textContent = "暂无排行榜"; list.append(empty); }
  toplists.forEach((toplist) => { const row = document.createElement("button"); row.className = "playlist-row"; const cover = document.createElement("span"); cover.className = "cover"; setCover(cover, toplist.cover); const info = document.createElement("span"); info.className = "playlist-info"; const title = document.createElement("strong"); title.textContent = toplist.title; const count = document.createElement("span"); count.textContent = toplist.count ? `${toplist.count} 首歌曲` : "查看榜单歌曲"; info.append(title, count); row.append(cover, info); row.addEventListener("click", () => openToplist(toplist)); list.append(row); });
  elements.content.append(list);
}
async function openToplist(toplist) { showNotice("正在加载排行榜…", "info"); const result = await message(MessageType.GET_TOPLIST_DETAIL, { toplist }); if (!result.ok) { showError(result, "排行榜加载失败"); return; } showNotice(); state.chartDetail = result.toplist; const songs = state.chartDetail?.songs || []; const total = Number(state.chartDetail?.total || 0); state.chartPaging = { loadingMore: false, total, complete: !songs.length || (total > 0 && songs.length >= total) }; renderToplistDetail(); }
async function loadMoreToplistSongs() {
  const detail = state.chartDetail;
  const paging = state.chartPaging;
  if (!detail || !paging || paging.loadingMore || paging.complete) return;
  paging.loadingMore = true;
  const scrollTop = elements.content.scrollTop;
  renderToplistDetail(scrollTop);
  const result = await message(MessageType.GET_TOPLIST_DETAIL, { toplist: { id: detail.id, title: detail.title, cover: detail.cover }, offset: detail.songs.length });
  if (state.chartDetail !== detail || state.chartPaging !== paging) return;
  paging.loadingMore = false;
  if (!result.ok) { showError(result, "加载更多榜单歌曲失败"); renderToplistDetail(scrollTop); return; }
  const known = new Set(detail.songs.map((song) => song.mid));
  const added = (result.toplist?.songs || []).filter((song) => !known.has(song.mid));
  detail.songs.push(...added);
  paging.total = Number(result.toplist?.total || 0) || paging.total;
  paging.complete = !added.length || (paging.total > 0 && detail.songs.length >= paging.total);
  renderToplistDetail(scrollTop);
}
function renderToplistDetail(scrollTop = 0) { const detail = state.chartDetail; clear(elements.content); const songs = detail?.songs || []; const period = detail?.period ? ` · ${detail.period}` : ""; const header = makeDetailHeader(`${detail.title}${period}`, "返回排行榜", () => { state.chartDetail = null; state.chartPaging = null; renderToplists(); }, songs.length ? () => playSong(songs, 0) : null); elements.content.append(header, renderSongs(songs, "榜单暂无歌曲")); const paging = state.chartPaging; if (paging) { const status = document.createElement("p"); status.className = "load-more"; status.textContent = paging.loadingMore ? "正在加载更多榜单歌曲…" : paging.complete ? `已加载全部 ${songs.length} 首歌曲` : `已加载 ${songs.length}${paging.total ? ` / ${paging.total}` : ""} 首，继续下滑加载更多`; elements.content.append(status); } elements.content.scrollTop = scrollTop; bindContentScroll(() => { if (elements.content.scrollTop + elements.content.clientHeight >= elements.content.scrollHeight - 80) loadMoreToplistSongs(); }); }
function makeSingerRow(singer) {
  const row = document.createElement("button"); row.className = "singer-row"; row.setAttribute("aria-label", `查看${singer.name}的歌曲`);
  const cover = document.createElement("span"); cover.className = "cover"; setCover(cover, singer.cover);
  const info = document.createElement("span"); info.className = "singer-info"; const title = document.createElement("strong"); title.textContent = singer.name; const sub = document.createElement("span"); sub.textContent = "歌手"; info.append(title, sub); row.append(cover, info);
  row.addEventListener("click", () => openSinger(singer)); return row;
}
function makeAlbumRow(album) {
  const row = document.createElement("button"); row.className = "album-row"; row.setAttribute("aria-label", `查看专辑${album.name}`);
  const cover = document.createElement("span"); cover.className = "cover"; setCover(cover, album.cover);
  const info = document.createElement("span"); info.className = "album-info"; const title = document.createElement("strong"); title.textContent = album.name; const sub = document.createElement("span"); sub.textContent = album.artist ? `专辑 · ${album.artist}` : "专辑"; info.append(title, sub); row.append(cover, info);
  row.addEventListener("click", () => openAlbum(album)); return row;
}
async function openAlbum(album) { showNotice("正在加载专辑…", "info"); const result = await message(MessageType.GET_ALBUM_SONGS, { album }); if (!result.ok) { showError(result, "专辑歌曲加载失败"); return; } showNotice(); state.albumDetail = { ...result.album, loadingMore: false, complete: !result.album.songs.length || (result.album.total > 0 && result.album.songs.length >= result.album.total) }; renderAlbumDetail(); }
async function loadMoreAlbumSongs() {
  const detail = state.albumDetail;
  if (!detail || detail.loadingMore || detail.complete) return;
  detail.loadingMore = true; const scrollTop = elements.content.scrollTop; renderAlbumDetail(scrollTop);
  const result = await message(MessageType.GET_ALBUM_SONGS, { album: detail.album, begin: detail.songs.length });
  if (state.albumDetail !== detail) return;
  detail.loadingMore = false;
  if (!result.ok) { showError(result, "加载更多歌曲失败"); renderAlbumDetail(scrollTop); return; }
  const known = new Set(detail.songs.map((song) => song.mid));
  const added = (result.album.songs || []).filter((song) => !known.has(song.mid));
  detail.songs.push(...added); detail.total = result.album.total || detail.total;
  detail.complete = !added.length || (detail.total > 0 && detail.songs.length >= detail.total);
  renderAlbumDetail(scrollTop);
}
function renderAlbumDetail(scrollTop = 0) {
  const detail = state.albumDetail;
  clear(elements.content);
  const songs = detail?.songs || [];
  const header = makeDetailHeader(detail.album?.name || detail.title || "专辑", "返回搜索结果", () => { state.albumDetail = null; renderSearch(); }, songs.length ? () => playSong(songs, 0) : null);
  const meta = document.createElement("p"); meta.className = "album-meta";
  meta.textContent = [detail.album?.artist, detail.album?.publishDate].filter(Boolean).join(" · ");
  elements.content.append(header);
  if (meta.textContent) elements.content.append(meta);
  elements.content.append(renderSongs(songs, "该专辑暂无歌曲"));
  const status = document.createElement("p"); status.className = "load-more";
  status.textContent = detail.loadingMore ? "正在加载更多歌曲…" : detail.complete ? `已加载全部 ${detail.songs.length} 首歌曲` : `已加载 ${detail.songs.length}${detail.total ? ` / ${detail.total}` : ""} 首，继续下滑加载更多`;
  elements.content.append(status);
  elements.content.scrollTop = scrollTop;
  bindContentScroll(() => { if (elements.content.scrollTop + elements.content.clientHeight >= elements.content.scrollHeight - 80) loadMoreAlbumSongs(); });
}
async function openSinger(singer) { showNotice("正在加载歌手歌曲…", "info"); const result = await message(MessageType.GET_SINGER_SONGS, { singer }); if (!result.ok) { showError(result, "歌手歌曲加载失败"); return; } showNotice(); state.singerDetail = { ...result.singer, loadingMore: false, complete: !result.singer.songs.length || (result.singer.total > 0 && result.singer.songs.length >= result.singer.total) }; renderSingerDetail(); }
async function loadMoreSingerSongs() {
  const detail = state.singerDetail;
  if (!detail || detail.loadingMore || detail.complete) return;
  detail.loadingMore = true; const scrollTop = elements.content.scrollTop; renderSingerDetail(scrollTop);
  const result = await message(MessageType.GET_SINGER_SONGS, { singer: detail.singer, begin: detail.songs.length });
  if (state.singerDetail !== detail) return;
  detail.loadingMore = false;
  if (!result.ok) { showError(result, "加载更多歌曲失败"); renderSingerDetail(scrollTop); return; }
  const known = new Set(detail.songs.map((song) => song.mid));
  const added = (result.singer.songs || []).filter((song) => !known.has(song.mid));
  detail.songs.push(...added); detail.total = result.singer.total || detail.total;
  detail.complete = !added.length || (detail.total > 0 && detail.songs.length >= detail.total);
  renderSingerDetail(scrollTop);
}
function renderSingerDetail(scrollTop = 0) { const detail = state.singerDetail; clear(elements.content); const header = document.createElement("div"); header.className = "detail-header"; const back = document.createElement("button"); back.innerHTML = icon("back"); back.setAttribute("aria-label", "返回搜索结果"); back.addEventListener("click", () => { state.singerDetail = null; renderSearch(); }); const title = document.createElement("strong"); title.textContent = detail.title; header.append(back, title); const status = document.createElement("p"); status.className = "load-more"; status.textContent = detail.loadingMore ? "正在加载更多歌曲…" : detail.complete ? `已加载全部 ${detail.songs.length} 首歌曲` : `已加载 ${detail.songs.length}${detail.total ? ` / ${detail.total}` : ""} 首，继续下滑加载更多`; elements.content.append(header, renderSongs(detail.songs, "该歌手暂无可播放歌曲"), status); elements.content.scrollTop = scrollTop; bindContentScroll(() => { if (elements.content.scrollTop + elements.content.clientHeight >= elements.content.scrollHeight - 80) loadMoreSingerSongs(); }); }
async function loadMoreSearchSongs() {
  const paging = state.searchPaging;
  if (!paging || paging.loadingMore || paging.complete) return;
  paging.loadingMore = true; const scrollTop = elements.content.scrollTop; renderSearch(scrollTop);
  const result = await message(MessageType.GET_SINGER_SONGS, { singer: paging.singer, begin: state.searchResults.length });
  if (state.searchPaging !== paging) return;
  paging.loadingMore = false;
  if (!result.ok) { showError(result, "加载更多歌曲失败"); renderSearch(scrollTop); return; }
  const known = new Set(state.searchResults.map((song) => song.mid));
  const added = (result.singer.songs || []).filter((song) => !known.has(song.mid));
  state.searchResults.push(...added); paging.total = result.singer.total || paging.total;
  paging.complete = !added.length || (paging.total > 0 && state.searchResults.length >= paging.total);
  renderSearch(scrollTop);
}
function renderSearch(scrollTop = 0) {
  clear(elements.content); const form = document.createElement("form"); form.className = "search-form"; const input = document.createElement("input"); input.placeholder = "搜索歌曲、歌手或专辑"; input.value = state.searchKeyword; input.setAttribute("aria-label", "搜索歌曲、歌手或专辑"); const submit = document.createElement("button"); submit.textContent = "搜索"; form.append(input, submit);
  form.addEventListener("submit", async (event) => { event.preventDefault(); const keyword = input.value.trim(); if (!keyword) return; showNotice("正在搜索…", "info"); const result = await message(MessageType.SEARCH_SONGS, { keyword }); if (!result.ok) { showError(result, "搜索失败"); return; } showNotice(); state.searchKeyword = keyword; state.searchResults = result.songs || []; state.singerResults = result.singers || []; state.albumResults = result.albums || []; state.searchPaging = result.searchPaging ? { ...result.searchPaging, loadingMore: false, complete: !result.songs.length || (result.searchPaging.total > 0 && result.songs.length >= result.searchPaging.total) } : null; state.singerDetail = null; state.albumDetail = null; renderSearch(); });
  elements.content.append(form);
  if (!state.searchKeyword) { elements.content.append(renderSongs([], "输入关键词搜索歌曲、歌手或专辑")); return; }
  if (state.singerResults.length) { const singerSection = document.createElement("section"); const heading = document.createElement("h2"); heading.className = "result-section-title"; heading.textContent = "歌手"; const list = document.createElement("div"); list.className = "list"; state.singerResults.forEach((singer) => list.append(makeSingerRow(singer))); singerSection.append(heading, list); elements.content.append(singerSection); }
  if (state.albumResults.length) { const albumSection = document.createElement("section"); const heading = document.createElement("h2"); heading.className = "result-section-title"; heading.textContent = "专辑"; const list = document.createElement("div"); list.className = "list"; state.albumResults.forEach((album) => list.append(makeAlbumRow(album))); albumSection.append(heading, list); elements.content.append(albumSection); }
  const songSection = document.createElement("section"); const heading = document.createElement("h2"); heading.className = "result-section-title"; heading.textContent = "歌曲"; songSection.append(heading, renderSongs(state.searchResults, "没有找到相关歌曲"));
  if (state.searchPaging) { const status = document.createElement("p"); status.className = "load-more"; status.textContent = state.searchPaging.loadingMore ? "正在加载更多歌曲…" : state.searchPaging.complete ? `已加载全部 ${state.searchResults.length} 首歌曲` : `已加载 ${state.searchResults.length}${state.searchPaging.total ? ` / ${state.searchPaging.total}` : ""} 首，继续下滑加载更多`; songSection.append(status); }
  elements.content.append(songSection); elements.content.scrollTop = scrollTop;
  if (state.searchPaging) bindContentScroll(() => { if (elements.content.scrollTop + elements.content.clientHeight >= elements.content.scrollHeight - 80) loadMoreSearchSongs(); });
}
function renderTab() { document.querySelectorAll(".nav-button").forEach((button) => button.classList.toggle("active", button.dataset.tab === state.tab)); if (state.tab === "liked") renderLiked(); if (state.tab === "playlists") renderPlaylists(); if (state.tab === "charts") renderToplists(); if (state.tab === "search") renderSearch(); }
async function loadLibrary() { const result = await message(MessageType.GET_LIBRARY); if (!result.ok) throw result; state.library = result.library; const liked = state.library?.liked || []; const likedTotal = Number(state.library?.likedTotal || 0); state.likedPaging = { loadingMore: false, total: likedTotal, complete: !liked.length || (likedTotal > 0 && liked.length >= likedTotal) }; renderAccount(state.library?.user); renderTab(); }
async function loadToplists() { showNotice("正在加载排行榜…", "info"); const result = await message(MessageType.GET_TOPLISTS); if (!result.ok) { showError(result, "排行榜加载失败"); return; } state.toplists = result.toplists || []; showNotice(); renderToplists(); }
async function startLogin() { state.viewRequestId += 1; showLoginView(); showNotice(); elements.qr.hidden = true; const result = await message(MessageType.LOGIN_START); if (!result.ok) { showError(result, "登录失败，请重新尝试"); return; } elements.qrImage.src = result.imageUrl; elements.qr.hidden = false; elements.qrStatus.textContent = "请使用 QQ 扫码登录"; clearInterval(state.poll); state.poll = setInterval(checkLogin, 2500); }
async function checkLogin() { const result = await message(MessageType.LOGIN_STATUS); if (!result.ok) { clearInterval(state.poll); showError(result, "登录失败，请重新尝试"); return; } if (result.status === "waiting") return; if (result.status === "scanned") { elements.qrStatus.textContent = "已扫码，请在手机上确认"; return; } if (result.status === "expired") { clearInterval(state.poll); elements.qrStatus.textContent = "二维码已失效，请重新获取"; return; } if (result.status === "done") { clearInterval(state.poll); const requestId = ++state.viewRequestId; try { await loadLibrary(); if (requestId === state.viewRequestId) showMusicView(); } catch (error) { if (requestId === state.viewRequestId) showError(error, "曲库加载失败"); } } }
document.querySelectorAll(".nav-button").forEach((button) => button.addEventListener("click", () => { state.tab = button.dataset.tab; state.detail = null; state.detailPaging = null; state.chartDetail = null; state.chartPaging = null; state.singerDetail = null; state.albumDetail = null; renderTab(); if (state.tab === "charts" && state.toplists === null) loadToplists(); }));
document.querySelector("#login-button").addEventListener("click", startLogin); document.querySelector("#retry-login").addEventListener("click", startLogin);
elements.account.addEventListener("click", () => { const open = elements.accountMenu.hidden; elements.accountMenu.hidden = !open; elements.account.setAttribute("aria-expanded", String(open)); });
elements.logout.addEventListener("click", async () => { const result = await message(MessageType.LOGOUT); if (!result?.ok) { showError(result, "退出登录失败"); return; } clearInterval(state.poll); state.library = null; state.toplists = null; state.detail = null; state.detailPaging = null; state.chartDetail = null; state.chartPaging = null; state.singerDetail = null; state.albumDetail = null; state.searchKeyword = ""; state.searchResults = []; state.singerResults = []; state.albumResults = []; state.searchPaging = null; state.likedPaging = null; clear(elements.content); elements.qr.hidden = true; renderPlayer(result.state); showNotice(); showLoginView(); });
document.addEventListener("click", (event) => { if (!elements.accountWrap.hidden && !elements.accountWrap.contains(event.target)) closeAccountMenu(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeAccountMenu(); });
document.querySelectorAll("[data-control]").forEach((button) => button.addEventListener("click", async () => { const action = button.dataset.control; const type = action === "previous" ? MessageType.PREVIOUS : action === "next" ? MessageType.NEXT : state.player?.playing ? MessageType.PAUSE : MessageType.PLAY; const result = await message(type); if (!result?.ok) showError(result, "播放操作失败"); }));
elements.mode.addEventListener("click", async () => { const currentIndex = Math.max(0, playbackModes.findIndex((item) => item.value === state.player?.playMode)); const nextMode = playbackModes[(currentIndex + 1) % playbackModes.length]; const result = await message(MessageType.SET_PLAY_MODE, { mode: nextMode.value }); if (!result?.ok) { showError(result, "无法切换播放模式"); return; } renderPlayer(result.state); });
elements.progress.addEventListener("input", () => { state.seeking = true; const currentTime = Number(elements.progress.value) || 0; elements.currentTime.textContent = formatTime(currentTime); const duration = Number(elements.progress.max) || 0; elements.progress.style.setProperty("--progress", duration > 0 ? `${currentTime / duration * 100}%` : "0%"); });
elements.progress.addEventListener("change", async () => { const result = await message(MessageType.SEEK, { position: Number(elements.progress.value) || 0 }); state.seeking = false; if (!result?.ok) { showError(result, "暂时无法调整播放进度"); renderPlayer(state.player); return; } renderPlayer({ ...state.player, currentTime: result.currentTime, duration: result.duration }); });
elements.brand.innerHTML = icon("note"); document.querySelector('[data-control="previous"]').innerHTML = icon("previous"); document.querySelector('[data-control="next"]').innerHTML = icon("next");
chrome.runtime.onMessage.addListener((message) => { if (message.type === MessageType.PLAYER_STATE_CHANGED) renderPlayer(message.state); });
(async () => { const player = await message(MessageType.GET_PLAYER_STATE); renderPlayer(player.state); const requestId = ++state.viewRequestId; try { await loadLibrary(); if (requestId === state.viewRequestId) showMusicView(); } catch (error) { if (requestId === state.viewRequestId) showError(error, "曲库加载失败"); } })();
