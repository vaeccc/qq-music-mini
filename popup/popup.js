import { MessageType, PlaybackMode } from "../api/types.js";
import { icon } from "./icons.js";

const state = { tab: "liked", library: null, searchKeyword: "", searchResults: [], singerResults: [], searchPaging: null, detail: null, singerDetail: null, player: null, seeking: false, poll: null, noticeTimer: null, viewRequestId: 0 };
const elements = {
  notice: document.querySelector("#notice"), login: document.querySelector("#login-view"), music: document.querySelector("#music-view"), qr: document.querySelector("#qr-panel"), qrImage: document.querySelector("#qr-image"), qrStatus: document.querySelector("#qr-status"), content: document.querySelector("#content"), brand: document.querySelector("#brand-mark"), playerTitle: document.querySelector("#player-title"), playerArtist: document.querySelector("#player-artist"), playerCover: document.querySelector("#player-cover"), mode: document.querySelector("#mode-button"), toggle: document.querySelector("#toggle-button"), progress: document.querySelector("#progress-slider"), currentTime: document.querySelector("#player-current-time"), duration: document.querySelector("#player-duration")
};
const playbackModes = [
  { value: PlaybackMode.ORDER, label: "顺序播放", icon: "order" },
  { value: PlaybackMode.REPEAT_ONE, label: "单曲循环", icon: "repeatOne" },
  { value: PlaybackMode.SHUFFLE, label: "随机播放", icon: "shuffle" }
];
function message(type, payload = {}) { return chrome.runtime.sendMessage({ type, ...payload }); }
function clear(node) { node.replaceChildren(); }
function showNotice(text = "", kind = "", hideAfter = 0) { clearTimeout(state.noticeTimer); elements.notice.hidden = !text; elements.notice.textContent = text; elements.notice.className = `notice ${kind}`; if (text && hideAfter) state.noticeTimer = setTimeout(() => showNotice(), hideAfter); }
function showError(error, fallback = "操作失败") { const defaults = { LOGIN_EXPIRED: "QQ 音乐登录已失效，请重新登录", NETWORK: "网络连接失败，请检查网络后重试", NO_PERMISSION: "当前账号无播放权限", NO_COPYRIGHT: "歌曲因版权限制暂不可播放", PLAY_URL: "播放地址获取失败", PLAYBACK_FAILED: "音频加载失败" }; const message = !error?.message || error.message === "网络请求失败" ? defaults[error?.error] || fallback : error.message; if (error?.error === "LOGIN_EXPIRED") showLoginView(); showNotice(message); }
function showLoginView() { elements.login.hidden = false; elements.music.hidden = true; }
function showMusicView() { elements.login.hidden = true; elements.music.hidden = false; }
function setCover(node, url) { node.style.backgroundImage = url ? `url("${url}")` : ""; node.innerHTML = url ? "" : icon("note"); }
function formatTime(seconds) { const value = Math.max(0, Math.floor(Number(seconds) || 0)); return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`; }
function renderPlayer(player) { state.player = player; const song = player?.currentSong; const songKey = String(song?.mid || song?.id || ""); const duration = Math.max(0, Number(player?.duration) || 0); const currentTime = Math.min(Math.max(0, Number(player?.currentTime) || 0), duration || Infinity); const mode = playbackModes.find((item) => item.value === player?.playMode) || playbackModes[0]; if (!state.seeking) { elements.progress.max = String(Math.max(0, Math.floor(duration))); elements.progress.value = String(Math.floor(currentTime)); elements.currentTime.textContent = formatTime(currentTime); } const displayTime = state.seeking ? Number(elements.progress.value) || 0 : currentTime; elements.playerTitle.textContent = song?.title || "暂无播放歌曲"; elements.playerArtist.textContent = song?.artist || ""; setCover(elements.playerCover, song?.cover); elements.mode.innerHTML = icon(mode.icon); elements.mode.title = mode.label; elements.mode.setAttribute("aria-label", `播放模式：${mode.label}`); elements.toggle.innerHTML = icon(player?.playing ? "pause" : "play"); elements.toggle.setAttribute("aria-label", player?.playing ? "暂停" : "播放"); elements.duration.textContent = formatTime(duration); elements.progress.disabled = !song || duration <= 0; elements.progress.style.setProperty("--progress", duration > 0 ? `${displayTime / duration * 100}%` : "0%"); document.querySelectorAll(".song-row").forEach((row) => { const active = Boolean(songKey && row.dataset.songKey === songKey); row.classList.toggle("active", active); row.setAttribute("aria-current", active ? "true" : "false"); }); if (player?.errorMessage) showNotice(player.errorMessage, "", skippableError(player.errorCode) ? 5000 : 0); }
function skippableError(code) { return ["NO_PERMISSION", "NO_COPYRIGHT", "PLAY_URL", "PLAYBACK_FAILED"].includes(code); }

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
function renderLiked() { clear(elements.content); elements.content.append(renderSongs(state.library?.liked || [], "还没有喜欢的歌曲")); }
function renderPlaylists() {
  clear(elements.content); const list = document.createElement("div"); list.className = "list"; const playlists = state.library?.playlists || [];
  if (!playlists.length) { const empty = document.createElement("p"); empty.className = "empty"; empty.textContent = "还没有歌单"; list.append(empty); }
  playlists.forEach((playlist) => { const row = document.createElement("button"); row.className = "playlist-row"; const cover = document.createElement("span"); cover.className = "cover"; setCover(cover, playlist.cover); const info = document.createElement("span"); info.className = "playlist-info"; const title = document.createElement("strong"); title.textContent = playlist.title; const count = document.createElement("span"); count.textContent = `${playlist.count} 首歌曲`; info.append(title, count); row.append(cover, info); row.addEventListener("click", () => openPlaylist(playlist)); list.append(row); });
  elements.content.append(list);
}
async function openPlaylist(playlist) { showNotice("正在加载歌单…", "info"); const result = await message(MessageType.GET_PLAYLIST_DETAIL, { playlist }); if (!result.ok) { showError(result, "歌单加载失败"); return; } showNotice(); state.detail = result.playlist; renderPlaylistDetail(); }
function renderPlaylistDetail() { clear(elements.content); const header = document.createElement("div"); header.className = "detail-header"; const back = document.createElement("button"); back.innerHTML = icon("back"); back.setAttribute("aria-label", "返回歌单"); back.addEventListener("click", () => { state.detail = null; renderPlaylists(); }); const title = document.createElement("strong"); title.textContent = state.detail.title; header.append(back, title); elements.content.append(header, renderSongs(state.detail.songs, "歌单暂无歌曲")); }
function makeSingerRow(singer) {
  const row = document.createElement("button"); row.className = "singer-row"; row.setAttribute("aria-label", `查看${singer.name}的歌曲`);
  const cover = document.createElement("span"); cover.className = "cover"; setCover(cover, singer.cover);
  const info = document.createElement("span"); info.className = "singer-info"; const title = document.createElement("strong"); title.textContent = singer.name; const sub = document.createElement("span"); sub.textContent = "歌手"; info.append(title, sub); row.append(cover, info);
  row.addEventListener("click", () => openSinger(singer)); return row;
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
function renderSingerDetail(scrollTop = 0) { const detail = state.singerDetail; clear(elements.content); const header = document.createElement("div"); header.className = "detail-header"; const back = document.createElement("button"); back.innerHTML = icon("back"); back.setAttribute("aria-label", "返回搜索结果"); back.addEventListener("click", () => { state.singerDetail = null; renderSearch(); }); const title = document.createElement("strong"); title.textContent = detail.title; header.append(back, title); const status = document.createElement("p"); status.className = "load-more"; status.textContent = detail.loadingMore ? "正在加载更多歌曲…" : detail.complete ? `已加载全部 ${detail.songs.length} 首歌曲` : `已加载 ${detail.songs.length}${detail.total ? ` / ${detail.total}` : ""} 首，继续下滑加载更多`; elements.content.append(header, renderSongs(detail.songs, "该歌手暂无可播放歌曲"), status); elements.content.scrollTop = scrollTop; elements.content.addEventListener("scroll", () => { if (elements.content.scrollTop + elements.content.clientHeight >= elements.content.scrollHeight - 80) loadMoreSingerSongs(); }); }
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
  clear(elements.content); const form = document.createElement("form"); form.className = "search-form"; const input = document.createElement("input"); input.placeholder = "搜索歌曲或歌手"; input.value = state.searchKeyword; input.setAttribute("aria-label", "搜索歌曲或歌手"); const submit = document.createElement("button"); submit.textContent = "搜索"; form.append(input, submit);
  form.addEventListener("submit", async (event) => { event.preventDefault(); const keyword = input.value.trim(); if (!keyword) return; showNotice("正在搜索…", "info"); const result = await message(MessageType.SEARCH_SONGS, { keyword }); if (!result.ok) { showError(result, "搜索失败"); return; } showNotice(); state.searchKeyword = keyword; state.searchResults = result.songs || []; state.singerResults = result.singers || []; state.searchPaging = result.searchPaging ? { ...result.searchPaging, loadingMore: false, complete: !result.songs.length || (result.searchPaging.total > 0 && result.songs.length >= result.searchPaging.total) } : null; state.singerDetail = null; renderSearch(); });
  elements.content.append(form);
  if (!state.searchKeyword) { elements.content.append(renderSongs([], "输入关键词搜索歌曲或歌手")); return; }
  if (state.singerResults.length) { const singerSection = document.createElement("section"); const heading = document.createElement("h2"); heading.className = "result-section-title"; heading.textContent = "歌手"; const list = document.createElement("div"); list.className = "list"; state.singerResults.forEach((singer) => list.append(makeSingerRow(singer))); singerSection.append(heading, list); elements.content.append(singerSection); }
  const songSection = document.createElement("section"); const heading = document.createElement("h2"); heading.className = "result-section-title"; heading.textContent = "歌曲"; songSection.append(heading, renderSongs(state.searchResults, "没有找到相关歌曲"));
  if (state.searchPaging) { const status = document.createElement("p"); status.className = "load-more"; status.textContent = state.searchPaging.loadingMore ? "正在加载更多歌曲…" : state.searchPaging.complete ? `已加载全部 ${state.searchResults.length} 首歌曲` : `已加载 ${state.searchResults.length}${state.searchPaging.total ? ` / ${state.searchPaging.total}` : ""} 首，继续下滑加载更多`; songSection.append(status); }
  elements.content.append(songSection); elements.content.scrollTop = scrollTop;
  if (state.searchPaging) elements.content.addEventListener("scroll", () => { if (elements.content.scrollTop + elements.content.clientHeight >= elements.content.scrollHeight - 80) loadMoreSearchSongs(); });
}
function renderTab() { document.querySelectorAll(".nav-button").forEach((button) => button.classList.toggle("active", button.dataset.tab === state.tab)); if (state.tab === "liked") renderLiked(); if (state.tab === "playlists") renderPlaylists(); if (state.tab === "search") renderSearch(); }
async function loadLibrary() { const result = await message(MessageType.GET_LIBRARY); if (!result.ok) throw result; state.library = result.library; renderTab(); }
async function startLogin() { state.viewRequestId += 1; showLoginView(); showNotice(); elements.qr.hidden = true; const result = await message(MessageType.LOGIN_START); if (!result.ok) { showError(result, "登录失败，请重新尝试"); return; } elements.qrImage.src = result.imageUrl; elements.qr.hidden = false; elements.qrStatus.textContent = "请使用 QQ 扫码登录"; clearInterval(state.poll); state.poll = setInterval(checkLogin, 2500); }
async function checkLogin() { const result = await message(MessageType.LOGIN_STATUS); if (!result.ok) { clearInterval(state.poll); showError(result, "登录失败，请重新尝试"); return; } if (result.status === "waiting") return; if (result.status === "scanned") { elements.qrStatus.textContent = "已扫码，请在手机上确认"; return; } if (result.status === "expired") { clearInterval(state.poll); elements.qrStatus.textContent = "二维码已失效，请重新获取"; return; } if (result.status === "done") { clearInterval(state.poll); const requestId = ++state.viewRequestId; try { await loadLibrary(); if (requestId === state.viewRequestId) showMusicView(); } catch (error) { if (requestId === state.viewRequestId) showError(error, "曲库加载失败"); } } }
document.querySelectorAll(".nav-button").forEach((button) => button.addEventListener("click", () => { state.tab = button.dataset.tab; state.detail = null; state.singerDetail = null; renderTab(); }));
document.querySelector("#login-button").addEventListener("click", startLogin); document.querySelector("#retry-login").addEventListener("click", startLogin);
document.querySelectorAll("[data-control]").forEach((button) => button.addEventListener("click", async () => { const action = button.dataset.control; const type = action === "previous" ? MessageType.PREVIOUS : action === "next" ? MessageType.NEXT : state.player?.playing ? MessageType.PAUSE : MessageType.PLAY; const result = await message(type); if (!result?.ok) showError(result, "播放操作失败"); }));
elements.mode.addEventListener("click", async () => { const currentIndex = Math.max(0, playbackModes.findIndex((item) => item.value === state.player?.playMode)); const nextMode = playbackModes[(currentIndex + 1) % playbackModes.length]; const result = await message(MessageType.SET_PLAY_MODE, { mode: nextMode.value }); if (!result?.ok) { showError(result, "无法切换播放模式"); return; } renderPlayer(result.state); });
elements.progress.addEventListener("input", () => { state.seeking = true; const currentTime = Number(elements.progress.value) || 0; elements.currentTime.textContent = formatTime(currentTime); const duration = Number(elements.progress.max) || 0; elements.progress.style.setProperty("--progress", duration > 0 ? `${currentTime / duration * 100}%` : "0%"); });
elements.progress.addEventListener("change", async () => { const result = await message(MessageType.SEEK, { position: Number(elements.progress.value) || 0 }); state.seeking = false; if (!result?.ok) { showError(result, "暂时无法调整播放进度"); renderPlayer(state.player); return; } renderPlayer({ ...state.player, currentTime: result.currentTime, duration: result.duration }); });
elements.brand.innerHTML = icon("note"); document.querySelector('[data-control="previous"]').innerHTML = icon("previous"); document.querySelector('[data-control="next"]').innerHTML = icon("next");
chrome.runtime.onMessage.addListener((message) => { if (message.type === MessageType.PLAYER_STATE_CHANGED) renderPlayer(message.state); });
(async () => { const player = await message(MessageType.GET_PLAYER_STATE); renderPlayer(player.state); const requestId = ++state.viewRequestId; try { await loadLibrary(); if (requestId === state.viewRequestId) showMusicView(); } catch (error) { if (requestId === state.viewRequestId) showError(error, "曲库加载失败"); } })();
