import { assertEquals } from "@std/assert/equals";
import { Reference } from "./reference.ts";
import { assertInstanceOf } from "@std/assert/instance-of";
import { ANY_STRING } from "./util.ts";
import { assertArrayIncludes } from "@std/assert/array-includes";

Deno.test("can be compared", () => {
    assertEquals(new Reference([1]), new Reference([1]));
});
Deno.test("can unwrap", () => {
    assertEquals(new Reference([1]).get(), [1]);
});

Deno.test("can hold objects", () => {
    const obj = { key: "value" };
    const ref = new Reference([obj]);
    assertInstanceOf(ref.getKey("key"), Reference);
    assertEquals(ref.getKey("key").get(), ["value"]);
});

Deno.test("can hold arrays", () => {
    const obj = { key: "value" };
    const arr = [obj];
    const ref = new Reference([arr]);
    assertEquals(ref.getKey(0), new Reference([obj]));
    assertEquals(ref.getKey(0).get()[0], obj);
});

Deno.test("can inspect deep references", () => {
    const a = { outer: { middle: { inner: { value: "a" } } } };
    const b = { outer: { middle: { inner: { value: "b" } } } };
    const ref = new Reference([a, b]);
    assertEquals(
        ref.getKey("outer").getKey("middle").getKey("inner").getKey("value")
            .get(),
        ["a", "b"],
    );
});

Deno.test("can set object values", () => {
    const a = { key: "value" };
    const ref = new Reference([a]);
    ref.setKey("key", "new-value");
    assertEquals(ref.getKey("key").get(), ["value", "new-value"]);
});
Deno.test("can set array elements", () => {
    const a = [1, 2, 3];
    const ref = new Reference([a]);
    ref.setKey(ANY_STRING, 4);
    assertArrayIncludes(ref.getKey(0).get(), [1, 2, 3, 4]);
});

Deno.test("can lookup ANY_STRING", () => {
    const a = { key: "value" };
    const ref = new Reference([a]);
    assertArrayIncludes(ref.getKey(ANY_STRING).get(), ["value"]);
});

Deno.test("doesn't hold array positions", () => {
    const arr = [1, 2, 3];
    const ref = new Reference([arr]);
    assertEquals(ref.getKey(0).get(), [1, 2, 3]);
    assertEquals(ref.getKey(1).get(), [1, 2, 3]);
    assertEquals(ref.getKey(2).get(), [1, 2, 3]);
});
