import { assertEquals } from "@std/assert/equals";
import { collectDeepReferences, pathToString } from "./deep_references.ts";

Deno.test("simple path", () => {
    assertEquals(pathToString(["a", "b", "c"]), "a.b.c");
});
Deno.test("path with spaces", () => {
    assertEquals(
        pathToString(["scenes", "My Scene", "values"]),
        'scenes["My Scene"].values',
    );
});
Deno.test("private member", () => {
    assertEquals(pathToString(["obj", "__private"]), "obj.__private");
});

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

Deno.test("Creates path", () => {
    const global = {
        outer: {
            middle: {
                inner: {
                    key: "value",
                },
            },
        },
    };
    const refs = collectDeepReferences(global);
    assertEquals(refs.get(global.outer.middle.inner), "outer.middle.inner");
});
