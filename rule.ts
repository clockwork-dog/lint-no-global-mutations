import { Rule } from "eslint";
import {
    getDeepFlags,
    NON_MUTATING_ARRAY_INSTANCE_METHODS,
    Scope,
    setDeepFlags,
} from "./main.ts";

export const meta: Rule.RuleModule["meta"] = {
    type: "problem",
    docs: {
        description: "",
    },
    fixable: "code",
    schema: [],
};

export const create: Rule.RuleModule["create"] = (context) => {
    const scopes: Scope[] = [{}];
    return {
        /**
         * Keep track everywhere where a global reference could be assigned...
         * Declaration: let a = state;
         * Assignment: a.reference = state;
         * Object.assign: Object.assign(a, state);
         *
         * Remember which local variables are in which scope
         */
        VariableDeclarator(node) {
            if (node) {
                const currentScope = scopes[scopes.length - 1];
                switch (node.id.type) {
                    case "Identifier": {
                        const { id } = node;
                        const init = node.init;
                        if (currentScope) {
                            currentScope[id.name] = getDeepFlags(init, scopes);
                        }
                        return;
                    }

                    case "MemberExpression":
                    case "ObjectPattern":
                    case "ArrayPattern":
                    case "RestElement":
                    case "AssignmentPattern":
                }
            }
        },

        /**
         * Be careful!
         * We need to watch for references to naughty things mutation aliases:
         *     const o = Object; o.assign(state, 'key', {value: 'value})
         * But we also need to watch for mutation itself:
         *     Object.assign = () => {};
         */
        AssignmentExpression(node) {
            if (!node) {
                return;
            }

            // Mutation check
            if (
                getDeepFlags(node.left, scopes).isGloballyDependent
            ) {
                context.report({
                    node,
                    message: "oops",
                    data: {},
                });
            }

            // Bookkeeping
            if (getDeepFlags(node.right, scopes).isGloballyDependent) {
                setDeepFlags(node.left, scopes, {
                    isGloballyDependent: true,
                });
            }
            if (node.right.type) {
                //
            }
        },
        /**
         * Keep track of current scope
         */
        BlockStatement() {
            scopes.push({});
        },
        "BlockStatement:exit"() {
            scopes.pop();
        },

        UpdateExpression(node) {
            if (
                node &&
                getDeepFlags(node.argument, scopes).isGloballyDependent
            ) {
                context.report({
                    node,
                    message: "oops",
                });
            }
        },
        CallExpression(node) {
            if (!node) {
                return;
            }
            const callee = node.callee;
            if (callee.type === "Super") {
                return;
            }
            // Object prototype mutation with global as argument
            if (getDeepFlags(callee, scopes).isMutationFunction) {
                context.report({
                    node,
                    message: "oops",
                });
            }

            // Array instance mutation method
            if (
                callee.type === "MemberExpression" &&
                getDeepFlags(callee.object, scopes).isGloballyDependent
            ) {
                if (
                    callee.property.type === "Identifier" &&
                    NON_MUTATING_ARRAY_INSTANCE_METHODS.has(
                        callee.property.name,
                    )
                ) {
                    // These are allowed
                } else {
                    // These are not
                    context.report({
                        node,
                        message: "oops",
                    });
                }
            }
        },
        TaggedTemplateExpression() {
            // TODO: You can execute code this way too
            // Is it possible to mutate something this way?
        },
    };
};
