# CloudBase CLI 隔离登录态规则

本项目不直接依赖本机全局 `tcb login`。所有默认 CloudBase CLI 操作都通过项目级 wrapper：

```bash
npm run tcb -- <tcb args>
```

wrapper 会把 `tcb` 的 `HOME` / `USERPROFILE` 指向项目内的 `.cloudbase-home/`，并设置：

```text
CLOUDBASE_ENV=cloud1-d8gbfzr7t6c5dc8bc
```

除 `login`、`logout`、`help`、`--help`、`--version` 等命令外，wrapper 会自动补上：

```bash
-e cloud1-d8gbfzr7t6c5dc8bc
```

如果命令已经显式传入 `-e` 或 `--env-id`，wrapper 不会覆盖。

## 首次登录

推荐交互式输入密钥，避免把 SecretKey 写进 shell 历史：

```bash
npm run cloudbase:login
```

如果必须非交互式登录，也必须在当前 shell 临时传入，不要写进仓库文件：

```bash
npm run tcb -- login --apiKeyId "$TENCENTCLOUD_SECRETID" --apiKey "$TENCENTCLOUD_SECRETKEY"
```

## 常用命令

```bash
npm run cloudbase:env
npm run cloudbase:functions
npm run tcb -- fn deploy handleOrder --force --json
npm run tcb -- fn invoke handleOrder -d @payload.json --json
```

## 安全规则

- `.cloudbase-home/` 是本项目专属 CLI 登录态目录，已加入 `.gitignore`。
- 不把 SecretId、SecretKey、登录密码、临时 token 写入仓库。
- 本地 Web 代理 `/api/cloud-function` 也使用同一个隔离登录态。
- 验证脚本也使用同一个隔离登录态。
- 部署前先运行 `npm run cloudbase:env`，确认环境 ID、地域和账号权限正确。

如需绕过 wrapper 调试裸 CLI，可以使用：

```bash
npm run tcb:raw -- <tcb args>
```

默认不要使用 `tcb:raw`。
