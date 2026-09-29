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

推送到正式仓库 `main` 后，「发布作品画廊」工作流自动执行测试、生成一致性、公开文件与发布目标检查；全部通过后按白名单打包并更新网站。任何检查失败都会阻止部署，线上继续保留上一版。PR 和其他分支不会发布网站；工作流仍支持手动重试。

修改画廊脚本或样式时，同步更新 `index.html` 中对应资源的 `v` 参数，避免访客缓存造成新页面与旧资源混用。

首次配置时，在仓库 Settings → Pages 将 Source 设为 GitHub Actions。日常发布随获准的 `main` 推送一起完成；需要重试时，从 Actions 手动运行该工作流并选择 `main`。操作方式参考 [GitHub 官方文档](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

推送后确认对应提交的部署工作流成功，并核对线上首页、脚本版本和案例数据与发布版本一致。实际打开网站，在桌面和手机尺寸验证本次改动影响的筛选、封面、搜索、播放、分享直达、关闭返回或错误回退。只有部署成功且线上核验完成，才报告网站已更新；若失败，修复或说明阻塞，不能只交付 Git 提交地址。

## 媒体检查与失效处理

```sh
node scripts/check-media.mjs            # 全库，报告位于 .research/media-health.json
node scripts/check-media.mjs --limit 6  # 小样本检查
```

「原帖媒体健康检查」工作流每日执行，也可手动运行；运行日志显示结果，逐条报告仅保留在该运行环境，不上传为公开仓库的运行附件，不自动删片、不修改案例。本机执行时报告保存在被忽略的 `.research/`。超时或平台限流可能导致失败，维护者应先复查原帖，再决定更新媒体地址或保留原帖入口。

检查只取 MP4 开头的有限字节，确认响应与文件头；不代表浏览器能完整播放，更不代表作品已通过视听审查。网站保留无 Referer 请求、播放超时、重试和作者原帖入口。
