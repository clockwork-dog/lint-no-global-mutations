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
