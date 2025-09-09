import { traverse, types } from "estree-toolkit";
import { constructScopes } from "./scopes.ts";
import {
    assertIsNodePos,
    FunctionNode,
    isFnNode,
    LintingError,
    MUTATING_ARRAY_INSTANCE_METHODS,
    MUTATING_OBJECT_PROTOTYPE_METHODS,
} from "./util.ts";
import { assert } from "@std/assert";
import {
    getPossibleReferences,
    ReferenceStack,
} from "./get_possible_references.ts";
import { Reference } from "./reference.ts";
import { collectDeepReferences } from "./deep_references.ts";
import { setPossibleReferences } from "./set_possible_references.ts";

export function noMutation(
    program: types.Program,
    schemaObj: any,
): LintingError[] {
    const allSchemaRefs = collectDeepReferences(schemaObj);
    // Construct global scope
    // Get the current scope stack and attach empty reference arrays
    // These will be populated with possible global references later
    const hoistedScopes = constructScopes(program);
    const hoistedRefs: Record<string | number, ReferenceStack> = {};
    Object.entries(hoistedScopes).forEach(([start, scopes]) => {
        // TODO: number lookup is gross
        hoistedRefs[start] = scopes.map((scope) => {
            const refs: Record<string, Reference> = {};
            Object.entries(scope).forEach(([name, value]) => {
                refs[name] = new Reference([value]);
            });
            return refs;
        });
    });

    if (typeof schemaObj !== "object" || Array.isArray(schemaObj)) {
        throw new Error(
            `schemaObj was not an object, got ${JSON.stringify(schemaObj)}`,
        );
    }
    const globalRefs: ReferenceStack[number] = {};
    Object.entries(schemaObj).forEach(([key, value]) => {
        globalRefs[key] = new Reference([value]);
    });

    const currentHoistedScope = hoistedScopes["-1"]![0]!;
    const currentHoistedRefs: ReferenceStack[number] = {};
    Object.entries(currentHoistedScope).forEach(([key]) => {
        currentHoistedRefs[key] = new Reference();
    });
    const currentRefs: ReferenceStack = [currentHoistedRefs, globalRefs];

    return noMutationRecursive(
        program,
        currentRefs,
        hoistedRefs,
        allSchemaRefs,
    );
}

function noMutationRecursive(
    code:
        | types.Program
        | types.FunctionDeclaration
        | types.FunctionExpression
        | types.ArrowFunctionExpression,
    refsStack: ReferenceStack,
    hoistedRefs: Record<number, ReferenceStack>,
    allSchemaRefs: Set<unknown>,
) {
    const errors: LintingError[] = [];
    let currentRefs = refsStack;
    traverse(code, {
        // We still need to keep track of non-hoisted variables (let / const)
        // So we just initialize each scope with hoisted variables
        BlockStatement: {
            enter(path) {
                assertIsNodePos(path.node);
                const newHoistedRefs = hoistedRefs[path.node.start]?.[0];
                // Each scope should appear in the hoisted scopes, and be indexed by the start
                assert(newHoistedRefs, "");
                currentRefs = [newHoistedRefs, ...currentRefs];
            },
            leave(_path) {
                currentRefs = currentRefs.slice(1);
            },
        },

        UpdateExpression(path) {
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
                    for (const refs of currentRefs) {
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
            const node = path.node;
            assertIsNodePos(node);

            node.declarations.forEach((declaration) => {
                const { id, init } = declaration;
                if (!init) return;
                switch (id.type) {
                    case "Identifier":
                        // Keep track of all the possibilities of the init
                        currentRefs[0]![id.name] = getPossibleReferences(
                            init,
                            currentRefs,
                        );
                        break;
                    case "ObjectPattern":
                    case "RestElement":
                    case "MemberExpression":
                    case "ArrayPattern":
                    case "AssignmentPattern":
                        throw new Error("TODO: Destructuring");
                }
            });
        },

        FunctionDeclaration(path) {
            // Function expressions and Arrow expressions are handled in variable declarations
            const node = path.node;
            assertIsNodePos(node);
            currentRefs[0]![node.id.name] = new Reference([node]);
        },

        CallExpression(path) {
            const node = path.node;
            assertIsNodePos(node);
            const args = node.arguments.map((arg) => {
                if (arg.type === "SpreadElement") {
                    throw new Error("TODO: spread");
                }
                return getPossibleReferences(arg, currentRefs);
            });

            // array methods, object methods, .call()
            if (node.callee.type === "MemberExpression") {
                const { object } = node.callee;

                // Array instance properties
                if (
                    getPossibleReferences(node.callee, currentRefs).get().some(
                        (method) => MUTATING_ARRAY_INSTANCE_METHODS.has(method),
                    )
                ) {
                    getPossibleReferences(
                        object,
                        currentRefs,
                    )
                        .get()
                        .filter(Array.isArray)
                        .filter((arr) => allSchemaRefs.has(arr))
                        .forEach(() => {
                            errors.push(
                                LintingError.fromNode("STOP THAT!", node),
                            );
                        });
                }
            }

            // Object prototype methods
            if (
                getPossibleReferences(node.callee, currentRefs).get().some(
                    (method) => MUTATING_OBJECT_PROTOTYPE_METHODS.has(method),
                )
            ) {
                if (
                    args.some((arg) =>
                        arg.get().some((poss) => allSchemaRefs.has(poss))
                    )
                ) {
                    errors.push(
                        LintingError.fromNode("STOP THAT!", node),
                    );
                }
            }

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

                    const fnParams: Record<string, Reference> = {};
                    fnNode.params.forEach((param, index) => {
                        if (param.type !== "Identifier") {
                            throw new Error("TODO: destructuring");
                        }
                        fnParams[param.name] = args[index]!;
                    });
                    currentRefs = [fnParams, ...currentRefs];

                    errors.push(
                        ...noMutationRecursive(
                            fnNode,
                            currentRefs,
                            hoistedRefs,
                            allSchemaRefs,
                        ).map((err) => {
                            err.start = node.start;
                            err.end = node.end;
                            return err;
                        }),
                    );
                    currentRefs = currentRefs.slice(1);
                },
            );
        },
    });
    return errors;
}
