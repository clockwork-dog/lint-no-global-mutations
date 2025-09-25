import { Diagnostic, linter as createLinter } from "@codemirror/lint";
import { parse } from "espree";
import { noMutation } from "./main.ts";
import { types } from "estree-toolkit";

export class NoGlobalMutations {
    constructor(globalSchema: object) {
        this.schema = globalSchema;
        this._linter = createLinter((view) => {
            let lint: Diagnostic[] = [];
            try {
                const source = view.state.doc.toString();
                const ast = parse(source, {
                    ecmaVersion: 2023,
                }) as types.Program;
                lint = noMutation(ast, this._schema).errors.map((e) => ({
                    from: e.start!,
                    to: e.end!,
                    message: e.message,
                    severity: "error",
                }));
            } catch (e) {
                console.warn(e);
            }
            return lint;
        });
    }

    private _schema!: object;
    set schema(globalSchema: object) {
        if (Array.isArray(globalSchema)) {
            throw new Error(
                `Expect globalSchema to be an object but received array ${globalSchema}`,
            );
        }
        if (globalSchema === null) {
            throw new Error(
                `Expect globalSchema to be an object but received null`,
            );
        }
        if (typeof globalSchema !== "object") {
            throw new Error(
                `Expect globalSchema to be an object but received ${globalSchema}`,
            );
        }
        this._schema = globalSchema;
    }

    private _linter;
    get linter() {
        return this._linter;
    }
}
