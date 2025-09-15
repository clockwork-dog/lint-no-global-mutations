import { types } from "estree-toolkit";
import { State } from "./main.ts";
import { Reference } from "./reference.ts";
import { getPossibleReferences } from "./get_possible_references.ts";
import { ANY_STRING, assertIsNodePos, LintingError, NodePos } from "./util.ts";
import { evaluateFnNode } from "./functions.ts";

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

const CALLBACK_ARRAY_INSTANCE_METHOD_NAMES = [
    "every",
    "filter",
    "find",
    "findIndex",
    "findLast",
    "findLastIndex",
    "flatMap",
    "forEach",
    "map",
    "reduce",
    "reduceRight",
    "some",
];
const CALLBACK_ARRAY_INSTANCE_METHODS = new Set(
    CALLBACK_ARRAY_INSTANCE_METHOD_NAMES.map((methodName: any) =>
        [][methodName]
    ),
);

export function arrayCallbackMethod(
    state: State & { node: types.CallExpression & NodePos },
    _args: Reference[],
) {
    const { node, allGlobalRefs, errors } = state;
    if (node.callee.type === "MemberExpression") {
        const { object } = node.callee;

        // Check if mutating array method on global
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

        // Check if callback will get reference to array element
        if (
            getPossibleReferences({ ...state, node: node.callee }).get()
                .some(
                    (method) =>
                        CALLBACK_ARRAY_INSTANCE_METHODS.has(method as any),
                )
        ) {
            const callback = node.arguments[0];
            assertIsNodePos(callback);
            if (
                callback?.type === "ArrowFunctionExpression" ||
                callback?.type === "FunctionExpression"
            ) {
                const array = getPossibleReferences({
                    ...state,
                    node: node.callee.object,
                });
                const index = new Reference([ANY_STRING]);
                const element = array.getKey(ANY_STRING);

                evaluateFnNode({ ...state, node: callback }, [
                    element,
                    index,
                    array,
                ]);
            }
        }
    }
}
