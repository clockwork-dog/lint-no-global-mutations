import { types } from "estree-toolkit";
import {
    getAllProperties,
    getPossibleReferences,
} from "./get_possible_references.ts";
import { Reference } from "./reference.ts";
import { ANY_STRING, isInteger } from "./util.ts";
import { assertGreater } from "@std/assert";
import { State } from "./main.ts";

function propertyToPathSegment(
    ex: types.MemberExpression["property"] | types.PrivateIdentifier,
): string | symbol {
    switch (ex.type) {
        case "Identifier":
        case "PrivateIdentifier":
            return ex.name;
        case "Literal":
            return ex.value as string;
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
        case "JSXElement":
        case "JSXFragment":
            return ANY_STRING;
    }
}

type Path = Array<string | symbol>;
export function decomposeMemberExpression(
    ex: types.MemberExpression,
    path: Path = [],
): { root: types.Identifier; path: Path } {
    switch (ex.object.type) {
        case "Identifier":
            return {
                root: ex.object,
                path: [propertyToPathSegment(ex.property), ...path],
            };
        case "MemberExpression": {
            return decomposeMemberExpression(ex.object, [
                propertyToPathSegment(ex.property),
                ...path,
            ]);
        }

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
        case "Literal":
        case "LogicalExpression":
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
        case "JSXElement":
        case "JSXFragment":
        case "Super":
            throw new Error();
    }
}

export function setPossibleReferences(
    left: types.MemberExpression,
    right: types.Expression,
    state: State,
): string | void {
    const value = getPossibleReferences({ ...state, node: right });
    const { root, path } = decomposeMemberExpression(left);

    assertGreater(path.length, 0);
    const finalSegment = path.pop()!;

    const rootRef = getPossibleReferences({ ...state, node: root });
    let possibilities = rootRef.get();

    for (const segment of path) {
        const nextPossibilities = [];
        for (const poss of possibilities) {
            if (poss instanceof Object) {
                if (Array.isArray(poss) && isInteger(segment)) {
                    nextPossibilities.push(...poss);
                } else if (segment === ANY_STRING) {
                    for (const prop of getAllProperties(poss)) {
                        possibilities.push((poss as any)[prop]);
                    }
                } else {
                    possibilities.push((poss as any)[segment]);
                    if (ANY_STRING in poss) {
                        possibilities.push((poss as any)[ANY_STRING]);
                    }
                }
            }
        }
        possibilities = nextPossibilities;
    }

    possibilities.forEach((poss) => {
        if (poss instanceof Object) {
            (poss as any)[finalSegment] = new Reference([
                (poss as any)[finalSegment],
                value,
            ]);
        }
    });
}
