import { assertEquals } from "@std/assert/equals";
import { objectToPossibleReferences } from "./object_to_references.ts";
import { ANY_STRING } from "./util.ts";
import { assertStrictEquals } from "@std/assert/strict-equals";

Deno.test("values are wrapped in an array", () => {
    assertEquals(objectToPossibleReferences(true)[0], [true]);
    assertEquals(objectToPossibleReferences(0)[0], [0]);
    assertEquals(objectToPossibleReferences("a")[0], ["a"]);
    assertEquals(objectToPossibleReferences([])[0], [[]]);
    assertEquals(objectToPossibleReferences({})[0], [{}]);
});

Deno.test("arrays keep possible elements", () => {
    const [refs] = objectToPossibleReferences([1, 2, 3]);
    assertEquals(refs, [[1, 2, 3]]);
});

Deno.test("objects preserve their keys", () => {
    const [refs] = objectToPossibleReferences({ a: 1, b: 2 });
    assertEquals(refs, [{ a: [1], b: [2] }]);
});

Deno.test("objecs can use ANY_STRING", () => {
    const [refs] = objectToPossibleReferences({ [ANY_STRING]: true });
    assertEquals(refs, [{ [ANY_STRING]: [true] }]);
});

Deno.test("deep objects", () => {
    const [refs] = objectToPossibleReferences({ a: { b: { c: "abc" } } });
    assertEquals(refs, [{ a: [{ b: [{ c: ["abc"] }] }] }]);
});

Deno.test("deep arrays", () => {
    const [refs] = objectToPossibleReferences([[[0]]]);
    assertEquals(refs, [[[[0]]]]);
});

Deno.test("mixed arrays", () => {
    const [refs] = objectToPossibleReferences([[[0], { a: 1 }]]);
    assertEquals(refs, [[[[0], { a: [1] }]]]);
});

Deno.test("mixed objects", () => {
    const [refs] = objectToPossibleReferences({
        keys: ["a", "b", "c"],
        values: [1, 2, 3],
    });
    assertEquals(refs, [{ keys: [["a", "b", "c"]], values: [[1, 2, 3]] }]);
});

Deno.test("returns object references", () => {
    const a = {};
    const b = { a };
    const c = { b };
    const [refs, map] = objectToPossibleReferences(c) as any;
    assertEquals(refs, [{ b: [{ a: [{}] }] }]);
    assertStrictEquals(map.get(refs[0]), c);
    assertStrictEquals(map.get(refs[0].b[0]), b);
    assertStrictEquals(map.get(refs[0].b[0].a[0]), a);
});
