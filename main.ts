import { traverse, types } from "estree-toolkit";
import { constructHoistedScopes } from "./scopes.ts";
import {
    assertIsNodePos,
    dedupeErrors,
    LintingError,
    References,
    ReferenceStack,
} from "./util.ts";
import { assert } from "@std/assert";
import { getPossibleReferences } from "./get_possible_references.ts";
import { Reference } from "./reference.ts";
import { collectDeepReferences } from "./deep_references.ts";
import { setPossibleReferences } from "./set_possible_references.ts";
import { evaluateCallExpression } from "./functions.ts";
import { getPossibleBindings, REST_BINDING_ERR } from "./bindings.ts";

export interface State {
    node: types.Node | null | undefined;
    currentRefs: ReferenceStack;
    hoistedRefStacks: Record<string | number, ReferenceStack>;
    allGlobalRefs: Map<unknown, string>;
    errors: LintingError[];
}

export function noMutation(
    program: types.Program,
    schemaObj: any,
): LintingError[] {
    const allGlobalRefs = collectDeepReferences(schemaObj);
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
        allGlobalRefs,
        errors,
    );

    return dedupeErrors(errors);
}

export function noMutationRecursive(
    code:
        | types.Program
        | types.FunctionDeclaration
        | types.FunctionExpression
        | types.ArrowFunctionExpression,
    refsStack: ReferenceStack,
    hoistedRefStacks: Record<number, ReferenceStack>,
    allGlobalRefs: Map<unknown, string>,
    errors: LintingError[],
): Reference {
    const currentRefs = refsStack;
    const state: State = {
        node: code,
        currentRefs,
        hoistedRefStacks,
        allGlobalRefs,
        errors,
    };
    const returnValue = new Reference();

    traverse(code, {
        // We still need to keep track of non-hoisted variables (let / const)
        // So we just initialize each scope with hoisted variables
        BlockStatement: {
            enter(path) {
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
                currentRefs.shift();
            },
        },

        // Function bodies are saved as a reference and when invoked will be run
        FunctionExpression: {
            enter(path) {
                assertIsNodePos(path.node);
                const [rootNode] = currentRefs[0]!;
                if (path.node !== rootNode) path.skip();
            },
        },
        ArrowFunctionExpression: {
            enter(path) {
                assertIsNodePos(path.node);
                const [rootNode] = currentRefs[0]!;
                if (path.node !== rootNode) path.skip();

                // Arrow function with implied return
                if (path.node.body.type !== "BlockStatement") {
                    const val = getPossibleReferences({
                        ...state,
                        node: path.node.body,
                    });
                    returnValue.set(val);
                }
            },
        },
        FunctionDeclaration: {
            enter(path) {
                const node = path.node;
                assertIsNodePos(node);
                const [rootNode, scope] = currentRefs[0]!;
                scope[node.id.name] = new Reference([node]);
                if (path.node !== rootNode) path.skip();
            },
        },
        ReturnStatement(path) {
            const node = path?.node;
            assertIsNodePos(node);
            const val = getPossibleReferences({
                ...state,
                node: node.argument,
            });
            returnValue.set(val);
        },

        UpdateExpression(path) {
            const node = path?.node;
            assertIsNodePos(node);
            getPossibleReferences({
                ...state,
                node: node.argument,
            })
                .get()
                .map((ref) => allGlobalRefs.get(ref))
                .filter(Boolean)
                .forEach((path) => {
                    errors.push(
                        LintingError.fromNode(
                            `Cannot mutate global variable ${path}`,
                            node,
                        ),
                    );
                });
        },

        UnaryExpression(path) {
            const node = path.node;
            assertIsNodePos(node);
            if (
                node.operator === "delete" &&
                node.argument.type === "MemberExpression"
            ) {
                getPossibleReferences({
                    ...state,
                    node: node.argument.object,
                })
                    .get()
                    .map((ref) => allGlobalRefs.get(ref))
                    .filter(Boolean)
                    .forEach((path) => {
                        errors.push(
                            LintingError.fromNode(
                                `Cannot mutate global variable ${path}`,
                                node,
                            ),
                        );
                    });
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
                ? getPossibleReferences({ ...state, node: node.left }).get()
                : [
                    ...getPossibleReferences({ ...state, node: node.left })
                        .get(),
                    ...getPossibleReferences({
                        ...state,
                        node: node.left.object,
                    })
                        .get(),
                ];

            possibleMutations
                .map((ref) => allGlobalRefs.get(ref))
                .filter(Boolean)
                .forEach((path) => {
                    errors.push(
                        LintingError.fromNode(
                            `Cannot mutate global variable ${path}`,
                            node,
                        ),
                    );
                });

            const value = getPossibleReferences({ ...state, node: node.right });
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
                    setPossibleReferences(node.left, node.right, state);
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

                if (id.type === "RestElement") {
                    throw new Error(REST_BINDING_ERR);
                }

                const val = getPossibleReferences({ ...state, node: init });
                const bindings = getPossibleBindings(
                    { ...state, node: id },
                    val,
                );
                const [, scope] = currentRefs[0]!;
                Object.entries(bindings)
                    .forEach(([k, v]) => {
                        scope[k] = v;
                    });
            });
        },

        CallExpression(path) {
            const node = path.node;
            assertIsNodePos(node);
            returnValue.set(evaluateCallExpression({
                node,
                allGlobalRefs,
                currentRefs,
                errors,
                hoistedRefStacks,
            }));
        },

        NewExpression(path) {
            const node = path.node;
            assertIsNodePos(node);
            const ctor = getPossibleReferences({ ...state, node: node.callee });
            if (ctor.get().some((fn) => fn === Function)) {
                state.errors.push(
                    LintingError.fromNode(
                        "Do not use Function constructor",
                        node,
                    ),
                );
            }
        },
    });
    return returnValue;
}
