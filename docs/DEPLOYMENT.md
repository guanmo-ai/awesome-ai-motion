# 运行与发布画廊

画廊不需要账号、模型 API 或依赖安装。需要 Node.js 22 或更新版本。

## 在线使用

直接打开 [Awesome AI Motion 在线画廊](https://guanmo-ai.github.io/awesome-ai-motion/) 即可浏览和播放，无需安装或登录。在线版为只读画廊；精选、删除和恢复在本地工作台使用。

## 本地打开

```sh
node scripts/serve.mjs
```

打开 http://127.0.0.1:4178/ 。默认进入作品浏览；点击「管理作品」后可精选、删除和恢复。本地维护服务仅绑定本机，修改保存在仓库中，不会自动推送或改变公开网站。

## 静态发布包

```sh
node scripts/build.mjs --check
node --test tests/*.test.mjs
node scripts/check-release.mjs
node scripts/package-site.mjs
```

输出为 `.research/site-dist/`，包含首页、样式、前端脚本、案例数据与被引用的封面。不会携带研究资料、删除恢复记录、Git 元数据或维护服务。视频仍引用作者 X 原帖媒体，不将 MP4 打包重传。

整个目录可托管为静态站点，支持放在域名根目录或项目子目录。静态访客可以看视频、筛选、复制作者公开提示词和分享作品；没有本地维护 API，也不会出现管理操作。

## GitHub Pages

仓库提供手动运行的「发布作品画廊」工作流，推送代码不会自动部署。

修改画廊脚本或样式时，同步更新 `index.html` 中对应资源的 `v` 参数，避免访客缓存造成新页面与旧资源混用。

获得项目所有者上线授权后，在仓库 Settings → Pages 将 Source 设为 GitHub Actions，再从 Actions 手动运行该工作流，选择 `main`。工作流先测试、校验并按白名单打包，随后发布静态文件。操作方式参考 [GitHub 官方文档](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

部署完成后，实际打开输出地址，在桌面和手机尺寸验证封面、搜索、播放、分享直达、关闭返回与错误回退，再把确认可用的网址加入 README。没有实际部署和验证前，不宣称已经上线。

## 媒体检查与失效处理

```sh
node scripts/check-media.mjs            # 全库，报告位于 .research/media-health.json
node scripts/check-media.mjs --limit 6  # 小样本检查
```

「原帖媒体健康检查」工作流每日执行，也可手动运行；失败条目保存在运行附件中，不自动删片、不修改案例。超时或平台限流可能导致失败，维护者应先复查原帖，再决定更新媒体地址或保留原帖入口。

检查只取 MP4 开头的有限字节，确认响应与文件头；不代表浏览器能完整播放，更不代表作品已通过视听审查。网站保留无 Referer 请求、播放超时、重试和作者原帖入口。
