import { parse as parseAST } from "espree";
import { GetImplementation, mutationLinter } from "./main.ts";
import { assertEquals } from "@std/assert/equals";
import { types } from "estree-toolkit";

const parse = (program: string) => {
    return parseAST(`(${program})`, { ecmaVersion: 2023 }) as types.Program;
};

const callback = parse(
    `function(callback) {
        callback();
    }`,
);

const callbackWithGlobal = parse(
    `function(callback) {
        callback(globalArr);
    }`,
);

const schemaObj = {
    window: {},
    globalArr: [],
    scenes: {
        values: {},
    },
};

const getImpl: GetImplementation = (path: Array<string | symbol>) => {
    switch (path.join(".")) {
        case "window.addEventListener":
            return [{ ast: callback, schemaObj }];
        case "scenes.values.callbackWithGlobal":
            return [{ ast: callbackWithGlobal, schemaObj }];
        default:
            return [];
    }
};

Deno.test("attach event listener", () => {
    const attachEventListener = parse(
        `window.addEventListener(() => {
            globalArr.pop();
        })`,
    );

    const errors = mutationLinter(attachEventListener, schemaObj, getImpl);
    assertEquals(errors.length, 1);
});

Deno.test("callback with global", () => {
    const mutateStuff = parse(
        `scenes.values.callbackWithGlobal((x) => x++)`,
    );

    const errors = mutationLinter(mutateStuff, schemaObj, getImpl);

    assertEquals(errors.length, 1);
});
