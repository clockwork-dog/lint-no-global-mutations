import { traverse, types } from "estree-toolkit";
import { constructHoistedScopes } from "./scopes.ts";
import {
    assertIsNodePos,
    FunctionNode,
    functionTypes,
    isFnNode,
    LintingError,
    References,
    ReferenceStack,
} from "./util.ts";
import { assert } from "@std/assert";
import { getPossibleReferences } from "./get_possible_references.ts";
import { Reference } from "./reference.ts";
import { collectDeepReferences } from "./deep_references.ts";
import { setPossibleReferences } from "./set_possible_references.ts";
import { evaluateFunction } from "./functions.ts";
import { arrayCallbackMethod } from "./array.ts";
import { objectCallbackMethod } from "./object.ts";

export interface State {
    node: types.Node;
    currentRefs: ReferenceStack;
    hoistedRefStacks: Record<string | number, ReferenceStack>;
    allGlobalRefs: Set<unknown>;
    errors: LintingError[];
}

export function noMutation(
    program: types.Program,
    schemaObj: any,
): LintingError[] {
    const allSchemaRefs = collectDeepReferences(schemaObj);
    // Construct global scope
    // Get the current scope stack and attach empty reference arrays
    // These will be populated with possible global references later
    const hoistedRefs = constructHoistedScopes(program);

    if (typeof schemaObj !== "object" || Array.isArray(schemaObj)) {
        throw new Error(
            `schemaObj was not an object, got ${JSON.stringify(schemaObj)}`,
        );
    }
    const globalRefs: References = {};
    Object.entries(schemaObj).forEach(([key, value]) => {
        globalRefs[key] = new Reference([value]);
    });

    const currentHoistedScope = hoistedRefs["-1"]![0]!;
    const currentHoistedRefs: References = {};
    Object.entries(currentHoistedScope).forEach(([key]) => {
        currentHoistedRefs[key] = new Reference();
    });
    const currentRefs: ReferenceStack = [
        [program, currentHoistedRefs],
        [null, globalRefs],
    ];

    const errors: LintingError[] = [];
    noMutationRecursive(
        program,
        currentRefs,
        hoistedRefs,
        allSchemaRefs,
        errors,
    );

    return errors;
}

export function noMutationRecursive(
    code:
        | types.Program
        | types.FunctionDeclaration
        | types.FunctionExpression
        | types.ArrowFunctionExpression,
    refsStack: ReferenceStack,
    hoistedRefStacks: Record<number, ReferenceStack>,
    allSchemaRefs: Set<unknown>,
    errors: LintingError[],
): Reference {
    const currentRefs = refsStack;
    const returnValue = new Reference();

    // Completely ignore all code inside function bodies as it will be checked when invoked.
    //.This means when inside a function body, the function node will always be on top of the stack.
    const ignoreIfInsideFunctionBody = () => {
        const [topNode, _stack] = currentRefs[0]!;
        if (
            functionTypes.has(topNode?.type as any) && // We're in a function body
            topNode !== code // We're executing said function
        ) {
            return true;
        } else {
            return false;
        }
    };

    traverse(code, {
        // We still need to keep track of non-hoisted variables (let / const)
        // So we just initialize each scope with hoisted variables
        BlockStatement: {
            enter(path) {
                if (ignoreIfInsideFunctionBody()) return;
                assertIsNodePos(path.node);
                const newHoistedRefs = hoistedRefStacks[path.node.start]?.[0];
                // Each scope should appear in the hoisted scopes, and be indexed by the start
                assert(
                    newHoistedRefs,
                    `Cannot find hoisted scope at ${path.node.start}`,
                );
                currentRefs.unshift(newHoistedRefs);
            },
            leave(_path) {
                if (ignoreIfInsideFunctionBody()) return;
                currentRefs.shift();
            },
        },

        // Whenever I get to a function I want to save reference to it so I can use it later.
        // I want to add it on the stack as a 'marker', then ignore everything until it comes
        // off the stack.

        FunctionExpression: {
            enter(path) {
                if (ignoreIfInsideFunctionBody()) return;
                assertIsNodePos(path.node);
                currentRefs.unshift([path.node, {}]);
            },
            leave() {
                currentRefs.shift();
            },
        },
        ArrowFunctionExpression: {
            enter(path) {
                if (ignoreIfInsideFunctionBody()) return;
                assertIsNodePos(path.node);
                currentRefs.unshift([path.node, {}]);
            },
            leave() {
                currentRefs.shift();
            },
        },
        FunctionDeclaration: {
            enter(path) {
                if (ignoreIfInsideFunctionBody()) return;
                const node = path.node;
                assertIsNodePos(node);
                const [, scope] = currentRefs[0]!;
                scope[node.id.name] = new Reference([node]);
                currentRefs.unshift([node, {}]);
            },
            leave() {
                currentRefs.shift();
            },
        },
        ReturnStatement(path) {
            if (ignoreIfInsideFunctionBody()) return;
            const node = path?.node;
            assertIsNodePos(node);
            const val = getPossibleReferences(node.argument, currentRefs);
            returnValue.set(val);
        },

        UpdateExpression(path) {
            if (ignoreIfInsideFunctionBody()) return;
            const node = path?.node;
            assertIsNodePos(node);
            if (
                getPossibleReferences(node.argument, currentRefs)
                    .get()
                    .some((ref) => allSchemaRefs.has(ref))
            ) {
                errors.push(
                    LintingError.fromNode(
                        "Cannot mutate global variable",
                        node,
                    ),
                );
            }
        },

        UnaryExpression(path) {
            if (ignoreIfInsideFunctionBody()) return;
            const node = path.node;
            assertIsNodePos(node);
            if (
                node.operator === "delete" &&
                node.argument.type === "MemberExpression"
            ) {
                if (
                    getPossibleReferences(node.argument.object, currentRefs)
                        .get()
                        .some((ref) => allSchemaRefs.has(ref))
                ) {
                    errors.push(
                        LintingError.fromNode(
                            "Cannot mutate global variable",
                            node,
                        ),
                    );
                }
            }
        },

        AssignmentExpression(path) {
            if (ignoreIfInsideFunctionBody()) return;
            const node = path.node;
            assertIsNodePos(node);

            if (
                node.left.type === "ArrayPattern" ||
                node.left.type === "ObjectPattern" ||
                node.left.type === "AssignmentPattern" ||
                node.left.type === "RestElement"
            ) {
                throw new Error("TODO: Destructuring");
            }

            const possibleMutations = node.left.type === "Identifier"
                ? getPossibleReferences(node.left, currentRefs).get()
                : [
                    ...getPossibleReferences(node.left, currentRefs)
                        .get(),
                    ...getPossibleReferences(node.left.object, currentRefs)
                        .get(),
                ];
            if (possibleMutations.some((ref) => allSchemaRefs.has(ref))) {
                errors.push(
                    LintingError.fromNode(
                        "Cannot reassign global",
                        node,
                    ),
                );
            }

            const value = getPossibleReferences(node.right, currentRefs);
            switch (node.left.type) {
                case "Identifier":
                    for (const [, refs] of currentRefs) {
                        if (node.left.name in refs) {
                            refs[node.left.name]!.set(value);
                            break;
                        }
                    }
                    break;
                case "MemberExpression":
                    setPossibleReferences(node.left, node.right, currentRefs);
                    break;
                default:
                    throw new Error("TODO!");
            }
        },

        VariableDeclaration(path) {
            if (ignoreIfInsideFunctionBody()) return;
            const node = path.node;
            assertIsNodePos(node);

            node.declarations.forEach((declaration) => {
                const { id, init } = declaration;
                if (!init) return;
                switch (id.type) {
                    case "Identifier": {
                        // Keep track of all the possibilities of the init
                        const [, scope] = currentRefs[0]!;
                        scope[id.name] = getPossibleReferences(
                            init,
                            currentRefs,
                        );
                        break;
                    }
                    case "ObjectPattern":
                    case "RestElement":
                    case "MemberExpression":
                    case "ArrayPattern":
                    case "AssignmentPattern":
                        throw new Error("TODO: Destructuring");
                }
            });
        },

        CallExpression(path) {
            if (ignoreIfInsideFunctionBody()) return;
            const node = path.node;
            assertIsNodePos(node);
            const args = node.arguments.map((arg) => {
                if (arg.type === "SpreadElement") {
                    throw new Error("TODO: spread");
                }
                return getPossibleReferences(arg, currentRefs);
            });

            arrayCallbackMethod({
                node: node,
                currentRefs,
                allGlobalRefs: allSchemaRefs,
                hoistedRefStacks,
                errors,
            }, args);

            objectCallbackMethod({
                node: node,
                currentRefs,
                allGlobalRefs: allSchemaRefs,
                hoistedRefStacks,
                errors,
            }, args);

            // Check for user functions
            const possibleFns: FunctionNode[] = [];
            switch (node.callee.type) {
                case "FunctionExpression":
                case "ArrowFunctionExpression":
                    possibleFns.push(node.callee);
                    break;
                default:
                    possibleFns.push(
                        ...getPossibleReferences(
                            node.callee,
                            currentRefs,
                        ).get() as FunctionNode[],
                    );
                    break;
            }

            possibleFns.forEach(
                (fnNode) => {
                    if (!isFnNode(fnNode)) {
                        return;
                    }
                    evaluateFunction({
                        node: fnNode,
                        currentRefs,
                        hoistedRefStacks: hoistedRefStacks,
                        allGlobalRefs: allSchemaRefs,
                        errors,
                    }, args);
                },
            );
        },
    });
    return returnValue;
}
