import { ANY_STRING, assertIsNodePos, References } from "./util.ts";
import { Reference } from "./reference.ts";
import { evaluateCallExpression, FunctionNode } from "./functions.ts";
import { noMutation, State } from "./main.ts";
import { globalAccessTracker } from "./global_access_tracker.ts";

export function getAllProperties(object: unknown) {
    let obj = object;
    const properties = [];
    while (obj !== null) {
        properties.push(...Object.getOwnPropertyNames(obj));
        obj = Object.getPrototypeOf(obj);
    }
    return properties;
}

export function getPossibleReferences(state: State): Reference {
    const getImpl = state.getImplementation;
    if (!getImpl) return getInternalReferences(state);

    const ex = state.node;
    if (!ex) return new Reference([ex]);

    switch (ex.type) {
        case "Identifier":
            break;
        case "MemberExpression": {
            if (ex.object.type === "Super") return new Reference();
            const obj = getPossibleReferences({
                ...state,
                node: ex.object,
            });
            let property: string | symbol;

            if (ex.property.type === "Identifier" && !ex.computed) {
                property = ex.property.name;
            } else if (ex.property.type === "Literal") {
                property = String(ex.property.value);
            } else {
                property = ANY_STRING;
            }

            const returnValues: unknown[] = [];

            obj.get().forEach((ref) => {
                const global = state.allGlobalRefs.get(ref);
                if (!global) return;
                const path = [...global, property];
                getImpl(path).forEach(
                    ({ ast, schemaObj }) => {
                        const trackedGlobals = globalAccessTracker(
                            schemaObj,
                            state.allGlobalRefs,
                        );
                        const globalRefs: References = {};
                        Object.entries(trackedGlobals).forEach(
                            ([key, value]) => {
                                globalRefs[key] = new Reference([value]);
                            },
                        );
                        const { errors, returnValue } = noMutation(
                            ast,
                            globalRefs,
                            state.allGlobalRefs,
                        );

                        // Is this necessary?
                        if (typeof returnValue === "object") {
                            state.allGlobalRefs.set(returnValue, path);
                        }

                        state.errors.push(...errors);
                        returnValues.push(returnValue);
                    },
                );
            });

            if (returnValues.length) {
                return new Reference(returnValues);
            }
        }
    }
    return getInternalReferences(state);
}

export function getInternalReferences(
    state: State,
): Reference {
    const ex = state.node;
    const referenceStack = state.currentRefs;
    if (!ex) return new Reference([ex]);
    switch (ex.type) {
        case "Literal":
            return new Reference([ex.value]);
        case "Identifier":
            for (const [, references] of referenceStack) {
                if (ex.name in references) {
                    return references[ex.name]!;
                }
            }
            switch (ex.name) {
                case "Object":
                    return new Reference([Object]);
                case "Array":
                    return new Reference([Array]);
                case "eval":
                    return new Reference([eval]);
                case "Function":
                    return new Reference([Function]);
                default:
                    return new Reference();
            }
        case "BinaryExpression":
            // Must return a primitive
            return new Reference([true, false]);
        case "LogicalExpression":
            // ||, &&, ??
            return new Reference([
                ...getPossibleReferences({ ...state, node: ex.left }).get(),
                ...getPossibleReferences({ ...state, node: ex.right }).get(),
            ]);
        case "ConditionalExpression":
            // condition ? a : b
            return new Reference([
                ...getPossibleReferences({ ...state, node: ex.consequent })
                    .get(),
                ...getPossibleReferences({ ...state, node: ex.alternate })
                    .get(),
            ]);
        case "AssignmentExpression":
            // a = b = {}
            // (a and b are the same reference)
            return getPossibleReferences({ ...state, node: ex.right });
        case "UnaryExpression":
            // Operators + - ! ~ typeof void delete
            // These all return primitives
            return new Reference([ANY_STRING]);
        case "UpdateExpression":
            // ++ -- return primitives
            return new Reference([ANY_STRING]);
        case "ArrayExpression": {
            // TODO: Check this!
            const elements: unknown[] = [];
            ex.elements
                .filter((elem) => elem !== null)
                .forEach((elem) => {
                    if (elem?.type === "SpreadElement") {
                        getPossibleReferences({ ...state, node: elem.argument })
                            .get()
                            .filter(Array.isArray)
                            .forEach((arr) => {
                                arr.forEach((item) => {
                                    elements.push(item);
                                });
                            });
                    } else {
                        getPossibleReferences({ ...state, node: elem })
                            .get()
                            .forEach((p) => elements.push(p));
                    }
                });
            return new Reference([elements]);
        }
        case "ObjectExpression": {
            const object: Record<string | symbol, Reference> = {};
            ex.properties.forEach((property) => {
                if (property.type === "SpreadElement") {
                    throw new Error("TODO: Spread");
                } else {
                    const { key, value } = property;
                    if (value.type === "ObjectPattern") return;
                    if (value.type === "ArrayPattern") return;
                    if (value.type === "RestElement") return;
                    if (value.type === "AssignmentPattern") return;

                    switch (key.type) {
                        case "Identifier":
                            object[key.name] = getPossibleReferences({
                                ...state,
                                node: value,
                            });
                            break;
                        case "Literal":
                            if (key.raw === undefined) return;
                            object[key.raw] = getPossibleReferences({
                                ...state,
                                node: value,
                            });
                            break;
                        case "CallExpression":
                        case "PrivateIdentifier":
                        case "JSXElement":
                        case "JSXFragment":
                        case "ArrayExpression":
                        case "ArrowFunctionExpression":
                        case "AssignmentExpression":
                        case "AwaitExpression":
                        case "BinaryExpression":
                        case "ChainExpression":
                        case "ClassExpression":
                        case "ConditionalExpression":
                        case "FunctionExpression":
                        case "ImportExpression":
                        case "LogicalExpression":
                        case "MemberExpression":
                        case "MetaProperty":
                        case "NewExpression":
                        case "ObjectExpression":
                        case "SequenceExpression":
                        case "TaggedTemplateExpression":
                        case "TemplateLiteral":
                        case "ThisExpression":
                        case "UnaryExpression":
                        case "UpdateExpression":
                        case "YieldExpression":
                            object[ANY_STRING] = getPossibleReferences({
                                ...state,
                                node: value,
                            });
                    }
                }
            });
            return new Reference([object]);
        }
        case "MemberExpression": {
            if (ex.object.type === "Super") return new Reference();
            let property: string | number | symbol;

            if (ex.property.type === "Identifier" && !ex.computed) {
                property = ex.property.name;
            } else if (ex.property.type === "Literal") {
                property = ex.property.value as any;
            } else {
                property = ANY_STRING;
            }

            return getPossibleReferences({ ...state, node: ex.object }).getKey(
                property,
            );
        }
        case "ChainExpression":
            // Optional chaining
            return getPossibleReferences({ ...state, node: ex.expression });
        case "SequenceExpression":
            // const a = (b = 1, c = 2, d = 3)
            // Returns the last expression
            return getPossibleReferences(
                { ...state, node: ex.expressions[ex.expressions.length - 1]! },
            );

        // For functions we store the node to get access to params and body
        case "FunctionExpression":
        case "ArrowFunctionExpression":
            // TODO: Deep clone state
            return new Reference([new FunctionNode({ ...state, node: ex })]);
        case "CallExpression": {
            assertIsNodePos(ex);
            return evaluateCallExpression({ ...state, node: ex });
        }
        case "AwaitExpression":
        case "ClassExpression":
        case "ImportExpression":
        case "MetaProperty":
        case "NewExpression":
        case "TaggedTemplateExpression":
        case "TemplateLiteral":
        case "ThisExpression":
        case "YieldExpression":
        case "JSXElement":
        case "JSXFragment":
        case "Super":
        default:
            return new Reference([]);
    }
}
