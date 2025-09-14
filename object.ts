import { types } from "estree-toolkit";
import { State } from "./main.ts";
import { Reference } from "./reference.ts";
import { getPossibleReferences } from "./get_possible_references.ts";
import { LintingError, NodePos } from "./util.ts";

const MUTATING_OBJECT_PROTOTYPE_METHOD_NAMES = [
    "assign",
    "defineProperties",
    "defineProperty",
    "freeze",
    "preventExtensions",
    "seal",
    "setPrototypeOf",
];
const MUTATING_OBJECT_PROTOTYPE_METHODS = new Set(
    MUTATING_OBJECT_PROTOTYPE_METHOD_NAMES.map((methodName: any) =>
        (Object as any)[methodName]
    ),
);

export function objectCallbackMethod(
    state: State & { node: types.CallExpression & NodePos },
    args: Reference[],
) {
    const { node, allGlobalRefs, errors } = state;
    if (
        getPossibleReferences({ ...state, node: node.callee }).get().some(
            (method) => MUTATING_OBJECT_PROTOTYPE_METHODS.has(method),
        )
    ) {
        if (
            args.some((arg) =>
                arg.get().some((poss) => allGlobalRefs.has(poss))
            )
        ) {
            errors.push(
                LintingError.fromNode("STOP THAT!", node),
            );
        }
    }
}
