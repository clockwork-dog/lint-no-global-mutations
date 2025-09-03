import { assertEquals } from "@std/assert/equals";
import { collectDeepReferences } from "./deep_references.ts";

Deno.test("Collects nested arrays", () => {
    const inner: never[] = [];
    const middle = [inner];
    const outer = [middle];

    const refs = collectDeepReferences(outer);
    assertEquals(refs.size, 3);
    assertEquals(refs.has(inner), true);
    assertEquals(refs.has(middle), true);
    assertEquals(refs.has(outer), true);
});
