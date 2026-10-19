"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Eye, Save, SplitSquareHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeEditor } from "@/components/editor/code-editor";
import { MarkdownPreview } from "@/components/editor/markdown-preview";

type ViewMode = "edit" | "split" | "preview";

interface EditableFileData {
  key: string;
  originalName: string;
  content: string;
  kind: string;
  language: string | null;
  encoding: "utf-8";
  hasBom: boolean;
  lineEnding: "lf" | "crlf" | "mixed" | "none";
  hasFinalNewline: boolean;
  size: number;
  etag: string;
  lastModified: string;
}

interface ApiError {
  error?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function FileEditor({ storageKey }: { storageKey: string }) {
  const router = useRouter();
  const [file, setFile] = useState<EditableFileData | null>(null);
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("edit");

  const dirty = content !== savedContent;
  const isMarkdown = file?.kind === "markdown";

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(
          `/api/files/content?key=${encodeURIComponent(storageKey)}`,
          { cache: "no-store" },
        );
        if (response.status === 401) {
          window.location.assign("/login");
          return;
        }
        const result = (await response.json()) as {
          success?: boolean;
          data?: EditableFileData;
          error?: string;
        };
        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.error ?? "无法打开文件");
        }
        if (!cancelled) {
          setFile(result.data);
          setContent(result.data.content);
          setSavedContent(result.data.content);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "无法打开文件",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  const save = useCallback(async () => {
    if (!file || saving || !dirty) {
      return;
    }
    if (file.kind === "json") {
      try {
        JSON.parse(content);
      } catch {
        if (!window.confirm("JSON 语法无效，仍然保存当前草稿吗？")) {
          return;
        }
      }
    }
    const snapshot = content;
    setSaving(true);
    setError(null);
    setSaveMessage(null);
    try {
      const response = await fetch("/api/files/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: file.key,
          content: snapshot,
          baseEtag: file.etag,
          encoding: file.encoding,
          hasBom: file.hasBom,
          lineEnding: file.lineEnding,
        }),
      });
      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }
      const result = (await response.json()) as {
        success?: boolean;
        data?: { etag: string; size: number; lastModified: string };
        error?: string;
      };
      if (!response.ok || !result.success || !result.data) {
        if (response.status === 409) {
          throw new Error(
            result.error ?? "版本冲突：文件已在其他页面被修改",
          );
        }
        throw new Error(result.error ?? "保存失败");
      }
      setFile((current) =>
        current
          ? {
              ...current,
              etag: result.data?.etag ?? current.etag,
              size: result.data?.size ?? current.size,
              lastModified:
                result.data?.lastModified ?? current.lastModified,
            }
          : current,
      );
      setSavedContent(snapshot);
      setSaveMessage("已保存");
    } catch (saveError) {
      const apiError = saveError as ApiError | Error;
      setError(
        apiError instanceof Error
          ? apiError.message
          : apiError.error ?? "保存失败",
      );
    } finally {
      setSaving(false);
    }
  }, [content, dirty, file, saving]);

  const goBack = () => {
    if (dirty && !window.confirm("当前修改尚未保存，确定离开吗？")) {
      return;
    }
    router.push("/");
  };

  const editorKey = useMemo(
    () => `${file?.key ?? storageKey}:${file?.etag ?? "loading"}`,
    [file?.etag, file?.key, storageKey],
  );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">正在加载文件…</p>
      </main>
    );
  }

  if (!file) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="max-w-md rounded-xl border bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-red-600">{error ?? "无法打开文件"}</p>
          <Button className="mt-4" variant="outline" onClick={goBack}>
            返回文件库
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-screen min-h-0 flex-col bg-slate-50">
      <header className="flex flex-wrap items-center gap-3 border-b bg-white px-4 py-3">
        <Button type="button" variant="ghost" size="sm" onClick={goBack}>
          <ArrowLeft className="size-4" />
          返回
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-medium text-slate-900">
            {file.originalName}
          </h1>
          <p className="text-xs text-slate-500">
            {file.language ?? "纯文本"} · {file.encoding.toUpperCase()} ·{" "}
            {file.lineEnding.toUpperCase()} · {formatBytes(file.size)}
          </p>
        </div>

        {isMarkdown && (
          <div className="flex rounded-lg border bg-slate-50 p-1">
            <Button
              type="button"
              variant={viewMode === "edit" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("edit")}
            >
              编辑
            </Button>
            <Button
              type="button"
              variant={viewMode === "split" ? "secondary" : "ghost"}
              size="sm"
              className="hidden sm:inline-flex"
              onClick={() => setViewMode("split")}
            >
              <SplitSquareHorizontal className="size-4" />
              分栏
            </Button>
            <Button
              type="button"
              variant={viewMode === "preview" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("preview")}
            >
              <Eye className="size-4" />
              预览
            </Button>
          </div>
        )}

        <Button type="button" size="sm" disabled={!dirty || saving} onClick={save}>
          {saving ? (
            "保存中…"
          ) : dirty ? (
            <>
              <Save className="size-4" />
              保存
            </>
          ) : (
            <>
              <Check className="size-4" />
              已保存
            </>
          )}
        </Button>
      </header>

      {(error || saveMessage || file.lineEnding === "mixed") && (
        <div className="border-b bg-white px-4 py-2 text-sm">
          {error && <p className="text-red-600">{error}</p>}
          {!error && saveMessage && (
            <p className="text-emerald-700">{saveMessage}</p>
          )}
          {file.lineEnding === "mixed" && (
            <p className="text-amber-700">
              文件包含混合换行；保存后将统一使用 LF。
            </p>
          )}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden sm:grid-cols-2">
        {viewMode !== "preview" && (
          <section
            className={
              viewMode === "split"
                ? "min-h-0 border-r bg-white"
                : "col-span-full min-h-0 bg-white"
            }
          >
            <CodeEditor
              key={editorKey}
              initialValue={content}
              fileName={file.originalName}
              onChange={(value) => {
                setContent(value);
                setSaveMessage(null);
              }}
              onSave={() => void save()}
            />
          </section>
        )}
        {isMarkdown && viewMode !== "edit" && (
          <section
            className={
              viewMode === "split" ? "min-h-0" : "col-span-full min-h-0"
            }
          >
            <MarkdownPreview content={content} />
          </section>
        )}
      </div>
    </main>
  );
}
