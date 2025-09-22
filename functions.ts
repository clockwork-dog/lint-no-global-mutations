import { types } from "estree-toolkit";
import { noMutationRecursive, State } from "./main.ts";
import { Reference } from "./reference.ts";
import { FunctionNode, isFnNode, NodePos, References } from "./util.ts";
import { getPossibleReferences } from "./get_possible_references.ts";
import { arrayCallbackMethod } from "./array.ts";
import { objectCallbackMethod } from "./object.ts";

// TODO:
// Recursive functions
// Double check hoisting inside a user function

export function evaluateCallExpression(
    state: State & { node: types.CallExpression & NodePos },
): Reference {
    const { node } = state;
    const returnValue = new Reference();

    // Construct argument array
    // If there are multiple possible functions, args may be mapped to different params
    const args: Reference[] = node.arguments.map((arg) => {
        if (arg.type === "SpreadElement") {
            throw new Error("TODO: spread");
        }
        return getPossibleReferences({ ...state, node: arg });
    });

    // Check all possible functions
    const possFns: Reference = new Reference();
    switch (node.callee.type) {
        case "FunctionExpression":
        case "ArrowFunctionExpression":
            possFns.set(node.callee);
            break;
        default:
            getPossibleReferences({ ...state, node: node.callee })
                .get()
                .forEach((poss) => possFns.set(poss));
            break;
    }

    possFns.get()
        .forEach((fn) => {
            // Only evaluate user functions (which are nodes in the AST)
            if (!isFnNode(fn)) return;
            returnValue.set(evaluateFnNode({ ...state, node: fn }, args));
        });

    // Handle array prototype and object instance methods
    returnValue.set(arrayCallbackMethod(state));
    returnValue.set(objectCallbackMethod(state));

    return returnValue;
}

export function evaluateFnNode(
    state: State & { node: FunctionNode & NodePos },
    args: Reference[],
) {
    const returnValue = new Reference();
    const fn = state.node;

    // Create reference array
    const argumentStack: References = {};
    fn.params.forEach((param, index) => {
        if (param.type !== "Identifier") {
            throw new Error("TODO: destructuring");
        }
        if (!args[index]) {
            throw new Error(`Missing argument at index ${index}`);
        }
        argumentStack[param.name] = args[index];
    });

    // Add to stack
    state.currentRefs.unshift([fn, argumentStack]);

    // Evaluate expression
    returnValue.set(noMutationRecursive(
        fn,
        state.currentRefs,
        state.hoistedRefStacks,
        state.allGlobalRefs,
        state.errors,
    ));

    // Remove from stack
    state.currentRefs.shift();

    return returnValue;
}
