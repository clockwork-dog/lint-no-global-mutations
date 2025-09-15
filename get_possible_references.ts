import { ANY_STRING, assertIsNodePos } from "./util.ts";
import { Reference } from "./reference.ts";
import { evaluateCallExpression } from "./functions.ts";
import { State } from "./main.ts";

export function getAllProperties(object: unknown) {
    let obj = object;
    const properties = [];
    while (obj !== null) {
        properties.push(...Object.getOwnPropertyNames(obj));
        obj = Object.getPrototypeOf(obj);
    }
    return properties;
}

export function getPossibleReferences(
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
            return new Reference();
        case "UpdateExpression":
            // ++ -- return primitives
            return new Reference();
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
            return new Reference([ex]);
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
