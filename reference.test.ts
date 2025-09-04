import { assertEquals } from "@std/assert/equals";
import { Reference } from "./reference.ts";
import { assertInstanceOf } from "@std/assert/instance-of";

Deno.test("can be compared", () => {
    assertEquals(new Reference([1]), new Reference([1]));
});
Deno.test("can unwrap", () => {
    assertEquals(new Reference([1]).unwrap(), [1]);
});

Deno.test("can hold objects", () => {
    const obj = { key: "value" };
    const ref = new Reference([obj]);
    assertInstanceOf(ref.get("key"), Reference);
    assertEquals(ref.get("key").unwrap(), ["value"]);
});

Deno.test("can hold arrays", () => {
    const obj = { key: "value" };
    const arr = [obj];
    const ref = new Reference([arr]);
    assertEquals(ref.get(0), new Reference([obj]));
    assertEquals(ref.get(0).unwrap()[0], obj);
});

Deno.test("can inspect deep references", () => {
    const a = { outer: { middle: { inner: { value: "a" } } } };
    const b = { outer: { middle: { inner: { value: "b" } } } };
    const ref = new Reference([a, b]);
    assertEquals(
        ref.get("outer").get("middle").get("inner").get("value").unwrap(),
        ["a", "b"],
    );
});
