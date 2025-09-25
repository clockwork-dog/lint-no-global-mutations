import { parse } from "espree";
import { constructHoistedScopes } from "./scopes.ts";
import { assertEquals } from "@std/assert/equals";
import { types } from "estree-toolkit";
import { Reference } from "./reference.ts";

const ast = (str: string) => {
    return parse(str, { ecmaVersion: 2023 }) as types.Program;
};

Deno.test("adds vars to scope", () => {
    const program = ast("var a = 1");
    assertEquals(
        constructHoistedScopes(program)["-1"]![1],
        { a: new Reference() },
    );
});
