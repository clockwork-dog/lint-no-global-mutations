import { parse } from "espree";
import { traverse } from "estree-toolkit";

export type NodePos = {
    start: number;
    end: number;
};
export type Scope = {
    [ident: string]: NodePos;
};
const isNodePos = (node: any): node is NodePos => {
    return typeof node === "object" && node != null &&
        "start" in node && typeof node.start === "number" &&
        "end" in node && typeof node.end === "number";
};

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
                if (!isNodePos(path.node)) {
                    throw new Error("Node does not have position");
                }
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
                        if (!isNodePos(declarator.id)) {
                            throw new Error("Node does not have position");
                        }
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
            if (!isNodePos(node.id)) {
                throw new Error("Node does not have position");
            }
            const { name, start, end } = node.id;
            if (name in currentScopeStack[0]!) throw new Error("");
            currentScopeStack[0]![name] = { start, end };

            currentScopeStack[0];
        },
    });

    return allScopeStacks;
}
