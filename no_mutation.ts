import { traverse, types } from "estree-toolkit";
import { constructScopes } from "./scopes.ts";
import { assertIsNodePos } from "./util.ts";
import { assert } from "@std/assert";
import { collectDeepReferences } from "./deep_references.ts";
import {
    getPossibleReferences,
    References,
} from "./get_possible_references.ts";

export function noMutation(
    program: types.Program,
    schemaObj: any,
) {
    const allSchemaRefs = collectDeepReferences(schemaObj);

    // Construct global scope
    // Get the current scope stack and attach empty reference arrays
    // These will be populated with possible global references later
    const hoistedScopes = constructScopes(program);
    const hoistedRefs: Record<number, References[]> = {};
    Object.entries(hoistedScopes).forEach(([start, scopes]) => {
        // TODO: number lookup is gross
        hoistedRefs[start as any as number] = scopes.map((scope) => {
            const refs: References = {};
            Object.entries(scope).forEach(([name]) => {
                refs[name] = [];
            });
            return refs;
        });
    });
    const globalRefs: References = {};
    Object.entries(schemaObj).forEach(([key, value]) => {
        globalRefs[key] = [value];
    });

    const currentHoistedScope = hoistedScopes["-1"]![0]!;
    const currentHoistedRefs: References = {};
    Object.entries(currentHoistedScope).forEach(([key]) => {
        currentHoistedRefs[key] = [];
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

        UpdateExpression(path) {
            const node = path?.node;
            assertIsNodePos(node);
            if (
                getPossibleReferences(node.argument, currentRefs).some(
                    (ref) => allSchemaRefs.has(ref),
                )
            ) {
                throw new Error("cannae dae that!");
            }
        },

        VariableDeclaration(path) {
            const node = path?.node;
            assertIsNodePos(node);

            node.declarations.forEach((declaration) => {
                const { id, init } = declaration;
                if (id.type !== "Identifier") {
                    throw new Error("TODO: Destructuring");
                }
                if (!init) return;
                // Keep track of all the possibilities of the init
                currentRefs[0]![id.name] = getPossibleReferences(
                    init,
                    currentRefs,
                );
            });
        },
    });
}
