import { types } from "estree-toolkit";
import { noMutationRecursive, State } from "./main.ts";
import { Reference } from "./reference.ts";
import {
    FunctionNode,
    isFnNode,
    LintingError,
    NodePos,
    References,
} from "./util.ts";
import { getPossibleReferences } from "./get_possible_references.ts";
import { arrayCallbackMethod } from "./array.ts";
import { objectCallbackMethod } from "./object.ts";
import { getPossibleBindings, REST_BINDING_ERR } from "./bindings.ts";

// About 1% of available JS callstack size
const MAX_CALLSTACK_SIZE = 100;

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
            if (fn === eval) {
                state.errors.push(
                    LintingError.fromNode("Do not use eval", state.node),
                );
            }
            if (fn === Function) {
                state.errors.push(
                    LintingError.fromNode(
                        "Do not use Function constructor",
                        state.node,
                    ),
                );
            }

            // Only evaluate user functions (which are nodes in the AST)
            if (isFnNode(fn) && state.currentRefs.length < MAX_CALLSTACK_SIZE) {
                returnValue.set(
                    evaluateFnNode({ ...state, node: fn }, args),
                );
            }
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
        if (param.type === "RestElement") {
            const restParm = param.argument;
            if (restParm.type !== "Identifier") {
                throw new Error(REST_BINDING_ERR);
            }

            const restArgs = args.slice(index);
            Object.entries(getPossibleBindings(
                { ...state, node: restParm },
                new Reference([restArgs]),
            )).forEach(([k, v]) => {
                argumentStack[k] = v;
            });
        } else {
            Object.entries(getPossibleBindings(
                { ...state, node: param },
                args[index] ?? new Reference([undefined]),
            )).forEach(([k, v]) => {
                argumentStack[k] = v;
            });
        }
    });

    // Add to stack
    state.currentRefs.unshift([fn, argumentStack]);

    // Evaluate expression
    returnValue.set(noMutationRecursive({ ...state, node: fn }));

    // Remove from stack
    state.currentRefs.shift();

    return returnValue;
}
