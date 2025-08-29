import { getPossibleReferences } from "./no_mutation.ts";
import { parse } from "espree";
import { types } from "estree-toolkit";
import { assertEquals, assertStrictEquals } from "@std/assert";

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

Deno.test("getPossibleReferences() literals don't have references", () => {
    assertEquals(getPossibleReferences(parseEx(`'a'`), []), []);
    assertEquals(getPossibleReferences(parseEx(`1`), []), []);
    assertEquals(getPossibleReferences(parseEx(`true`), []), []);
    assertEquals(getPossibleReferences(parseEx(`/a/`), []), []);
});

Deno.test("getPossibleReferences() finds identifier references", () => {
    const refs = getPossibleReferences(
        parseEx("a"),
        [{ a: [REF_A] }],
    );
    assertEquals(refs.length, 1);
    assertStrictEquals(refs[0], REF_A);
});

Deno.test("getPossibleReferences() Logical expressions", () => {
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

Deno.test("getPossibleReferences() Ternary expressions", () => {
    assertEquals(
        getPossibleReferences(
            parseEx(`Math.random() > 0.5 ? a : b`),
            [{ a: [REF_A], b: [REF_B] }],
        ),
        [REF_A, REF_B],
    );
});

Deno.test("getPossibleReferences() can handle arrays", () => {
    const referenceObj = {};
    const refs = getPossibleReferences(
        parseEx("[a]"),
        [{ a: [referenceObj] }],
    );
    assertEquals(refs.length, 1);
    assertStrictEquals((refs[0] as any)[0], referenceObj);
});

Deno.test("getPossibleReferences() can handle array spread", () => {
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

Deno.test("getPossibleReferences() can handle objects", () => {
    const refs = getPossibleReferences(
        parseEx("({key: a})"),
        [{ a: [REF_A] }],
    );

    assertEquals(refs!.length, 1);
    assertStrictEquals((refs[0] as any).key[0], REF_A);
});
