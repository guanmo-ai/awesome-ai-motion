# 维护指南

内容源为 `data/cases.json`。README、英文入口、`cases/` 和 `prompts/` 由脚本生成，编辑内容源后再生成，避免手工改动丢失。

## 新增或更正案例

1. 核对作者原帖及模型说明；提示词可以来自同一作者的回复，不能把转载者或 AI 推测当作原文。
2. 记录标题、独立简介、用途和必要素材；有公开原始指令用 `original`，只有转述用 `brief`。
3. 封面保存到 `assets/covers/<原帖 ID>.jpg`，不超过 250 KB，记录媒体来源和取帧时间。
4. 互动数字来自同一个原帖和采集时间；未知值保留 `null`。不要混用回复的点赞与主帖的浏览量。
5. 运行下面的检查，通过 PR 提交数据和生成文件。

```sh
node scripts/build.mjs
node --test tests/*.test.mjs
node scripts/build.mjs --check
node scripts/check-release.mjs
```

Node.js 22+，无需安装依赖。CI 在推送、PR 和手动触发时执行同样的检查，不联网刷新指标，不使用 API Key。

## 播放来源

`playback` 是可选字段；缺失时展示封面与作者原帖。当前支持 `external_github_attachment`：引用第三方公开 GitHub 附件，不重复上传。记录附件 URL、提供方、固定提交版本的来源页、对应原帖、核对时间和媒体时长。

核验时在未登录的 GitHub 页面检查播放器能加载视频帧，核对原帖 ID、画面和时长。普通 HEAD 请求可能返回 404，不能单凭该响应认定附件失效。不得保存带 JWT 的短期签名播放地址；只保存稳定的 `github.com/user-attachments/assets/…` 地址。

外部公开链接不等于本项目已获转载许可。当前 `reuploadPermission` 为 `not_verified`，不得据此自行下载再上传。作者投稿或允许托管后，另行保存明确依据再扩展上传流程。视频文件不提交到 Git 历史。

外部播放器可能被提供方撤下。收到失效反馈后先复查，失败则移除 `playback`，保留原帖入口；不要换成与作品无关的视频。权利人请求移除时同时检查 README、案例页、提示词、封面和数据记录。

## 指标刷新

记录原帖公开互动快照及核对时间；更新后运行 `node scripts/build.mjs`。

失败条目保留旧数字与旧时间。刷新不代表重新确认作品质量。当前没有自动定时采集。

## 发布

合入 `main` 前确认 CI 通过。发布说明只写已验证的实际能力；修改排序或媒体方式时同步更新来源说明。原创脚本的 MIT 不覆盖第三方媒体与提示词。
