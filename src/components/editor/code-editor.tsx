"use client";

import { useEffect, useRef } from "react";
import { basicSetup } from "codemirror";
import { indentWithTab } from "@codemirror/commands";
import { jsonParseLinter } from "@codemirror/lang-json";
import { LanguageDescription } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { linter } from "@codemirror/lint";
import { Compartment, EditorState, Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";

interface CodeEditorProps {
  initialValue: string;
  fileName: string;
  onChange: (value: string) => void;
  onSave: () => void;
}

export function CodeEditor({
  initialValue,
  fileName,
  onChange,
  onSave,
}: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const initialValueRef = useRef(initialValue);
  const initialFileNameRef = useRef(fileName);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  const languageCompartmentRef = useRef<Compartment | null>(null);

  if (languageCompartmentRef.current === null) {
    languageCompartmentRef.current = new Compartment();
  }

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    const host = hostRef.current;
    const languageCompartment = languageCompartmentRef.current;
    if (!host || !languageCompartment) {
      return;
    }

    const state = EditorState.create({
      doc: initialValueRef.current,
      extensions: [
        basicSetup,
        languageCompartment.of([]),
        ...(initialFileNameRef.current.toLowerCase().endsWith(".json")
          ? [linter(jsonParseLinter())]
          : []),
        EditorView.lineWrapping,
        EditorView.editorAttributes.of({
          "aria-label": `${initialFileNameRef.current} 文本编辑器`,
        }),
        EditorView.theme({
          "&": { height: "100%", fontSize: "14px" },
          ".cm-scroller": {
            overflow: "auto",
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          },
          ".cm-content": { padding: "16px 0" },
          ".cm-gutters": {
            backgroundColor: "#F9FAFB",
            borderRight: "1px solid #E5E7EB",
          },
          "&.cm-focused": { outline: "none" },
        }),
        Prec.high(
          keymap.of([
            indentWithTab,
            {
              key: "Mod-s",
              preventDefault: true,
              run: () => {
                onSaveRef.current();
                return true;
              },
            },
          ]),
        ),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
      ],
    });
    const view = new EditorView({ state, parent: host });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const description = LanguageDescription.matchFilename(languages, fileName);
    const view = viewRef.current;
    const languageCompartment = languageCompartmentRef.current;
    if (!description || !view || !languageCompartment) {
      return;
    }

    void description.load().then((support) => {
      if (!cancelled && viewRef.current) {
        viewRef.current.dispatch({
          effects: languageCompartment.reconfigure(support),
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [fileName]);

  return <div ref={hostRef} className="h-full min-h-0 overflow-hidden" />;
}
