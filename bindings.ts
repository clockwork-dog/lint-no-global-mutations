import { types } from "estree-toolkit";
import { State } from "./main.ts";
import { Reference } from "./reference.ts";
import { ANY_STRING } from "./util.ts";
import { getPossibleReferences } from "./get_possible_references.ts";

export const REST_BINDING_ERR = "Unknown rest format, expected Identifier";
export const ASSIGN_BINDING_ERR =
    "Unknown assignment format, expected Identifier";

export function getPossibleBindings(
    state: State & {
        node: Exclude<types.Pattern, types.RestElement>;
    },
    init: Reference,
): Record<string, Reference> {
    const bindings: Record<string, Reference> = {};

    switch (state.node.type) {
        case "Identifier":
            bindings[state.node.name] = init;
            break;

        case "ArrayPattern": {
            const possValues = init.getKey(0);
            state.node.elements
                .filter((elem) => elem !== null)
                .forEach((elem) => {
                    if (elem.type === "RestElement") {
                        /// [...rest] = arr
                        if (elem.argument.type !== "Identifier") {
                            throw new Error(REST_BINDING_ERR);
                        }
                        bindings[elem.argument.name] = new Reference([[
                            possValues,
                        ]]);
                    } else if (elem.type === "AssignmentPattern") {
                        /// [a = defaultValue] = arr
                        if (elem.left.type !== "Identifier") {
                            throw new Error(ASSIGN_BINDING_ERR);
                        }
                        const defaultValue = getPossibleReferences({
                            ...state,
                            node: elem.right,
                        });
                        bindings[elem.left.name] = new Reference([
                            possValues,
                            defaultValue,
                        ]);
                    } else {
                        /// [a] = arr
                        Object.entries(getPossibleBindings(
                            { ...state, node: elem },
                            possValues,
                        ))
                            .forEach(([k, v]) => bindings[k] = v);
                    }
                });
            break;
        }

        case "ObjectPattern": {
            state.node.properties
                .forEach((prop) => {
                    if (prop.type === "RestElement") {
                        const arg = prop.argument;
                        const possValues = init.getKey(ANY_STRING);
                        if (arg.type !== "Identifier") {
                            throw new Error(REST_BINDING_ERR);
                        }
                        bindings[arg.name] = new Reference([{
                            [ANY_STRING]: possValues,
                        }]);
                    } else {
                        const { key, value } = prop;
                        if (key.type !== "Identifier") {
                            throw new Error(ASSIGN_BINDING_ERR);
                        }
                        if (value.type === "RestElement") {
                            throw new Error(REST_BINDING_ERR);
                        }
                        const keyName = prop.computed ? ANY_STRING : key.name;

                        Object.entries(getPossibleBindings(
                            { ...state, node: value },
                            init.getKey(keyName),
                        ))
                            .forEach(([k, v]) => bindings[k] = v);
                    }
                });
            break;
        }

        case "MemberExpression":
        case "AssignmentPattern":
            throw new Error("Unknown destructuring pattern");
    }
    return bindings;
}
