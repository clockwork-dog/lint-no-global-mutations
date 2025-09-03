import { getPossibleReferences } from "./get_possible_references.ts";
import { parse } from "espree";
import { types } from "estree-toolkit";
import {
    assertArrayIncludes,
    assertEquals,
    assertGreater,
    assertStrictEquals,
} from "@std/assert";
import { ANY_STRING } from "./util.ts";

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
    assertEquals(getPossibleReferences(parseEx(`'a'`), []), []);
    assertEquals(getPossibleReferences(parseEx(`1`), []), []);
    assertEquals(getPossibleReferences(parseEx(`true`), []), []);
    assertEquals(getPossibleReferences(parseEx(`/a/`), []), []);
});

Deno.test("finds identifier references", () => {
    const refs = getPossibleReferences(
        parseEx("a"),
        [{ a: [REF_A] }],
    );
    assertEquals(refs.length, 1);
    assertStrictEquals(refs[0], REF_A);
});

Deno.test("Logical expressions", () => {
    assertEquals(
        getPossibleReferences(
            parseEx(`a || b`),
            [{ a: [REF_A], b: [REF_B] }],
        ),
        [REF_A, REF_B],
    );
    assertEquals(
        getPossibleReferences(
            parseEx(`a && b`),
            [{ a: [REF_A], b: [REF_B] }],
        ),
        [REF_A, REF_B],
    );
    assertEquals(
        getPossibleReferences(
            parseEx(`a ?? b`),
            [{ a: [REF_A], b: [REF_B] }],
        ),
        [REF_A, REF_B],
    );
});

Deno.test("Ternary expressions", () => {
    assertEquals(
        getPossibleReferences(
            parseEx(`Math.random() > 0.5 ? a : b`),
            [{ a: [REF_A], b: [REF_B] }],
        ),
        [REF_A, REF_B],
    );
});

Deno.test("can handle arrays", () => {
    const referenceObj = {};
    const refs = getPossibleReferences(
        parseEx("[a]"),
        [{ a: [referenceObj] }],
    );
    assertEquals(refs.length, 1);
    assertStrictEquals((refs[0] as any)[0], referenceObj);
});

Deno.test("can handle array spread", () => {
    const refArrA = [REF_A];
    const refArrB = [REF_B];
    const refs = getPossibleReferences(
        parseEx("[...a, ...b]"),
        [{ a: [refArrA] }, { b: [refArrB] }],
    );

    assertEquals(refs!.length, 1);
    assertStrictEquals((refs[0] as any)[0], REF_A);
    assertStrictEquals((refs[0] as any)[1], REF_B);
});

Deno.test("can handle simple objects", () => {
    const refs = getPossibleReferences(
        parseEx("({key: a})"),
        [{ a: [REF_A] }],
    );

    assertEquals(refs!.length, 1);
    assertStrictEquals((refs[0] as any).key[0], REF_A);
});

Deno.test("can handle nested objects", () => {
    const refs = getPossibleReferences(
        parseEx("({ key: { arr: [a] } })"),
        [{ a: [REF_A] }],
    );

    assertEquals(refs!.length, 1);
    assertStrictEquals((refs[0] as any).key[0].arr[0][0], REF_A);
});

Deno.test("can handle computed keys in objects", () => {
    const refs = getPossibleReferences(
        parseEx("({['k' + 'e' + 'y']: a})"),
        [{ a: [REF_A] }],
    );

    assertEquals(refs!.length, 1);
    assertStrictEquals((refs[0] as any)[ANY_STRING][0], REF_A);
});

Deno.test("preserves Object reference", () => {
    const refs = getPossibleReferences(parseEx("Object"), []);
    assertStrictEquals(refs[0], Object);
});

Deno.test("preserves Object member reference", () => {
    const refs = getPossibleReferences(parseEx("Object.assign"), []);
    assertStrictEquals(refs[0], Object.assign);
});

Deno.test("complex index falls back to all properties", () => {
    const refs = getPossibleReferences(parseEx("Object['as' + 'sign']"), []);
    assertGreater(refs.length, 1);
    assertArrayIncludes(refs, [Object.assign]);
});

Deno.test.ignore("gets deep properties", () => {
    const refs = getPossibleReferences(parseEx("globalNestedObj.a"), [{
        globalNestedObj: [{ a: [{ b: [{ c: [{}] }] }] }],
    }]);
    assertEquals(refs, [{ b: [{ c: [{}] }] }]);
});
