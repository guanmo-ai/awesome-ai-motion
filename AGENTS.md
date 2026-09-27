# Awesome AI Motion

独立的开源 AI 视频与动效案例库，唯一远程目标为 `guanmo-ai/awesome-ai-motion`。只使用本仓库的案例、封面、脚本和研究记录，不读取相邻项目的媒体、私有数据或配置。

- `data/cases.json` 是内容源；README、分类页、双语详情和提示词由 `scripts/build.mjs` 生成。
- `index.html` 与 `assets/gallery*` 是独立静态画廊。预览使用 `PORT=4178 node scripts/serve.mjs`，仅绑定本机。
- 发现与核验见 `docs/DISCOVERY.md`，维护与发布见 `docs/MAINTAINING.md`。参考仓库只用于找原帖，不照搬收录判断。
- 保留 `.research/deleted-works/` 中的删除恢复记录；其他研究证据也只留在被忽略的 `.research/`，不公开提交。
- 先查看工作树并保留已有改动。当前先本地审看，提交、推送、PR 和部署须获得用户授权。
- 用户指定：适合并行的简单任务交给 GPT-6-Sol high，普通实现与核验交给 GPT-6-Sol xhigh；写清文件所有权，主 Agent 集成验证。
- 修改后执行受影响测试及 `node scripts/build.mjs --check`；发布准备执行 `node --test tests/*.test.mjs`、`node scripts/check-release.mjs` 和 `node scripts/check-target.mjs`。
