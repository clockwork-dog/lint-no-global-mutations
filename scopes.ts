import { traverse, types } from "estree-toolkit";
import { assertIsNodePos, ReferenceStack } from "./util.ts";
import { Reference } from "./reference.ts";
import { FunctionNode } from "./functions.ts";

export function constructHoistedScopes(
    program: types.Node,
): Record<string | number, ReferenceStack[number]> {
    // At the start of each block statement, this will be the current stack
    // (We will construct all hoisted declarations)
    const allScopeStacks: Record<string | number, ReferenceStack[number]> = {
        "-1": [program, {}],
    };
    const scopeIndexes = [-1];

    traverse(program, {
        BlockStatement: {
            enter(path) {
                if (!path) return;
                assertIsNodePos(path.node);

                scopeIndexes.unshift(path.node.start);
                allScopeStacks[path.node.start] = [path.node, {}];
            },
            leave() {
                scopeIndexes.shift();
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
                        const [_node, scope] =
                            allScopeStacks[scopeIndexes[0]!]!;
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
            const { node } = path;
            if (!node) return;
            const { name } = node.id;
            const [_node, scope] = allScopeStacks[scopeIndexes[0]!]!;
            if (name in scope) {
                throw new Error(
                    `Duplicate variable initialization: ${name}`,
                );
            }

            const scopeStack = scopeIndexes.map((i) => allScopeStacks[i]!);

            scope[name] = new Reference([
                FunctionNode.hoisted(
                    node,
                    scopeStack,
                    allScopeStacks,
                ),
            ]);
        },
    });

    return allScopeStacks;
}
