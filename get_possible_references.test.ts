import {
    getAllProperties,
    getPossibleReferences,
} from "./get_possible_references.ts";
import {
    assertArrayIncludes,
    assertEquals,
    assertGreater,
    assertStrictEquals,
} from "@std/assert";
import { Reference } from "./reference.ts";
import { parseEx } from "./test_utils.ts";

Deno.test("gets all properties of array", () => {
    assertArrayIncludes(getAllProperties([1]), ["0"]); // Member properties
    assertArrayIncludes(getAllProperties([]), ["length"]); // Instance properties
    assertArrayIncludes(getAllProperties([]), ["pop"]); // Prototype methods
});
Deno.test("gets all properties of object", () => {
    assertArrayIncludes(getAllProperties({ a: 2 }), ["a"]); // Member properties
    assertArrayIncludes(getAllProperties({}), ["toString"]); // Prototype methods
});

// Useful object references for tests
const REF_A = {};
const REF_B = {};

Deno.test("literals don't have references", () => {
    assertEquals(
        getPossibleReferences(parseEx(`'a'`), []),
        new Reference(["a"]),
    );
    assertEquals(
        getPossibleReferences(parseEx(`1`), []),
        new Reference([1]),
    );
    assertEquals(
        getPossibleReferences(parseEx(`true`), []),
        new Reference([true]),
    );
    assertEquals(
        getPossibleReferences(parseEx(`/a/`), []),
        new Reference([/a/]),
    );
});

Deno.test("finds identifier references", () => {
    const ref = getPossibleReferences(
        parseEx("a"),
        [[null, { a: new Reference([REF_A]) }]],
    );
    assertEquals(ref.get().length, 1);
    assertStrictEquals(ref.get()[0], REF_A);
});

Deno.test("Logical expressions", () => {
    assertEquals(
        getPossibleReferences(
            parseEx(`a || b`),
            [[null, { a: new Reference([REF_A]), b: new Reference([REF_B]) }]],
        ),
        new Reference([REF_A, REF_B]),
    );
    assertEquals(
        getPossibleReferences(
            parseEx(`a && b`),
            [[null, { a: new Reference([REF_A]), b: new Reference([REF_B]) }]],
        ),
        new Reference([REF_A, REF_B]),
    );
    assertEquals(
        getPossibleReferences(
            parseEx(`a ?? b`),
            [[null, { a: new Reference([REF_A]), b: new Reference([REF_B]) }]],
        ),
        new Reference([REF_A, REF_B]),
    );
});

Deno.test("Ternary expressions", () => {
    assertEquals(
        getPossibleReferences(
            parseEx(`Math.random() > 0.5 ? a : b`),
            [[null, { a: new Reference([REF_A]), b: new Reference([REF_B]) }]],
        ),
        new Reference([REF_A, REF_B]),
    );
});

Deno.test("can handle arrays", () => {
    const referenceObj = {};
    const ref = getPossibleReferences(
        parseEx("[a]"),
        [[null, { a: new Reference([referenceObj]) }]],
    );
    assertEquals(ref.get().length, 1);
    assertStrictEquals(ref.getKey(0).get()[0], referenceObj);
});

Deno.test("can handle array spread", () => {
    const refArrA = [REF_A];
    const refArrB = [REF_B];
    const ref = getPossibleReferences(
        parseEx("[...a, ...b]"),
        [[null, { a: new Reference([refArrA]), b: new Reference([refArrB]) }]],
    );

    assertEquals(ref.get().length, 1);
    assertStrictEquals((ref.get()[0] as any)[0], REF_A);
    assertStrictEquals((ref.get()[0] as any)[1], REF_B);
});

Deno.test("can handle simple objects", () => {
    const ref = getPossibleReferences(
        parseEx("({key: a})"),
        [[null, { a: new Reference([REF_A]) }]],
    );

    assertEquals(ref.get().length, 1);
    assertEquals(ref.getKey("key").get().length, 1);
    assertStrictEquals(ref.getKey("key").get()[0], REF_A);
});

Deno.test("can handle nested objects", () => {
    const refs = getPossibleReferences(
        parseEx("({ key: { arr: [a] } })"),
        [[null, { a: new Reference([REF_A]) }]],
    );

    assertEquals(refs.get().length, 1);
    assertEquals(refs.getKey("key").get().length, 1);
    assertStrictEquals(
        refs.getKey("key").getKey("arr").getKey(0).get()[0],
        REF_A,
    );
});

Deno.test("can handle computed keys in objects", () => {
    const ref = getPossibleReferences(
        parseEx("({['k' + 'e' + 'y']: a})"),
        [[null, { a: new Reference([REF_A]) }]],
    );

    assertEquals(ref.get().length, 1);
    assertEquals(ref.getKey("k" + "e" + "y").get().length, 2);
    assertEquals(ref.getKey("random-string").get().length, 2);
    const value = ref.getKey("random-string").get()
        .filter((v) => v !== undefined)[0];
    assertStrictEquals(value, REF_A);
});

Deno.test("preserves Object reference", () => {
    const ref = getPossibleReferences(parseEx("Object"), []);
    assertStrictEquals(ref.get()[0], Object);
});

Deno.test("preserves Object member reference", () => {
    const ref = getPossibleReferences(parseEx("Object.assign"), []);
    assertStrictEquals(ref.get()[0], Object.assign);
});

Deno.test("complex index falls back to all properties", () => {
    const ref = getPossibleReferences(parseEx("Object['as' + 'sign']"), []);
    assertGreater(ref.get().length, 1);
    assertEquals(ref.get().some((value) => value === Object.assign), true);
});

Deno.test("gets properties", () => {
    const ref = getPossibleReferences(parseEx("globalNestedObj.a"), [[null, {
        globalNestedObj: new Reference([{ a: { b: { c: {} } } }]),
    }]]);
    assertEquals(ref.getKey("b").getKey("c").get()[0], {});
});

Deno.test("gets deep properties", () => {
    const ref = getPossibleReferences(parseEx("globalNestedObj.a.b.c"), [[
        null,
        {
            globalNestedObj: new Reference([{ a: { b: { c: {} } } }]),
        },
    ]]);
    assertEquals(ref.get()[0], {});
});
