import { parse } from "espree";
import { traverse, types } from "estree-toolkit";
import {} from "./scopes.test.ts";
import { constructScopes } from "./scopes.ts";
import { assertIsNodePos } from "./util.ts";
import { assert } from "@std/assert";

export type Reference = unknown | types.Node;
export type References = Record<string, Reference[]>;

const Node = parse("").constructor;
function isNode(ref: unknown): ref is Node {
    return ref instanceof Node;
}

export function getPossibleReferences(
    ex: types.Expression,
    referencesStack: References[],
): Reference[] {
    switch (ex.type) {
        case "Literal":
            return [];
        case "Identifier":
            for (const references of referencesStack) {
                if (ex.name in references) {
                    return references[ex.name]!;
                }
            }
            return [];
        case "BinaryExpression":
            // Must return a primitive
            return [];
        case "LogicalExpression":
            // ||, &&, ??
            return [
                ...getPossibleReferences(ex.left, referencesStack),
                ...getPossibleReferences(ex.right, referencesStack),
            ];
        case "ConditionalExpression":
            // condition ? a : b
            return [
                ...getPossibleReferences(ex.consequent, referencesStack),
                ...getPossibleReferences(ex.alternate, referencesStack),
            ];
        case "ArrayExpression": {
            return [
                ex.elements
                    .filter((elem) => elem !== null)
                    .flatMap((elem) => {
                        if (elem.type === "SpreadElement") {
                            return getPossibleReferences(
                                elem.argument,
                                referencesStack,
                            )
                                .filter(Array.isArray)
                                .flatMap((arr) => arr);
                        } else {
                            return getPossibleReferences(elem, referencesStack);
                        }
                    }),
            ];
        }
        case "ObjectExpression": {
            const object: Record<string, unknown[]> = {};
            ex.properties.forEach((property) => {
                if (property.type === "SpreadElement") {
                    //
                } else {
                    const { key, value } = property;
                    if (value.type === "ObjectPattern") return;
                    if (value.type === "ArrayPattern") return;
                    if (value.type === "RestElement") return;
                    if (value.type === "AssignmentPattern") return;

                    switch (key.type) {
                        case "Identifier":
                            object[key.name] = getPossibleReferences(
                                value,
                                referencesStack,
                            );
                            break;
                        case "Literal":
                            if (key.raw === undefined) return;
                            object[key.raw] = getPossibleReferences(
                                value,
                                referencesStack,
                            );
                            break;
                    }
                }
            });
            return [object];
        }
        case "ArrowFunctionExpression":
        case "AssignmentExpression":
        case "AwaitExpression":
        case "CallExpression":
        case "ChainExpression":
        case "ClassExpression":
        case "FunctionExpression":
        case "ImportExpression":
        case "MemberExpression":
        case "MetaProperty":
        case "NewExpression":
        case "SequenceExpression":
        case "TaggedTemplateExpression":
        case "TemplateLiteral":
        case "ThisExpression":
        case "UnaryExpression":
        case "UpdateExpression":
        case "YieldExpression":
        case "JSXElement":
        case "JSXFragment":
            return [];
    }
}

export function noMutation(
    program: types.Program,
    schemaObj: any,
) {
    // Construct global scope
    // Get the current scope stack and attach empty reference arrays
    // These will be populated with possible global references later
    const hoistedScopes = constructScopes(program);
    const hoistedRefs: Record<number, References[]> = {};
    Object.entries(hoistedScopes).forEach(([start, scopes]) => {
        // TODO: number lookup is gross
        hoistedRefs[start as any as number] = scopes.map((scope) => {
            const refs: References = {};
            Object.entries(scope).forEach(([name, nPos]) => {
                refs[name] = { ...nPos, references: [] };
            });
            return refs;
        });
    });
    const globalRefs: References = {};
    Object.entries(schemaObj).forEach(([key, value]) => {
        globalRefs[key] = { start: NaN, end: NaN, references: [value] };
    });

    const currentHoistedScope = hoistedScopes["-1"]![0]!;
    const currentHoistedRefs: References = {};
    Object.entries(currentHoistedScope).forEach(([key, value]) => {
        currentHoistedRefs[key] = { ...value, references: [] };
    });
    let currentRefs: References[] = [currentHoistedRefs, globalRefs];

    traverse(program, {
        // We still need to keep track of non-hoisted variables (let / const)
        // So we just initialize each scope with hoisted variables
        BlockStatement: {
            enter(path) {
                assertIsNodePos(path);
                const newHoistedRefs = hoistedRefs[path.start]?.[0];
                // Each scope should appear in the hoisted scopes, and be indexed by the start
                assert(newHoistedRefs, "");
                currentRefs = [newHoistedRefs, ...currentRefs];
            },
            leave(_path) {
                currentRefs = currentRefs.slice(1);
            },
        },

        VariableDeclaration(path) {
            const node = path?.node;
            assertIsNodePos(node);

            node.declarations.forEach((declaration) => {
                const { init } = declaration;
                if (!init) return;
                // Keep track of all the possibilities of the init
                const possibleReferences = getPossibleReferences(
                    init,
                    currentRefs,
                );
            });
        },
    });
}
