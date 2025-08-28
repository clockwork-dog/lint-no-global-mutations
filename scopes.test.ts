import { parse } from "espree";
import { constructScopes } from "./scopes.ts";
import { assertEquals } from "@std/assert/equals";
import { expect } from "@std/expect";

Deno.test("adds vars to scope", () => {
    const ast = parse("var a = 1", { ecmaVersion: 2023 });
    assertEquals(constructScopes(ast)["-1"], [{ a: { start: 4, end: 5 } }]);
});
Deno.test("adds functions declarations to scope", () => {
    const ast = parse("function a() { }", { ecmaVersion: 2023 });
    const allScopes = constructScopes(ast);
    expect(allScopes["-1"]).toEqual([{
        a: { start: 9, end: 10, functionBody: expect.any(Object) },
    }]);
    expect(allScopes["13"]).toEqual([
        {}, // Empty function body
        { a: { start: 9, end: 10, functionBody: expect.any(Object) } }, // Previous scope
    ]);
});
Deno.test("doesn't add functions expressions to scope", () => {
    const ast = parse("const a = function() { }", { ecmaVersion: 2023 });
    const allScopes = constructScopes(ast);
    expect(allScopes["-1"]).toEqual([{}]);
});
Deno.test("doesn't add let to scope", () => {
    const ast = parse("let a = 1", { ecmaVersion: 2023 });
    assertEquals(constructScopes(ast)["-1"], [{}]);
});
Deno.test("doesn't add const to scope", () => {
    const ast = parse("const a = 1", { ecmaVersion: 2023 });
    assertEquals(constructScopes(ast)["-1"], [{}]);
});
Deno.test("outer block scope", () => {
    const ast = parse("{}", { ecmaVersion: 2023 });
    const allScopes = constructScopes(ast);
    assertEquals(allScopes["-1"], [{}]);
    assertEquals(allScopes["0"], [{}, {}]);
});
Deno.test("var outside block scope", () => {
    const ast = parse("{} var a = 1", { ecmaVersion: 2023 });
    const allScopes = constructScopes(ast);
    assertEquals(allScopes["-1"], [{ a: { start: 7, end: 8 } }]);
    assertEquals(allScopes["0"], [{}, { a: { start: 7, end: 8 } }]);
});
Deno.test("nested block scopes", () => {
    const ast = parse(
        `{
            var a = 1;
            function b() {
                var c = 3
            }
        }`,
        { ecmaVersion: 2023 },
    );
    const allScopes = constructScopes(ast);
    expect(allScopes["-1"]).toEqual([{}]);
    expect(allScopes["0"]).toEqual([{
        a: { start: 18, end: 19 },
        b: { start: 46, end: 47, functionBody: expect.any(Object) },
    }, {}]);
    expect(allScopes["50"]).toEqual([{
        c: { start: 72, end: 73 },
    }, {
        a: { start: 18, end: 19 },
        b: { start: 46, end: 47, functionBody: expect.any(Object) },
    }, {}]);
});
