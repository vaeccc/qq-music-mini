# QQ Music Mini

一个面向 Chrome 和 Edge 的轻量 QQ 音乐播放器扩展。扫码登录后，可以查看“我喜欢”和个人歌单，搜索歌曲、歌手或专辑，并在浏览器后台持续播放。

[从 Microsoft Edge Add-ons 安装](https://microsoftedge.microsoft.com/addons/detail/qq-music-mini/dpeoaedhplbgjhpafgnppiaclbmoclaf) · [GitHub 源码](https://github.com/vaeccc/qq-music-mini)

> 非腾讯官方项目，仅供个人学习与技术研究使用。

## Mini 家族

Mini 家族为不同音乐平台提供轻量浏览器播放器：

- [Netease Music Mini](https://github.com/vaeccc/netease-music-mini)：网易云音乐歌单、搜索与后台播放。
- [Bili mini](https://github.com/vaeccc/Bili-mini)：把有权访问的 B 站视频音轨作为后台音乐播放。
- [QQ Music Mini](https://github.com/vaeccc/qq-music-mini)：QQ 音乐曲库、搜索与后台播放。

## 功能

- QQ 音乐二维码登录
- 简洁的账号管理入口，可查看当前账号并安全退出
- 查看“我喜欢”、个人歌单与歌单歌曲，并支持“播放全部”
- 浏览 QQ 音乐排行榜，查看榜单歌曲并支持整榜播放
- 搜索歌曲，单次显示最多 20 条歌曲结果
- 搜索歌手；点击歌手头像进入歌曲列表
- 搜索专辑；点击专辑进入专辑歌曲列表
- “我喜欢”、歌单歌曲与歌手歌曲均按批加载，向下滚动会继续加载，直至全部完成
- 分页加载显示进度与完成状态，自动去重并保留已加载内容，减少重复渲染
- 上一首、播放/暂停、下一首，以及顺序播放、列表循环、单曲循环、随机播放模式
- 可拖动的播放进度条、当前时间与歌曲总时长
- 在歌曲列表中高亮当前播放歌曲
- Popup 关闭后继续播放
- Windows 系统媒体控制：在支持的 Chrome / Edge 环境中，可从系统媒体面板控制播放、切歌和调整进度
- 区分登录失效、网络异常、账号权限、版权限制和音频加载错误
- 最近搜索结果与专辑封面颜色会在当前会话内缓存，错误提示可复制轻量诊断信息
- 紧凑播放器栏与自定义扩展图标
- 根据当前歌曲专辑封面自动调整播放强调色；取色失败时回退到默认绿色主题

## 安装

项目使用 Manifest V3，需要 Chrome / Edge 109 或更高版本。

### Edge 用户（推荐）

直接打开 [QQ Music Mini 的 Edge Add-ons 页面](https://microsoftedge.microsoft.com/addons/detail/qq-music-mini/dpeoaedhplbgjhpafgnppiaclbmoclaf)，点击“获取”并确认添加扩展即可。

### Chrome 用户

目前 Chrome 版本通过“加载已解压的扩展程序”安装：

#### 下载 ZIP 安装

1. 打开本项目的 [GitHub 仓库](https://github.com/vaeccc/qq-music-mini)。
2. 点击绿色的 **Code** 按钮，再点击 **Download ZIP**。
3. 下载完成后解压 ZIP 文件。不要直接从压缩包内加载扩展。
4. 打开扩展管理页：
   - Chrome：在地址栏输入 `chrome://extensions`
   - Edge：在地址栏输入 `edge://extensions`
5. 开启页面右上角的“开发者模式”。
6. 点击“加载已解压的扩展程序”，选择解压后包含 `manifest.json` 的项目文件夹。
7. 点击浏览器工具栏中的扩展按钮，将 **QQ Music Mini** 固定到工具栏。

#### 使用 Git 安装（可选）

熟悉 Git 的用户也可以克隆仓库：

```bash
git clone https://github.com/vaeccc/qq-music-mini.git
cd qq-music-mini
```

然后按照上面的第 4～7 步加载项目文件夹。

## 使用方法

### 登录与账号管理

1. 点击工具栏中的 **QQ Music Mini** 图标。
2. 点击“登录 QQ 音乐”，使用手机 QQ 扫描二维码并确认登录。
3. 登录成功后即可查看“我喜欢”和个人歌单。
4. 如需切换账号或退出登录，点击顶部的账号入口并选择“退出登录”。

登录二维码过期时，点击“重新获取二维码”即可。

### 查找和播放音乐

- **我喜欢**：查看并播放当前账号收藏的歌曲，向下滚动可继续加载。
- **歌单**：点击歌单进入歌曲列表，再点击歌曲开始播放。
- **播放歌单**：打开歌单后点击“播放全部”，会按当前歌单歌曲创建播放队列。
- **榜单**：打开“榜单”标签，选择排行榜后点击“播放全部”即可播放当前榜单歌曲。
- **搜索歌曲**：输入歌曲名，搜索结果会分批显示，向下滚动会自动加载更多。
- **搜索歌手**：输入歌手名，点击歌手头像或歌手行即可查看其歌曲；向下滚动会继续加载，直至全部加载完成。
- **搜索专辑**：搜索结果中的专辑分区会同时列出与关键词相关的专辑，点击可查看该专辑的全部曲目（按专辑顺序排列），并支持“播放全部”。

### 播放控制

- 底部播放栏支持上一首、播放/暂停、下一首和拖动进度。
- 点击播放模式按钮，可以切换顺序播放、单曲循环和随机播放。
- 当前正在播放的歌曲会在列表中高亮显示。
- 关闭扩展弹窗后音乐仍会继续播放。
- 在支持的 Windows、Chrome 和 Edge 环境中，可以通过系统媒体面板暂停、继续、切歌或调整进度。
- 遇到无版权、会员限制或无法加载的歌曲时，扩展会显示错误原因并尝试跳到下一首可播放歌曲。

## 更新扩展

- **Edge 商店安装**：Edge 会自动检查更新，也可以在 `edge://extensions` 页面点击“更新”。
- **通过 ZIP 安装**：重新下载最新版 ZIP 并解压，然后在扩展管理页找到 QQ Music Mini，点击“重新加载”。如果换了解压目录，也可以先移除旧版本再重新加载新目录。
- **通过 Git 安装**：在项目目录执行 `git pull`，然后回到扩展管理页点击“重新加载”。

更新或修改源码后，必须在扩展管理页重新加载，浏览器才会使用最新代码。

## 卸载

在 Chrome 或 Edge 的扩展管理页找到 **QQ Music Mini**，点击“移除”即可。卸载扩展时，保存在该扩展本地存储中的登录信息也会一并删除。

## 工作方式与隐私

- 界面运行在 Popup 中；播放队列和状态由 Manifest V3 Service Worker 管理。
- 实际音频播放在扩展的 Offscreen Document 中完成，因此 Popup 关闭后音乐仍会继续。
- 扩展会直接访问 QQ / QQ 音乐相关域名以完成登录、读取曲库、搜索和获取一次性的播放地址；不依赖公开部署的第三方 API 服务。
- 二维码登录凭据仅保存在当前浏览器的 `chrome.storage.local` 中。扩展不读取或保存 QQ 密码，也不将凭据上传到开发者服务器。
- 播放地址不会持久化；每次切歌都会重新请求。
- 无法取得授权播放地址时，扩展会提示对应原因；不会尝试绕过会员、数字专辑、地区或版权限制。

完整隐私政策请参阅 [PRIVACY.md](https://github.com/vaeccc/qq-music-mini/blob/master/PRIVACY.md)。

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
- 本项目不是官方 QQ 音乐客户端或插件，也不代表腾讯或 QQ 音乐。

## 参考与致谢

接口请求形态和返回数据结构曾对照 [L-1124/QQMusicApi](https://github.com/L-1124/QQMusicApi)。本项目以原生 JavaScript 独立实现，未复制该项目源码。

## 免责声明

QQ 音乐名称、商标、音乐内容及相关版权归腾讯和/或各自权利人所有。使用本项目时，请遵守 QQ 音乐服务条款、适用法律以及所在地区的版权规则。
