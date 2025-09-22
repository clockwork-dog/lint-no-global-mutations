import { types } from "estree-toolkit";
import { State } from "./main.ts";
import { Reference } from "./reference.ts";
import { getPossibleReferences } from "./get_possible_references.ts";
import { ANY_STRING, LintingError, NodePos } from "./util.ts";

const getTarget = (
    state: State & { node: types.CallExpression & NodePos },
): Reference => {
    const target = new Reference();
    const args = state.node.arguments;
    if (args.length < 1) return target;
    const firstArg = args[0]!;

    if (firstArg.type === "SpreadElement") {
        target.set(
            getPossibleReferences({ ...state, node: firstArg.argument })
                .getKey(ANY_STRING),
        );
    } else {
        target.set(getPossibleReferences({ ...state, node: firstArg }));
    }
    return target;
};

const mutatesTarget = (
    target: Reference,
    state: State & { node: types.CallExpression & NodePos },
) => {
    target.get()
        .map((ref) => state.allGlobalRefs.get(ref))
        .filter(Boolean)
        .forEach((path) => {
            state.errors.push(
                LintingError.fromNode(
                    `Cannot call mutating Object prototype method on ${path}`,
                    state.node,
                ),
            );
        });
};

type CallbackHandler = (
    state: State & { node: types.CallExpression & NodePos },
) => Reference;
const OBJECT_PROTOTYPE_METHODS: Map<Function, CallbackHandler> = new Map([
    [Object.assign, (state) => {
        const target = getTarget(state);
        mutatesTarget(target, state);
        return target;
    }],
    [Object.create, (_state) => {
        return new Reference();
    }],
    [Object.defineProperties, (state) => {
        const target = getTarget(state);
        mutatesTarget(target, state);
        return target;
    }],
    [Object.defineProperty, (state) => {
        const target = getTarget(state);
        mutatesTarget(target, state);
        return target;
    }],
    [Object.entries, (state) => {
        const target = getTarget(state);
        return new Reference([
            [ANY_STRING, target.getKey(ANY_STRING)],
        ]);
    }],
    [Object.freeze, (state) => {
        const target = getTarget(state);
        mutatesTarget(target, state);
        return target;
    }],
    [Object.fromEntries, (state) => {
        const target = getTarget(state);
        return new Reference([{ [ANY_STRING]: target.getKey(ANY_STRING) }]);
    }],
    [Object.getOwnPropertyDescriptor, (state) => {
        const target = getTarget(state);
        const descriptor: PropertyDescriptor = {
            value: target.getKey(ANY_STRING),
        };
        return new Reference([undefined, descriptor]);
    }],
    [Object.getOwnPropertyDescriptors, (state) => {
        const target = getTarget(state);
        const descriptor: Record<symbol, PropertyDescriptor> = {
            [ANY_STRING]: { value: target.getKey(ANY_STRING) },
        };

        return new Reference([descriptor]);
    }],
    [Object.getOwnPropertyNames, (_state) => {
        return new Reference([[ANY_STRING]]);
    }],
    [Object.getOwnPropertySymbols, (_state) => {
        return new Reference([[ANY_STRING]]);
    }],
    [Object.getPrototypeOf, (state) => {
        state.errors.push(
            LintingError.fromNode("Don't touch prototypes", state.node),
        );
        return new Reference();
    }],
    [Object.groupBy, (state) => {
        const target = getTarget(state);
        return new Reference([{ [ANY_STRING]: target.getKey(ANY_STRING) }]);
    }],
    [Object.hasOwn, (_state) => {
        return new Reference([true, false]);
    }],
    [Object.is, (_state) => {
        return new Reference([true, false]);
    }],
    [Object.isExtensible, (_state) => {
        return new Reference([true, false]);
    }],
    [Object.isFrozen, (_state) => {
        return new Reference([true, false]);
    }],
    [Object.isSealed, (_state) => {
        return new Reference([true, false]);
    }],
    [Object.keys, (_state) => {
        return new Reference([[ANY_STRING]]);
    }],
    [Object.preventExtensions, (state) => {
        const target = getTarget(state);
        mutatesTarget(target, state);
        return target;
    }],
    [Object.seal, (state) => {
        const target = getTarget(state);
        mutatesTarget(target, state);
        return target;
    }],
    [Object.setPrototypeOf, (state) => {
        const target = getTarget(state);
        mutatesTarget(target, state);
        return target;
    }],
    [Object.values, (state) => {
        const target = getTarget(state);
        return new Reference([[target.getKey(ANY_STRING)]]);
    }],
]);

export function objectCallbackMethod(
    state: State & { node: types.CallExpression & NodePos },
): Reference {
    const returnValue = new Reference();
    getPossibleReferences({ ...state, node: state.node.callee }).get()
        .forEach((ref) => {
            const method = OBJECT_PROTOTYPE_METHODS.get(ref as any);
            if (!method) return;
            returnValue.set(method(state));
        });

    return returnValue;
}
