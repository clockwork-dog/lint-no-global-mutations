import { parse } from "espree";
import { traverse, types } from "estree-toolkit";
import { assertIsNodePos, NodePos } from "./util.ts";

export type Program = ReturnType<typeof parse>;

export type Scope = {
    [ident: string]: NodePos;
};

export function constructScopes(
    program: types.Program,
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
                assertIsNodePos(declarator.id);
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
            currentScopeStack[0]![name] = { start, end };

            currentScopeStack[0];
        },
    });

    return allScopeStacks;
}
