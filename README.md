# QQ Music Mini

极简 QQ 音乐 Chrome / Edge 浏览器播放器。音乐通过扩展自身的 Offscreen Document 在后台播放；关闭 Popup 不会停止播放。

## 功能

- QQ 音乐二维码登录
- 我喜欢
- 我的歌单及歌单歌曲
- 搜索歌曲
- 后台播放
- 上一首、播放/暂停、下一首

## 安装

1. 打开 Chrome 或 Edge 的“扩展程序”页面。
2. 开启“开发者模式”。
3. 选择“加载已解压的扩展程序”。
4. 选择本项目目录：`C:\Users\CC\Documents\ChatGPT\QQ音乐`。

## 设计说明

Popup 只负责界面；播放队列和当前状态由 Manifest V3 Service Worker 管理，并持久化至 `chrome.storage.local`。真正的 `HTMLAudioElement` 运行于扩展的 Offscreen Document，因此 Popup 被关闭后不会影响播放。

扩展会直接向 QQ 音乐域名请求登录、曲库、搜索和一次性的播放 URL；不会使用公开部署的第三方 QQ Music API 服务。播放 URL 不持久化，每次切歌会重新请求。无法获取授权播放地址时，界面会提示“当前账号无播放权限”或“当前歌曲暂不可播放”，不会尝试规避会员、数字专辑、地区或版权限制。

二维码登录凭据仅保存在当前浏览器的 `chrome.storage.local`。扩展不保存 QQ 密码，也不会将凭据上传给第三方。

## 参考与许可证

接口请求形态对照了 [L-1124/QQMusicApi](https://github.com/L-1124/QQMusicApi) 的当前实现和 QQ 音乐服务端返回结构。该参考项目采用 GPLv3；本项目没有复制其源码，而是以原生 JavaScript 独立实现最小 Adapter，因此不继承该项目源码的 GPLv3 许可。

QQ 音乐服务端接口会随时变更，若登录或某一 API 调用失效，应在浏览器扩展的 Service Worker 控制台查看请求的 HTTP 状态及 QQ 音乐返回 `code`，再对照当前参考实现调整 Adapter；项目不会使用假数据掩盖失败。

## 免责声明

- 非腾讯官方产品，仅用于个人学习与技术研究。
- QQ 音乐及其音乐版权归相关权利方所有。
- 本项目不提供绕过会员、付费内容、数字专辑、地区限制或版权限制的功能。
