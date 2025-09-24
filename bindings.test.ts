import { getPossibleBindings } from "./bindings.ts";
import { getPossibleReferences } from "./get_possible_references.ts";
import { State } from "./main.ts";
import { Reference } from "./reference.ts";
import { parseDeclaration } from "./test_utils.ts";
import { assertArrayIncludes, assertEquals } from "@std/assert";
import { ANY_STRING } from "./util.ts";

const MOCK_STATE: State = {
    allGlobalRefs: new Map(),
    errors: [],
    currentRefs: [],
    hoistedRefStacks: {},
    node: null,
};

const destructure = (declaration: string) => {
    const decl = parseDeclaration(declaration);
    return getPossibleBindings(
        { ...MOCK_STATE, node: decl.id as any },
        getPossibleReferences({ ...MOCK_STATE, node: decl.init as any }),
    );
};

// All test cases are syntax examples from
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring
Deno.test("array destructure", () => {
    const bindings = destructure(`const [a, b] = [1, 2]`);
    assertEquals(bindings.a?.get(), [1, 2]);
    assertEquals(bindings.b?.get(), [1, 2]);
});
Deno.test("array gap destructure", () => {
    const bindings = destructure(`const [a, , b] = [1, 2, 3]`);
    assertEquals(bindings.a?.get(), [1, 2, 3]);
    assertEquals(bindings.b?.get(), [1, 2, 3]);
});
Deno.test("array default destructure", () => {
    const bindings = destructure(`const [a = 5, b] = [1, 2]`);
    assertEquals(bindings.a!.get(), [1, 2, 5]);
    assertEquals(bindings.b!.get(), [1, 2]);
});
Deno.test("array rest destructure", () => {
    const bindings = destructure(`const [a, b, ...rest] = [1, 2, 3, 4, 5]`);
    assertEquals(bindings.a?.get(), [1, 2, 3, 4, 5]);
    assertEquals(bindings.b?.get(), [1, 2, 3, 4, 5]);
    assertEquals(bindings.rest?.getKey(0).get(), [1, 2, 3, 4, 5]);
});
Deno.test("array rest with gap destructure", () => {
    const bindings = destructure(`const [a, , b, ...rest] = [1, 2, 3, 4, 5]`);
    assertEquals(bindings.a?.get(), [1, 2, 3, 4, 5]);
    assertEquals(bindings.b?.get(), [1, 2, 3, 4, 5]);
    assertEquals(bindings.rest?.getKey(0).get(), [1, 2, 3, 4, 5]);
});
Deno.test.ignore("array element and propery destructure", () => {
    const bindings = destructure(`const [a, b, { length }] = [1, 2, 3, 4, 5]`);
    assertEquals(bindings.a?.get(), [1, 2, 3, 4, 5]);
    assertEquals(bindings.b?.get(), [1, 2, 3, 4, 5]);
    assertEquals(bindings.length?.get(), [ANY_STRING]);
});
Deno.test.ignore("array rest destructured array", () => {
    const bindings = destructure(`const [a, b, ...[c, d]] = [1, 2, 3, 4]`);
    assertEquals(bindings.a?.get(), [1, 2, 3, 4]);
    assertEquals(bindings.b?.get(), [1, 2, 3, 4]);
    assertEquals(bindings.c?.get(), [1, 2, 3, 4]);
    assertEquals(bindings.d?.get(), [1, 2, 3, 4]);
});
Deno.test("object destructure", () => {
    const bindings = destructure(`const {a, b} = {a: 'a', b: 'b'}`);
    assertEquals(bindings.a?.get(), ["a"]);
    assertEquals(bindings.b?.get(), ["b"]);
});
Deno.test("object destructure with assignment", () => {
    const bindings = destructure(`const {a: a1, b: b1} = {a: 'a', b: 'b'}`);
    assertEquals(bindings.a1?.get(), ["a"]);
    assertEquals(bindings.b1?.get(), ["b"]);
});
Deno.test.ignore("object destructure with assignment and default", () => {
    const bindings = destructure(
        `const {a: a1 = 'a1', b: b1 = 'b1'} = {a: 'a', b: 'b'}`,
    );
    assertEquals(bindings.a1?.get(), ["a", "a1"]);
    assertEquals(bindings.b1?.get(), ["b", "b1"]);
});
Deno.test.ignore("object rest destructure", () => {
    const bindings = destructure(
        `const {a, b, ...rest} = {a: 'a', b: 'b', c: 'c'}`,
    );
    assertEquals(bindings.a?.get(), ["a"]);
    assertEquals(bindings.b?.get(), ["b"]);
    assertEquals(bindings.c?.get(), ["a", "b", "c"]);
});
Deno.test.ignore("object rest destructure with assignment", () => {
    const bindings = destructure(
        `const {a: a1, b: b1, ...rest} = {a: 'a', b: 'b', c: 'c'}`,
    );
    assertEquals(bindings.a1?.get(), ["a"]);
    assertEquals(bindings.b1?.get(), ["b"]);
    assertEquals(bindings.c?.get(), ["a", "b", "c"]);
});
Deno.test.ignore("object destructure with computed assignment", () => {
    const bindings = destructure(
        `const { ['a']: a1 } = {a: 'a', b: 'b'}`,
    );
    assertEquals(bindings.a1?.get(), ["a", "b"]);
});
