import { types } from "estree-toolkit";
import { AssertionError } from "@std/assert";

export type FunctionNode = types.FunctionDeclaration;
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

export const ANY_STRING = Symbol("any string");
