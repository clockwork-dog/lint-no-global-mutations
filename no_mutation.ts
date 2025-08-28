import { traverse, types } from "estree-toolkit";
import {} from "./scopes.test.ts";
import { constructScopes } from "./scopes.ts";
import { assertIsNodePos, NodePos } from "./util.ts";
import { assert } from "@std/assert";

export type Reference = NodePos & {
    references: any[];
};
export type References = Record<string, Reference>;

export function getPossibleReferences(
    ex: types.Expression | types.SpreadElement,
    referencesStack: References[],
): Reference[] {
    switch (ex.type) {
        case "Literal":
            return [];
        case "Identifier":
            for (const references of referencesStack) {
                if (ex.name in references) {
                    return [references[ex.name]!];
                }
            }
            return [];
        case "ArrayExpression":
            return ex.elements
                .filter((elem) => elem !== null)
                .flatMap((elem) =>
                    getPossibleReferences(elem, referencesStack)
                );
        case "ArrowFunctionExpression":
        case "AssignmentExpression":
        case "AwaitExpression":
        case "BinaryExpression":
        case "CallExpression":
        case "ChainExpression":
        case "ClassExpression":
        case "ConditionalExpression":
        case "FunctionExpression":
        case "ImportExpression":
        case "LogicalExpression":
        case "MemberExpression":
        case "MetaProperty":
        case "NewExpression":
        case "ObjectExpression":
        case "SequenceExpression":
        case "TaggedTemplateExpression":
        case "TemplateLiteral":
        case "ThisExpression":
        case "UnaryExpression":
        case "UpdateExpression":
        case "YieldExpression":
        case "JSXElement":
        case "JSXFragment":
        case "SpreadElement":
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
