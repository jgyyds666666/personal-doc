# Coze 环境对象存储兼容性问题排查与修复指引

> 用途：本仓库在 **Coze 沙箱/部署环境** 运行时，`pull` 更新代码后**文件列表**与**文件编辑功能**不可用（报 500）。本文档面向使用 **AI 辅助修改代码** 的开发者，说明现象、根因与推荐修复方向，供你参考后交由 AI 落地。**本项目当前不在本文档所指仓库内改动源码。**

---

## 1. 问题现象

- 登录后页面**文件列表加载失败**，接口 `GET /api/files` 返回：
  ```json
  { "error": "Failed to list files" }
  ```
- 新增的“编辑文件”相关接口（如 `GET /api/files/content`）同样 500。
- 上传 / 下载 / 删除接口正常，未受影响。

## 2. 运行日志

服务器日志（`/app/work/logs/bypass/app.log`）中关键错误：

```
List files error: Error [CredentialsProviderError]: Could not load credentials from any providers
    at async listFilesFromStorage (src/lib/storage.ts:97:18)
```

复现命令：

```bash
# 先登录拿到 cookie
curl -c /tmp/ck.txt -X POST -H 'Content-Type: application/json' \
  -d '{"password":"<ADMIN_PASSWORD>"}' http://localhost:5000/api/auth/login
# 触发列表
curl -b /tmp/ck.txt http://localhost:5000/api/files
```

---

## 3. 根因分析

### 3.1 Coze 环境的对象存储配置（与本问题直接相关）

Coze 沙箱/部署环境会自动注入以下环境变量，提供的是 **Coze 托管的 S3 兼容代理端点**，**不需要、也没有真实 AWS 访问密钥**：

```env
COZE_BUCKET_ENDPOINT_URL=https://integration.coze.cn/coze-coding-s3proxy/v1
COZE_BUCKET_NAME=bucket_xxxxxxxxxxxx
```

项目对其兼容读写的方式，**必须使用 `coze-coding-dev-sdk` 提供的 `S3Storage`**（内部适配了该代理，无需凭证即可工作），而**不要**直接用原生 `@aws-sdk/client-s3` 的 `S3Client`（原生客户端会走标准 AWS 签名与凭证链，需要真实 `accessKeyId/secretAccessKey`）。

### 3.2 新旧代码的差异导致冲突

**改动前（可用）：** `src/lib/storage.ts` 统一用 `coze-coding-dev-sdk` 的 `S3Storage`，因此上传/列表/下载/删除都能在 Coze 环境工作。

**`pull` 新代码后（列表/编辑功能不可用）：** 引入并改用了原生 AWS SDK 客户端，且使用**不统一**：

| 功能 | 实现 | 使用的客户端 | Coze 环境下状态 |
|---|---|---|---|
| 上传 `uploadFileToStorage` | `src/lib/storage.ts` | `S3Storage`（coze SDK） | ✅ 正常 |
| 下载 `getDownloadUrl` | `src/lib/storage.ts` | `S3Storage` | ✅ 正常 |
| 删除 `deleteFileFromStorage` | `src/lib/storage.ts` | `S3Storage` | ✅ 正常 |
| **列表 `listFilesFromStorage`** | `src/lib/storage.ts` | **`getS3Client()`（原生 SDK）** | ❌ 报错 |
| **可编辑文件读写 `editable-storage.ts`** | content 路由中使用 | **`getS3Client()`（原生 SDK）** | ❌ 报错 |

### 3.3 原生 `S3Client` 为何报错

`src/lib/s3-client.ts` 的 `getS3Client()`：

```ts
credentials:
  config.accessKeyId && config.secretAccessKey
    ? { accessKeyId, secretAccessKey, sessionToken }
    : undefined,   // ← 未配置时传 undefined
```

当 Coze 环境没有 `S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY` 时，`credentials` 为 `undefined`，原生 AWS SDK 会回落到**默认凭证提供链**（环境变量、IAM、EC2 metadata 等）→ 全部找不到 → 抛出 `CredentialsProviderError: Could not load credentials from any providers`。

---

## 4. 涉及文件与改动点

| 文件 | 关键函数 | 用途 |
|---|---|---|
| `src/lib/s3-client.ts` | `readStorageConfig` / `getS3Client` | 原生 S3Client 初始化（凭证/端点读取） |
| `src/lib/storage.ts` | `listFilesFromStorage` | **文件列表**（当前用原生 S3Client）|
| `src/lib/editable-storage.ts` | 读取/写入/删除可编辑文件 | **编辑功能**（全部用原生 S3Client）|
| `src/app/api/files/route.ts` | GET | 列表接口 |
| `src/app/api/files/content/route.ts` | GET/PUT 等 | 文件内容读写接口 |

---

## 5. 推荐修复方向（供选择的 AI 技术方案）

> 请结合你的部署场景（是否真需要第三方 S3）选择。

### 方案 A（推荐，改动小且贴合 Coze）：统一改回/改用 `coze-coding-dev-sdk` 的 `S3Storage`

- 让 `listFilesFromStorage` 与 `editable-storage.ts` 全部改用 `coze-coding-dev-sdk` 的 `S3Storage`（`listFiles` / `readFile` / 上传等），不再走原生 `getS3Client()`。
- **注意元数据差异**：原生 `ListObjectsV2Command` 能拿到 `Size / LastModified / ETag`，而 `S3Storage.listFiles` 目前协议只返回 `keys`。若要保留 `etag`（完整性校验）等元数据，需确认/扩展 `S3Storage` 返回字段，或对可编辑文件改用 `readFile` 后再推导。
- 优点：与 Coze 官方 SDK 用法一致，`pull` 前就这么跑通的，最稳。
- 缺点：可能有元数据字段缺失，需小范围适配。

### 方案 B（若必须保留原生 `S3Client`）：允许“匿名/占位凭证”访问 Coze 代理

- 在 `getS3Client()` 中，当未配置真实凭证时，**不要传 `undefined`**，而是提供空串凭证占位（与 `S3Storage` 内部行为对齐），避免 SDK 走默认凭证链：
  ```ts
  credentials: config.accessKeyId && config.secretAccessKey
    ? { accessKeyId, secretAccessKey, sessionToken }
    : { accessKeyId: "", secretAccessKey: "", sessionToken: undefined },
  ```
- **必须实测** Coze 代理端点是否接受空签名（建议用一次 `ListObjectsV2` 冒烟）。若代理对签名敏感，此方案不可行，需回退方案 A。
- 优点：保留原生客户端能力（完整元数据）。
- 缺点：绕过 SDK 凭证语义，依赖代理对空签名的容忍度，需验证。

### 方案 C（仅当你确实要用真实第三方 S3 时）

- 在部署环境配置真实的 `S3_ENDPOINT_URL / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY` 指向你自己的 S3 兼容存储，原生 `S3Client` 即可正常签名。
- 与 Coze 托管存储无关；若仍要兼容 Coze 环境，需结合方案 B 或 A 做“有凭证用原生、无凭证走 Coze SDK”的统一入口封装。

> 建议最终形态：**提供一个统一的存储适配层（facade）**，内部根据“是否配置了真实凭证”决定走 `S3Storage` 还是原生 `S3Client`，保证两种环境都能跑。

---

## 6. 修复后验证

1. 代码检查：`pnpm lint`、`pnpm ts-check` 通过。
2. 接口冒烟（已登录）：
   ```bash
   curl -b /tmp/ck.txt http://localhost:5000/api/files           	# 期望 {success:true, data:[...]}
   curl -b /tmp/ck.txt "http://localhost:5000/api/files/content?key=uploads/<key>"
   ```
3. 上传 → 列表 → 编辑文件 → 保存 → 下载 → 删除，逐条确认。
4. `app.log` 中无可复现的 `CredentialsProviderError / List files error`。

---

## 附：相关环境变量参考（`.env.local`）

```env
# Coze 沙箱自动注入（无需手动填）：
COZE_BUCKET_ENDPOINT_URL=...
COZE_BUCKET_NAME=...
# 若走方案 C 的第三方 S3 才需配置：
# S3_ENDPOINT_URL=...
# S3_ACCESS_KEY_ID=...
# S3_SECRET_ACCESS_KEY=...
# S3_REGION=...
```