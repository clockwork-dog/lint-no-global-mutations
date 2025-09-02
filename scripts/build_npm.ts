import { build, emptyDir } from "@deno/dnt";

await emptyDir("./npm");

if (!Deno.args[0]) throw new Error("No args given, expected version");

await build({
    entryPoints: ["./main.ts"],
    typeCheck: false,
    outDir: "./npm",
    shims: {
        // see JS docs for overview and more options
        deno: { test: "dev" },
    },
    package: {
        // package.json properties
        name: "lint-no-global-mutations",
        version: Deno.args[0],
        description: "ESLint No Global Mutations",
        license: "MIT",
        repository: {
            type: "git",
            url: "git+https://github.com/clockwork-dog/lint-no-global-mutations.git",
        },
        bugs: {
            url: "https://github.com/clockwork-dog/lint-no-global-mutations/issues",
        },
    },
    postBuild() {
        // steps to run after building and before running the tests
        Deno.copyFileSync("LICENSE", "npm/LICENSE");
        Deno.copyFileSync("README.md", "npm/README.md");
    },
});
