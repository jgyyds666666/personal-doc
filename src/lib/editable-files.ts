export const DEFAULT_MAX_EDITABLE_FILE_BYTES = 2 * 1024 * 1024;

export type EditableFileKind =
  | "plain-text"
  | "markdown"
  | "json"
  | "jsonc"
  | "csv"
  | "tsv"
  | "source-code"
  | "config"
  | "unsupported";

export interface EditableFileDetection {
  kind: EditableFileKind;
  language: string | null;
  editable: boolean;
  reason?: "unsupported-format" | "file-too-large";
}

interface EditableTypeDefinition {
  kind: Exclude<EditableFileKind, "unsupported">;
  language: string | null;
}

const EDITABLE_EXTENSIONS: Readonly<Record<string, EditableTypeDefinition>> = {
  txt: { kind: "plain-text", language: null },
  log: { kind: "plain-text", language: null },
  md: { kind: "markdown", language: "markdown" },
  markdown: { kind: "markdown", language: "markdown" },
  json: { kind: "json", language: "json" },
  jsonc: { kind: "jsonc", language: "json" },
  csv: { kind: "csv", language: null },
  tsv: { kind: "tsv", language: null },
  html: { kind: "source-code", language: "html" },
  htm: { kind: "source-code", language: "html" },
  css: { kind: "source-code", language: "css" },
  scss: { kind: "source-code", language: "scss" },
  less: { kind: "source-code", language: "less" },
  js: { kind: "source-code", language: "javascript" },
  jsx: { kind: "source-code", language: "jsx" },
  mjs: { kind: "source-code", language: "javascript" },
  cjs: { kind: "source-code", language: "javascript" },
  ts: { kind: "source-code", language: "typescript" },
  tsx: { kind: "source-code", language: "tsx" },
  py: { kind: "source-code", language: "python" },
  java: { kind: "source-code", language: "java" },
  kt: { kind: "source-code", language: "kotlin" },
  kts: { kind: "source-code", language: "kotlin" },
  c: { kind: "source-code", language: "c" },
  h: { kind: "source-code", language: "c" },
  cpp: { kind: "source-code", language: "cpp" },
  cc: { kind: "source-code", language: "cpp" },
  cxx: { kind: "source-code", language: "cpp" },
  hpp: { kind: "source-code", language: "cpp" },
  cs: { kind: "source-code", language: "csharp" },
  go: { kind: "source-code", language: "go" },
  rs: { kind: "source-code", language: "rust" },
  php: { kind: "source-code", language: "php" },
  rb: { kind: "source-code", language: "ruby" },
  sh: { kind: "source-code", language: "shell" },
  bash: { kind: "source-code", language: "shell" },
  zsh: { kind: "source-code", language: "shell" },
  ps1: { kind: "source-code", language: "powershell" },
  sql: { kind: "source-code", language: "sql" },
  vue: { kind: "source-code", language: "vue" },
  svelte: { kind: "source-code", language: "svelte" },
  dart: { kind: "source-code", language: "dart" },
  swift: { kind: "source-code", language: "swift" },
  gradle: { kind: "source-code", language: "groovy" },
  xml: { kind: "config", language: "xml" },
  yaml: { kind: "config", language: "yaml" },
  yml: { kind: "config", language: "yaml" },
  toml: { kind: "config", language: "toml" },
  ini: { kind: "config", language: "properties" },
  conf: { kind: "config", language: "properties" },
  properties: { kind: "config", language: "properties" },
  env: { kind: "config", language: "properties" },
};

const SPECIAL_FILE_NAMES: Readonly<Record<string, EditableTypeDefinition>> = {
  dockerfile: { kind: "source-code", language: "dockerfile" },
  makefile: { kind: "source-code", language: "makefile" },
  ".gitignore": { kind: "config", language: null },
  ".gitattributes": { kind: "config", language: null },
  ".editorconfig": { kind: "config", language: "properties" },
};

function getFileNameExtension(fileName: string): string {
  const baseName = fileName.toLowerCase();
  if (baseName.startsWith(".env.")) {
    return "env";
  }
  const separatorIndex = baseName.lastIndexOf(".");
  return separatorIndex >= 0 ? baseName.slice(separatorIndex + 1) : "";
}

export function detectEditableFile(
  fileName: string,
  sizeBytes: number,
  maxBytes: number = DEFAULT_MAX_EDITABLE_FILE_BYTES,
): EditableFileDetection {
  const baseName = fileName.trim().toLowerCase();
  const definition =
    SPECIAL_FILE_NAMES[baseName] ??
    EDITABLE_EXTENSIONS[getFileNameExtension(baseName)];

  if (!definition) {
    return {
      kind: "unsupported",
      language: null,
      editable: false,
      reason: "unsupported-format",
    };
  }

  if (sizeBytes > maxBytes) {
    return {
      ...definition,
      editable: false,
      reason: "file-too-large",
    };
  }

  return { ...definition, editable: true };
}
