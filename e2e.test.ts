import { parse as parseAST } from "espree";
import { GetImplementation, mutationLinter } from "./main.ts";
import { types } from "estree-toolkit";
import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";

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

const returnGlobal = parse(
    `globalArr`,
);

const returnValue = parse(
    `'value'`,
);

const schemaObj1 = {
    window: {},
    globalArr: [1, 2, 3],
    scenes: {
        values: {},
    },
};
const schemaObj2 = {
    window: {},
    globalArr: [1, 2, 3],
    scenes: {
        values: {},
    },
};
const schemaGetThrows = {
    window: {},
    globalArr: [1, 2, 3],
    scenes: {
        values: {
            get willThrow() {
                throw new Error("do not touch");
            },
        },
    },
};

const getImpl: GetImplementation = (path: Array<string | symbol>) => {
    switch (path.join(".")) {
        case "window.addEventListener":
            return [{ ast: callback, schemaObj: {} }];
        case "scenes.values.callbackWithGlobal":
            return [{ ast: callbackWithGlobal, schemaObj: schemaObj2 }];
        case "scenes.values.returnGlobal":
            return [{ ast: returnGlobal, schemaObj: schemaObj1 }];
        case "scenes.values.willThrow":
            return [{ ast: returnValue, schemaObj: schemaObj1 }];
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

    const errors = mutationLinter(
        attachEventListener,
        schemaObj1,
        100,
        getImpl,
    );
    assertEquals(errors.length, 1);
    assertStringIncludes(errors[0]!.message, "globalArr");
});

Deno.test("callback with global", () => {
    const mutateStuff = parse(
        `scenes.values.callbackWithGlobal((x) => x++)`,
    );

    const errors = mutationLinter(mutateStuff, schemaObj1, 100, getImpl);

    assertEquals(errors.length, 1);
    assertStringIncludes(errors[0]!.message, "globalArr");
});
Deno.test("return global", () => {
    const getGlobal = parse(
        `scenes.values.returnGlobal.pop()`,
    );

    const errors = mutationLinter(getGlobal, schemaObj1, 100, getImpl);

    assertEquals(errors.length, 1);
    assertStringIncludes(errors[0]!.message, "globalArr");
});
Deno.test("doesn't touch getters", () => {
    const getGlobal = parse(
        `scenes.values.willThrow`,
    );

    const errors = mutationLinter(getGlobal, schemaGetThrows, 100, getImpl);

    assertEquals(errors, []);
});

Deno.test("Max map size (nested arrays)", () => {
    const BREAKING_STACK_SIZE = 1000;

    const constructNewGlobals = () => {
        const schemaObj: { global: Record<string, {}> } = { global: {} };
        for (
            let letter = "a";
            letter <= "z";
            letter = String.fromCharCode(letter.charCodeAt(0) + 1)
        ) {
            schemaObj.global[letter] = {};
        }
        return schemaObj;
    };

    const getNMinus1: GetImplementation = (path) => {
        if (
            path.length === 2 && path[0] === "global" &&
            typeof path[1] === "string"
        ) {
            const n = parseInt(path[1]);
            if (n > 1) {
                return [{
                    ast: parse(`[global[${n - 1}]]`),
                    schemaObj: constructNewGlobals(),
                }];
            }
        }
        return [];
    };

    // When maxDepth = 100, there is no errors
    // The linter gets too deep and gives up
    const errors = mutationLinter(
        parse(`[global[${BREAKING_STACK_SIZE}]]`),
        constructNewGlobals(),
        100,
        getNMinus1,
    );
    assertEquals(errors, []);

    // When maxDepth is not limited, it throws stacksize
    assertThrows(() => {
        mutationLinter(
            parse(`[global[${BREAKING_STACK_SIZE}]]`),
            constructNewGlobals(),
            Infinity,
            getNMinus1,
        );
    });
});
