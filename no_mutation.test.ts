import { noMutation } from "./no_mutation.ts";
import { parse } from "espree";
import { types } from "estree-toolkit";
import { assertThrows } from "@std/assert/throws";

Deno.test("stops global updates", () => {
    const ast = parse("a++", { ecmaVersion: 2023 }) as types.Program;
    assertThrows(() => noMutation(ast, { a: [] }));
});
