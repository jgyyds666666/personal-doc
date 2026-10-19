# 个人知识库功能实施方案

> 项目：personal-doc 私人文档库
>
> 文档状态：方案分析，尚未实施
>
> 编写日期：2026-10-19
>
> 前置文档：[纯文本与代码文件在线编辑方案](./TEXT_AND_CODE_FILE_EDITOR_PLAN.md)
> 当前部署：单用户、低并发、Next.js 单进程、1 核 2 GB、S3 兼容对象存储

## 1. 目标

在现有私人文件库和文本编辑功能之上，逐步增加一个真正可用的个人知识库。

知识库分为两个层次：

1. **基础知识库**：目录、标签、收藏、关联、全文搜索、版本、索引状态和内容定位；不依赖 AI。
2. **智能知识库**：语义搜索、相似内容、摘要和带来源引用的 AI 问答；作为可选增强能力。

基础知识库必须在没有任何 AI Key、AI 服务不可用或额度耗尽时继续正常工作。AI 不应成为打开、编辑、搜索和下载私人文件的前置条件。

## 2. 当前范围

第一阶段只索引前一份方案中的文本类文件：

- TXT、LOG。
- Markdown。
- JSON、JSONC。
- CSV、TSV。
- 常见编程语言代码。
- YAML、TOML、INI、XML、properties、普通配置文件。

暂不处理：

- Office 文档。
- PDF 正文抽取。
- 图片 OCR。
- 音视频转写。
- 网站抓取。
- 邮件、微信、Notion、Google Drive 等外部连接器。
- 多人共享和权限协作。

这些来源以后可以通过统一的“内容抽取接口”扩展，但不应阻塞第一版。

## 3. 可行性结论

可以实现，并且适合沿用当前 Next.js + S3 架构。

需要新增的核心组件只有一个持久化数据库，用来保存：

- 文件稳定 ID 与对象 key 的映射。
- 标题、目录、标签、收藏、备注等知识库元数据。
- 文件内容哈希和索引状态。
- 可检索文本分块。
- 可选向量 embedding。
- 重建、失败和重试任务状态。

S3 继续作为原文件的唯一事实来源；数据库中的分块和向量属于可重建索引。数据库损坏后可以从 S3 重新生成索引，但目录、标签、备注等人工数据必须单独备份。

## 4. 不建议的做法

### 4.1 直接遍历 S3 做每次搜索

每次搜索都列出所有对象、下载所有文件再匹配，会导致响应慢、S3 请求多，也无法高质量排序。只能用于一次性重建索引，不能作为日常搜索架构。

### 4.2 一开始只做向量搜索

纯向量搜索不擅长：

- 精确文件名。
- 代码符号和变量名。
- 错误码、版本号、IP、URL。
- 中文短词或英文缩写。
- 用户明确输入的完整短语。

个人文档和代码知识库应采用关键词搜索为基础，以后叠加向量搜索。

### 4.3 把 AI 结果当成事实

AI 回答必须展示来源文件和行号。没有足够来源时应回答“未找到可靠依据”，不能根据模型记忆补全私人资料。

### 4.4 在 1 核 2 GB 服务器运行本地大模型

当前服务器适合文件管理、索引调度和普通搜索，不适合运行本地大语言模型或大规模 embedding 模型。AI 阶段应使用外部 API 或独立计算服务。

### 4.5 把索引任务放在不可靠的进程内后台运行

在请求响应后通过未持久化 Promise 继续处理，进程重启后任务会丢失。索引任务必须在数据库中有状态，能够重试和恢复。

## 5. 推荐总体架构

```text
                         ┌──────────────────────┐
                         │       浏览器          │
                         │ 文件、编辑、搜索、问答 │
                         └──────────┬───────────┘
                                    │
                                    v
                         ┌──────────────────────┐
                         │      Next.js          │
                         │ 登录 / API / 索引调度  │
                         └──────┬────────┬──────┘
                                │        │
                    原文件读写   │        │ 元数据、分块、检索
                                v        v
                         ┌──────────┐  ┌──────────────┐
                         │ S3 对象库 │  │ 持久化数据库  │
                         │ 原文件版本 │  │ 元数据与索引   │
                         └──────────┘  └──────┬───────┘
                                              │ 可选
                                              v
                                       ┌──────────────┐
                                       │ Embedding /  │
                                       │ AI API       │
                                       └──────────────┘
```

职责划分：

- **S3**：保存原始文件和历史版本。
- **数据库**：保存知识库元数据、可重建文本索引、可选向量和任务状态。
- **Next.js**：身份验证、业务 API、文本抽取、搜索编排、AI 调用和来源校验。
- **浏览器**：文件管理、编辑、检索和问答界面，不接触数据库服务密钥或 AI Key。

## 6. 数据库选择

### 6.1 方案对比

| 方案 | 适用条件 | 优点 | 风险 |
| --- | --- | --- | --- |
| 本地 SQLite + FTS5 | 服务器有可靠持久卷、永远单实例 | 最轻量、成本低 | GUI/容器重建可能丢盘；向量能力和远程备份需额外处理 |
| 外部 PostgreSQL | 当前部署无可靠持久卷或以后需要 AI | 稳定、全文搜索、pg_trgm、pgvector、备份成熟 | 多一个外部服务，需要连接和额度管理 |
| Supabase Postgres | 希望图形化管理和托管数据库 | Postgres、扩展、控制台、pgvector | 免费额度和休眠策略可能变化，需上线时核对 |
| Cloudflare D1 | 整个应用运行在 Workers 体系 | 托管 SQLite、轻量 | 当前 Next.js 服务架构不一定匹配；无原生 pgvector 路线 |
| 只用 S3 | 不建议 | 无数据库成本 | 搜索和元数据一致性差，无法扩展 |

### 6.2 当前推荐

如果当前线上部署平台不能明确保证本地磁盘永久存在，推荐使用外部 PostgreSQL；需要图形化管理时可以考虑 Supabase Postgres。

原因：

- 基础阶段可以使用普通表、GIN 索引和 `pg_trgm`。
- AI 阶段可以启用 pgvector，无需迁移到另一套向量数据库。
- 小型个人知识库可以放在一个数据库中，不需要单独部署 Elasticsearch、Meilisearch 或 Pinecone。
- Supabase 官方支持在 Postgres 中使用 pgvector 存储和检索向量，也支持普通关键词和混合搜索方案。

只有确认当前服务器拥有可靠持久卷、固定单实例和可执行数据库备份时，才优先考虑本地 SQLite。

### 6.3 当前依赖不代表已经配置数据库

项目 `package.json` 中已经存在 Supabase、Drizzle 和 PostgreSQL 相关依赖，但这只能说明包已安装，不能证明线上数据库、表、密钥和备份已经配置。

实施时仍需要：

- 确认数据库提供商。
- 创建迁移文件。
- 配置服务端连接变量。
- 执行真实读写验证。
- 配置备份与恢复。

## 7. 核心数据模型

### 7.1 文档表 `kb_documents`

```text
id                  uuid primary key
storage_key         text unique not null
original_name       text not null
title               text not null
extension           text
mime_type           text
editable_kind       text
size_bytes          bigint
etag                text
storage_version_id  text
content_hash        text
encoding            text
line_ending         text
folder_id           uuid nullable
summary             text nullable
notes               text nullable
is_favorite         boolean default false
is_archived         boolean default false
ai_indexable        boolean default false
index_status        text
index_error          text nullable
indexed_hash        text nullable
indexed_at          timestamptz nullable
created_at          timestamptz
updated_at          timestamptz
deleted_at          timestamptz nullable
```

建议的 `index_status`：

- `not_indexed`。
- `pending`。
- `processing`。
- `ready`。
- `failed`。
- `excluded`。

### 7.2 目录表 `kb_folders`

```text
id          uuid primary key
parent_id   uuid nullable
name        text not null
sort_order  integer
created_at  timestamptz
updated_at  timestamptz
```

第一版目录只承担逻辑分类，不修改 S3 对象 key。移动目录只更新数据库，避免昂贵且容易失败的 S3 Copy + Delete。

### 7.3 标签表

```text
kb_tags
  id
  name
  normalized_name
  color
  created_at

kb_document_tags
  document_id
  tag_id
  created_at
```

`normalized_name` 用于避免“Next.js”“next.js”和多余空格形成重复标签。显示名称仍保留用户输入形式。

### 7.4 文本分块表 `kb_chunks`

```text
id                uuid primary key
document_id       uuid not null
ordinal           integer not null
heading_path      text nullable
symbol_name       text nullable
start_line        integer nullable
end_line          integer nullable
content           text not null
content_hash      text not null
token_estimate    integer
metadata          jsonb
embedding         vector nullable
embedding_model   text nullable
created_at        timestamptz
updated_at        timestamptz
```

约束：`document_id + ordinal + content_hash` 应具有足够的唯一性，重复索引不能无限插入相同分块。

### 7.5 索引任务表 `kb_index_jobs`

```text
id             uuid primary key
document_id    uuid not null
content_hash   text not null
job_type       text
status         text
attempts       integer
next_run_at    timestamptz
locked_at      timestamptz nullable
last_error     text nullable
created_at     timestamptz
updated_at     timestamptz
```

任务状态需要支持：待执行、处理中、成功、失败、等待重试和取消。

## 8. 文件与数据库一致性

S3 原文件和数据库元数据不可能通过一个普通事务同时提交，因此需要明确一致性策略。

### 8.1 上传

1. 文件先成功写入 S3。
2. 计算或记录对象 ETag、版本 ID 和内容哈希。
3. 写入 `kb_documents`。
4. 创建 `pending` 索引任务。
5. 如果数据库写入失败，记录可恢复日志；后续通过“扫描未登记对象”补偿。

### 8.2 编辑保存

1. 使用 ETag 检查编辑冲突。
2. 写入新的 S3 对象版本。
3. 更新文档元数据和内容哈希。
4. 将旧索引标记为过期。
5. 创建只针对新内容哈希的索引任务。

### 8.3 删除

1. 数据库标记 `deleted_at` 或进入回收站。
2. S3 保留对象版本或移动到回收站策略。
3. 日常搜索排除已删除文档。
4. 生命周期到期后再清理对象和索引。

### 8.4 对账

提供管理员“存储对账”功能：

- S3 有对象、数据库无记录。
- 数据库有记录、S3 对象不存在。
- ETag 或内容哈希不一致。
- 索引哈希落后于当前内容哈希。

对账应只生成报告或待修复任务，不应未经确认自动永久删除数据。

## 9. 内容抽取

第一阶段所有目标格式本身都是文本，不需要复杂解析器。

统一抽取结果：

```ts
interface ExtractedKnowledgeDocument {
  title: string;
  text: string;
  language: string | null;
  encoding: "utf-8";
  contentHash: string;
  structure: Array<{
    type: "heading" | "symbol" | "section" | "row-group";
    label: string | null;
    startLine: number;
    endLine: number;
  }>;
}
```

规则：

- TXT：按段落和行范围。
- Markdown：按标题层级和段落；代码块保持整体。
- JSON：按顶级 key 或 JSON Pointer 分组。
- CSV/TSV：重复表头并按若干行分组。
- 代码：第一版按行窗口和空行边界；后续再按函数、类、方法等语法节点切分。
- YAML/TOML/INI：按顶级 section 或 key 分组。

不要在抽取阶段执行宏、模板、脚本或配置文件中的表达式。

## 10. 分块策略

分块既影响关键词搜索片段，也影响未来 AI 检索质量。

### 10.1 第一版原则

- 优先保持语义结构，不机械固定每 N 个字符切断。
- 单块应带文件 ID、标题、格式、标题路径和行号。
- 相邻块可以少量重叠，避免上下文在边界丢失。
- 超长段落和压缩 JSON 才退化到字符或 token 窗口。
- 空白、纯符号和过短块不进入 AI embedding。

### 10.2 各格式建议

| 格式 | 优先边界 | 备注 |
| --- | --- | --- |
| Markdown | 标题、段落、代码块 | 保存标题路径 |
| TXT | 段落、空行 | 保留行号 |
| JSON | 顶级 key / JSON Pointer | 不把一个小对象拆散 |
| CSV | 表头 + 行组 | 每块重复表头 |
| 代码 | 函数、类；首版可用行窗口 | 保存语言、符号名 |
| 配置 | section、顶级 key | 敏感文件默认不做 AI 索引 |

分块参数必须可配置，并保存 `chunker_version`。修改切分算法后，可以识别哪些文档需要重建。

## 11. 基础搜索

### 11.1 必须先实现的搜索

- 文件名和标题精确匹配。
- 文件名、标题、标签前缀匹配。
- 内容关键词匹配。
- 文件类型、目录、标签和时间筛选。
- 搜索结果高亮。
- 点击结果跳转到编辑器对应行。

### 11.2 中文和代码搜索

PostgreSQL 内置全文搜索对英文词形处理成熟，但中文分词和代码符号需要额外设计。

个人知识库第一版建议组合：

1. 标题、文件名和标签使用标准索引及精确/前缀查询。
2. 内容使用 `pg_trgm` 的 GIN/GiST 索引支持子串和相似匹配。
3. 英文自然语言内容可以增加 `tsvector` 全文索引。
4. 代码搜索保留原符号，不做英文词干化。

PostgreSQL 官方说明 `pg_trgm` 基于连续三个字符计算相似度，并支持索引加速相似字符串搜索，适合补足中文子串、拼写误差和代码片段检索。

### 11.3 排序建议

搜索结果综合评分：

1. 文件名完全匹配。
2. 标题完全匹配。
3. 标签完全匹配。
4. 文件名或标题前缀匹配。
5. 内容关键词和短语匹配。
6. trigram 相似度。
7. 收藏和最近编辑给予很小加权。

不要让“最近编辑”压过明显更准确的结果。

## 12. 知识组织功能

### 12.1 第一版

- 逻辑目录。
- 多标签。
- 收藏。
- 归档。
- 文档备注。
- 最近编辑。
- 无标签、未索引、索引失败等智能筛选。

### 12.2 第二版

- Markdown `[[双向链接]]`。
- 出链和反向链接。
- 相关文档推荐。
- 保存的搜索条件。
- 每日回顾或最近更新视图。

### 12.3 不建议第一版做知识图谱

图数据库和自动实体关系抽取会增加复杂度。对单用户知识库，目录、标签、双向链接和相关文档已经能覆盖大部分整理需求。

## 13. 索引任务设计

### 13.1 触发时机

- 上传成功。
- 编辑保存成功。
- 恢复历史版本。
- 用户修改“允许 AI 索引”。
- 索引算法或 embedding 模型升级。
- 用户手动请求重建。

### 13.2 执行方式

第一版可以采用数据库任务表 + 受保护的处理接口：

```text
POST /api/internal/index/run
Authorization: Bearer <INDEXER_SECRET>
```

由以下任意方式触发：

- 部署平台 Cron。
- 服务器 systemd timer。
- 管理员页面手动执行。

处理器每次只领取少量任务，设置锁和超时，避免 1 核 2 GB 环境被长任务占满。

### 13.3 幂等性

- 同一 `document_id + content_hash + indexer_version` 只能有一个有效结果。
- 重试前删除或替换同版本临时分块。
- 新内容保存后，旧任务即使后来完成，也不能覆盖新内容的索引状态。
- 任务锁超时后允许重新领取。

## 14. API 设计建议

### 14.1 元数据

```text
GET    /api/knowledge/documents
GET    /api/knowledge/documents/:id
PATCH  /api/knowledge/documents/:id
POST   /api/knowledge/documents/:id/reindex
GET    /api/knowledge/documents/:id/versions
```

### 14.2 目录和标签

```text
GET/POST/PATCH/DELETE /api/knowledge/folders
GET/POST/PATCH/DELETE /api/knowledge/tags
```

删除目录不应默认删除文件；应先将文档移到“未分类”或要求用户明确选择。

### 14.3 搜索

```text
GET /api/knowledge/search?q=&folder=&tag=&type=&cursor=
```

返回：

- 文档 ID、标题、文件名、格式。
- 命中片段。
- 行号和标题路径。
- 匹配类型和基础得分。
- 用于下一页的游标。

不向前端暴露 embedding 或数据库内部 SQL 排名细节。

### 14.4 索引状态

```text
GET  /api/knowledge/index/status
POST /api/knowledge/index/rebuild
POST /api/internal/index/run
```

所有业务接口要求管理员登录；变更接口要求同源检查。内部索引接口使用独立高强度 secret，并限制来源或只绑定内网。

## 15. 前端页面设计

### 15.1 首页升级

```text
┌──────────────┬─────────────────────────────────────┐
│ 全部文档       │ 搜索框              筛选   新建/上传  │
│ 收藏           ├─────────────────────────────────────┤
│ 最近编辑       │ 文件卡片 / 表格                       │
│ 未分类         │ 标题、摘要、标签、格式、更新时间        │
│ 索引失败       │                                     │
│               │                                     │
│ 目录           │                                     │
│ 标签           │                                     │
└──────────────┴─────────────────────────────────────┘
```

### 15.2 搜索结果

- 左侧保留目录和标签筛选。
- 结果显示文件名、命中片段、标题路径和行号。
- 点击直接打开 `/edit?key=...&line=...`。
- 未索引或索引过期的文档显示状态，不假装已经可搜索。

### 15.3 文档详情

- 文件元数据。
- 标签和目录。
- 备注。
- 历史版本。
- 出链和反向链接。
- 索引状态、最后索引时间和失败原因。
- 是否允许发送到外部 AI 服务。

## 16. AI 与 RAG 可选阶段

### 16.1 能力范围

- 语义搜索：词语不同但含义接近也能找到。
- 相似文档和相关段落。
- 基于选定文档生成摘要。
- 对知识库提问，并给出文件和行号来源。

### 16.2 不应与基础搜索绑定

建议环境开关：

```text
AI_ENABLED=false
EMBEDDING_PROVIDER=
EMBEDDING_MODEL=
EMBEDDING_DIMENSIONS=
AI_CHAT_PROVIDER=
AI_CHAT_MODEL=
AI_API_KEY=
```

AI Key 只能保存在服务端 Secret 中，不能进入浏览器、数据库普通字段、日志或 Git。

聊天模型和 embedding 模型可以来自不同服务。不要默认一个提供商同时具备合适的对话模型和向量模型。

### 16.3 向量存储

如果选择 PostgreSQL/Supabase，可使用 pgvector：

- embedding 维度必须与模型输出一致。
- 所有参与相似度比较的向量必须来自同一模型和同一版本。
- 保存 `embedding_model`、维度和生成时间。
- 模型切换后创建新索引版本，不要把不同模型的向量混在同一查询中。
- 数据量较小时可以先顺序扫描；增长后再评估 HNSW 索引。

Supabase 官方资料说明 pgvector 可以在 Postgres 中保存 embedding，并通过欧氏距离、内积或余弦距离进行相似度查询；官方当前通常推荐 HNSW 用于变化中的数据集，但个人小库不必过早优化。

### 16.4 混合检索

推荐查询流程：

1. 对问题生成 embedding。
2. 执行关键词/子串搜索。
3. 执行向量相似度搜索。
4. 合并并去重结果。
5. 标题、文件名、标签和代码精确匹配优先。
6. 选择少量高质量分块交给聊天模型。
7. 生成答案并附来源。

不要只按向量相似度排序。

### 16.5 回答必须带来源

每个引用至少包含：

- 文档标题。
- 原文件名。
- 标题路径或代码符号。
- 开始和结束行号。
- 打开原文的链接。

示例：

```text
依据：部署说明 > 环境变量，第 42-58 行
```

如果相关分块得分不足、互相矛盾或没有覆盖问题，应明确提示，而不是凭模型常识补写私人事实。

## 17. AI 安全与隐私

### 17.1 默认不发送敏感文件

以下文件默认设置 `ai_indexable=false`：

- `.env` 和环境配置。
- 私钥、证书、Token 和 credentials 文件。
- 文件名包含 `secret`、`password`、`credential`、`private-key` 等明显敏感词。
- 用户手动标记为“禁止外发”的目录。

基础本地关键词索引与发送到第三方 AI 是两件事，UI 必须分别说明。

### 17.2 文档内容属于不可信输入

文件内可能出现“忽略之前指令”“读取其他文件”等提示注入文本。RAG 系统必须：

- 把检索内容作为引用资料，不作为系统指令。
- 不让模型调用任意文件读取、Shell、网络或数据库工具。
- 只把已经通过权限过滤的少量分块发给模型。
- 不执行模型输出中的代码或链接。
- 不把隐藏系统提示、密钥和其他未检索文档发给模型。

### 17.3 日志

默认不记录完整问题、完整回答和原始分块。若为了调试临时记录，应明确开关、脱敏和自动过期时间。

## 18. AI 问答 API

```text
POST /api/knowledge/ask
```

请求：

```json
{
  "question": "生产环境如何配置管理员密码？",
  "folderId": null,
  "tagIds": [],
  "documentIds": []
}
```

响应建议使用流式事件：

- `retrieval`：返回命中的来源概要。
- `answer_delta`：逐步返回答案。
- `citation`：返回结构化引用。
- `done`：完成及 token/费用摘要。
- `error`：可恢复错误。

服务端在发起 AI 请求前再次校验 Session 和文档权限，不能相信前端传入的 document ID 列表。

## 19. 备份与恢复

知识库完成后需要同时保护两类数据。

### 19.1 S3

- 对象版本控制。
- 回收站生命周期。
- 定期导出或复制到第二位置。
- 恢复抽查。

### 19.2 数据库

- 每日数据库备份。
- 定期导出目录、标签、备注和文档 ID 映射。
- 向量和分块可重建，但人工元数据不能只依赖重建。
- 至少执行一次从空数据库恢复并重建索引的演练。

### 19.3 可移植导出

提供一个不依赖数据库厂商的导出包：

```text
knowledge-export.json
files-manifest.json
tags.json
folders.json
links.json
```

导出文件不包含数据库密码、AI Key 或临时签名 URL。

## 20. 可观测性

至少记录以下指标，不记录正文：

- 文档总数、已索引数、待处理数、失败数。
- 每次索引耗时和分块数。
- S3 读取失败率。
- 搜索请求耗时和结果数。
- AI 请求次数、失败率和估算费用。
- callback/cron 最后成功时间。

索引失败必须在管理页面可见，并允许针对单个文档重试。

## 21. 分阶段实施路线

### 阶段 0：编辑与数据基础

前置条件：

- 稳定文件 ID。
- 真实文件元数据、ETag 和分页。
- 文本读取与保存。
- 版本冲突检测。
- 对象历史版本。

### 阶段 1：元数据知识库

实现：

- 数据库和迁移。
- 文档元数据同步。
- 逻辑目录、标签、收藏、备注和归档。
- 存储对账。

此阶段没有全文内容索引，也应可以正常管理知识。

### 阶段 2：关键词搜索

实现：

- 文本抽取和分块。
- 持久化索引任务。
- 文件名、标题、标签和内容搜索。
- 中文/代码子串检索。
- 高亮片段和行号跳转。

这是最应该优先交付的知识库核心。

### 阶段 3：链接和版本体验

实现：

- Markdown 双向链接。
- 出链、反向链接。
- 历史版本 UI。
- 相关文档的非 AI 推荐。
- 可移植导出和恢复流程。

### 阶段 4：语义检索

在用户明确允许文档发送给 embedding 服务后：

- 启用 pgvector。
- 配置 embedding provider。
- 对允许的文档生成向量。
- 实现混合搜索。
- 增加模型切换后的重建机制。

### 阶段 5：AI 问答

最后实现：

- 带引用的问答。
- 文件/目录/标签范围限定。
- 低置信度拒答。
- 使用量和费用限制。
- 提示注入测试和敏感文件排除。

## 22. 验收标准

### 基础知识库

1. 文件编辑或上传后能够可靠进入索引队列。
2. 相同内容不会重复生成无限分块。
3. 中文短语、代码符号、文件名和标签都能搜索。
4. 结果能跳转到准确文件和行号。
5. 修改文件后旧索引不会继续作为最新结果。
6. 删除进入回收站后不出现在默认搜索中。
7. 数据库索引可以从 S3 重建。
8. 目录、标签和备注可以从备份恢复。

### AI 知识库

1. AI 关闭时基础知识库不受影响。
2. 未允许 AI 索引的文件不会发送给外部服务。
3. 回答包含结构化来源和原文跳转。
4. 没有来源时不编造私人知识。
5. 模型切换不会混用旧 embedding。
6. 文档中的提示注入不能获得额外文件或系统权限。
7. 可以查看调用失败和估算使用量。

## 23. 推荐的实际落地顺序

结合当前项目状态，推荐按以下顺序推进：

1. 完成真实元数据、分页和对象版本控制。
2. 实现文本与代码文件编辑。
3. 确认线上平台是否有可靠持久卷；没有则准备外部 PostgreSQL。
4. 实现目录、标签、收藏和备注。
5. 实现关键词、中文子串和代码符号搜索。
6. 实现分块、行号定位和索引任务重试。
7. 使用一段时间，确认实际搜索痛点。
8. 确实需要“按含义搜索”时再接入 embedding 和 pgvector。
9. 最后再实现带来源引用的 AI 问答。

这一路线避免一次性构建一个昂贵且难验证的 RAG 系统，同时确保每个阶段都能独立产生价值。

## 24. 开始实现前需要确认

1. 当前线上平台是否提供永久持久卷。
2. 是否已经有 Supabase/PostgreSQL 项目可用。
3. 知识库是否只供当前管理员使用。
4. 第一版是否需要目录和标签同时存在。
5. CSV 内容是否需要进入全文搜索。
6. `.env` 和配置文件是否允许进入基础关键词索引。
7. 是否允许任何文档内容发送给第三方 AI。
8. 如果允许，哪些目录和格式必须排除。
9. AI Key 的提供商、预算和每日调用上限。

在这些配置未确认前，可以先实施阶段 0 到阶段 2 的本地业务功能，但不能声称 AI、向量库或云数据库已经配置完成。

## 25. 官方参考资料

- [Supabase AI 与向量能力](https://supabase.com/docs/guides/ai)
- [Supabase pgvector 向量列](https://supabase.com/docs/guides/ai/vector-columns)
- [Supabase 语义搜索](https://supabase.com/docs/guides/ai/semantic-search)
- [Supabase 向量索引](https://supabase.com/docs/guides/ai/vector-indexes)
- [Supabase PostgreSQL 全文搜索](https://supabase.com/docs/guides/database/full-text-search)
- [PostgreSQL pg_trgm](https://www.postgresql.org/docs/current/pgtrgm.html)
- [pgvector 官方仓库](https://github.com/pgvector/pgvector)
