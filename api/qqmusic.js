import { ErrorCode } from "./types.js";

const MUSICU = "https://u.y.qq.com/cgi-bin/musicu.fcg";
const WEB_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

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
    : valueAt(raw, ["singername", "singer"]);
  return {
    mid: valueAt(raw, ["mid", "songmid", "songMid"]),
    mediaMid: valueAt(raw, ["file.media_mid", "file.mediaMid", "strMediaMid", "media_mid"]),
    title: valueAt(raw, ["name", "songname", "title"]),
    artist: artists || "未知歌手",
    album: valueAt(raw, ["album.name", "albumname", "albumName"]),
    albumMid,
    cover: albumMid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albumMid}.jpg` : "",
    songType: Number(valueAt(raw, ["type", "songtype"], 0)) || 0
  };
}

function checkResponse(response, context) {
  const code = Number(response?.code ?? 0);
  if (code === 0) return response?.data ?? response;
  if ([1000, 104400, 104401].includes(code)) throw new QQMusicError(ErrorCode.LOGIN_EXPIRED, "QQ 音乐登录已失效，请重新登录", { context, code });
  throw new QQMusicError(ErrorCode.NETWORK, "网络请求失败", { context, code });
}

export async function validateCredential(credential) {
  if (!credential?.musicid || !credential?.musickey) return false;
  try {
    const response = await musicu({
      req_0: { module: "music.UserInfo.userInfoServer", method: "GetLoginUserInfo", param: {} }
    }, credential);
    return Number(response.req_0?.code) === 0;
  } catch (error) {
    console.error("Credential validation failed", error);
    return false;
  }
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
  const response = await musicu({
    req_0: { module: "music.musicasset.PlaylistBaseRead", method: "GetPlaylistByUin", param: { uin: String(musicid) } },
    req_1: {
      module: "music.srfDissInfo.DissInfo",
      method: "CgiGetDiss",
      param: { disstid: 0, dirid: 201, tag: true, song_begin: 0, song_num: 100, userinfo: true, orderlist: true, enc_host_uin: encryptUin }
    }
  }, credential);
  const playlistData = checkResponse(response.req_0, "playlists");
  const likedData = checkResponse(response.req_1, "liked");
  const rawPlaylists = playlistData?.v_playlist || playlistData?.playlist || playlistData?.list || [];
  return {
    user: { musicid, encryptUin },
    liked: (likedData?.songlist || []).map(normalizeSong),
    playlists: rawPlaylists.map((item) => ({
      id: String(item.tid || item.id || item.dissid || item.dirid || item.dirId),
      dirid: Number(item.dirid || item.dirId || 0),
      title: item.title || item.dissname || item.name || item.dirName || item.dirname || "未命名歌单",
      count: Number(item.songnum || item.songNum || item.song_cnt || item.song_num || 0),
      cover: item.picurl || item.picUrl || item.bigpicUrl || item.albumPicUrl || item.cover || item.logo || ""
    }))
  };
}

export async function getPlaylistDetail(playlist, credential) {
  const response = await musicu({
    req_0: {
      module: "music.srfDissInfo.DissInfo",
      method: "CgiGetDiss",
      param: { disstid: Number(playlist.id), dirid: playlist.dirid || 0, tag: true, song_begin: 0, song_num: 300, userinfo: true, orderlist: true }
    }
  }, credential);
  const data = checkResponse(response.req_0, "playlist-detail");
  return { title: data?.dirinfo?.title || playlist.title, songs: (data?.songlist || []).map(normalizeSong) };
}

export async function searchSongs(keyword, credential) {
  const url = new URL("https://c.y.qq.com/soso/fcgi-bin/client_search_cp");
  Object.entries({
    p: 1, n: 20, w: keyword, format: "json", new_json: 1, cr: 1, g_tk: hash33(credential?.musickey || ""),
    loginUin: credential?.musicid || 0, hostUin: 0, t: 0, aggr: 1, inCharset: "utf8", outCharset: "utf-8",
    notice: 0, platform: "yqq.json", needNewCode: 0
  }).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  let quickResponse;
  try {
    quickResponse = await fetch(url, { credentials: "include" });
  } catch (error) {
    console.error("QQ Music search failed", error);
    throw new QQMusicError(ErrorCode.NETWORK, "网络请求失败");
  }
  if (!quickResponse.ok) throw new QQMusicError(ErrorCode.NETWORK, "网络请求失败", { status: quickResponse.status });
  const data = await quickResponse.json();
  if (Number(data?.code) !== 0) {
    console.error("QQ Music search returned error", data?.code);
    throw new QQMusicError(ErrorCode.NETWORK, "网络请求失败", { code: data?.code });
  }
  return (data?.data?.song?.list || []).map(normalizeSong).filter((song) => song.mid);
}

export async function getPlayUrl(song, credential) {
  if (!song?.mid) throw new QQMusicError(ErrorCode.PLAY_URL, "播放地址获取失败");
  const mediaMid = song.mediaMid || song.mid;
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
