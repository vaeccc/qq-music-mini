# QQ Music Mini

一个面向 Chrome 和 Edge 的轻量 QQ 音乐播放器扩展。扫码登录后，可以查看“我喜欢”和个人歌单，搜索歌曲或歌手，并在浏览器后台持续播放。

> 非腾讯官方项目，仅供个人学习与技术研究使用。

## 功能

- QQ 音乐二维码登录
- 查看“我喜欢”、个人歌单与歌单歌曲
- 搜索歌曲，单次显示最多 20 条歌曲结果
- 搜索歌手；点击歌手头像进入歌曲列表
- 歌手歌曲按批加载，向下滚动会继续加载，直至全部完成
- 上一首、播放/暂停、下一首
- Popup 关闭后继续播放
- Windows 系统媒体控制：在支持的 Chrome / Edge 环境中，可从系统媒体面板控制播放
- 紧凑播放器栏与自定义扩展图标

## 安装

当前项目可以通过“加载已解压的扩展程序”方式测试：

1. 下载或克隆本仓库。
2. 打开扩展管理页：Chrome 为 `chrome://extensions`，Edge 为 `edge://extensions`。
3. 开启“开发者模式”。
4. 点击“加载已解压的扩展程序”，选择本项目根目录。
5. 将 QQ Music Mini 固定到浏览器工具栏，点击图标后扫码登录。

项目使用 Manifest V3，需要 Chrome / Edge 109 或更高版本。

## 使用说明

1. 点击“登录 QQ 音乐”，使用 QQ 扫描二维码并在手机端确认。
2. 在“我喜欢”或“歌单”中点击歌曲即可播放。
3. 在“搜索”中输入歌曲名或歌手名。
4. 搜索到歌手后，点击头像或歌手行可查看歌曲；继续向下滚动会自动加载下一批。
5. 关闭 Popup 不会停止音乐；可用扩展底部控制栏或系统媒体面板切歌、暂停和继续播放。

## 工作方式与隐私

- 界面运行在 Popup 中；播放队列和状态由 Manifest V3 Service Worker 管理。
- 实际音频播放在扩展的 Offscreen Document 中完成，因此 Popup 关闭后音乐仍会继续。
- 扩展会直接访问 QQ / QQ 音乐相关域名以完成登录、读取曲库、搜索和获取一次性的播放地址；不依赖公开部署的第三方 API 服务。
- 二维码登录凭据仅保存在当前浏览器的 `chrome.storage.local` 中。扩展不读取或保存 QQ 密码，也不将凭据上传到开发者服务器。
- 播放地址不会持久化；每次切歌都会重新请求。
- 无法取得授权播放地址时，扩展会提示对应原因；不会尝试绕过会员、数字专辑、地区或版权限制。

完整隐私政策见：[PRIVACY.md](./PRIVACY.md)。

## 开发

项目没有构建步骤，修改源码后在扩展管理页点击“重新加载”即可。

```text
background.js          Service Worker：消息、登录状态、播放队列
api/                   QQ 音乐请求与数据适配
offscreen/             后台 HTMLAudioElement 与 Media Session
popup/                 扩展界面、样式与控制图标
storage/               chrome.storage.local 封装
icons/                 扩展图标资源
```

## 商店打包

Windows PowerShell 下运行：

```powershell
./scripts/package-store.ps1
```

脚本会读取 `manifest.json` 中的版本号，并生成：

```text
dist/qq-music-mini-<version>-store.zip
```

ZIP 根目录直接包含 `manifest.json`，只打包扩展运行所需文件，不包含 README、开发脚本或 Git 元数据。

Chrome Web Store / Microsoft Edge Add-ons 的文案、权限用途、审核测试说明见：[STORE_SUBMISSION.md](./STORE_SUBMISSION.md)。

## 已知限制

- 这是非官方实现，QQ 音乐服务端接口、登录方式或版权策略变化时，部分功能可能失效。
- 播放能力完全取决于当前 QQ 账号的有效登录态与歌曲授权范围。
- 本项目尚未作为官方 QQ 音乐客户端或插件发布，也不代表腾讯或 QQ 音乐。

## 参考与致谢

接口请求形态和返回数据结构曾对照 [L-1124/QQMusicApi](https://github.com/L-1124/QQMusicApi)。本项目以原生 JavaScript 独立实现，未复制该项目源码。

## 免责声明

QQ 音乐名称、商标、音乐内容及相关版权归腾讯和/或各自权利人所有。使用本项目时，请遵守 QQ 音乐服务条款、适用法律以及所在地区的版权规则。
