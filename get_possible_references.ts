import { types } from "estree-toolkit";
import { ANY_STRING } from "./util.ts";
import { Reference } from "./reference.ts";

export type ReferenceStack = Record<string, Reference>[];

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
    ex: types.Expression | types.Super | undefined,
    referencesStack: ReferenceStack,
): Reference {
    if (!ex) return new Reference();
    switch (ex.type) {
        case "Literal":
            return new Reference([ex.value]);
        case "Identifier":
            for (const references of referencesStack) {
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
                ...getPossibleReferences(ex.left, referencesStack)
                    .get(),
                ...getPossibleReferences(ex.right, referencesStack)
                    .get(),
            ]);
        case "ConditionalExpression":
            // condition ? a : b
            return new Reference([
                ...getPossibleReferences(ex.consequent, referencesStack)
                    .get(),
                ...getPossibleReferences(ex.alternate, referencesStack)
                    .get(),
            ]);
        case "AssignmentExpression":
            // a = b = {}
            // (a and b are the same reference)
            return getPossibleReferences(ex.right, referencesStack);
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
                        getPossibleReferences(elem.argument, referencesStack)
                            .get()
                            .filter(Array.isArray)
                            .forEach((arr) => {
                                arr.forEach((item) => {
                                    elements.push(item);
                                });
                            });
                    } else {
                        getPossibleReferences(elem, referencesStack)
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
                            object[key.name] = getPossibleReferences(
                                value,
                                referencesStack,
                            );
                            break;
                        case "Literal":
                            if (key.raw === undefined) return;
                            object[key.raw] = getPossibleReferences(
                                value,
                                referencesStack,
                            );
                            break;
                        case "PrivateIdentifier":
                        case "JSXElement":
                        case "JSXFragment":
                        case "ArrayExpression":
                        case "ArrowFunctionExpression":
                        case "AssignmentExpression":
                        case "AwaitExpression":
                        case "BinaryExpression":
                        case "CallExpression":
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
                            object[ANY_STRING] = getPossibleReferences(
                                value,
                                referencesStack,
                            );
                    }
                }
            });
            return new Reference([object]);
        }
        case "MemberExpression": {
            if (ex.object.type === "Super") return new Reference();
            const possibleRefs: unknown[] = [];

            const p = ex.property.type === "Identifier"
                ? ex.property.name
                : ex.property.type === "Literal"
                ? ex.property.value
                : ANY_STRING;

            getPossibleReferences(ex.object, referencesStack)
                .get()
                .forEach((ref) => {
                    if (Array.isArray(ref)) {
                        possibleRefs.push(...ref);
                    } else if (ref instanceof Object && ref !== null) {
                        //@ts-ignore This is as we check `in`
                        if (p in ref) {
                            //@ts-ignore So p must be index type
                            possibleRefs.push(ref[p]);
                        } else {
                            const allProperties = Object
                                .getOwnPropertyNames(ref) as Array<
                                    keyof typeof ref
                                >;
                            for (const property of allProperties) {
                                possibleRefs.push(ref[property]);
                            }

                            possibleRefs.push(...Object.values(ref).flat());
                        }
                    }
                });
            return new Reference(possibleRefs);
        }
        case "ChainExpression":
            // Optional chaining
            return getPossibleReferences(ex.expression, referencesStack);
        case "SequenceExpression":
            // const a = (b = 1, c = 2, d = 3)
            // Returns the last expression
            return getPossibleReferences(
                ex.expressions[ex.expressions.length - 1]!,
                referencesStack,
            );

        // For functions we store the node to get access to params and body
        case "FunctionExpression":
        case "ArrowFunctionExpression":
            return new Reference([ex]);
        case "AwaitExpression":
        case "CallExpression":
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
            return new Reference([]);
    }
}
