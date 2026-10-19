# 纯文本、Markdown、JSON、CSV 与代码文件在线编辑方案

> 项目：personal-doc 私人文档库
>
> 文档状态：已明确范围，尚未实施
>
> 编写日期：2026-10-19
>
> 适用架构：Next.js 16 + React 19 + TypeScript + S3 兼容对象存储
> 当前部署：单用户、低并发、主应用服务器 1 核 2 GB

## 1. 需求范围

本方案只实现文本类文件在线编辑，不实现 Office 和复杂二进制文档编辑。

包含：

- 纯文本：`txt`、`log`。
- Markdown：`md`、`markdown`。
- 数据文件：`json`、`jsonc`、`csv`、`tsv`。
- Web 代码：`html`、`htm`、`css`、`scss`、`less`、`js`、`jsx`、`ts`、`tsx`。
- 配置文件：`xml`、`yaml`、`yml`、`toml`、`ini`、`conf`、`properties`、`env`。
- 常见代码：`py`、`java`、`kt`、`kts`、`c`、`h`、`cpp`、`hpp`、`cs`、`go`、`rs`、`php`、`rb`、`sh`、`bash`、`zsh`、`ps1`、`sql`、`vue`、`svelte`、`dart`、`swift`、`gradle`。
- 特殊无扩展名文本文件：`Dockerfile`、`Makefile`、`.gitignore` 等经过白名单确认的文件。

不包含：

- `doc`、`docx`、`xls`、`xlsx`、`ppt`、`pptx`。
- PDF 正文编辑。
- 图片、音频、视频、压缩包编辑。
- 代码编译、运行、调试或在线终端。
- 浏览器直接运行 HTML、JavaScript、Shell、PowerShell 等上传内容。
- 多人实时协同编辑。

## 2. 可行性结论

该范围完全可以在现有项目中实现，不需要新增服务器，也不需要 ONLYOFFICE、Collabora、WOPI、PostgreSQL、Redis 或消息队列。

推荐由当前 Next.js 应用负责：

1. 从 S3 读取受支持的小型文本文件。
2. 在浏览器中使用 CodeMirror 6 编辑。
3. Markdown 提供安全的实时预览。
4. JSON 提供语法检查和格式化。
5. CSV 第一版先按文本编辑，后续再增加表格模式。
6. 保存时使用对象 ETag 或版本号检测冲突。
7. 每次覆盖前保留可恢复的历史版本。

纯文本编辑的主要资源消耗发生在用户浏览器，1 核 2 GB 的服务端只处理小文件读写、鉴权和 S3 请求，能够承载单用户使用。

## 3. 产品原则

### 3.1 只编辑，不执行

代码文件只能作为文本展示和保存，任何情况下都不能在服务端或浏览器中自动执行。

- 不提供“运行代码”。
- 不提供 Shell 或终端。
- 不执行上传的 JavaScript。
- 不把 HTML 放进可执行 iframe 预览。
- 不自动加载代码里引用的远程资源。
- 不根据文件内容调用 `eval`、`Function`、子进程或动态模块导入。

这条原则可以显著降低远程代码执行和 XSS 风险。

### 3.2 原文往返优先

打开再保存不应在用户没有修改的情况下改变文件内容。

需要保留：

- UTF-8 BOM 是否存在。
- `LF` 或 `CRLF` 换行风格。
- 文件末尾是否有换行。
- 缩进、空格和空行。
- CSV 的引号和分隔符，除非用户主动进入表格模式并确认重新序列化。

默认禁止自动格式化保存。JSON 格式化、代码缩进整理等操作必须由用户主动触发。

### 3.3 保存前可恢复

在线编辑增加了误覆盖风险。编辑功能上线前必须至少满足一种恢复方案：

- 推荐：对象存储开启版本控制。
- 备选：每次保存前复制旧对象到 `versions/{fileId}/{timestamp}`。

只显示“保存成功”不等于安全；必须能够找回上一个版本。

## 4. 支持格式与行为

| 分类 | 格式 | 第一版编辑方式 | 保存检查 |
| --- | --- | --- | --- |
| 纯文本 | TXT、LOG | 代码编辑器 | 编码、大小、冲突 |
| Markdown | MD、MARKDOWN | 源码编辑 + 安全预览 | XSS 净化、冲突 |
| JSON | JSON、JSONC | 代码编辑 + 语法提示 | 语法警告、冲突 |
| 表格文本 | CSV、TSV | 第一版按文本编辑 | 编码、分隔符、冲突 |
| Web 代码 | HTML、CSS、JS、TS 等 | 语法高亮 | 不执行、不预览 HTML |
| 配置 | YAML、TOML、INI、ENV 等 | 语法高亮 | 敏感内容提示 |
| 其他代码 | Python、Java、Kotlin、Go 等 | 语法高亮 | 不编译、不运行 |

### 4.1 TXT

提供：

- 行号、搜索、替换。
- 自动换行开关。
- 字符数、行数和当前光标位置。
- `Ctrl+S` / `Cmd+S` 保存。
- 未保存离开提醒。

### 4.2 Markdown

提供三种视图：

- 仅编辑。
- 编辑与预览并排。
- 仅预览。

第一版支持 GitHub Flavored Markdown 的表格、任务列表、删除线和代码块。

安全约束：

- 默认不解析 Markdown 内嵌 HTML。
- 不使用未经净化的 `dangerouslySetInnerHTML`。
- 如果以后允许部分 HTML，必须通过 `rehype-sanitize` 白名单净化。
- 外部链接使用 `rel="noopener noreferrer"`。
- 外部图片默认不自动加载，或经过明确的域名策略。
- 暂不支持 Mermaid、脚本组件、MDX 和任意 iframe。

`react-markdown` 官方说明其默认不直接执行原始 HTML，但修改 URL 转换或加入插件可能重新引入风险，因此仍要固定插件清单并执行安全测试。

### 4.3 JSON 与 JSONC

提供：

- 括号匹配。
- 语法错误行提示。
- 主动触发的格式化。
- 折叠和搜索。

保存策略：

- 合法 JSON 直接保存。
- 非法 JSON 显示明确错误。
- 不强制禁止保存，因为私人文档可能保存未完成草稿；但需要二次确认“仍然保存无效 JSON”。
- JSONC 允许注释，不用原生 `JSON.parse` 作为唯一校验器。

### 4.4 CSV 与 TSV

第一版建议只使用文本编辑器，不立即开发电子表格界面。这样能够保留原始引号、空行和换行，不会因为重新序列化导致文件发生大量无意义变化。

第二版如果增加表格模式，需要：

- 自动或手动选择逗号、制表符、分号等分隔符。
- 支持带引号字段和字段内换行。
- 使用虚拟滚动，限制最大行数和列数。
- 从文本模式切换到表格模式时提示“保存后可能重新格式化 CSV”。
- 保留原始文本，表格解析失败时允许退回文本模式。

### 4.5 代码和配置文件

第一版目标是“查看和修改源码”，不是云 IDE。

提供：

- 语法高亮。
- 行号、搜索、替换。
- 括号匹配和当前行高亮。
- 缩进宽度、Tab/空格设置。
- 软换行开关。
- 只读模式降级。

暂不提供：

- Language Server Protocol。
- 工程级跳转和符号索引。
- Git 操作。
- 包安装。
- 编译、运行、测试和调试。
- 自动修复或格式化保存。

这样可以控制首版体积和安全边界。

## 5. 文件识别与白名单

不能只相信浏览器上传的 MIME 类型，也不能只相信扩展名。

服务端应同时检查：

1. 文件 key 仍满足 `uploads/` 单层对象限制。
2. 文件名或特殊文件名命中可编辑白名单。
3. 文件大小不超过可编辑上限。
4. 内容不包含 NUL 字节。
5. 内容能够按允许的文本编码解码。
6. MIME 类型没有明确指向二进制格式。

建议分类函数返回：

```ts
type EditableFileKind =
  | "plain-text"
  | "markdown"
  | "json"
  | "jsonc"
  | "csv"
  | "tsv"
  | "source-code"
  | "config"
  | "unsupported";

interface EditableFileDetection {
  kind: EditableFileKind;
  language: string | null;
  editable: boolean;
  reason?: string;
}
```

扩展名白名单必须集中放在服务端共享模块中，不能在前端和多个 API 中各维护一份不同列表。

## 6. 大小和编码限制

### 6.1 建议限制

- 默认可编辑上限：2 MiB。
- 可配置硬上限：5 MiB。
- 超过上限：仍允许下载，但编辑按钮变成“文件过大，仅支持下载”。
- 单行特别长的压缩 JSON、生成代码或日志可能造成浏览器卡顿，应在打开前警告。

2 MiB 对普通笔记、配置和源码已经足够，也可以避免客户端编辑器和服务端内存出现明显压力。

### 6.2 编码策略

第一版：

- 完整支持 UTF-8。
- 识别并保留 UTF-8 BOM。
- 非 UTF-8 文件显示“暂不支持该编码”，继续允许下载。

第二版再考虑：

- GBK / GB18030。
- Big5。
- 用户手动选择编码后重新打开。

不要静默使用替换字符解码后覆盖原文件，否则会造成不可逆乱码。

### 6.3 换行策略

打开文件时检测主要换行风格：

- `LF`。
- `CRLF`。
- 混合换行。

保存默认保持原风格。混合换行文件应显示提示，并让用户主动选择是否统一。

## 7. 推荐编辑器技术

推荐 CodeMirror 6，不选择完整 Monaco Editor 作为第一版。

理由：

- 模块化，可按语言动态加载。
- 更适合移动端和普通文本编辑。
- 首屏和资源体积更容易控制。
- 搜索、语法高亮、括号匹配等能力足够。
- 当前需求不是完整 VS Code，也不需要内置 TypeScript 工程语言服务。

建议直接使用 CodeMirror 官方模块，在 React 客户端组件中封装编辑器生命周期。语言包按文件类型动态导入，未知文本不加载额外语言包。

计划依赖仅供实施时参考，安装必须使用 pnpm：

```text
codemirror
@codemirror/language-data
@codemirror/lang-markdown
@codemirror/lang-json
@codemirror/lint
react-markdown
remark-gfm
rehype-sanitize
```

最终安装前需要按当时版本再次确认包名、兼容性和许可证，避免照搬文档中的版本号。

## 8. 页面与组件设计

### 8.1 文件列表

对可编辑格式增加“编辑”按钮；其他文件仍只提供下载和删除。

按钮状态：

- `编辑`：格式和大小允许。
- `只读查看`：可以安全显示但不允许保存。
- `文件过大`：超过编辑上限。
- `不支持编辑`：二进制或未列入白名单。

### 8.2 编辑页面

建议路由：

```text
/edit?key={urlEncodedStorageKey}
```

对象 key 不是授权凭证。服务端仍必须验证登录、key 范围、文件类型和大小。

编辑页结构：

```text
┌──────────────────────────────────────────────┐
│ 返回  文件名  语言  编码  换行  保存状态  保存 │
├──────────────────────────────────────────────┤
│                                              │
│              CodeMirror 编辑区域              │
│                                              │
├──────────────────────────────────────────────┤
│ 第 12 行，第 8 列  UTF-8  LF  125 KB          │
└──────────────────────────────────────────────┘
```

Markdown 桌面端可使用左右分栏；移动端使用“编辑 / 预览”标签切换，避免双栏过窄。

### 8.3 保存状态

至少区分：

- 未修改。
- 有未保存修改。
- 保存中。
- 已保存。
- 保存失败。
- 版本冲突。

只有服务端确认 S3 新版本写入成功后，才能显示“已保存”。

## 9. API 设计

### 9.1 读取内容

```text
GET /api/files/content?key={key}
```

成功响应：

```json
{
  "success": true,
  "data": {
    "key": "uploads/uuid_example.ts",
    "originalName": "example.ts",
    "content": "export const value = 1;\n",
    "kind": "source-code",
    "language": "typescript",
    "encoding": "utf-8",
    "hasBom": false,
    "lineEnding": "lf",
    "size": 24,
    "etag": "object-version-etag",
    "lastModified": "2026-10-19T00:00:00.000Z"
  }
}
```

服务端步骤：

1. 验证管理员登录。
2. 验证 storage key。
3. 获取对象真实元数据。
4. 验证大小和文件类型。
5. 流式读取或在严格上限内读取 Buffer。
6. 检测二进制内容、编码、BOM 和换行。
7. 返回 `Cache-Control: no-store`。

### 9.2 保存内容

```text
PUT /api/files/content
Content-Type: application/json
```

请求体：

```json
{
  "key": "uploads/uuid_example.ts",
  "content": "export const value = 2;\n",
  "baseEtag": "object-version-etag",
  "encoding": "utf-8",
  "hasBom": false,
  "lineEnding": "lf"
}
```

服务端步骤：

1. 验证登录和同源请求。
2. 限制请求体大小。
3. 再次验证 key 和格式，不相信读取接口之前的结果。
4. 检查 `baseEtag` 是否仍等于当前对象版本。
5. 不一致时返回 `409 Conflict`，不覆盖文件。
6. 按原编码、BOM 和换行策略生成保存内容。
7. 写入新对象版本。
8. 返回新的 ETag、大小和保存时间。

### 9.3 错误状态

| 状态码 | 含义 |
| --- | --- |
| 400 | key、请求体或编码参数不合法 |
| 401 | 登录失效 |
| 403 | Origin 不合法或无权限 |
| 404 | 文件不存在 |
| 409 | 文件已被其他页面修改 |
| 413 | 文件或请求体过大 |
| 415 | 不支持编辑的格式或检测为二进制 |
| 500 | 对象存储或服务器保存失败 |

## 10. S3 读写方案

当前 `S3Storage` 封装提供文件读取能力，但编辑保存需要可靠地覆盖指定 key、读取真实 ETag，并最好支持条件写入。

建议编辑功能直接复用项目已经安装的 AWS S3 SDK：

- `HeadObjectCommand`：读取大小、ETag、修改时间和版本 ID。
- `GetObjectCommand`：读取内容。
- `PutObjectCommand`：写回原 key。
- 对象存储支持时使用条件写入；否则在写入前再次核对版本，并依赖单用户低并发和对象版本控制兜底。

不要通过重新调用当前“上传新文件”的接口保存编辑内容，因为它会生成新的 UUID key，导致原文件和编辑结果成为两个不相关文件。

## 11. 并发与版本冲突

典型场景：同一个文件同时在电脑和手机打开。

推荐使用乐观锁：

1. 打开时记录 `baseEtag`。
2. 保存时携带 `baseEtag`。
3. 服务端比较当前 ETag。
4. 一致则保存。
5. 不一致返回 409。

冲突 UI 提供：

- 下载当前服务器版本。
- 将自己的内容另存为新文件。
- 放弃本地修改并重新加载。

第一版不要提供“仍然强制覆盖”，避免用户在不了解差异的情况下丢失另一端修改。

## 12. 草稿与自动保存

第一版推荐：

- 以手动保存为主。
- 支持 `Ctrl+S` / `Cmd+S`。
- 页面关闭前提醒未保存修改。
- 编辑器内存中保留当前内容。

不推荐第一版每次输入都写 S3，这会产生大量对象版本和请求费用。

可选第二版：

- 停止输入 30 秒后自动保存。
- 自动保存仍然执行 ETag 冲突检查。
- 失败后不清空编辑内容。
- 网络恢复后由用户确认重试。

浏览器本地持久化草稿需要谨慎：`.env`、`.pem`、`.key` 或含凭据的代码可能把敏感内容留在 IndexedDB。建议第一版不做持久化草稿；以后增加时默认对敏感扩展名关闭，并提供自动过期和退出登录清理。

## 13. 安全要求

### 13.1 服务端

- 所有读取、保存接口必须验证管理员 Session。
- 保存接口必须执行同源检查。
- storage key 继续只允许 `uploads/` 下的单层对象。
- 限制请求体和文件大小，不能只依赖前端。
- 文件类型白名单和二进制检测必须在服务端执行。
- 返回 `Cache-Control: no-store`。
- 日志不能记录完整文件内容、密码、Cookie、S3 密钥和签名 URL。
- 对象存储密钥永远不能发送到浏览器。
- 读取和保存超时应有上限。

### 13.2 浏览器

- 不执行代码内容。
- HTML、SVG 和脚本文件只以纯文本形式编辑。
- Markdown 预览使用安全组件和固定插件白名单。
- 禁止未经净化的原始 HTML。
- 不自动加载 Markdown 中的外部资源。
- CSP 不允许任意脚本源和任意 frame。
- 页面离开时销毁编辑器实例并清理内存引用。

### 13.3 敏感文件

以下文件应显示醒目提示：

- `.env`、`.env.*`。
- `.pem`、`.key`、`.p12`、`.pfx`。
- `credentials`、`secrets` 等命名文件。

其中私钥和二进制证书默认不应进入可编辑白名单；`.env` 可以作为文本编辑，但不提供 Markdown 预览、本地草稿或内容日志。

## 14. 性能设计

### 14.1 服务端

- 2 MiB 默认限制使 Buffer 读取仍处于可控范围。
- 不在服务端做语法高亮和代码解析。
- S3 Client 复用单例连接。
- 读取和保存接口不缓存私人内容。
- 主应用继续保持单进程，不新增常驻后台任务。

### 14.2 浏览器

- 编辑器组件动态加载，避免增加登录页和文件列表首屏体积。
- 语言包根据扩展名动态导入。
- Markdown 预览使用防抖，例如停止输入 200 至 300 毫秒后更新。
- 大文件关闭实时 Markdown 预览和复杂语法检查。
- CSV 表格模式以后必须使用虚拟滚动。

## 15. 建议代码结构

```text
src/
├── app/
│   ├── edit/page.tsx
│   └── api/files/content/route.ts
├── components/
│   └── editor/
│       ├── file-editor.tsx
│       ├── code-editor.tsx
│       ├── editor-toolbar.tsx
│       ├── editor-status-bar.tsx
│       └── markdown-preview.tsx
└── lib/
    ├── editable-files.ts
    ├── text-encoding.ts
    ├── line-endings.ts
    └── editable-storage.ts
```

职责：

- `editable-files.ts`：唯一的格式白名单和语言映射。
- `text-encoding.ts`：UTF-8、BOM 和二进制检测。
- `line-endings.ts`：换行检测和保持策略。
- `editable-storage.ts`：Head、Get、Put 和 ETag 冲突控制。
- `file-editor.tsx`：页面状态和保存流程。
- `code-editor.tsx`：CodeMirror 生命周期及动态语言包。
- `markdown-preview.tsx`：只负责安全 Markdown 渲染。

## 16. 分阶段实施计划

### 阶段 0：数据基础

先完成：

- 文件列表返回真实大小、修改时间和 ETag。
- 文件列表分页，不再只显示前 100 个。
- 对象存储版本控制或保存前备份。
- 服务端统一的可编辑格式识别。

这是编辑功能的前置条件。

### 阶段 1：TXT 与通用代码文件

实现：

- 编辑按钮和编辑页面。
- UTF-8 文本读取与保存。
- CodeMirror 6。
- 语法高亮动态加载。
- 手动保存、快捷键、未保存提醒。
- ETag 冲突检测。

### 阶段 2：Markdown 和 JSON

实现：

- Markdown 安全预览。
- GFM 表格、任务列表和代码块。
- JSON / JSONC 语法提示。
- 主动格式化和无效 JSON 保存确认。

### 阶段 3：CSV / TSV

先完善文本模式，再决定是否需要表格模式。只有实际经常编辑 CSV 时，才引入表格解析和虚拟化组件。

### 阶段 4：体验增强

- 版本历史和恢复 UI。
- 可选自动保存。
- 编码选择。
- 编辑器主题、字体、Tab 宽度设置。
- 只读查看超出编辑上限的文本。

## 17. 测试计划

### 17.1 单元测试

- 扩展名和特殊文件名白名单。
- 大小限制。
- NUL 字节和二进制检测。
- UTF-8、UTF-8 BOM。
- LF、CRLF、混合换行。
- ETag 冲突。
- Markdown 危险链接和 HTML 净化。
- JSON 与 JSONC 校验策略。

### 17.2 API 集成测试

- 未登录读取返回 401。
- 跨来源保存返回 403。
- 非法 key 返回 400。
- 二进制文件返回 415。
- 超大文件返回 413。
- 过期 ETag 返回 409 且原文件不变。
- 保存失败时旧版本仍可下载。
- 成功保存返回新 ETag。

### 17.3 往返测试

测试文件至少包含：

- 中文、emoji、制表符和长行。
- UTF-8 BOM。
- LF 与 CRLF。
- 文件末尾有换行和无换行两种情况。
- Markdown 表格、代码块和恶意 HTML。
- JSON 转义字符和大整数。
- CSV 引号、逗号、中文和字段内换行。
- `.env` 中含有形似密钥的内容，确认日志和本地草稿不会记录。

测试标准是“未修改时保存后字节保持一致；主动修改时只改变预期内容”。

## 18. 验收标准

第一版完成需要同时满足：

1. 支持 TXT、MD、JSON 和约定的代码扩展名。
2. 只编辑文本，不执行任何上传内容。
3. 2 MiB 内 UTF-8 文件可以稳定打开和保存。
4. BOM、换行风格和文件末尾换行得到保留。
5. 两个页面同时修改时不会静默覆盖。
6. 保存失败不会丢失编辑器中的内容。
7. 每次覆盖都可以恢复旧版本。
8. Markdown 中的脚本、事件属性和危险链接无法执行。
9. 未登录用户不能读取或保存内容。
10. 移动端可以完成基本编辑和保存。

## 19. 推荐的第一版范围

为了尽快获得稳定价值，第一版建议控制在：

- 支持 `txt`、`md`、`markdown`、`json`、`jsonc`。
- 支持常用代码：`js`、`jsx`、`ts`、`tsx`、`html`、`css`、`py`、`java`、`kt`、`go`、`rs`、`sh`、`ps1`、`sql`、`yaml`、`yml`、`xml`、`toml`、`ini`、`properties`、`env`。
- 其他可识别纯文本先以无语法高亮模式打开。
- CSV/TSV 第一版只按文本编辑。
- 默认最大 2 MiB，仅支持 UTF-8。
- 手动保存，不做服务器自动保存。
- CodeMirror 语法高亮、搜索、快捷保存。
- Markdown 安全预览。
- ETag 冲突检查和对象版本恢复。

这套范围不改变当前轻量部署架构，也没有额外常驻服务成本。

## 20. 官方技术参考

- [CodeMirror 官方文档](https://codemirror.net/docs/)
- [CodeMirror language-data 语言映射](https://github.com/codemirror/language-data)
- [react-markdown 官方说明](https://github.com/remarkjs/react-markdown)
- [rehype-sanitize 官方说明](https://github.com/rehypejs/rehype-sanitize)
- [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)
- [AWS SDK for JavaScript S3 示例](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_s3_code_examples.html)

## 21. 后续知识库能力

文本编辑完成后，可以在同一批文件上继续建设分类、检索、关联和 AI 问答能力。知识库不会改变“代码只编辑、不执行”的安全边界。

详细方案见 [知识库功能实施方案](./KNOWLEDGE_BASE_IMPLEMENTATION_PLAN.md)。
