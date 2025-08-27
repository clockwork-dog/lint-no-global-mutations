import { parse } from "espree";
import { stopGlobalMutationLinter } from "./main.ts";
import { assertEquals, assertGreaterOrEqual } from "@std/assert";

function testPasses(program: string) {
  const ast = parse(program, { ecmaVersion: 2023 });
  assertEquals(stopGlobalMutationLinter(ast).length, 0);
}
function testFails(programWithMarkers: string) {
  const start = programWithMarkers.indexOf("-->");
  const end = programWithMarkers.indexOf("<--") - "-->".length;
  if (start === -1 || end === -1) {
    throw new Error("Could not find linting assertion between --> and <--");
  }
  const program = programWithMarkers.replace("-->", "").replace("<--", "");

  let ast: ReturnType<typeof parse>;
  try {
    ast = parse(program, {
      ecmaVersion: 2023,
    });
  } catch (e) {
    throw new Error("Cannot parse program:\n" + program + "\n" + e);
  }
  const errors = stopGlobalMutationLinter(ast);

  assertGreaterOrEqual(
    errors.length,
    1,
    "Expected errors but there were none."
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
Deno.test("destructuring", () => {
  testPasses("const { values } = show;");
});
Deno.test("destructuring object and mutating", () => {
  testFails("const { values } = show; -->values++<--");
});
Deno.test("destructuring array and mutating", () => {
  testFails("const [ values ] = [ show ]; -->values++<--");
});
Deno.test("destructuring array with property access and mutating", () => {
  testFails("const [ values ] = [ scenes['my scene'] ]; -->values++<--");
});
Deno.test("mutation of variable in block", () => {
  testPasses(`
            {
                let state = 1;
                state++;
            }`);
});
Deno.test("mutation of variable out of block", () => {
  testFails(`
            {
                let state = 1;
            }
            -->state++<--;`);
});
Deno.test("mutation of variable in function", () => {
  testPasses(`
            function f(){
                let state = 1;
                state++;
            }`);
});
Deno.test("mutation of variable out of function", () => {
  testFails(`
            function f(){
                let state = 1;
            }
            -->state++<--;`);
});
Deno.test("mutate global", () => {
  testFails("-->state++<--;");
});
Deno.test("update global property", () => {
  testFails("-->state.value = 2<--;");
});
Deno.test("update global deep property", () => {
  testFails("-->state.variable.value = 2<--;");
});
Deno.test("assign and mutate", () => {
  testFails("let a = state; -->a++<--;");
});
Deno.test("assign and mutate member", () => {
  testFails("let a = state; -->a.value++<--;");
});
Deno.test("assign and update member", () => {
  testFails("let a = state; -->a.value = 2<--;");
});
Deno.test("updates spread initialized variables", () => {
  testFails(`
            let { ...spread } = state;
            -->spread.key.values = 'value'<--;
            `);
});
Deno.test("updates indirected global property", () => {
  testFails(`
            let a = {};
            a.values = state.values;
            -->a.values.key = 'value'<--;
            `);
});
Deno.test("method inspects global property", () => {
  testPasses(`Object.keys(state.values);`);
});
Deno.test("Object.assign mutates global property", () => {
  testFails(`-->Object.assign(state, {key: "value"})<--;`);
});
Deno.test("Object.defineProperty mutates global property", () => {
  testFails(`-->Object.defineProperty(state, 'key', {value: 'value'})<--;`);
});
Deno.test("saves reference to mutating method", () => {
  testFails(`
            const a = Object.assign;
            -->a(state, {key: "value"})<--;
            `);
});
Deno.test("doesn't allow dynamic global Object properties", () => {
  testFails(`
            -->Object['define' + 'Property'](state, 'key', {value: 'value'})<--
            `);
});
Deno.test("doesn't allow dynamic referenced Object properties", () => {
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
Deno.test.ignore("allows console.log()", () => {
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
Deno.test("doesn't allow instance methods on globals", () => {
  testFails(`
    -->scenes.pop()<--;
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
Deno.test.ignore("mutation helper function", () => {
    testFails(`
            const mutate = (arr) => arr.pop();
            mutate(state);
        `);
});
Deno.test.ignore("hoisted mutation helper function", () => {
    testPasses(`
                mutate(state);
                function mutate(arr) { arr.pop(); }
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
