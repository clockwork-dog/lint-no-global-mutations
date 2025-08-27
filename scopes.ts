import { parse } from "espree";
import { traverse, types } from "estree-toolkit";
import { AssertionError } from "node:assert";

export type Program = ReturnType<typeof parse>;
export type FunctionNode = types.FunctionDeclaration;
export type NodePos = {
    start: number;
    end: number;
    functionBody?: FunctionNode;
};
export type Scope = {
    [ident: string]: NodePos;
};
function isNodePos(node: unknown): node is NodePos {
    return typeof node === "object" && node != null &&
        "start" in node && typeof node.start === "number" &&
        "end" in node && typeof node.end === "number";
}
function assertIsNodePos(node: unknown): asserts node is NodePos {
    if (!isNodePos(node)) {
        throw new AssertionError();
    }
}

export function constructScopes(
    program: ReturnType<typeof parse>,
) {
    let currentScopeStack: Scope[] = [{}];
    // At the start of each block statement, this will be the current stack
    // (We will construct all hoisted declarations)
    const allScopeStacks: Record<number, Scope[]> = { "-1": currentScopeStack };

    traverse(program, {
        BlockStatement: {
            enter(path) {
                if (!path) return;
                assertIsNodePos(path.node);

                currentScopeStack = [{}, ...currentScopeStack];
                allScopeStacks[path.node.start] = currentScopeStack;
            },
            leave() {
                currentScopeStack = currentScopeStack.slice(1);
            },
        },

        VariableDeclaration(path) {
            if (!path?.node) return;
            const { node } = path;
            if (node.kind !== "var") return;
            node.declarations.forEach((declarator) => {
                if (!declarator) return;
                if (!isNodePos(declarator)) {
                    throw new Error("Node does not have position");
                }
                switch (declarator.id.type) {
                    case "Identifier": {
                        assertIsNodePos(declarator.id);
                        const { name, start, end } = declarator.id;
                        if (name in currentScopeStack[0]!) throw new Error("");
                        currentScopeStack[0]![name] = { start, end };
                        break;
                    }
                    // TODO:!
                    case "MemberExpression":
                    case "ObjectPattern":
                    case "ArrayPattern":
                    case "RestElement":
                    case "AssignmentPattern":
                }
            });
        },

        FunctionDeclaration(path) {
            if (!path?.node) return;
            const { node } = path;
            assertIsNodePos(node.id);
            const { name, start, end } = node.id;
            if (name in currentScopeStack[0]!) throw new Error("");
            currentScopeStack[0]![name] = { start, end, functionBody: node };

            currentScopeStack[0];
        },
    });

    return allScopeStacks;
}
