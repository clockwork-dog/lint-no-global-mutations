import { types } from "estree-toolkit";
import { parse } from "espree";
import { ANY_STRING } from "./util.ts";

export type Reference = unknown | types.Node;
export type References = Record<string, Reference[]>;

const Node = parse("").constructor;
function isNode(ref: unknown): ref is Node {
    return ref instanceof Node;
}

export function getPossibleReferences(
    ex: types.Expression,
    referencesStack: References[],
): Reference[] {
    switch (ex.type) {
        case "Literal":
            return [];
        case "Identifier":
            for (const references of referencesStack) {
                if (ex.name in references) {
                    return references[ex.name]!;
                }
            }
            return [];
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
        case "ArrowFunctionExpression":
        case "AssignmentExpression":
        case "AwaitExpression":
        case "CallExpression":
        case "ChainExpression":
        case "ClassExpression":
        case "FunctionExpression":
        case "ImportExpression":
        case "MemberExpression":
        case "MetaProperty":
        case "NewExpression":
        case "SequenceExpression":
        case "TaggedTemplateExpression":
        case "TemplateLiteral":
        case "ThisExpression":
        case "UnaryExpression":
        case "UpdateExpression":
        case "YieldExpression":
        case "JSXElement":
        case "JSXFragment":
            return [];
    }
}
