import { types } from "estree-toolkit";
import { noMutationRecursive, State } from "./main.ts";
import { Reference } from "./reference.ts";
import { isFnNode, NodePos, References } from "./util.ts";
import { getPossibleReferences } from "./get_possible_references.ts";
import { arrayCallbackMethod } from "./array.ts";
import { objectCallbackMethod } from "./object.ts";

// TODO:
// Recursive functions

// This should be the main path
//  -> in main.ts we want to be able to see mutations
//  -> in get_possible_references.ts we want to be able to see return values
// This function should call array/object helpers

// Do I need to make a helper to make it easier to 'call' a function
// I need to add all the args to a new stack

// Double check hoisting inside a user function

export function evaluateCallExpression(
    state: State & { node: types.CallExpression & NodePos },
): Reference {
    const { node, currentRefs } = state;
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
        });

    // Handle array prototype and object instance methods
    arrayCallbackMethod(state, args);
    objectCallbackMethod(state, args);

    return returnValue;
}
