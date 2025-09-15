import { basicSetup, EditorView } from "codemirror";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { javascript } from "@codemirror/lang-javascript";
import { tags as t } from "@lezer/highlight";
import { ViewPlugin, ViewUpdate } from "@codemirror/view";
import { NoGlobalMutations } from "../linter.ts";

export const EDITOR_COLORS = {
    background: "#1d2229",
    foreground: "#ffffff",
    caret: "#e8e8e8",
    selection: "#9292c255",
    selectionMatch: "#383838",
    gutterBackground: "#2B313977",
    gutterForeground: "#3f4853",
    gutterBorder: "#dddddd",
    gutterActiveForeground: "#565c65",
    lineHighlight: "#ffffff08",
} as const;

export const cogsCodeMirrorEditorTheme = EditorView.theme(
    {
        "&": {
            backgroundColor: EDITOR_COLORS.background,
            color: EDITOR_COLORS.foreground,
            fontSize: "25px",
            fontFamily: "Roboto Mono",
            overflowY: "auto",
            fontWeight: "normal",
        },
        /* Turn off the dashed outline when the editor is focused */
        "&.cm-focused": {
            outline: "none",
        },

        ".cm-gutters": {
            backgroundColor: EDITOR_COLORS.gutterBackground,
            color: EDITOR_COLORS.gutterForeground,
            borderRightColor: EDITOR_COLORS.gutterBorder,
        },
        ".cm-scroller": {
            fontFamily: "Roboto Mono",
        },
        ".cm-content": {
            caretColor: EDITOR_COLORS.caret,
            paddingTop: "8px",
            paddingBottom: "8px",
        },
        ".cm-cursor, .cm-dropCursor": {
            borderLeftColor: EDITOR_COLORS.caret,
        },
        ".cm-activeLine": {
            backgroundColor: EDITOR_COLORS.lineHighlight,
        },
        ".cm-activeLineGutter": {
            color: EDITOR_COLORS.gutterActiveForeground,
            backgroundColor: EDITOR_COLORS.lineHighlight,
        },
        ".cm-focused .cm-selectionBackground, .cm-line::selection, .cm-selectionLayer .cm-selectionBackground, .cm-content ::selection":
            {
                background: `${EDITOR_COLORS.selection} !important`,
            },
        ".cm-selectionMatch": {
            backgroundColor: EDITOR_COLORS.selectionMatch,
        },
        /* Hide highlighted line and selection for non-focused editor */
        "&:not(.cm-focused) .cm-activeLine, &:not(.cm-focused) .cm-selectionBackground, &:not(.cm-focused) .cm-selectionMatch":
            {
                backgroundColor: "transparent !important",
            },
    },
    { dark: true },
);

export const cogsCodeMirrorSyntaxHighlightTheme = syntaxHighlighting(
    HighlightStyle.define([
        { tag: t.comment, color: "#929292" },
        { tag: t.lineComment, color: "#929292" },
        { tag: t.blockComment, color: "#929292" },
        { tag: t.docComment, color: "#929292" },
        { tag: t.name, color: "#61c9fc" },
        { tag: t.definition(t.typeName), color: "#7958ae" },
        { tag: t.typeName, color: "#7958ae" },
        { tag: t.variableName, color: "#59b387" },
        { tag: t.namespace, color: "#62ccff" },
        { tag: t.string, color: "#ffd38f" },
        { tag: t.number, color: "#e47f58" },
        { tag: t.bool, color: "#f5df3d" },
        { tag: t.regexp, color: "#cd33d3" },
        { tag: t.keyword, color: "#af7ff6" },
        { tag: t.null, color: "#59b387" },
        { tag: t.operator, color: "#cacaca" },
        { tag: t.arithmeticOperator, color: "#ff9065" },
        { tag: t.punctuation, color: "#af7ff6" },
        { tag: t.squareBracket, color: "#ffffff" },
        { tag: t.brace, color: "#ffffff" },
        { tag: t.separator, color: "#aaaaaa" },
        { tag: t.angleBracket, color: "#aaaaaa" },
        { tag: t.paren, color: "#ffffff" },
    ]),
);

const syncURL = ViewPlugin.fromClass(
    class {
        constructor(view: EditorView) {
            Promise.resolve()
                .then(() => {
                    const code = atob(globalThis.location.hash.slice(1));
                    view.dispatch({
                        changes: [{
                            from: 0,
                            insert: code,
                        }],
                    });
                })
                .catch(console.error);
        }
        update(update: ViewUpdate) {
            if (update.docChanged) {
                globalThis.location.hash = btoa(
                    update.view.state.doc.toString(),
                );
            }
        }
    },
);

const GLOBALS = {
    globalObj: { a: { b: { c: {} } } },
    globalArr: [[[[]]]],
    window: { key: "value" },
};

const noMutation = new NoGlobalMutations(GLOBALS);

new EditorView({
    extensions: [
        syncURL,
        basicSetup,
        javascript(),
        noMutation.linter,
        cogsCodeMirrorEditorTheme,
        cogsCodeMirrorSyntaxHighlightTheme,
    ],
    parent: document.body,
});

document.body.style.backgroundColor = EDITOR_COLORS.background;
