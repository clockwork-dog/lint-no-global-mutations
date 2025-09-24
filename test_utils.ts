import { parse } from "espree";
import { types } from "estree-toolkit";

export const parseEx = (ex: string) => {
    const program = parse(ex, { ecmaVersion: 2023 });
    const firstNode = program.body[0];
    if (firstNode?.type !== "ExpressionStatement") {
        throw new Error(
            `Exprected expression but got ${firstNode?.type}: ${ex}`,
        );
    }
    return firstNode.expression as types.Expression;
};

export const parseDeclaration = (decl: string) => {
    const program = parse(decl, { ecmaVersion: 2023 });
    const firstNode = program.body[0];
    if (firstNode?.type !== "VariableDeclaration") {
        throw new Error(
            `Exprected variable declaration but got ${firstNode?.type}: ${decl}`,
        );
    }
    if (firstNode.declarations.length !== 1) {
        throw new Error(
            `Exprected a single declartation but got ${firstNode.declarations.length}`,
        );
    }
    return firstNode.declarations[0]!;
};
