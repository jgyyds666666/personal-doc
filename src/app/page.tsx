"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface FileInfo {
  key: string;
  originalName: string;
  size: number;
  uploadTime: string;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "--";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getFileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const iconMap: Record<string, string> = {
    pdf: "📄",
    doc: "📝",
    docx: "📝",
    xls: "📊",
    xlsx: "📊",
    ppt: "📑",
    pptx: "📑",
    jpg: "🖼️",
    jpeg: "🖼️",
    png: "🖼️",
    gif: "🖼️",
    svg: "🖼️",
    mp4: "🎬",
    mov: "🎬",
    mp3: "🎵",
    wav: "🎵",
    zip: "📦",
    rar: "📦",
    "7z": "📦",
    txt: "📃",
    md: "📃",
    json: "📃",
  };
  return iconMap[ext] || "📄";
}

export default function Home() {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch("/api/files");
      const json = await res.json();
      if (json.success) {
        setFiles(json.data);
      }
    } catch {
      setError("Failed to load files");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleUpload = async (fileList: FileList | File[]) => {
    const fileArr = Array.from(fileList);
    if (fileArr.length === 0) return;

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    let completed = 0;
    for (const file of fileArr) {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/files/upload", {
          method: "POST",
          body: formData,
        });

        const json = await res.json();
        if (!json.success) {
          setError(`Upload failed: ${file.name}`);
        }
      } catch {
        setError(`Upload failed: ${file.name}`);
      }
      completed++;
      setUploadProgress(Math.round((completed / fileArr.length) * 100));
    }

    setUploading(false);
    setUploadProgress(0);
    await fetchFiles();
  };

  const handleDownload = async (file: FileInfo) => {
    try {
      const res = await fetch(
        `/api/files/download?key=${encodeURIComponent(file.key)}`
      );
      const json = await res.json();

      if (!json.success) {
        setError("Failed to get download URL");
        return;
      }

      // Use fetch + blob for cross-origin download
      const response = await fetch(json.data.downloadUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = file.originalName;
      link.click();
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      setError("Download failed");
    }
  };

  const handleDelete = async (key: string) => {
    setDeletingKey(key);
    try {
      const res = await fetch(
        `/api/files/delete?key=${encodeURIComponent(key)}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (json.success) {
        setFiles((prev) => prev.filter((f) => f.key !== key));
      }
    } catch {
      setError("Delete failed");
    } finally {
      setDeletingKey(null);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        handleUpload(e.dataTransfer.files);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <div className="mx-auto max-w-3xl px-6 py-12">
        {/* Header */}
        <header className="mb-10">
          <h1 className="text-2xl font-semibold text-[#111827]">
            File Vault
          </h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Upload, manage and download your documents
          </p>
        </header>

        {/* Upload Area */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            group relative cursor-pointer rounded-xl border-2 border-dashed
            p-10 text-center transition-all duration-200
            ${
              isDragging
                ? "border-[#3730A3] bg-[#3730A3]/5"
                : "border-[#E5E7EB] hover:border-[#3730A3]/40 hover:bg-[#3730A3]/[0.02]"
            }
            ${uploading ? "pointer-events-none opacity-60" : ""}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleUpload(e.target.files);
              e.target.value = "";
            }}
          />

          {uploading ? (
            <div className="space-y-3">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[#E5E7EB] border-t-[#3730A3]" />
              <div className="text-sm text-[#6B7280]">
                Uploading... {uploadProgress}%
              </div>
              <div className="mx-auto h-1.5 w-48 overflow-hidden rounded-full bg-[#E5E7EB]">
                <div
                  className="h-full rounded-full bg-[#3730A3] transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-3xl">
                <svg
                  className="mx-auto h-10 w-10 text-[#9CA3AF] transition-colors group-hover:text-[#3730A3]"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
                  />
                </svg>
              </div>
              <p className="text-sm text-[#374151]">
                <span className="font-medium text-[#3730A3]">Click to upload</span>{" "}
                or drag and drop
              </p>
              <p className="text-xs text-[#9CA3AF]">
                Max file size: 50MB
              </p>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 font-medium underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* File List */}
        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-medium text-[#111827]">
              Files
              {files.length > 0 && (
                <span className="ml-2 text-sm font-normal text-[#9CA3AF]">
                  ({files.length})
                </span>
              )}
            </h2>
            {files.length > 0 && (
              <button
                onClick={fetchFiles}
                className="text-xs text-[#6B7280] hover:text-[#3730A3] transition-colors"
              >
                Refresh
              </button>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-lg bg-[#F3F4F6]"
                />
              ))}
            </div>
          ) : files.length === 0 ? (
            <div className="rounded-lg border border-[#E5E7EB] bg-white py-16 text-center">
              <p className="text-sm text-[#9CA3AF]">
                No files yet. Upload your first document above.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((file, index) => (
                <div
                  key={file.key}
                  className="group flex items-center gap-4 rounded-lg border border-[#E5E7EB] bg-white px-4 py-3 transition-all hover:border-[#3730A3]/20 hover:shadow-sm"
                  style={{
                    animation: `fadeInUp 0.3s ease-out ${index * 0.05}s both`,
                  }}
                >
                  {/* File Icon */}
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F3F4F6] text-lg">
                    {getFileIcon(file.originalName)}
                  </span>

                  {/* File Info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#111827]">
                      {file.originalName}
                    </p>
                    <p className="text-xs text-[#9CA3AF]">
                      {formatFileSize(file.size)}
                      {file.uploadTime && (
                        <span className="ml-2">{formatTime(file.uploadTime)}</span>
                      )}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => handleDownload(file)}
                      className="rounded-md p-2 text-[#6B7280] transition-colors hover:bg-[#F3F4F6] hover:text-[#3730A3]"
                      title="Download"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(file.key)}
                      disabled={deletingKey === file.key}
                      className="rounded-md p-2 text-[#6B7280] transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                      title="Delete"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
