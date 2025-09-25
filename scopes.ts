import { traverse, types } from "estree-toolkit";
import { assertIsNodePos, ReferenceStack } from "./util.ts";
import { Reference } from "./reference.ts";

export function constructHoistedScopes(
    program: types.Node,
): Record<string | number, ReferenceStack> {
    let currentScopeStack: ReferenceStack = [[program, {}]];
    // At the start of each block statement, this will be the current stack
    // (We will construct all hoisted declarations)
    const allScopeStacks: Record<string | number, ReferenceStack> = {
        "-1": currentScopeStack,
    };

    traverse(program, {
        BlockStatement: {
            enter(path) {
                if (!path) return;
                assertIsNodePos(path.node);

                currentScopeStack = [...currentScopeStack, [path.node, {}]];
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
                switch (declarator.id.type) {
                    case "Identifier": {
                        assertIsNodePos(declarator.id);
                        const { name } = declarator.id;
                        const [_node, scope] = currentScopeStack[0]!;
                        if (name in scope) {
                            throw new Error(
                                `Duplicate variable initialization: ${name}`,
                            );
                        }
                        scope[name] = new Reference();
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
            const { name } = path.node.id;
            const [_node, scope] = currentScopeStack[0]!;
            if (name in scope) {
                throw new Error(
                    `Duplicate variable initialization: ${name}`,
                );
            }
            scope[name] = new Reference([path.node]);
        },
    });

    return allScopeStacks;
}
