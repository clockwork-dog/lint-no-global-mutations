import { noMutation } from "./no_mutation.ts";
import { parse } from "espree";
import { types } from "estree-toolkit";
import { assertThrows } from "@std/assert/throws";

Deno.test("stops global updates", () => {
    const ast = parse("a++", { ecmaVersion: 2023 }) as types.Program;
    assertThrows(() => noMutation(ast, { a: [] }));
});
Deno.test("works", () => {
    const ast = parse(
        `
        const a = [...states];
        a++;`,
        { ecmaVersion: 2023 },
    ) as types.Program;
    noMutation(ast, { states: [{}] });
});

Deno.test("throws", () => {
    const ast = parse(
        `
        const a = [...states];
        a[0]++;`,
        { ecmaVersion: 2023 },
    ) as types.Program;
    assertThrows(() => noMutation(ast, { states: [{}] }));
});
