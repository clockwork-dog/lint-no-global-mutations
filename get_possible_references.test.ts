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
import { References } from "./util.ts";

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

function getEx(expression: string, refs: References = {}) {
    const ex = parseEx(expression);
    return getPossibleReferences({
        node: ex,
        currentRefs: [[null, refs]],
        errors: [],
        hoistedRefStacks: {},
        allGlobalRefs: new Map(),
    });
}

Deno.test("literals", () => {
    assertEquals(getEx(`'a'`), new Reference(["a"]));
    assertEquals(getEx(`1`), new Reference([1]));
    assertEquals(getEx(`true`), new Reference([true]));
    assertEquals(getEx(`/a/`), new Reference([/a/]));
});

Deno.test("finds identifier references", () => {
    const ref = getEx("a", { a: new Reference([REF_A]) });
    assertEquals(ref.get().length, 1);
    assertStrictEquals(ref.get()[0], REF_A);
});

Deno.test("Logical expressions", () => {
    assertEquals(
        getEx(`a || b`, {
            a: new Reference([REF_A]),
            b: new Reference([REF_B]),
        }),
        new Reference([REF_A, REF_B]),
    );
    assertEquals(
        getEx(`a && b`, {
            a: new Reference([REF_A]),
            b: new Reference([REF_B]),
        }),
        new Reference([REF_A, REF_B]),
    );
    assertEquals(
        getEx(`a ?? b`, {
            a: new Reference([REF_A]),
            b: new Reference([REF_B]),
        }),
        new Reference([REF_A, REF_B]),
    );
});

Deno.test("Ternary expressions", () => {
    assertEquals(
        getEx(`Math.random() > 0.5 ? a : b`, {
            a: new Reference([REF_A]),
            b: new Reference([REF_B]),
        }),
        new Reference([REF_A, REF_B]),
    );
});

Deno.test("can handle arrays", () => {
    const referenceObj = {};
    const ref = getEx("[a]", { a: new Reference([referenceObj]) });
    assertEquals(ref.get().length, 1);
    assertStrictEquals(ref.getKey(0).get()[0], referenceObj);
});

Deno.test("can handle array spread", () => {
    const refArrA = [REF_A];
    const refArrB = [REF_B];
    const ref = getEx("[...a, ...b]", {
        a: new Reference([refArrA]),
        b: new Reference([refArrB]),
    });

    assertEquals(ref.get().length, 1);
    assertStrictEquals((ref.get()[0] as any)[0], REF_A);
    assertStrictEquals((ref.get()[0] as any)[1], REF_B);
});

Deno.test("can handle simple objects", () => {
    const ref = getEx("({key: a})", { a: new Reference([REF_A]) });

    assertEquals(ref.get().length, 1);
    assertEquals(ref.getKey("key").get().length, 1);
    assertStrictEquals(ref.getKey("key").get()[0], REF_A);
});

Deno.test("can handle nested objects", () => {
    const refs = getEx("({ key: { arr: [a] } })", {
        a: new Reference([REF_A]),
    });

    assertEquals(refs.get().length, 1);
    assertEquals(refs.getKey("key").get().length, 1);
    assertStrictEquals(
        refs.getKey("key").getKey("arr").getKey(0).get()[0],
        REF_A,
    );
});

Deno.test("can handle computed keys in objects", () => {
    const ref = getEx("({['k' + 'e' + 'y']: a})", {
        a: new Reference([REF_A]),
    });

    assertEquals(ref.get().length, 1);
    assertEquals(ref.getKey("k" + "e" + "y").get().length, 2);
    assertEquals(ref.getKey("random-string").get().length, 2);
    const value = ref.getKey("random-string").get()
        .filter((v) => v !== undefined)[0];
    assertStrictEquals(value, REF_A);
});

Deno.test("preserves Object reference", () => {
    const ref = getEx("Object");
    assertStrictEquals(ref.get()[0], Object);
});

Deno.test("preserves Object member reference", () => {
    const ref = getEx("Object.assign");
    assertStrictEquals(ref.get()[0], Object.assign);
});

Deno.test("complex index falls back to all properties", () => {
    const ref = getEx("Object['as' + 'sign']");
    assertGreater(ref.get().length, 1);
    assertEquals(ref.get().some((value) => value === Object.assign), true);
});

Deno.test("gets properties", () => {
    const ref = getEx("globalNestedObj.a", {
        globalNestedObj: new Reference([{ a: { b: { c: {} } } }]),
    });
    assertEquals(ref.getKey("b").getKey("c").get()[0], {});
});

Deno.test("gets deep properties", () => {
    const ref = getEx("globalNestedObj.a.b.c", {
        globalNestedObj: new Reference([{ a: { b: { c: {} } } }]),
    });
    assertEquals(ref.get()[0], {});
});
