import { getPossibleReferences } from "./no_mutation.ts";
import { parse } from "espree";
import { types } from "estree-toolkit";
import { assertEquals, assertStrictEquals } from "@std/assert";

const parseEx = (ex: string) => {
    const program = parse(ex);
    const firstNode = program.body[0];
    if (firstNode?.type !== "ExpressionStatement") {
        throw new Error(
            `Exprected expression but got ${firstNode?.type}: ${ex}`,
        );
    }
    return firstNode.expression as types.Expression;
};

Deno.test("getPossibleReferences() literals don't have references", () => {
    assertEquals(getPossibleReferences(parseEx(`'a'`), []), []);
    assertEquals(getPossibleReferences(parseEx(`1`), []), []);
    assertEquals(getPossibleReferences(parseEx(`true`), []), []);
    assertEquals(getPossibleReferences(parseEx(`/a/`), []), []);
});

Deno.test("getPossibleReferences() finds identifier references", () => {
    const referenceObj = {};
    const refs = getPossibleReferences(
        parseEx("n"),
        [{ n: { start: 0, end: 1, references: [referenceObj] } }],
    );

    assertEquals(refs!.length, 1);
    const ref = refs![0]!;
    assertEquals(ref.references.length, 1);
    assertStrictEquals(ref.references[0], referenceObj);
});

Deno.test("getPossibleReferences() can handle arrays", () => {
    const referenceObj = {};
    const refs = getPossibleReferences(
        parseEx("[n]"),
        [{ n: { start: 0, end: 1, references: [referenceObj] } }],
    );

    assertEquals(refs!.length, 1);
    const ref = refs![0]!;
    assertStrictEquals(ref.references[0], referenceObj);
});
