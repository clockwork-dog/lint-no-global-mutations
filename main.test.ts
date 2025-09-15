import { parse } from "espree";
import { assertEquals, assertGreaterOrEqual } from "@std/assert";
import { noMutation } from "./main.ts";
import { types } from "estree-toolkit";

function testPasses(program: string) {
    const globals = {
        window: { key: "value" },
        globalArr: [0],
        globalNestedArr: [1, [2, [3]]],
        globalObj: {},
        globalNestedObj: { a: { b: { c: {} } } },
    };
    const ast = parse(program, { ecmaVersion: 2023 }) as types.Program;
    const errors = noMutation(ast, globals);
    assertEquals(errors.length, 0, errors[0]?.message);
}
function testFails(programWithMarkers: string) {
    const globals = {
        window: { key: "value" },
        globalArr: [0],
        globalNestedArr: [1, [2, [3]]],
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
Deno.test("can't delete global property", () => {
    testFails("-->delete globalNestedObj.a<--");
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

Deno.test("uncalled function declarations are ignored", () => {
    testPasses(`
        function a() {
            globalArr++;
        };
        `);
});
Deno.test("uncalled function expressions are ignored", () => {
    testPasses(`
        const a = function() {
            globalArr++;
        };
        `);
});
Deno.test("uncalled arrow function expressions are ignored", () => {
    testPasses(`
        const a =() => {
            globalArr++;
        };
        `);
});
Deno.test("function declaration call error", () => {
    testFails(`
        function a() {
            -->globalArr++<--;
        };
        a();
        `);
});
Deno.test("function expression call error", () => {
    testFails(`
        const a = function() {
            -->globalArr++<--;
        };
        a();
        `);
});
Deno.test("arrow function expression call error", () => {
    testFails(`
        const a =() => {
            -->globalArr++<--;
        };
        a();
        `);
});
Deno.test("allows variable shadowing", () => {
    testPasses(`
        const myArr = globalArr;
        function pushZero(myArr) {
            myArr++
        }
        pushZero([]);
        `);
});
Deno.test("failing variable shadowing example", () => {
    testFails(`
        const myArr = globalArr;
        function pushZero(myArr) {
            -->myArr++<--;
        }
        pushZero(window);
        `);
});
Deno.test("nested iifes", () => {
    testFails(
        `(() => {
          (() => { -->globalArr++<-- })()
        })()`,
    );
});
Deno.test("tracks function return expressions", () => {
    testFails(`
        function identity(x) { return x }
        const maybeGlobal = identity(globalArr);
        -->maybeGlobal++<--;
        `);
});
Deno.test("tracks inline arrow function return values", () => {
    testFails(`
        const identity = (x) => x;
        const maybeGlobal = identity(globalArr);
        -->maybeGlobal++<--;
        `);
});
Deno.test("Array.forEach element mutation", () => {
    testFails(`
        [globalArr, globalObj].forEach((element) => {
            -->element++<--;
        });
        `);
});
Deno.test("Array.forEach array index mutation", () => {
    testFails(`
        [globalArr, globalObj].forEach((element, index, arr) => {
            -->arr[index]++<--;
        });
        `);
});
Deno.test.ignore("Array.map keeping references", () => {
    testFails(`
    const myArr = [globalArr, globalObj].map((elem) => elem);
    -->myArr[0]++<--;
        `);
});
Deno.test("mutation helper function on global", () => {
    testFails(`
        function increment(x) {
            return -->x++<--;
        }
        increment(globalNestedObj);
        `);
});
Deno.test("mutation arrow function", () => {
    testFails(`
        const add = (x) => -->x++<--;
        add(globalArr);
        `);
});
Deno.test("mutation iife", () => {
    testFails(`
        ((arr) => { -->arr++<--})(globalArr);
        `);
});
Deno.test("mutation from object member", () => {
    testFails(`
        const o = { f: function mutate(x) { -->x++<--; } };
        o.f(globalArr);
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
Deno.test("adding a key to a nested global", () => {
    testFails(`
            -->globalNestedObj.a.key = 'value'<--;
            `);
});
Deno.test("updates indirected global property", () => {
    testFails(`
            let o = {};
            o.a = globalNestedObj.a;
            -->o.a.key = 'value'<--;
            `);
});
Deno.test("method inspects global property", () => {
    testPasses(`Object.keys(state.values);`);
});
Deno.test("Object.assign mutates global property", () => {
    testFails(`-->Object.assign(globalObj, {key: "value"})<--;`);
});
Deno.test("Object.defineProperty mutates global property", () => {
    testFails(
        `-->Object.defineProperty(globalObj, 'key', {value: 'value'})<--;`,
    );
});
Deno.test("saves reference to mutating method", () => {
    testFails(`
            const a = Object.assign;
            -->a(globalArr, {key: "value"})<--;
            `);
});
Deno.test("doesn't allow dynamic global Object properties", () => {
    testFails(`
            -->Object['define' + 'Property'](globalObj, 'key', {value: 'value'})<--
            `);
});
Deno.test("doesn't allow dynamic referenced Object properties", () => {
    testFails(`
            const o = Object;
            -->o['define' + 'Property'](globalObj, 'key', {value: 'value'})<--;
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
Deno.test("allows pure instance methods on globals (identifier)", () => {
    testPasses(`globalArr.slice();`);
});
Deno.test("allows pure instance methods on globals (literal)", () => {
    testPasses(`globalArr['at'](0);`);
});
Deno.test("doesn't allow mutating instance methods on globals", () => {
    testFails(`
    -->globalArr.pop()<--;
    `);
});
Deno.test("array instance methods on user owned array", () => {
    testPasses(`
          const allScenes = [...scenes];
          const lastScene = allScenes.pop();
      `);
});
Deno.test.ignore("tracks reference through array.pop", () => {
    testFails(`
          const allScenes = [...scenes];
          const lastScene = allScenes.pop();
          -->lastScene++<--;
      `);
});

Deno.test.ignore("globalThis access", () => {
    testFails(`
            const o = globalThis['Obj' + 'ect'];
            -->o.assign(globalObj, {key: value})<--;
            `);
});
Deno.test("unknown array element mutation", () => {
    testFails(`
            const references = [globalNestedObj, {value: 1}];
            -->delete references[Math.floor(Math.random() * 2)].value<--;
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
Deno.test.ignore("recursive function", () => {
    testPasses(`
        function multiply(x, y) {
            if (y === 0) return 0;
            return x + multiply(x, y - 1);
        }
        multiply(2, 3);
        `);
});
Deno.test.ignore("window.addEventListener", () => {
    testFails(`
        window.addEventListener(() => {
            -->window.key = 'new value'<--;            
        })
        `);
});
Deno.test("accidental assignment instead of comparison", () => {
    testFails(`
        if (-->window.isDev = true<--) {
            console.debug('development mode')
        }
        `);
});
Deno.test.ignore("Calling binded Object prototype methods", () => {
    testFails(`
        const mutate = Object.prototype.constructor.assign;
        -->mutate(globalObj, {a: 1})<--;
        ;
        `);
});
Deno.test.ignore("Tagged template binded Object prototype methods", () => {
    testFails(`
        const pop = Object.getPrototypeOf([]).pop.bind(globalArr);
        -->pop\`aah\`<--;
        `);
});
Deno.test.ignore("Searching through object prototypes", () => {
    testFails(`
        const a = ({}).__proto__.constructor.assign;
        -->a(globalArr, { key: 'value' })<--;
        `);
});
