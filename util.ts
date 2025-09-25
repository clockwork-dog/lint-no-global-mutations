import { types } from "estree-toolkit";
import { Reference } from "./reference.ts";

export const functionTypes = new Set([
    "FunctionDeclaration",
    "FunctionExpression",
    "ArrowFunctionExpression",
]);
export type FunctionNode =
    | types.FunctionDeclaration
    | types.FunctionExpression
    | types.ArrowFunctionExpression;

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
function isNode(ref: unknown): ref is types.Node {
    return typeof ref === "object" && ref !== null && "type" in (ref as Node);
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

export function isFnNode(ref: unknown): ref is FunctionNode & NodePos {
    if (!isNode(ref)) return false;
    if (!isNodePos(ref)) return false;
    if (!functionTypes.has(ref.type)) return false;
    return true;
}
export function assertIsFnNode(
    ref: unknown,
): asserts ref is
    & FunctionNode
    & NodePos {
    if (!isFnNode(ref)) throw new Error();
}

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
