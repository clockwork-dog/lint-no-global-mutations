import { assertEquals } from "@std/assert/equals";
import { Reference } from "./reference.ts";
import { assertInstanceOf } from "@std/assert/instance-of";

Deno.test("can be compared", () => {
    assertEquals(new Reference([1]), new Reference([1]));
});

Deno.test("can hold objects", () => {
    const REF = { key: "value" };
    const obj = new Reference([REF]);
    assertInstanceOf(obj.get("key"), Reference);
    assertEquals(obj.get("key").possibilities, ["value"]);
});

Deno.test("can inspect deep references", () => {
    const a = { outer: { middle: { inner: { value: "a" } } } };
    const b = { outer: { middle: { inner: { value: "b" } } } };
    const ref = new Reference([a, b]);
    assertEquals(
        ref.get("outer").get("middle").get("inner").get("value").possibilities,
        ["a", "b"],
    );
});
