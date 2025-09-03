import { types } from "estree-toolkit";
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
        throw new Error("");
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

export const NON_MUTATING_ARRAY_INSTANCE_METHOD_NAMES = new Set([
    "at",
    "concat",
    // "copyWithin",
    "entries",
    "every",
    // "fill",
    "filter",
    "find",
    "findIndex",
    "findLast",
    "findLastIndex",
    "flat",
    "flatMap",
    "forEach",
    "includes",
    "indexOf",
    "join",
    "keys",
    "lastIndexOf",
    "map",
    // "pop",
    // "push",
    "reduce",
    "reduceRight",
    // "reverse",
    // "shift",
    "slice",
    "some",
    // "sort",
    // "splice",
    "toLocaleString",
    "toReversed",
    "toSorted",
    "toSpliced",
    "toString",
    // "unshift",
    "values",
    "with",
]);

export const NON_MUTATING_OBJECT_PROTOTYPE_METHODS = new Set([
    // "assign",
    "create",
    // "defineProperties",
    // "defineProperty",
    "entries",
    // "freeze",
    "fromEntries",
    "getOwnPropertyDescriptor",
    "getOwnPropertyDescriptors",
    "getOwnPropertyNames",
    "getOwnPropertySymbols",
    "getPrototypeOf",
    "groupBy",
    "hasOwn",
    "is",
    "isExtensible",
    "isFrozen",
    "isSealed",
    "keys",
    // "preventExtensions",
    // "seal",
    // "setPrototypeOf",
    "values",
]);
