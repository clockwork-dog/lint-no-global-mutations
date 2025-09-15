import { types } from "estree-toolkit";
import { State } from "./main.ts";
import { Reference } from "./reference.ts";
import { getPossibleReferences } from "./get_possible_references.ts";
import { ANY_STRING, assertIsFnNode, LintingError, NodePos } from "./util.ts";
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
type MemberCallExpression = types.Node & {
    type: "CallExpression";
    callee: { type: "MemberExpression" };
};
type CallbackHandler = (
    state: State & { node: MemberCallExpression },
) => Reference;
const elemIndexArrCallback = (
    state: State & { node: MemberCallExpression },
): [Reference, Reference, Reference] => {
    const callback = state.node.arguments[0]!;
    assertIsFnNode(callback);
    const array = getPossibleReferences({
        ...state,
        node: state.node.callee.object,
    });
    const index = new Reference([ANY_STRING]);
    const element = array.getKey(ANY_STRING);

    evaluateFnNode({ ...state, node: callback }, [
        element,
        index,
        array,
    ]);

    return [element, index, array];
};
const CALLBACK_ARRAY_INSTANCE_METHODS = new Map<Function, CallbackHandler>([
    [[].every, (state) => {
        elemIndexArrCallback(state);
        return new Reference([true, false]);
    }],
    [[].filter, (state) => {
        const [_element, _index, array] = elemIndexArrCallback(state);
        return array;
    }],
    [[].find, (state) => {
        const [element, _index, _array] = elemIndexArrCallback(state);
        return element;
    }],
    [[].findIndex, (state) => {
        elemIndexArrCallback(state);
        return new Reference([undefined, ANY_STRING]);
    }],
    [[].findLast, (state) => {
        const [element, _index, _array] = elemIndexArrCallback(state);
        return element;
    }],
    [[].findLastIndex, (state) => {
        elemIndexArrCallback(state);
        return new Reference([undefined, ANY_STRING]);
    }],
    [[].flatMap, (state) => {
        const returnValues: Reference[] = [];
        const callback = state.node.arguments[0]!;
        assertIsFnNode(callback);
        const array = getPossibleReferences({
            ...state,
            node: state.node.callee.object,
        });
        const index = new Reference([ANY_STRING]);
        const element = array.getKey(ANY_STRING);

        returnValues.push(evaluateFnNode({ ...state, node: callback }, [
            element,
            index,
            array,
        ]));

        return new Reference(returnValues);
    }],
    [[].forEach, (state) => {
        elemIndexArrCallback(state);
        return new Reference();
    }],
    [[].map, (state) => {
        const returnValues: Reference[] = [];
        const callback = state.node.arguments[0]!;
        assertIsFnNode(callback);
        const array = getPossibleReferences({
            ...state,
            node: state.node.callee.object,
        });
        const index = new Reference([ANY_STRING]);
        const element = array.getKey(ANY_STRING);

        returnValues.push(evaluateFnNode({ ...state, node: callback }, [
            element,
            index,
            array,
        ]));

        return new Reference([returnValues]);
    }],
    [[].reduce, (state) => {
        throw new Error("TODO");
    }],
    [[].reduceRight, (state) => {
        throw new Error("TODO");
    }],
    [[].some, (state) => {
        elemIndexArrCallback(state);
        return new Reference([true, false]);
    }],
]);

export function arrayCallbackMethod(
    state: State & { node: types.CallExpression & NodePos },
    _args: Reference[],
): Reference {
    const returnValue = new Reference();
    const { node, allGlobalRefs, errors } = state;
    if (node.callee.type === "MemberExpression") {
        const { object } = node.callee;

        // Check if mutating array method on global ~ globalArr.pop()
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

        // Check if callback will get reference to array element ~ globalArr.map(x => x++);
        getPossibleReferences({ ...state, node: node.callee }).get().forEach(
            (ref) => {
                const method = CALLBACK_ARRAY_INSTANCE_METHODS.get(
                    ref as any,
                );
                if (!method) return;

                const callback = node.arguments[0]!;
                assertIsFnNode(callback);
                returnValue.set(method(state as any));
            },
        );
    }
    return returnValue;
}
