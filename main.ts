import { traverse, types } from "estree-toolkit";
import { constructHoistedScopes } from "./scopes.ts";
import {
    ANY_STRING,
    assertIsNodePos,
    dedupeErrors,
    LintingError,
    References,
    ReferenceStack,
} from "./util.ts";
import { assert } from "@std/assert";
import { getPossibleReferences } from "./get_possible_references.ts";
import { Reference } from "./reference.ts";
import { pathToString } from "./util.ts";
import { evaluateCallExpression, FunctionNode } from "./functions.ts";
import { getPossibleBindings, REST_BINDING_ERR } from "./bindings.ts";
import { globalAccessTracker } from "./global_access_tracker.ts";

export { ANY_STRING } from "./util.ts";
export { NoGlobalMutations } from "./linter.ts";

export type GetImplementation = (
    path: Array<string | symbol>,
) => Array<{ ast: types.Node; schemaObj: any }>;

export interface State {
    node: types.Node | null | undefined;
    currentRefs: ReferenceStack;
    hoistedRefStacks: Record<string | number, ReferenceStack[number]>;
    allGlobalRefs: Map<unknown, Array<string | symbol>>;
    getImplementation?: GetImplementation;
    errors: LintingError[];
}

export function mutationLinter(
    program: types.Program,
    schemaObj: any,
    getImplementation?: GetImplementation,
): LintingError[] {
    if (typeof schemaObj !== "object" || Array.isArray(schemaObj)) {
        throw new Error(
            `schemaObj was not an object, got ${JSON.stringify(schemaObj)}`,
        );
    }
    const allGlobalRefs: Map<unknown, Array<string | symbol>> = new Map();
    const trackedGlobals = globalAccessTracker(schemaObj, allGlobalRefs);
    const globalRefs: References = {};
    Object.entries(trackedGlobals).forEach(([key, value]) => {
        globalRefs[key] = new Reference([value]);
    });

    return noMutation(
        program,
        globalRefs,
        allGlobalRefs,
        getImplementation,
    ).errors;
}

export function noMutation(
    program: types.Node,
    globalReferences: References,
    allGlobalRefs: Map<unknown, Array<string | symbol>>,
    getImplementation?: GetImplementation,
): { returnValue: Reference; errors: LintingError[] } {
    // Construct global scope
    // Get the current scope stack and attach empty reference arrays
    // These will be populated with possible global references later
    const hoistedRefStacks = constructHoistedScopes(program);
    const [_node, initialHoistedRefs] = hoistedRefStacks["-1"]!;

    const currentRefs: ReferenceStack = [
        [program, initialHoistedRefs],
        [null, globalReferences],
    ];

    const errors: LintingError[] = [];
    const returnValue = noMutationRecursive({
        node: program,
        currentRefs,
        hoistedRefStacks,
        allGlobalRefs,
        errors,
        getImplementation,
    });

    return { returnValue, errors: dedupeErrors(errors) };
}

export function noMutationRecursive(
    state: State,
): Reference {
    const { node, hoistedRefStacks, currentRefs, allGlobalRefs, errors } =
        state;
    const returnValue = new Reference();

    traverse(node, {
        // We still need to keep track of non-hoisted variables (let / const)
        // So we just initialize each scope with hoisted variables
        BlockStatement: {
            enter(path) {
                assertIsNodePos(path.node);
                const newHoistedRefs = hoistedRefStacks[path.node.start];

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

                scope[node.id.name] = new Reference([
                    // TODO: Deep clone state
                    new FunctionNode({
                        ...state,
                        node,
                    }),
                ]);

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

        Program(path) {
            const node = path?.node;
            assertIsNodePos(node);
            if (node.body.length === 1) {
                const body = node.body[0];
                if (body?.type === "ExpressionStatement") {
                    returnValue.set(
                        getPossibleReferences({
                            ...state,
                            node: body.expression,
                        }),
                    );
                }
            }
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
                .filter((ref) => ref != undefined)
                .forEach((path) => {
                    errors.push(
                        LintingError.fromNode(
                            `Cannot mutate global variable ${
                                pathToString(path)
                            }`,
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
                    .filter((ref) => ref != undefined)
                    .forEach((path) => {
                        errors.push(
                            LintingError.fromNode(
                                `Cannot mutate global variable ${
                                    pathToString(path)
                                }`,
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
                .filter((ref) => ref != undefined)
                .forEach((path) => {
                    errors.push(
                        LintingError.fromNode(
                            `Cannot mutate global variable ${
                                pathToString(path)
                            }`,
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
                case "MemberExpression": {
                    const object = getPossibleReferences({
                        ...state,
                        node: node.left.object,
                    });
                    const objectPaths = object.get()
                        .map((ref) => allGlobalRefs.get(ref))
                        .filter((ref) => ref != undefined);
                    if (objectPaths.length) {
                        errors.push(
                            ...objectPaths.map((path) =>
                                LintingError.fromNode(
                                    `Cannot mutate global variable ${
                                        pathToString(path)
                                    }`,
                                    node,
                                )
                            ),
                        );
                        return;
                    }

                    let property: string | symbol;
                    if (
                        node.left.property.type === "Identifier" &&
                        !node.left.computed
                    ) {
                        property = node.left.property.name;
                    } else if (node.left.property.type === "Literal") {
                        property = String(node.left.property.value);
                    } else {
                        property = ANY_STRING;
                    }

                    object.setKey(property, value);

                    break;
                }
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
