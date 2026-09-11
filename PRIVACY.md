# QQ Music Mini 隐私政策 / Privacy Policy

生效日期 / Effective date: 2026-09-09

QQ Music Mini 是一个非官方、轻量的 QQ 音乐浏览器扩展。扩展的单一目的，是让用户在浏览器扩展中访问自己的 QQ 音乐内容，并播放当前账号有权限播放的歌曲。

QQ Music Mini is an unofficial lightweight browser extension for QQ Music. Its single purpose is to let users access their own QQ Music library in the extension and play tracks that their account is authorized to play.

## 1. 扩展会访问哪些数据 / Data the extension accesses

为实现登录、曲库和播放功能，扩展可能访问以下数据：

- QQ 官方二维码登录流程产生的必要 Cookie（例如 `qrsig`、`p_skey`）。
- QQ 音乐登录成功后返回的登录凭据，例如 MusicID / MusicKey 等会话信息。
- 用户自己的“我喜欢”、个人歌单、歌曲及歌手等音乐库信息。
- 用户主动输入的歌曲或歌手搜索关键词。
- 当前播放歌曲、播放队列和播放/暂停状态。

The extension may access the following data only as necessary to provide its user-facing features:

- Required cookies created by the official QQ QR-code login flow, such as `qrsig` and `p_skey`.
- QQ Music session credentials returned after successful login, such as MusicID / MusicKey and related session data.
- The user's own liked songs, playlists, tracks and artist metadata.
- Song or artist search terms entered by the user.
- Current track, playback queue and play/pause state.

QQ Music Mini 不读取或保存 QQ 账号密码。

QQ Music Mini does not read or store the user's QQ account password.

## 2. 数据如何使用 / How data is used

上述数据仅用于以下功能：

- 完成 QQ 官方二维码登录并维持登录状态；
- 展示“我喜欢”和个人歌单；
- 执行用户主动发起的歌曲/歌手搜索；
- 获取当前 QQ 音乐账号有权限播放的歌曲地址；
- 在扩展后台播放音乐并保持播放状态。

The data is used only to provide login, library browsing, search and background playback. It is not used for advertising, profiling, credit decisions, data brokerage or unrelated purposes.

## 3. 数据存储 / Data storage

QQ 音乐登录凭据及必要的播放器状态使用 `chrome.storage.local` 保存在当前浏览器的本地扩展存储中。

QQ Music credentials and necessary player state are stored locally in the browser using `chrome.storage.local`.

扩展没有开发者自建的账号服务器、分析服务器或广告服务器，不会把 QQ 音乐凭据上传到开发者服务器。

The extension does not operate a developer-owned account server, analytics server or advertising server, and does not upload QQ Music credentials to the developer.

## 4. 数据传输与第三方服务 / Data transmission and third-party services

当用户使用登录、曲库、搜索或播放功能时，扩展会直接与 QQ / QQ 音乐官方相关域名通信，以完成用户请求的功能。歌曲封面和音频内容也由 QQ 音乐相关服务提供。

When the user uses login, library, search or playback features, the extension communicates directly with QQ / QQ Music services to fulfill those requests. Artwork and audio are also served by QQ Music-related services.

QQ Music Mini 不出售用户数据，不向广告商、数据经纪商或其他无关第三方共享用户数据，也不包含第三方统计或广告 SDK。

QQ Music Mini does not sell user data, share it with advertisers or data brokers, or include third-party analytics or advertising SDKs.

用户与 QQ / QQ 音乐服务之间的数据处理同时受腾讯及 QQ 音乐自身的服务条款和隐私政策约束。

Data processed by QQ / QQ Music is also subject to Tencent and QQ Music's own terms and privacy policies.

## 5. Cookie 权限 / Cookie permission

扩展请求浏览器的 `cookies` 权限，仅用于 QQ 官方二维码登录流程中读取登录所需的 QQ 域名 Cookie。扩展不会读取与 QQ 音乐登录无关网站的 Cookie。

The extension requests the browser `cookies` permission only to read QQ-domain cookies required by the official QQ QR-code login flow. It does not read cookies from unrelated websites.

## 6. 版权与付费权限 / Copyright and paid access

扩展不会尝试绕过 QQ 音乐的 VIP、数字专辑、地区、版权或其他访问限制。能否播放由当前 QQ 音乐账号及 QQ 音乐服务端返回的授权结果决定。

The extension does not attempt to bypass QQ Music VIP, digital-album, regional, copyright or other access restrictions. Playback is determined by the user's QQ Music account permissions and QQ Music's server-side authorization response.

## 7. 数据保留与删除 / Retention and deletion

本扩展不在开发者服务器保留用户数据。用户可以通过浏览器清除该扩展的本地数据，或卸载扩展以删除其本地扩展存储。

The developer does not retain user data on a developer server. Users can clear the extension's local data through the browser or uninstall the extension to remove its local extension storage.

## 8. 政策变更 / Changes to this policy

如果扩展的数据处理方式发生实质变化，本隐私政策会同步更新，并在发布新版本时保持与实际功能一致。

If the extension's data practices materially change, this policy will be updated so that it remains consistent with the released product.

## 9. 联系方式 / Contact

如对本隐私政策或扩展的数据处理方式有疑问，可通过项目 GitHub Issues 联系：

For privacy or data-handling questions, contact the project through GitHub Issues:

https://github.com/vaeccc/qq-music-mini/issues
