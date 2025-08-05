import { RuleTester } from "eslint";
import { create, meta } from "./rule.ts";

const ruleTester = new RuleTester({ languageOptions: { ecmaVersion: 2015 } });

ruleTester.run("no-global-mutations", { meta, create }, {
    valid: [
        {
            code: "const a = 1;",
        },
    ],
    invalid: [
        {
            code: "states.values = []",
            errors: 1,
        },
    ],
});

console.log("All tests passed!");
