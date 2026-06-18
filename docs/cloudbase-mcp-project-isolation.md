# CloudBase MCP 项目级隔离方案

本项目已经跑通 CloudBase MCP，默认不使用全局 `tcb login` 状态。

## 当前配置

- 项目根目录：当前仓库根目录
- 环境 ID：`cloud1-d8gbfzr7t6c5dc8bc`
- 地域：`ap-shanghai`
- 凭证模式：`projectProfile`
- 隔离目录：`.cloudbase-home/`
- MCP 包：`@cloudbase/cloudbase-mcp`

配置入口是仓库根目录的 `cloudbase.project.json`。实际运行入口是：

```bash
npm run cloudbase:mcp:verify
npm run cloudbase:mcp:stdio
```

`cloudbase:mcp:verify` 会直接调用 MCP 工具读取环境、云函数列表和数据库集合列表，用于证明项目凭证可用。

`cloudbase:mcp:stdio` 是给 Codex、Cursor、Claude Desktop 等 MCP 客户端使用的 stdio 服务入口。客户端配置时只需要把命令指向这个脚本，不需要把密钥写到客户端配置里。

## 隔离机制

`scripts/cloudbase/mcp-context.js` 会在启动 MCP 前设置这些进程级变量：

```text
HOME=<repo>/.cloudbase-home
USERPROFILE=<repo>/.cloudbase-home
XDG_CONFIG_HOME=<repo>/.cloudbase-home/.config
XDG_CACHE_HOME=<repo>/.cloudbase-home/.cache
XDG_DATA_HOME=<repo>/.cloudbase-home/.local/share
CLOUDBASE_ENV_ID=cloud1-d8gbfzr7t6c5dc8bc
TCB_REGION=ap-shanghai
```

因此 CloudBase MCP 读取到的是当前项目的本地登录态，而不是本机全局登录态。

默认 `credentialMode` 是 `projectProfile`。在这个模式下，脚本会清理当前进程继承到的 SecretId、SecretKey、临时 token、CloudBase API Key，避免其他项目或其他 AI 进程的环境变量串进来。

如果未来插件需要在 CI 或一次性进程里使用显式密钥，可以把 `cloudbase.project.json` 里的 `mcp.credentialMode` 改为 `processEnv`，然后只在启动 MCP 的那个进程里注入环境变量。不要把密钥写进仓库。

## MCP 客户端配置模板

不同客户端配置文件位置不同，但核心结构一致。生成插件时应写入目标客户端自己的项目级配置，命令指向目标仓库内的 wrapper：

```json
{
  "mcpServers": {
    "cloudbase": {
      "command": "node",
      "args": ["/absolute/path/to/project/scripts/cloudbase/run-mcp-isolated.js"],
      "env": {
        "INTEGRATION_IDE": "Codex"
      }
    }
  }
}
```

如果使用 `processEnv` 模式，只能在 `env` 中注入当前项目对应的临时凭证或项目专用 CAM 凭证。

## 后续插件化规则

把这套机制做成插件时，插件只负责把以下内容加载到目标项目：

1. 安装 `@cloudbase/cloudbase-mcp`。
2. 写入 `cloudbase.project.json`。
3. 复制 `scripts/cloudbase/mcp-context.js`、`verify-mcp.js`、`run-mcp-isolated.js`。
4. 确保 `.cloudbase-home/`、`.env`、`.env.*` 在 `.gitignore` 中。
5. 添加 `cloudbase:mcp:verify` 和 `cloudbase:mcp:stdio` 脚本。
6. 运行 `npm run cloudbase:mcp:verify`，确认目标环境 ID、云函数列表、集合列表都来自目标项目。

插件不得读取或修改全局 `tcb login`，不得把任何密钥写入 Git 文件。
