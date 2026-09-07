import { QQMusicError } from "./qqmusic.js";
import { ErrorCode } from "./types.js";

const QR_HOST = "https://ssl.ptlogin2.qq.com/";
const APP_ID = "716027609";
const QQ_CONNECT_ID = "100497308";

function hash33(value, seed = 0) {
  let hash = seed;
  for (const char of value || "") hash += (hash << 5) + char.charCodeAt(0);
  return hash & 0x7fffffff;
}

function query(url, values) {
  const target = new URL(url);
  Object.entries(values).forEach(([key, value]) => target.searchParams.set(key, String(value)));
  return target;
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, { credentials: "include", redirect: "manual", ...options });
  if (!response.ok && response.type !== "opaqueredirect") throw new QQMusicError(ErrorCode.NETWORK, "网络请求失败", { status: response.status });
  return response;
}

function parsePtui(text) {
  const quoted = [...text.matchAll(/'((?:\\.|[^'])*)'/g)].map((match) => match[1]);
  if (!quoted.length) throw new QQMusicError(ErrorCode.NETWORK, "登录失败，请重新尝试");
  return quoted;
}

async function musicLogin(code) {
  const response = await fetch("https://u.y.qq.com/cgi-bin/musicu.fcg", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      comm: { ct: 24, cv: 4747474, platform: "yqq.json", uin: 0, format: "json", notice: 0, tmeLoginType: 2 },
      req_0: { module: "QQConnectLogin.LoginServer", method: "QQLogin", param: { code } }
    })
  });
  if (!response.ok) throw new QQMusicError(ErrorCode.NETWORK, "网络请求失败", { status: response.status });
  const result = await response.json();
  const login = result.req_0 || {};
  if (Number(login.code) !== 0 || !login.data?.musickey) {
    console.error("QQ login rejected", login);
    throw new QQMusicError(ErrorCode.NETWORK, "登录失败，请重新尝试", { code: login.code });
  }
  return login.data;
}

export async function createQrLogin() {
  const url = query(`${QR_HOST}ptqrshow`, {
    appid: APP_ID, e: 2, l: "M", s: 3, d: 72, v: 4, t: Math.random(), daid: 383, pt_3rd_aid: QQ_CONNECT_ID
  });
  let response;
  try { response = await fetch(url, { credentials: "include" }); } catch (error) {
    console.error("QQ QR image request failed", error);
    throw new QQMusicError(ErrorCode.NETWORK, "二维码获取失败，请重新尝试", { stage: "qr-image" });
  }
  if (!response.ok) {
    console.error("QQ QR image HTTP failure", response.status);
    throw new QQMusicError(ErrorCode.NETWORK, "二维码获取失败，请重新尝试", { stage: "qr-image", status: response.status });
  }
  let qrsig;
  try { qrsig = (await chrome.cookies.get({ url: QR_HOST, name: "qrsig" }))?.value; } catch (error) {
    console.error("QQ QR cookie read failed", error);
    throw new QQMusicError(ErrorCode.NETWORK, "浏览器未授予 QQ 登录 Cookie 权限，请重新加载扩展", { stage: "qr-cookie" });
  }
  if (!qrsig) {
    console.error("QQ QR image was returned without qrsig cookie");
    throw new QQMusicError(ErrorCode.NETWORK, "二维码登录初始化失败，请重新加载扩展后再试", { stage: "qr-cookie" });
  }
  const image = await response.blob();
  return { qrsig, imageUrl: URL.createObjectURL(image) };
}

export async function pollQrLogin(qrsig) {
  const response = await fetchText(query(`${QR_HOST}ptqrlogin`, {
    u1: "https://graph.qq.com/oauth2.0/login_jump", ptqrtoken: hash33(qrsig), ptredirect: 0, h: 1, t: 1, g: 1,
    from_ui: 1, ptlang: 2052, action: `0-0-${Date.now()}`, js_ver: 20102616, js_type: 1, pt_uistyle: 40,
    aid: APP_ID, daid: 383, pt_3rd_aid: QQ_CONNECT_ID, has_onekey: 1
  }));
  const args = parsePtui(await response.text());
  const code = Number(args[0]);
  if (code === 66) return { status: "waiting" };
  if (code === 67) return { status: "scanned" };
  if (code === 65) return { status: "expired" };
  if (code !== 0) throw new QQMusicError(ErrorCode.NETWORK, "登录失败，请重新尝试", { code });
  const redirect = args[2] || "";
  const sigx = new URL(redirect).searchParams.get("ptsigx");
  const uin = new URL(redirect).searchParams.get("uin");
  if (!sigx || !uin) throw new QQMusicError(ErrorCode.NETWORK, "登录失败，请重新尝试");
  await fetchText(query("https://ssl.ptlogin2.graph.qq.com/check_sig", {
    uin, pttype: 1, service: "ptqrlogin", nodirect: 0, ptsigx: sigx, s_url: "https://graph.qq.com/oauth2.0/login_jump",
    ptlang: 2052, ptredirect: 100, aid: APP_ID, daid: 383, j_later: 0, low_login_hour: 0, regmaster: 0,
    pt_login_type: 3, pt_aid: 0, pt_aaid: 16, pt_light: 0, pt_3rd_aid: QQ_CONNECT_ID
  }));
  const pSkey = (await chrome.cookies.get({ url: "https://graph.qq.com/", name: "p_skey" }))?.value;
  if (!pSkey) throw new QQMusicError(ErrorCode.NETWORK, "登录失败，请重新尝试");
  const authResponse = await fetchText("https://graph.qq.com/oauth2.0/authorize", {
    method: "POST",
    redirect: "follow",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      response_type: "code", client_id: QQ_CONNECT_ID,
      redirect_uri: "https://y.qq.com/portal/wx_redirect.html?login_type=1&surl=https://y.qq.com/",
      scope: "get_user_info,get_app_friends", state: "state", switch: "", from_ptlogin: "1", src: "1", update_auth: "1",
      openapi: "1010_1030", g_tk: String(hash33(pSkey, 5381)), auth_time: String(Date.now()), ui: crypto.randomUUID()
    })
  });
  // Extension fetches can hide Location on a manual cross-origin redirect; the final URL is readable when followed.
  const callbackUrl = authResponse.headers.get("location") || authResponse.url || "";
  let authorizationCode = "";
  try { authorizationCode = new URL(callbackUrl).searchParams.get("code") || ""; } catch (error) { console.error("QQ OAuth callback parsing failed", error); }
  if (!authorizationCode) throw new QQMusicError(ErrorCode.NETWORK, "登录失败，请重新尝试");
  return { status: "done", credential: await musicLogin(authorizationCode) };
}
