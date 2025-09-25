import { types } from "estree-toolkit";
import { State } from "./main.ts";
import { Reference } from "./reference.ts";
import { getPossibleReferences } from "./get_possible_references.ts";
import {
    ANY_STRING,
    assertIsFnNode,
    isFnNode,
    LintingError,
    NodePos,
} from "./util.ts";
import { evaluateFnNode } from "./functions.ts";
import { pathToString } from "./deep_references.ts";

type MemberCallExpression = types.Node & {
    type: "CallExpression";
    callee: { type: "MemberExpression" };
};
type CallbackHandler = (
    state: State & { node: MemberCallExpression & NodePos },
) => Reference;
const elemIndexArrCallback = (
    state: State & { node: MemberCallExpression & NodePos },
): [Reference, Reference, Reference] => {
    const array = getPossibleReferences({
        ...state,
        node: state.node.callee.object,
    });
    const index = new Reference([ANY_STRING]);
    const element = array.getKey(ANY_STRING);
    const callbacks = getPossibleReferences({
        ...state,
        node: state.node.arguments[0]!,
    });
    callbacks.get().filter(isFnNode).forEach((callback) => {
        evaluateFnNode({ ...state, node: callback }, [
            element,
            index,
            array,
        ]);
    });

    return [element, index, array];
};
const mutatingMethod = (
    state: State & { node: MemberCallExpression & NodePos },
): Reference => {
    const array = getPossibleReferences({
        ...state,
        node: state.node.callee.object,
    });
    array.get()
        .map((arr) => state.allGlobalRefs.get(arr))
        .filter((arr) => arr != undefined)
        .forEach((path) => {
            state.errors.push(
                LintingError.fromNode(
                    `Can't call mutating array instance method on ${
                        pathToString(path)
                    }`,
                    state.node,
                ),
            );
        });

    return array;
};
const ARRAY_INSTANCE_METHODS = new Map<Function, CallbackHandler>([
    [[].copyWithin, (state) => {
        return mutatingMethod(state);
    }],
    [[].every, (state) => {
        elemIndexArrCallback(state);
        return new Reference([true, false]);
    }],
    [[].fill, (state) => {
        const arr = mutatingMethod(state);
        const arg = getPossibleReferences({
            ...state,
            node: state.node.arguments[0],
        });
        arr.setKey(ANY_STRING, arg);
        return arr;
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
        const array = getPossibleReferences({
            ...state,
            node: state.node.callee.object,
        });
        const index = new Reference([ANY_STRING]);
        const element = array.getKey(ANY_STRING);
        const callbacks = getPossibleReferences({
            ...state,
            node: state.node.arguments[0]!,
        });
        callbacks.get().filter(isFnNode).forEach((callback) => {
            returnValues.push(evaluateFnNode({ ...state, node: callback }, [
                element,
                index,
                array,
            ]));
        });

        return new Reference(returnValues);
    }],
    [[].forEach, (state) => {
        elemIndexArrCallback(state);
        return new Reference();
    }],
    [[].map, (state) => {
        const returnValues: Reference[] = [];
        const array = getPossibleReferences({
            ...state,
            node: state.node.callee.object,
        });
        const index = new Reference([ANY_STRING]);
        const element = array.getKey(ANY_STRING);
        const callbacks = getPossibleReferences({
            ...state,
            node: state.node.arguments[0]!,
        });
        callbacks.get().filter(isFnNode).forEach((callback) => {
            returnValues.push(evaluateFnNode({ ...state, node: callback }, [
                element,
                index,
                array,
            ]));
        });

        return new Reference([returnValues]);
    }],
    [[].pop, (state) => {
        const array = mutatingMethod(state);
        const element = array.getKey(ANY_STRING);
        return element;
    }],
    [[].push, (state) => {
        const arr = mutatingMethod(state);
        state.node.arguments.forEach((arg) => {
            if (arg.type === "SpreadElement") throw new Error("TODO");
            const val = getPossibleReferences({ ...state, node: arg });
            arr.setKey(ANY_STRING, val);
        });
        return new Reference([ANY_STRING]);
    }],
    [[].reduce, (state) => {
        const returnValue = new Reference();
        const array = getPossibleReferences({
            ...state,
            node: state.node.callee.object,
        });
        const index = new Reference([ANY_STRING]);
        const element = array.getKey(ANY_STRING);
        const initialValue = state.node.arguments.length > 1
            ? getPossibleReferences({ ...state, node: state.node.arguments[1] })
            : element;
        const callbacks = getPossibleReferences({
            ...state,
            node: state.node.arguments[0]!,
        });
        const accumulator = new Reference([
            ...element.get(),
            ...initialValue.get(),
        ]);
        callbacks.get().filter(isFnNode).forEach((callback) => {
            returnValue.set(evaluateFnNode({ ...state, node: callback }, [
                accumulator,
                accumulator,
                index,
                array,
            ]));
        });
        return returnValue;
    }],
    [[].reduceRight, (state) => {
        const array = getPossibleReferences({
            ...state,
            node: state.node.callee.object,
        });
        const index = new Reference([ANY_STRING]);
        const element = array.getKey(ANY_STRING);
        const initialValue = state.node.arguments.length > 1
            ? getPossibleReferences({ ...state, node: state.node.arguments[1] })
            : element;
        const accumulator = new Reference([
            ...element.get(),
            ...initialValue.get(),
        ]);
        const callback = state.node.arguments[0]!;
        assertIsFnNode(callback);

        return evaluateFnNode({ ...state, node: callback }, [
            accumulator,
            accumulator,
            index,
            array,
        ]);
    }],
    [[].reverse, (state) => {
        return mutatingMethod(state);
    }],
    [[].shift, (state) => {
        const arr = mutatingMethod(state);
        state.node.arguments.forEach((arg) => {
            if (arg.type === "SpreadElement") throw new Error("TODO");
            const val = getPossibleReferences({ ...state, node: arg });
            arr.setKey(ANY_STRING, val);
        });
        return new Reference([ANY_STRING]);
    }],
    [[].some, (state) => {
        elemIndexArrCallback(state);
        return new Reference([true, false]);
    }],
    [[].sort, (state) => {
        return mutatingMethod(state);
    }],
    [[].splice, (state) => {
        const arr = mutatingMethod(state);
        state.node.arguments.forEach((arg, index) => {
            if (index < 2) return; // first 2 args are from and to
            if (arg.type === "SpreadElement") throw new Error("TODO");
            const val = getPossibleReferences({ ...state, node: arg });
            arr.setKey(ANY_STRING, val);
        });
        return arr;
    }],
    [[].unshift, (state) => {
        const arr = mutatingMethod(state);
        state.node.arguments.forEach((arg) => {
            if (arg.type === "SpreadElement") throw new Error("TODO");
            const val = getPossibleReferences({ ...state, node: arg });
            arr.setKey(ANY_STRING, val);
        });
        return new Reference([ANY_STRING]);
    }],
]);

export function arrayCallbackMethod(
    state: State & { node: types.CallExpression & NodePos },
): Reference {
    const returnValue = new Reference();
    if (state.node.callee.type === "MemberExpression") {
        // Check if mutating array method on global ~ globalArr.pop()
        // Check if callback will get reference to array element ~ globalArr.map(x => x++);
        getPossibleReferences({ ...state, node: state.node.callee }).get()
            .forEach(
                (ref) => {
                    const method = ARRAY_INSTANCE_METHODS.get(
                        ref as any,
                    );
                    if (!method) return;
                    returnValue.set(method(state as any));
                },
            );
    }
    return returnValue;
}
