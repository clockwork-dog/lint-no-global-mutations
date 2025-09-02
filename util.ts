import { types } from "estree-toolkit";
import { AssertionError } from "@std/assert";
import { parse } from "espree";

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
        throw new AssertionError("");
    }
}
const Node = parse("").constructor;
function isNode(ref: unknown): ref is types.Node {
    return ref instanceof Node;
}

const functionTypes = new Set([
    "FunctionDeclaration",
    "FunctionExpression",
    "ArrowFunctionExpression",
]);
export type FunctionNode =
    | types.FunctionDeclaration
    | types.FunctionExpression
    | types.ArrowFunctionExpression;
export function assertIsFnNode(
    ref: unknown,
): asserts ref is
    & FunctionNode
    & NodePos {
    if (!isNode(ref)) throw new Error(JSON.stringify(ref));
    if (!isNodePos(ref)) throw new Error();
    if (!functionTypes.has(ref.type)) throw new Error();
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
