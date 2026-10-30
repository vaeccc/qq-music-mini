# QQ Music Mini 商店提交资料

本文件用于 Chrome Web Store 与 Microsoft Edge Add-ons 上架时直接复制填写。

## 产品名称

QQ Music Mini

## 简短描述

轻量 QQ 音乐浏览器播放器：查看我喜欢和歌单、搜索歌曲，并在浏览器后台播放。

## 详细描述

QQ Music Mini 是一个非官方、轻量的 QQ 音乐浏览器扩展。

登录自己的 QQ 音乐账号后，可以：

- 查看“我喜欢”歌曲；
- 查看个人歌单和歌单歌曲；
- 搜索歌曲和歌手；
- 点击歌曲直接播放；
- 使用上一首、播放/暂停、下一首控制；
- 关闭扩展 Popup 后继续在浏览器后台播放；
- 在支持的 Chrome / Edge 环境中使用系统媒体控制。

扩展直接连接 QQ / QQ 音乐相关服务完成登录、曲库读取、搜索和播放，不依赖开发者自建的第三方音乐 API 服务器。

QQ Music Mini 不读取或保存 QQ 密码，不上传 QQ 音乐登录凭据到开发者服务器，不包含广告或第三方统计 SDK，也不会尝试绕过 VIP、数字专辑、地区或版权限制。

本扩展为非腾讯官方项目，与腾讯音乐娱乐集团及 QQ 音乐无官方关联。

## Single purpose / 单一用途

让用户在一个轻量浏览器扩展中访问自己的 QQ 音乐曲库、搜索音乐，并播放当前账号有权限播放的歌曲。

## 权限用途说明

### storage

用于在当前浏览器本地保存 QQ 音乐登录凭据、播放队列和必要的播放器状态。数据保存在 `chrome.storage.local` 中，不上传到开发者服务器。

### offscreen

用于创建不可见的 Offscreen Document，通过 HTMLAudioElement 在 Popup 关闭后继续播放音乐。

### cookies

仅用于 QQ 官方二维码登录流程，读取 QQ 登录域名产生的必要 Cookie（例如 `qrsig`、`p_skey`）。不会读取与 QQ 音乐登录无关的网站 Cookie。

### Host permissions

- `ssl.ptlogin2.qq.com`：获取和轮询 QQ 登录二维码。
- `ssl.ptlogin2.graph.qq.com`：完成 QQ 登录签名校验。
- `graph.qq.com`：完成 QQ OAuth 授权。
- `u.y.qq.com`：QQ 音乐登录、用户曲库、歌单及播放地址接口。
- `c.y.qq.com`：歌曲与歌手搜索。
- `y.gtimg.cn`：加载 QQ 音乐歌曲/专辑封面。
- `dl.stream.qqmusic.qq.com`：播放 QQ 音乐服务端返回的授权音频流。

## 隐私政策 URL

建议填写：

https://github.com/vaeccc/qq-music-mini/blob/master/PRIVACY.md

合并本上架分支后再使用该 URL。

## 数据使用声明建议

扩展处理的数据仅用于用户主动请求的登录、曲库、搜索和音乐播放功能。

- 不出售用户数据；
- 不用于广告；
- 不用于信用评估；
- 不用于用户画像或与产品单一用途无关的分析；
- 不向数据经纪商提供数据；
- 不将 QQ 音乐凭据上传到开发者服务器。

QQ / QQ 音乐服务自身的数据处理由腾讯及 QQ 音乐的服务条款与隐私政策管理。

## 审核人员测试说明

1. 安装扩展并固定到浏览器工具栏。
2. 点击扩展图标。
3. 点击“登录 QQ 音乐”。
4. 使用 QQ 手机客户端扫描扩展中显示的二维码，并在手机端确认登录。
5. 登录完成后，“我喜欢”和“歌单”页面会显示当前 QQ 音乐账号的数据。
6. 在“搜索”页输入歌曲名或歌手名进行搜索。
7. 点击任意当前账号有播放权限的歌曲。
8. 使用底部播放器验证上一首、播放/暂停、下一首。
9. 播放过程中关闭 Popup，音乐应继续播放；重新打开 Popup 后应恢复当前歌曲和播放状态。

注意：播放能力取决于审核账号自身拥有的 QQ 音乐授权。若歌曲受 VIP、数字专辑、地区或版权限制，扩展会显示无法播放或无权限提示，不会绕过限制。

## 非官方声明

QQ Music Mini is an unofficial third-party browser extension and is not affiliated with, endorsed by, or sponsored by Tencent Music Entertainment or QQ Music.

QQ 音乐名称、商标、音乐内容及相关版权归腾讯和/或各自权利人所有。

## 建议商店分类

Music & Audio / 音乐与音频（如果商店提供该分类）。

## 截图建议

至少准备 4 张商店截图：

1. 二维码登录界面；
2. “我喜欢”歌曲列表；
3. 个人歌单页面；
4. 搜索结果 + 底部 Mini Player。

截图中不要出现真实 QQ 号、敏感个人信息或无权公开的私人歌单信息。

## 上架前检查

- [ ] `manifest.json` 版本号已更新；
- [ ] Chrome 和 Edge 均通过本地加载测试；
- [ ] 二维码登录可用；
- [ ] 我喜欢可加载；
- [ ] 歌单及详情可加载；
- [ ] 搜索可用；
- [ ] 后台播放可用；
- [ ] 上一首 / 播放暂停 / 下一首正常；
- [ ] Popup 关闭后继续播放；
- [ ] 无远程执行 JavaScript；
- [ ] 无广告或统计 SDK；
- [ ] 隐私政策 URL 可以公开访问；
- [ ] 商店 ZIP 根目录直接包含 `manifest.json`。
