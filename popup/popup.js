import { MessageType } from "../api/types.js";

const status = document.querySelector("#status");
chrome.runtime.sendMessage({ type: MessageType.GET_PLAYER_STATE }).then(({ state }) => {
  status.textContent = state.currentSong ? `正在播放：${state.currentSong.title}` : "暂无播放歌曲";
}).catch(() => { status.textContent = "播放器连接失败"; });
