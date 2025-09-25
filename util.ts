import { types } from "estree-toolkit";
import { Reference } from "./reference.ts";

export type References = Record<string, Reference>;
export type ReferenceStack = Array<[types.Node | null, References]>;

export type NodePos = {
    start: number;
    end: number;
};
function isNodePos(node: unknown): node is NodePos {
    return typeof node === "object" && node != null &&
        "start" in node && typeof node.start === "number" &&
        "end" in node && typeof node.end === "number";
}
export function assertIsNodePos(node: unknown): asserts node is NodePos {
    if (!isNodePos(node)) {
        throw new Error("");
    }
}

export const isInteger = (n: unknown) => {
    switch (typeof n) {
        case "number":
            return Number.isInteger(n);
        case "string":
            return n === String(parseInt(n, 10));
        case "symbol":
            return n === ANY_STRING;
    }
};

export const ANY_STRING = Symbol("any string");

export class LintingError extends Error {
    constructor(
        msg: string,
        public start: number,
        public end: number,
    ) {
        super(msg);
    }

    static fromNode(msg: string, node: NodePos) {
        return new LintingError(msg, node.start, node.end);
    }

    override get name() {
        return this.constructor.name;
    }
}

export const dedupeErrors = (allErrors: LintingError[]): LintingError[] => {
    const errors: LintingError[] = [];

    allErrors.forEach((error) => {
        for (const e of errors) {
            // Total overlap
            if (e.start <= error.start && e.end >= error.end) return;
            // Start overlaps
            if (e.start >= error.start && e.start <= error.end) return;
            // End overlaps
            if (e.end >= error.start && e.end <= error.end) return;
        }
        // Else
        errors.push(error);
    });

    return errors;
};

export const pathToString = (path: Array<string | symbol>): string => {
    return path.map((segment) => {
        if (String(segment).match(/^\w+$/)) {
            return `.${String(segment)}`;
        } else {
            return `["${String(segment)}"]`;
        }
    }).join("").replace(/^\./, "");
};
