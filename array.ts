import { types } from "estree-toolkit";
import { State } from "./main.ts";
import { Reference } from "./reference.ts";
import { getPossibleReferences } from "./get_possible_references.ts";
import { LintingError, NodePos } from "./util.ts";

const MUTATING_ARRAY_INSTANCE_METHOD_NAMES = [
    "copyWithin",
    "fill",
    "pop",
    "push",
    "reverse",
    "shift",
    "sort",
    "splice",
    "unshift",
];
const MUTATING_ARRAY_INSTANCE_METHODS = new Set(
    MUTATING_ARRAY_INSTANCE_METHOD_NAMES.map((methodName: any) =>
        [][methodName]
    ),
);

export function arrayCallbackMethod(
    state: State & { node: types.CallExpression & NodePos },
    _args: Reference[],
) {
    const { node, allGlobalRefs, errors } = state;
    // Check if mutating array method on global
    if (node.callee.type === "MemberExpression") {
        const { object } = node.callee;
        if (
            getPossibleReferences({ ...state, node: node.callee }).get()
                .some(
                    (method) =>
                        MUTATING_ARRAY_INSTANCE_METHODS.has(method as any),
                )
        ) {
            getPossibleReferences({ ...state, node: object })
                .get()
                .filter(Array.isArray)
                .filter((arr) => allGlobalRefs.has(arr))
                .forEach(() => {
                    errors.push(
                        LintingError.fromNode("STOP THAT!", node),
                    );
                });
        }
    }
}
