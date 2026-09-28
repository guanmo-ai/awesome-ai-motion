# Awesome AI Motion

独立的开源 AI 视频与动效案例库，唯一远程目标为 `guanmo-ai/awesome-ai-motion`。只使用本仓库的案例、封面、脚本和研究记录，不读取相邻项目的媒体、私有数据或配置。

- `data/cases.json` 是内容源；README、分类页、双语详情和提示词由 `scripts/build.mjs` 生成。
- `index.html` 与 `assets/gallery*` 是独立静态画廊。预览使用 `PORT=4178 node scripts/serve.mjs`，仅绑定本机。
- 发现与核验见 `docs/DISCOVERY.md`，维护与发布见 `docs/MAINTAINING.md`。参考仓库只用于找原帖，不照搬收录判断。
- `discovery` 表示来源已核对、编目资料待完善；`catalogued` 表示资料已整理。完整视听评价是可选记录，不是收录门槛；精选单独标记。
- 保留 `.research/deleted-works/` 中的删除恢复记录；其他研究证据也只留在被忽略的 `.research/`，不公开提交。
- 先查看工作树并保留已有改动。当前先本地审看，提交、推送、PR 和部署须获得用户授权。
- 公开与本地资料边界见 `docs/PUBLIC_PRIVATE.md`。内部采集方法、任务分工及候选只放本地研究目录，公开文件只保留必要来源与核验结果。
- 修改后执行受影响测试及 `node scripts/build.mjs --check`；发布准备执行 `node --test tests/*.test.mjs`、`node scripts/check-release.mjs` 和 `node scripts/check-target.mjs`。
- 对外署名使用「观默 / @guanmo_ai」，本仓库提交使用公开署名与 GitHub noreply 邮箱；提交前检查作者和提交者身份，不使用自动生成的本机身份。不要将真实姓名、私人邮箱、机器名、私有路径、凭据和内部研究记录写入公开文件。
