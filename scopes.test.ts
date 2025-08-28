import { parse } from "espree";
import { constructScopes } from "./scopes.ts";
import { assertEquals } from "@std/assert/equals";
import { expect } from "@std/expect";
import { types } from "estree-toolkit";

const ast = (str: string) => {
    return parse(str, { ecmaVersion: 2023 }) as types.Program;
};

Deno.test("adds vars to scope", () => {
    const program = ast("var a = 1");
    assertEquals(constructScopes(program)["-1"], [{ a: { start: 4, end: 5 } }]);
});
Deno.test("adds functions declarations to scope", () => {
    const program = ast("function a() { }");
    const allScopes = constructScopes(program);
    expect(allScopes["-1"]).toEqual([{
        a: { start: 9, end: 10, functionBody: expect.any(Object) },
    }]);
    expect(allScopes["13"]).toEqual([
        {}, // Empty function body
        { a: { start: 9, end: 10, functionBody: expect.any(Object) } }, // Previous scope
    ]);
});
Deno.test("doesn't add functions expressions to scope", () => {
    const program = ast("const a = function() { }");
    const allScopes = constructScopes(program);
    expect(allScopes["-1"]).toEqual([{}]);
});
Deno.test("doesn't add let to scope", () => {
    const program = ast("let a = 1");
    assertEquals(constructScopes(program)["-1"], [{}]);
});
Deno.test("doesn't add const to scope", () => {
    const program = ast("const a = 1");
    assertEquals(constructScopes(program)["-1"], [{}]);
});
Deno.test("outer block scope", () => {
    const program = ast("{}");
    const allScopes = constructScopes(program);
    assertEquals(allScopes["-1"], [{}]);
    assertEquals(allScopes["0"], [{}, {}]);
});
Deno.test("var outside block scope", () => {
    const program = ast("{} var a = 1");
    const allScopes = constructScopes(program);
    assertEquals(allScopes["-1"], [{ a: { start: 7, end: 8 } }]);
    assertEquals(allScopes["0"], [{}, { a: { start: 7, end: 8 } }]);
});
Deno.test("nested block scopes", () => {
    const program = ast(
        `{
            var a = 1;
            function b() {
                var c = 3
            }
        }`,
    );
    const allScopes = constructScopes(program);
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
Deno.test.ignore("handles destructuring arrays", () => {
    const program = ast("const [a, b] = [1, 2]");
    const allScopes = constructScopes(program);
    assertEquals(allScopes["-1"], [{
        a: { start: 0, end: 0 },
        b: { start: 1, end: 1 },
    }]);
});
Deno.test.ignore("handles destructuring deep arrays", () => {
    const program = ast("const [[[a], b], c] = [[[]]]");
    const allScopes = constructScopes(program);
    assertEquals(allScopes["-1"], [{
        a: { start: 0, end: 0 },
        b: { start: 1, end: 1 },
        c: { start: 1, end: 1 },
    }]);
});
Deno.test.ignore("handles array rest operators", () => {});
Deno.test.ignore("handles destructuring objects", () => {
    const program = ast("const {a, b} = {a: 1, b: 2}");
    const allScopes = constructScopes(program);
    assertEquals(allScopes["-1"], [{
        a: { start: 0, end: 0 },
        b: { start: 1, end: 1 },
    }]);
});
Deno.test.ignore("handles destructuring deep objects", () => {});
Deno.test.ignore("handles destructuring object with reassignment", () => {});
Deno.test.ignore("handles object rest operators", () => {});
Deno.test.ignore("handles the kitchen sink", () => {});
