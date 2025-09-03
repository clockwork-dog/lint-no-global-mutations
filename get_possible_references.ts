import { types } from "estree-toolkit";
import { ANY_STRING } from "./util.ts";

export type Reference = unknown | types.Node;
export type References = Record<string, Reference[]>;
export function getPossibleReferences(
    ex: types.Expression | types.Super | undefined,
    referencesStack: References[],
): Reference[] {
    if (!ex) return [];
    switch (ex.type) {
        case "Literal":
            return [];
        case "Identifier":
            for (const references of referencesStack) {
                if (ex.name in references) {
                    return references[ex.name]!;
                }
            }
            switch (ex.name) {
                case "Object":
                    return [Object];
                case "Array":
                    return [Array];
                default:
                    return [];
            }
        case "BinaryExpression":
            // Must return a primitive
            return [];
        case "LogicalExpression":
            // ||, &&, ??
            return [
                ...getPossibleReferences(ex.left, referencesStack),
                ...getPossibleReferences(ex.right, referencesStack),
            ];
        case "ConditionalExpression":
            // condition ? a : b
            return [
                ...getPossibleReferences(ex.consequent, referencesStack),
                ...getPossibleReferences(ex.alternate, referencesStack),
            ];
        case "AssignmentExpression":
            // a = b = {}
            // (a and b are the same reference)
            return getPossibleReferences(ex.right, referencesStack);
        case "UnaryExpression":
            // Operators + - ! ~ typeof void delete
            // These all return primitives
            return [];
        case "UpdateExpression":
            // ++ -- return primitives
            return [];
        case "ArrayExpression": {
            return [
                ex.elements
                    .filter((elem) => elem !== null)
                    .flatMap((elem) => {
                        if (elem.type === "SpreadElement") {
                            return getPossibleReferences(
                                elem.argument,
                                referencesStack,
                            )
                                .filter(Array.isArray)
                                .flatMap((arr) => arr);
                        } else {
                            return getPossibleReferences(elem, referencesStack);
                        }
                    }),
            ];
        }
        case "ObjectExpression": {
            const object: Record<string | symbol, unknown[]> = {};
            ex.properties.forEach((property) => {
                if (property.type === "SpreadElement") {
                    //
                } else {
                    const { key, value } = property;
                    if (value.type === "ObjectPattern") return;
                    if (value.type === "ArrayPattern") return;
                    if (value.type === "RestElement") return;
                    if (value.type === "AssignmentPattern") return;

                    switch (key.type) {
                        case "Identifier":
                            object[key.name] ??= [];
                            object[key.name]?.push(...getPossibleReferences(
                                value,
                                referencesStack,
                            ));
                            break;
                        case "Literal":
                            if (key.raw === undefined) return;
                            object[key.raw] ??= [];
                            object[key.raw]?.push(...getPossibleReferences(
                                value,
                                referencesStack,
                            ));
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
                            object[ANY_STRING] ??= [];
                            object[ANY_STRING].push(
                                ...getPossibleReferences(
                                    value,
                                    referencesStack,
                                ),
                            );
                    }
                }
            });
            return [object];
        }
        case "MemberExpression": {
            const possibleRefs: unknown[] = [];
            if (ex.object.type === "Super") return [];

            const p = ex.property.type === "Identifier"
                ? ex.property.name
                : ex.property.type === "Literal"
                ? ex.property.value
                : ANY_STRING;

            getPossibleReferences(ex.object, referencesStack).forEach((ref) => {
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
            return possibleRefs;
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
            return [ex];
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
            return [];
    }
}
