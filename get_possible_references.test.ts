import { getPossibleReferences } from "./get_possible_references.ts";
import { parse } from "espree";
import { types } from "estree-toolkit";
import { assertEquals, assertGreater, assertStrictEquals } from "@std/assert";
import { Reference } from "./reference.ts";

const parseEx = (ex: string) => {
    const program = parse(ex, { ecmaVersion: 2023 });
    const firstNode = program.body[0];
    if (firstNode?.type !== "ExpressionStatement") {
        throw new Error(
            `Exprected expression but got ${firstNode?.type}: ${ex}`,
        );
    }
    return firstNode.expression as types.Expression;
};

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
        [{ a: new Reference([REF_A]) }],
    );
    assertEquals(ref.unwrap().length, 1);
    assertStrictEquals(ref.unwrap()[0], REF_A);
});

Deno.test("Logical expressions", () => {
    assertEquals(
        getPossibleReferences(
            parseEx(`a || b`),
            [{ a: new Reference([REF_A]), b: new Reference([REF_B]) }],
        ),
        new Reference([REF_A, REF_B]),
    );
    assertEquals(
        getPossibleReferences(
            parseEx(`a && b`),
            [{ a: new Reference([REF_A]), b: new Reference([REF_B]) }],
        ),
        new Reference([REF_A, REF_B]),
    );
    assertEquals(
        getPossibleReferences(
            parseEx(`a ?? b`),
            [{ a: new Reference([REF_A]), b: new Reference([REF_B]) }],
        ),
        new Reference([REF_A, REF_B]),
    );
});

Deno.test("Ternary expressions", () => {
    assertEquals(
        getPossibleReferences(
            parseEx(`Math.random() > 0.5 ? a : b`),
            [{ a: new Reference([REF_A]), b: new Reference([REF_B]) }],
        ),
        new Reference([REF_A, REF_B]),
    );
});

Deno.test("can handle arrays", () => {
    const referenceObj = {};
    const ref = getPossibleReferences(
        parseEx("[a]"),
        [{ a: new Reference([referenceObj]) }],
    );
    assertEquals(ref.unwrap().length, 1);
    assertStrictEquals(ref.get(0).unwrap()[0], referenceObj);
});

Deno.test("can handle array spread", () => {
    const refArrA = [REF_A];
    const refArrB = [REF_B];
    const ref = getPossibleReferences(
        parseEx("[...a, ...b]"),
        [{ a: new Reference([refArrA]) }, { b: new Reference([refArrB]) }],
    );

    assertEquals(ref.unwrap().length, 1);
    assertStrictEquals((ref.unwrap()[0] as any)[0], REF_A);
    assertStrictEquals((ref.unwrap()[0] as any)[1], REF_B);
});

Deno.test("can handle simple objects", () => {
    const ref = getPossibleReferences(
        parseEx("({key: a})"),
        [{ a: new Reference([REF_A]) }],
    );

    assertEquals(ref.unwrap().length, 1);
    assertEquals(ref.get("key").unwrap().length, 1);
    assertStrictEquals(ref.get("key").unwrap()[0], REF_A);
});

Deno.test("can handle nested objects", () => {
    const refs = getPossibleReferences(
        parseEx("({ key: { arr: [a] } })"),
        [{ a: new Reference([REF_A]) }],
    );

    assertEquals(refs.unwrap().length, 1);
    assertEquals(refs.get("key").unwrap().length, 1);
    assertStrictEquals(refs.get("key").get("arr").get(0).unwrap()[0], REF_A);
});

Deno.test("can handle computed keys in objects", () => {
    const ref = getPossibleReferences(
        parseEx("({['k' + 'e' + 'y']: a})"),
        [{ a: new Reference([REF_A]) }],
    );

    assertEquals(ref.unwrap().length, 1);
    assertEquals(ref.get("k" + "e" + "y").unwrap().length, 2);
    assertEquals(ref.get("random-string").unwrap().length, 2);
    const value = ref.get("random-string").unwrap()
        .filter((v) => v !== undefined)[0];
    assertStrictEquals(value, REF_A);
});

Deno.test("preserves Object reference", () => {
    const ref = getPossibleReferences(parseEx("Object"), []);
    assertStrictEquals(ref.unwrap()[0], Object);
});

Deno.test("preserves Object member reference", () => {
    const ref = getPossibleReferences(parseEx("Object.assign"), []);
    assertStrictEquals(ref.unwrap()[0], Object.assign);
});

Deno.test("complex index falls back to all properties", () => {
    const ref = getPossibleReferences(parseEx("Object['as' + 'sign']"), []);
    assertGreater(ref.unwrap().length, 1);
    assertEquals(ref.unwrap().some((value) => value === Object.assign), true);
});

Deno.test("gets deep properties", () => {
    const ref = getPossibleReferences(parseEx("globalNestedObj.a"), [{
        globalNestedObj: new Reference([{ a: { b: { c: {} } } }]),
    }]);
    assertEquals(ref.get("b").get("c").unwrap()[0], {});
});
