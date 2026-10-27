import { ErrorCode } from "./types.js";

const MUSICU = "https://u.y.qq.com/cgi-bin/musicu.fcg";
const WEB_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const PRIMARY_SEARCH_TIMEOUT_MS = 2200;
// fcg_play_single_song.fcg silently truncates a request to 50 song ids, so the
// toplist fallback has to be requested in chunks to keep every track.
const SONG_DETAIL_CHUNK_SIZE = 50;
// How many per-song detail lookups may be in flight at once.
const DETAIL_LOOKUP_BATCH_SIZE = 4;
// Codes that mean "the credential itself is rejected" rather than "the request failed".
const LOGIN_REJECTED_CODES = new Set([1000, 10004, 104400, 104401]);

export class QQMusicError extends Error {
  constructor(code, message, detail = {}) {
    super(message);
    this.code = code;
    this.detail = detail;
  }
}

function hash33(value, seed = 5381) {
  let hash = seed;
  for (const char of value || "") hash += (hash << 5) + char.charCodeAt(0);
  return hash & 0x7fffffff;
}

function randomGuid() {
  return String(Math.floor(Math.random() * 9000000000) + 1000000000);
}

function common(credential = null) {
  const uin = Number(credential?.musicid || 0);
  const gTk = hash33(credential?.musickey || "");
  return {
    ct: 24,
    cv: 4747474,
    platform: "yqq.json",
    uin,
    g_tk: gTk,
    g_tk_new_20200303: gTk,
    format: "json",
    inCharset: "utf-8",
    outCharset: "utf-8",
    notice: 0,
    needNewCode: 1,
    tmeLoginType: Number(credential?.loginType || credential?.login_type || 0) || undefined
  };
}

async function musicu(requests, credential = null) {
  let response;
  try {
    response = await fetch(MUSICU, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", "user-agent": WEB_UA },
      body: JSON.stringify({ comm: common(credential), ...requests })
    });
  } catch (error) {
    console.error("QQ Music request failed", error);
    throw new QQMusicError(ErrorCode.NETWORK, "网络请求失败");
  }
  if (!response.ok) {
    console.error("QQ Music HTTP error", response.status);
    throw new QQMusicError(ErrorCode.NETWORK, "网络请求失败", { status: response.status });
  }
  const body = await response.json();
  return body;
}

function valueAt(object, paths, fallback = "") {
  for (const path of paths) {
    const value = path.split(".").reduce((node, key) => node?.[key], object);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
}

function normalizeSong(raw = {}) {
  const albumMid = valueAt(raw, ["album.mid", "albummid", "albumMid"]);
  const singer = raw.singer || raw.singerlist || [];
  const artists = Array.isArray(singer)
    ? singer.map((item) => item.name || item.title).filter(Boolean).join(" / ")
    : valueAt(raw, ["singername", "singerName", "singer"]);
  return {
    mid: valueAt(raw, ["mid", "songmid", "songMid", "song_mid"]),
    mediaMid: valueAt(raw, ["file.media_mid", "file.mediaMid", "strMediaMid", "media_mid"]),
    title: valueAt(raw, ["name", "songname", "title"]),
    artist: artists || "未知歌手",
    album: valueAt(raw, ["album.name", "albumname", "albumName"]),
    albumMid,
    cover: String(valueAt(raw, ["cover", "picurl", "picUrl"], albumMid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albumMid}.jpg` : "")).replace(/^http:/, "https:"),
    songType: Number(valueAt(raw, ["type", "songtype"], 0)) || 0
  };
}

function normalizeSinger(raw = {}) {
  const mid = valueAt(raw, ["mid", "singer_mid", "singerMid"]);
  return {
    mid,
    name: valueAt(raw, ["name", "singer", "title"], "未知歌手"),
    cover: valueAt(raw, ["pic", "picurl", "picUrl"]).replace(/^http:/, "https:")
  };
}

function checkResponse(response, context, extraLoginCodes = []) {
  const code = Number(response?.code ?? 0);
  if (code === 0) return response?.data ?? response;
  if (LOGIN_REJECTED_CODES.has(code) || extraLoginCodes.includes(code)) {
    throw new QQMusicError(ErrorCode.LOGIN_EXPIRED, "QQ 音乐登录已失效，请重新登录", { context, code });
  }
  throw new QQMusicError(ErrorCode.NETWORK, "网络请求失败", { context, code });
}

/**
 * Validates a stored credential.
 *
 * The result is intentionally tri-state: a network hiccup must not be
 * mistaken for "the credential is dead", otherwise a single dropped request
 * would wipe the local login and force the user to re-scan the QR code.
 *
 * @returns {Promise<boolean|"unknown">} true = valid, false = rejected, "unknown" = could not tell.
 */
export async function validateCredential(credential) {
  if (!credential?.musicid || !credential?.musickey) return false;
  let response;
  try {
    response = await musicu({
      req_0: { module: "music.UserInfo.userInfoServer", method: "GetLoginUserInfo", param: {} }
    }, credential);
  } catch (error) {
    console.error("Credential validation failed", error);
    return "unknown";
  }
  const code = Number(response?.req_0?.code);
  if (code === 0) return true;
  if (LOGIN_REJECTED_CODES.has(code)) return false;
  // Any other code means the request reached QQ Music but did not confirm the
  // session. Treat it as inconclusive rather than as a rejected login.
  console.warn("Credential validation returned an inconclusive code", code);
  return "unknown";
}

export async function refreshCredential(credential) {
  const response = await musicu({
    req_0: {
      module: "music.login.LoginServer",
      method: "Login",
      param: {
        openid: credential.openid || "",
        access_token: credential.access_token || "",
        refresh_token: credential.refresh_token || "",
        expired_in: credential.expired_at || 0,
        musicid: credential.musicid,
        str_musicid: credential.str_musicid || String(credential.musicid),
        musickey: credential.musickey,
        unionid: credential.unionid || "",
        refresh_key: credential.refresh_key || "",
        loginMode: 2
      }
    }
  }, credential);
  const data = checkResponse(response.req_0, "refresh");
  return data;
}

export async function getUserLibrary(credential) {
  const userResponse = await musicu({
    req_0: { module: "music.UserInfo.userInfoServer", method: "GetLoginUserInfo", param: {} }
  }, credential);
  const user = checkResponse(userResponse.req_0, "user");
  const musicid = Number(valueAt(user, ["musicid", "uin", "user.musicid"], credential.musicid));
  const encryptUin = valueAt(user, ["encrypt_uin", "encryptUin", "user.encrypt_uin"], credential.encryptUin || "");
  const nickname = valueAt(user, ["nickname", "nick", "name", "user.nickname", "user.nick", "userInfo.nickname"], "QQ 音乐账号");
  const rawAvatar = valueAt(user, ["avatar", "avatarUrl", "headurl", "headUrl", "picurl", "user.avatar", "user.avatarUrl", "userInfo.avatar"]);
  const avatar = rawAvatar && String(rawAvatar).startsWith("//") ? `https:${rawAvatar}` : String(rawAvatar || "");
  const response = await musicu({
    req_0: { module: "music.musicasset.PlaylistBaseRead", method: "GetPlaylistByUin", param: { uin: String(musicid) } },
    req_1: {
      module: "music.srfDissInfo.DissInfo",
      method: "CgiGetDiss",
      param: { disstid: 0, dirid: 201, tag: true, song_begin: 0, song_num: 100, userinfo: true, orderlist: true, enc_host_uin: encryptUin }
    }
  }, credential);
  const playlistData = checkResponse(response.req_0, "playlists");
  // 10004 means the personal "liked" list was rejected, which for dirid=201
  // only happens when the session is not actually authenticated.
  const likedData = checkResponse(response.req_1, "liked", [10004]);
  const rawPlaylists = playlistData?.v_playlist || playlistData?.playlist || playlistData?.list || [];
  return {
    user: { musicid, encryptUin, nickname, avatar },
    liked: (likedData?.songlist || []).map(normalizeSong),
    likedTotal: Number(likedData?.songlist_size || likedData?.total_song_num || 0),
    playlists: rawPlaylists.map((item) => ({
      id: String(item.tid || item.id || item.dissid || item.dirid || item.dirId),
      dirid: Number(item.dirid || item.dirId || 0),
      title: item.title || item.dissname || item.name || item.dirName || item.dirname || "未命名歌单",
      count: Number(item.songnum || item.songNum || item.song_cnt || item.song_num || 0),
      cover: item.picurl || item.picUrl || item.bigpicUrl || item.albumPicUrl || item.cover || item.logo || ""
    }))
  };
}

/**
 * Loads one page of the personal "liked" list. The list is served by the same
 * CgiGetDiss endpoint as regular playlists, so `song_begin` pages it.
 */
export async function getLikedSongs(credential, begin = 0) {
  const response = await musicu({
    req_0: {
      module: "music.srfDissInfo.DissInfo",
      method: "CgiGetDiss",
      param: { disstid: 0, dirid: 201, tag: true, song_begin: Math.max(0, Number(begin) || 0), song_num: 100, userinfo: true, orderlist: true }
    }
  }, credential);
  const data = checkResponse(response.req_0, "liked", [10004]);
  return {
    songs: (data?.songlist || []).map(normalizeSong),
    total: Number(data?.songlist_size || data?.total_song_num || 0)
  };
}

export async function getPlaylistDetail(playlist, credential, begin = 0) {
  const response = await musicu({
    req_0: {
      module: "music.srfDissInfo.DissInfo",
      method: "CgiGetDiss",
      param: {
        disstid: Number(playlist.id),
        dirid: playlist.dirid || 0,
        tag: true,
        song_begin: Math.max(0, Number(begin) || 0),
        song_num: 100,
        userinfo: true,
        orderlist: true
      }
    }
  }, credential);
  const data = checkResponse(response.req_0, "playlist-detail");
  return {
    id: Number(playlist.id),
    dirid: Number(playlist.dirid || 0),
    title: data?.dirinfo?.title || playlist.title,
    songs: (data?.songlist || []).map(normalizeSong),
    total: Number(data?.dirinfo?.songnum || data?.songlist_size || data?.total_song_num || 0)
  };
}

async function getJson(url, context) {
  let response;
  try {
    // The same endpoints answer differently depending on the UA, so every
    // request identifies itself the same way.
    response = await fetch(url, { credentials: "include", headers: { "user-agent": WEB_UA } });
  } catch (error) {
    console.error("QQ Music request failed", context, error);
    throw new QQMusicError(ErrorCode.NETWORK, "网络请求失败");
  }
  if (!response.ok) throw new QQMusicError(ErrorCode.NETWORK, "网络请求失败", { context, status: response.status });
  try {
    return await response.json();
  } catch (error) {
    throw new QQMusicError(ErrorCode.NETWORK, "网络请求失败", { context, reason: "invalid-json" });
  }
}

export async function getToplists() {
  const url = new URL("https://c.y.qq.com/v8/fcg-bin/fcg_myqq_toplist.fcg");
  url.searchParams.set("g_tk", "5381");
  url.searchParams.set("uin", "0");
  url.searchParams.set("format", "json");
  url.searchParams.set("inCharset", "utf-8");
  url.searchParams.set("outCharset", "utf-8");
  url.searchParams.set("notice", "0");
  url.searchParams.set("platform", "h5");
  url.searchParams.set("needNewCode", "1");
  const response = await getJson(url, "toplists");
  if (Number(response?.code ?? 0) !== 0) throw new QQMusicError(ErrorCode.NETWORK, "排行榜加载失败", { code: response?.code });
  const rawLists = response?.data?.topList || response?.topList || response?.data?.toplist || [];
  return rawLists.map((item) => ({
    id: Number(item.id || item.topid || item.topId || 0),
    title: item.topTitle || item.title || item.name || "未命名榜单",
    cover: String(item.picUrl || item.picurl || item.frontPicUrl || item.front_pic_url || "").replace(/^http:/, "https:"),
    // This endpoint exposes no track count at all — only `listenCount` (plays).
    // Reporting 0 lets the UI show "查看榜单歌曲" instead of a wrong "0 首歌曲".
    count: 0,
    preview: (item.songList || item.songlist || []).slice(0, 3).map((song) => `${song.singername || song.singer || "未知歌手"} · ${song.songname || song.name || ""}`)
  })).filter((item) => item.id > 0);
}

/**
 * Resolves a toplist into playable songs.
 *
 * `GetDetail` answers with two parallel arrays:
 *   - `data.songInfoList` — complete song objects (mid, file.media_mid, album, singer)
 *   - `data.data.song`   — rank rows that only carry a numeric `songId`
 * Only the former can be turned into playable tracks, so it is preferred. The
 * rank rows remain as a fallback and are resolved through the song-detail
 * endpoint, which silently caps a single request at 50 ids and therefore has
 * to be paged.
 */
export async function getToplistDetail(toplist, credential, offset = 0) {
  const request = {
    comm: common(credential),
    req_1: {
      module: "musicToplist.ToplistInfoServer",
      method: "GetDetail",
      param: { topid: Number(toplist.id), offset: Math.max(0, Number(offset) || 0), num: 100 }
    }
  };
  const url = new URL(MUSICU);
  url.searchParams.set("data", JSON.stringify(request));
  const response = await getJson(url, "toplist-detail");
  const block = response?.req_1 || response?.topList || response?.toplist || response?.req_0;
  const data = checkResponse(block, "toplist-detail");
  const detail = data?.data || data;
  const rawSongs = data?.songInfoList || detail?.songInfoList || detail?.songlist || detail?.songList || detail?.song || [];
  let songs = rawSongs.map(normalizeSong).filter((song) => song.mid);
  if (!songs.length && rawSongs.length) {
    songs = await resolveSongsById(rawSongs, credential);
  }
  return {
    id: Number(toplist.id),
    title: detail?.title || toplist.title,
    period: detail?.updateTime || detail?.period || "",
    total: Number(detail?.totalNum || detail?.total || toplist.count || 0),
    cover: String(detail?.frontPicUrl || detail?.front_pic_url || toplist.cover || "").replace(/^http:/, "https:"),
    songs
  };
}

/**
 * Resolves rank rows that only expose numeric song ids into full song objects.
 * The endpoint truncates at 50 ids per request, so ids are requested in chunks
 * and concatenated in the original order.
 */
async function resolveSongsById(rawSongs, credential) {
  const songIds = rawSongs.map((song) => song.songId || song.songid || song.id).filter(Boolean);
  if (!songIds.length) return [];
  const collected = [];
  for (let start = 0; start < songIds.length; start += SONG_DETAIL_CHUNK_SIZE) {
    const chunk = songIds.slice(start, start + SONG_DETAIL_CHUNK_SIZE);
    const songUrl = new URL("https://c.y.qq.com/v8/fcg-bin/fcg_play_single_song.fcg");
    Object.entries({
      songid: chunk.join(","),
      tpl: "yqq_song_detail",
      format: "json",
      loginUin: credential?.musicid || 0,
      hostUin: 0,
      outCharset: "utf8",
      notice: 0,
      platform: "yqq",
      needNewCode: 0,
      g_tk: hash33(credential?.musickey || "")
    }).forEach(([key, value]) => songUrl.searchParams.set(key, String(value)));
    const songResponse = await getJson(songUrl, "toplist-songs");
    collected.push(...(songResponse?.data || []));
  }
  return collected.map(normalizeSong).filter((song) => song.mid);
}

async function searchWithSmartbox(keyword, credential) {
  const url = new URL("https://c.y.qq.com/splcloud/fcgi-bin/smartbox_new.fcg");
  url.searchParams.set("key", keyword);
  url.searchParams.set("format", "json");
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new QQMusicError(ErrorCode.NETWORK, "网络请求失败", { status: response.status });
  const data = await response.json();
  if (Number(data?.code) !== 0) throw new QQMusicError(ErrorCode.NETWORK, "网络请求失败", { code: data?.code });
  const briefSongs = (data?.data?.song?.itemlist || []).map(normalizeSong).filter((song) => song.mid);
  const singers = (data?.data?.singer?.itemlist || []).map(normalizeSinger).filter((singer) => singer.mid);
  const normalizedKeyword = keyword.replace(/\s+/g, "").toLowerCase();
  const exactSinger = singers.find((singer) => singer.name.replace(/\s+/g, "").toLowerCase() === normalizedKeyword);
  if (exactSinger) {
    try {
      const singerSongs = await getSingerSongs(exactSinger, credential);
      if (singerSongs.songs.length) {
        return {
          songs: singerSongs.songs,
          singers,
          searchPaging: { singer: exactSinger, total: singerSongs.total }
        };
      }
    } catch (error) {
      console.warn("QQ Music exact singer search failed", exactSinger.mid, error);
    }
  }
  // smartbox only returns `mid`; the full record (and with it media_mid) has to
  // be fetched per song. Requests are issued in small waves to stay polite.
  const songs = [];
  for (let start = 0; start < briefSongs.length; start += DETAIL_LOOKUP_BATCH_SIZE) {
    const batch = briefSongs.slice(start, start + DETAIL_LOOKUP_BATCH_SIZE);
    const detailed = await Promise.all(batch.map(async (song) => {
      try {
        const detailResponse = await musicu({
          req_0: {
            module: "music.pf_song_detail_svr",
            method: "get_song_detail_yqq",
            param: { song_mid: song.mid }
          }
        }, credential);
        const detail = checkResponse(detailResponse.req_0, "song-detail");
        return normalizeSong(detail?.track_info || song);
      } catch (error) {
        console.warn("QQ Music song detail lookup failed", song.mid, error);
        return song;
      }
    }));
    songs.push(...detailed);
  }
  return { songs, singers };
}

export async function searchSongs(keyword, credential) {
  const url = new URL("https://c.y.qq.com/soso/fcgi-bin/client_search_cp");
  Object.entries({
    p: 1, n: 20, w: keyword, catZhida: 1, remoteplace: "txt.yqq.song", format: "json", cr: 1,
    g_tk: hash33(credential?.musickey || ""), loginUin: credential?.musicid || 0, hostUin: 0,
    t: 0, aggr: 1, lossless: 0, flag_qc: 0, ct: 24, qqmusic_ver: 1298,
    inCharset: "utf8", outCharset: "utf-8", notice: 0, platform: "yqq.json", needNewCode: 0
  }).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  try {
    const quickResponse = await fetch(url, { credentials: "include", signal: AbortSignal.timeout(PRIMARY_SEARCH_TIMEOUT_MS) });
    if (!quickResponse.ok) return searchWithSmartbox(keyword, credential);
    const data = await quickResponse.json();
    if (Number(data?.code) !== 0) {
      console.error("QQ Music search returned error", data?.code);
      return searchWithSmartbox(keyword, credential);
    }
    const songs = (data?.data?.song?.list || data?.song?.list || []).map(normalizeSong).filter((song) => song.mid);
    if (!songs.length) return searchWithSmartbox(keyword, credential);
    let singers = [];
    try {
      const singerUrl = new URL("https://c.y.qq.com/splcloud/fcgi-bin/smartbox_new.fcg");
      singerUrl.searchParams.set("key", keyword);
      singerUrl.searchParams.set("format", "json");
      const singerResponse = await fetch(singerUrl, { credentials: "include" });
      if (singerResponse.ok) {
        const singerData = await singerResponse.json();
        singers = (singerData?.data?.singer?.itemlist || []).map(normalizeSinger).filter((singer) => singer.mid);
      }
    } catch (error) {
      // Singer suggestions enhance ordinary song search, but must not block it.
      console.warn("QQ Music singer suggestions failed", error);
    }
    return { songs, singers };
  } catch (error) {
    console.error("QQ Music search failed", error);
    return searchWithSmartbox(keyword, credential);
  }
}

export async function getSingerSongs(singer, credential, begin = 0) {
  if (!singer?.mid) throw new QQMusicError(ErrorCode.NETWORK, "歌手信息无效");
  const response = await musicu({
    req_0: {
      module: "musichall.song_list_server",
      method: "GetSingerSongList",
      param: { singerMid: singer.mid, order: 1, number: 30, begin: Math.max(0, Number(begin) || 0) }
    }
  }, credential);
  const data = checkResponse(response.req_0, "singer-songs");
  return {
    title: singer.name,
    singer,
    total: Number(data?.totalNum || 0),
    songs: (data?.songList || []).map((item) => normalizeSong(item?.songInfo || item)).filter((song) => song.mid)
  };
}

/**
 * Resolves the `media_mid` of a song, which is the id QQ Music expects in vkey
 * filenames. It is a different identifier from `song.mid` (verified: the same
 * track reports songmid=0039MnYb0qxYhV but media_mid=003Qui1q2u1Zho), so
 * falling back to `song.mid` produces an empty vkey and a false "no copyright"
 * verdict.
 */
async function resolveMediaMid(song, credential) {
  if (song?.mediaMid) return song.mediaMid;
  if (!song?.mid) return "";
  try {
    const response = await musicu({
      req_0: {
        module: "music.pf_song_detail_svr",
        method: "get_song_detail_yqq",
        param: { song_mid: song.mid }
      }
    }, credential);
    const detail = checkResponse(response.req_0, "song-detail");
    return valueAt(detail?.track_info || {}, ["file.media_mid", "media_mid", "strMediaMid"]);
  } catch (error) {
    console.warn("QQ Music media mid lookup failed", song.mid, error);
    return "";
  }
}

export async function getPlayUrl(song, credential) {
  if (!song?.mid) throw new QQMusicError(ErrorCode.PLAY_URL, "播放地址获取失败");
  const mediaMid = await resolveMediaMid(song, credential);
  if (!mediaMid) {
    // Without a media_mid the vkey request would ask for a file that does not
    // exist, so report it as a URL problem instead of a copyright problem.
    throw new QQMusicError(ErrorCode.PLAY_URL, "播放地址获取失败：缺少歌曲媒体标识", { songMid: song.mid });
  }
  const filename = `M500${mediaMid}.mp3`;
  const response = await musicu({
    req_0: {
      module: "music.vkey.GetVkey",
      method: "UrlGetVkey",
      param: {
        uin: credential?.str_musicid || String(credential?.musicid || 0),
        filename: [filename],
        guid: randomGuid(),
        songmid: [song.mid],
        songtype: [song.songType || 0],
        ctx: 0
      }
    }
  }, credential);
  const data = checkResponse(response.req_0, "play-url");
  const item = data?.midurlinfo?.[0];
  if (!item?.purl) {
    const code = Number(item?.result ?? data?.code ?? -1);
    console.error("QQ Music play URL unavailable", { code, song: song.mid, data });
    if ([104003, 104013].includes(code)) throw new QQMusicError(ErrorCode.NO_PERMISSION, "当前账号无播放权限", { code });
    if (code === 104004) throw new QQMusicError(ErrorCode.PLAY_URL, "播放地址获取失败", { code });
    throw new QQMusicError(ErrorCode.NO_COPYRIGHT, "当前歌曲暂不可播放", { code });
  }
  return `https://dl.stream.qqmusic.qq.com/${item.purl}`;
}
