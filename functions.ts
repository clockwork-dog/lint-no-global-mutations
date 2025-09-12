import { noMutationRecursive, State } from "./main.ts";
import { Reference } from "./reference.ts";
import { FunctionNode, References } from "./util.ts";

// TODO:
// Recursive functions

// This should be the main path
//  -> in main.ts we want to be able to see mutations
//  -> in get_possible_references.ts we want to be able to see return values
// This function should call array/object helpers

// Do I need to make a helper to make it easier to 'call' a function
// I need to add all the args to a new stack

export function evaluateFunction(
    state: State & {
        node: FunctionNode;
    },
    args: Reference[],
): Reference {
    // Create reference array
    const argumentStack: References = {};
    state.node.params.forEach((param, index) => {
        if (param.type !== "Identifier") throw new Error("TODO: destructuring");
        if (!args[index]) throw new Error(`Missing argument at index ${index}`);
        argumentStack[param.name] = args[index];
    });

    // Add to stack
    state.currentRefs.unshift([state.node, argumentStack]);

    // Evaluate expression
    const returnValue = noMutationRecursive(
        state.node,
        state.currentRefs,
        state.hoistedRefStacks,
        state.allGlobalRefs,
        state.errors,
    );

    // Remove from stack
    state.currentRefs.shift();

    return returnValue;
}
