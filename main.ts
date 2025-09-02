import { traverse, types } from "estree-toolkit";
import { constructScopes } from "./scopes.ts";
import {
    assertIsFnNode,
    assertIsNodePos,
    FunctionNode,
    LintingError,
} from "./util.ts";
import { assert } from "@std/assert";
import {
    objectToPossibleReferences,
    PossibleObj,
} from "./object_to_references.ts";
import {
    getPossibleReferences,
    References,
} from "./get_possible_references.ts";

export function noMutation(
    program: types.Program,
    schemaObj: any,
): LintingError[] {
    // Construct global scope
    // Get the current scope stack and attach empty reference arrays
    // These will be populated with possible global references later
    const hoistedScopes = constructScopes(program);
    const hoistedRefs: Record<string | number, PossibleObj[]> = {};
    Object.entries(hoistedScopes).forEach(([start, scopes]) => {
        // TODO: number lookup is gross
        hoistedRefs[start] = scopes.map((scope) => {
            const refs: PossibleObj = {};
            Object.entries(scope).forEach(([name]) => {
                refs[name] = [];
            });
            return refs;
        });
    });
    const [[globalRefs], schemaMap] = objectToPossibleReferences(schemaObj);
    if (typeof globalRefs !== "object" || Array.isArray(globalRefs)) {
        throw new Error(
            `schemaObj was not an object, got ${JSON.stringify(globalRefs)}`,
        );
    }

    const currentHoistedScope = hoistedScopes["-1"]![0]!;
    const currentHoistedRefs: PossibleObj = {};
    Object.entries(currentHoistedScope).forEach(([key]) => {
        currentHoistedRefs[key] = [];
    });
    const currentRefs: PossibleObj[] = [currentHoistedRefs, globalRefs];

    return noMutationRecursive(
        program,
        currentRefs,
        hoistedRefs,
        schemaMap,
    );
}

function noMutationRecursive(
    code:
        | types.Program
        | types.FunctionDeclaration
        | types.FunctionExpression
        | types.ArrowFunctionExpression,
    refsStack: References[],
    hoistedRefs: Record<number, References[]>,
    allSchemaRefs: Map<any, unknown>,
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
                getPossibleReferences(node.argument, currentRefs).some(
                    (ref) => allSchemaRefs.has(ref),
                )
            ) {
                errors.push(
                    LintingError.fromNode(
                        "Cannot update global variable",
                        node,
                    ),
                );
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
                ? getPossibleReferences(node.left, currentRefs)
                : [
                    ...getPossibleReferences(node.left, currentRefs),
                    ...getPossibleReferences(node.left.object, currentRefs),
                ];
            if (possibleMutations.some((ref) => allSchemaRefs.has(ref))) {
                errors.push(
                    LintingError.fromNode(
                        "Cannot reassign global",
                        node,
                    ),
                );
            }

            // TODO:  Update refs of other variables
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
            currentRefs[0]![node.id.name] = [node];
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
                        ) as FunctionNode[],
                    );
                    break;
            }

            possibleFns.forEach(
                (fnNode) => {
                    assertIsFnNode(fnNode);
                    const fnParams: References = {};
                    fnNode.params.forEach((param, index) => {
                        if (param.type !== "Identifier") {
                            throw new Error("TODO");
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
