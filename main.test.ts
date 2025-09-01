import { parse } from "espree";
import { assertEquals, assertGreaterOrEqual } from "@std/assert";
import { noMutation } from "./main.ts";
import { types } from "estree-toolkit";

function testPasses(program: string) {
    const globals = {
        globalArr: [],
        globalNestedArr: [[[]]],
        globalObj: {},
        globalNestedObj: { a: { b: { c: {} } } },
    };
    const ast = parse(program, { ecmaVersion: 2023 }) as types.Program;
    assertEquals(noMutation(ast, globals).length, 0);
}
function testFails(programWithMarkers: string) {
    const globals = {
        globalArr: [],
        globalNestedArr: [[[]]],
        globalObj: {},
        globalNestedObj: { a: { b: { c: {} } } },
    };
    const start = programWithMarkers.indexOf("-->");
    const end = programWithMarkers.indexOf("<--") - "-->".length;
    if (start === -1 || end === -1) {
        throw new Error("Could not find linting assertion between --> and <--");
    }
    const program = programWithMarkers.replace("-->", "").replace("<--", "");

    let ast: types.Program;
    try {
        ast = parse(program, {
            ecmaVersion: 2023,
        }) as types.Program;
    } catch (e) {
        throw new Error("Cannot parse program:\n" + program + "\n" + e);
    }
    const errors = noMutation(ast, globals);

    assertGreaterOrEqual(
        errors.length,
        1,
        "Expected errors but there were none.",
    );
    errors.forEach((err) => {
        assertEquals(err.start, start);
        assertEquals(err.end, end);
    });
}
Deno.test("literal assignment", () => {
    testPasses("const a = 2;");
});
Deno.test("literal mutation", () => {
    testPasses("let a = 2; a++;");
});
Deno.test("user array assignment", () => {
    testPasses("const a = [1, 2, 3];");
});
Deno.test("user array mutation", () => {
    testPasses("const a = [1, 2, 3]; a[3] = 4;");
});
Deno.test("user array push", () => {
    testPasses("const a = [1, 2, 3]; a.push(4)");
});
Deno.test("assignment to user array", () => {
    testPasses("const a = [...globalArr]");
});
Deno.test("can't update global", () => {
    testFails("-->globalArr++<--");
});
Deno.test("can update user owned array", () => {
    testPasses(`
        const a = [...globalNestedArr];
        a++;
        `);
});
Deno.test("can't update global on user array", () => {
    testFails(`
        const a = [...globalNestedArr];
        -->a[0]++<--;
        `);
});

Deno.test.ignore("destructuring", () => {
    testPasses("const { values } = show;");
});
Deno.test.ignore("destructuring object and mutating", () => {
    testFails("const { values } = show; -->values++<--");
});
Deno.test.ignore("destructuring array and mutating", () => {
    testFails("const [ values ] = [ show ]; -->values++<--");
});
Deno.test.ignore(
    "destructuring array with property access and mutating",
    () => {
        testFails("const [ values ] = [ scenes['my scene'] ]; -->values++<--");
    },
);
Deno.test("mutate global", () => {
    testFails("-->globalArr++<--;");
});
Deno.test("mutation of variable in block", () => {
    testPasses(`
            {
                let globalArr = 1;
                globalArr++;
            }`);
});
Deno.test("mutation of variable out of block", () => {
    testFails(`
            {
                let globalArr = 1;
            }
            -->globalArr++<--;`);
});
Deno.test("mutation of variable in function", () => {
    testPasses(`
            function f(){
                let globalArr = 1;
                globalArr++;
            }`);
});
Deno.test("mutation of variable out of function", () => {
    testFails(`
            function f(){
                let globalArr = 1;
            }
            -->globalArr++<--;`);
});
Deno.test("mutation helper function", () => {
    testPasses(`
        function increment(x) {
            return x++;
        }
        increment(2);
        `);
});
Deno.test("mutation helper function on global", () => {
    testFails(`
        function increment(x) {
            return x++;
        }
        -->increment(globalNestedObj)<--;
        `);
});
Deno.test("mutation arrow function", () => {
    testFails(`
        const add = (x) => x++;
        -->add(globalArr)<--;
        `);
});
Deno.test("mutation iife", () => {
    testFails(`
        -->((arr) => {arr++})(globalArr)<--;
        `);
});
Deno.test("update global", () => {
    testFails("-->globalObj = 2<--;");
});
Deno.test("update global property", () => {
    testFails("-->globalObj.value = 2<--;");
});
Deno.test("update global deep property", () => {
    testFails("-->globalNestedObj.a.b = 2<--;");
});
Deno.test("assign and mutate", () => {
    testFails("let a = globalObj; -->a++<--;");
});
Deno.test("assign and mutate member", () => {
    testFails("let o = globalNestedObj; -->o.a++<--;");
});
Deno.test("assign and update member", () => {
    testFails("let a = globalObj; -->a.value = 2<--;");
});
Deno.test.ignore("updates spread initialized variables", () => {
    testFails(`
            let { ...spread } = globalNestedObj;
            -->spread.a.b = 'value'<--;
            `);
});
Deno.test.ignore("updates indirected global property", () => {
    testFails(`
            let o = {};
            o.a = globalNestedObj.a;
            -->o.a.key = 'value'<--;
            `);
});
Deno.test("method inspects global property", () => {
    testPasses(`Object.keys(state.values);`);
});
Deno.test.ignore("Object.assign mutates global property", () => {
    testFails(`-->Object.assign(state, {key: "value"})<--;`);
});
Deno.test.ignore("Object.defineProperty mutates global property", () => {
    testFails(`-->Object.defineProperty(state, 'key', {value: 'value'})<--;`);
});
Deno.test.ignore("saves reference to mutating method", () => {
    testFails(`
            const a = Object.assign;
            -->a(state, {key: "value"})<--;
            `);
});
Deno.test.ignore("doesn't allow dynamic global Object properties", () => {
    testFails(`
            -->Object['define' + 'Property'](state, 'key', {value: 'value'})<--
            `);
});
Deno.test.ignore("doesn't allow dynamic referenced Object properties", () => {
    testFails(`
            const o = Object;
            -->o['define' + 'Property'](state, 'key', {value: 'value'})<--;
            `);
});
Deno.test("doesn't allow nested dynamic referenced Object properties", () => {
    testPasses(`
            const o = {};
            o.obj = Object;
            -->o.obj['define' + 'Property'](state, 'key', {value: 'value'})<--;
            `);
});
Deno.test("allows console.log()", () => {
    testPasses("console.log('Hello, world!')");
});
Deno.test("allows a for loop", () => {
    testPasses(`
            const doSomething = () => {};
            for(let i = 0; i < 10; i++) {
                doSomething(i);
            }
            `);
});
Deno.test("allows function calls", () => {
    testPasses(`
              const anonArrow = () => {};
              const anonFunc = function() {};
              function namedFunc() {};
              anonArrow();
              anonFunc();
              namedFunc();
    `);
});
Deno.test.ignore("doesn't allow instance methods on globals", () => {
    testFails(`
    -->globalArr.pop()<--;
    `);
});
Deno.test.ignore("array instance methods on user owned array", () => {
    testPasses(`
          const allScenes = [...scenes];
          const lastScene = allScenes.pop();
      `);
});

Deno.test.ignore("globalThis access", () => {
    testFails(`
            const o = globalThis['Obj' + 'ect'];
            o.assign(state, {key: value});
            `);
});
Deno.test.ignore("unknown array element mutation", () => {
    testFails(`
            const references = [this, {value: 1}];
            delete references[Math.floor(Math.random() * 2)].value;
            `);
});

Deno.test.ignore("non-mutating helper function", () => {
    testPasses(`
            const logItems = (...items) => console.log('[' + items.join(', ') + ']');
            logItems(state);
            `);
});
Deno.test("hoisted mutation helper function", () => {
    testPasses(`
                mutate(state);
                function mutate(arr) { arr++; }
            `);
});
Deno.test.ignore("mutation helper tag", () => {
    testFails(`
            const mutate = (strings, ...args) => {
                args[0].pop();
            }
            mutate\`\${state}\`;
            `);
});
Deno.test.ignore("eval", () => {
    testFails(`eval("state.key = 'value';");`);
});
