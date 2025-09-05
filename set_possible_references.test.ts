import { parseEx } from "./test_utils.ts";
import { assertEquals } from "@std/assert/equals";
import { types } from "estree-toolkit";
import { decomposeMemberExpression } from "./set_possible_references.ts";
import { ANY_STRING } from "./util.ts";

const parseMemberEx = (ex: string) => {
    const expression = parseEx(ex);
    assertEquals(expression.type, "MemberExpression");
    return expression as types.MemberExpression;
};

Deno.test("deconstructs a simple path", () => {
    const ex = parseMemberEx("a.b");
    const { root, path } = decomposeMemberExpression(ex);
    assertEquals(root.name, "a");
    assertEquals(path, ["b"]);
});
Deno.test("deconstructs a deep path", () => {
    const ex = parseMemberEx("a.b.c.d");
    const { root, path } = decomposeMemberExpression(ex);
    assertEquals(root.name, "a");
    assertEquals(path, ["b", "c", "d"]);
});
Deno.test("deconstructs a complex path", () => {
    const ex = parseMemberEx("a['b'[0]].c[String.fromCharCode(100)]"); //a.b.c.d
    const { root, path } = decomposeMemberExpression(ex);
    assertEquals(root.name, "a");
    assertEquals(path, [ANY_STRING, "c", ANY_STRING]);
});
