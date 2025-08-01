import { build, emptyDir } from "@deno/dnt";

await emptyDir("./npm");

await build({
  entryPoints: ["./main.ts"],
  typeCheck: false,
  outDir: "./npm",
  shims: {
    // see JS docs for overview and more options
    deno: true,
  },
  package: {
    // package.json properties
    name: "eslint-plugin-no-global-mutations",
    version: Deno.args[0],
    description: "ESLint No Global Mutations",
    license: "MIT",
    repository: {
      type: "git",
      url:
        "git+https://github.com/clockwork-dog/eslint-plugin-no-global-mutations.git",
    },
    bugs: {
      url:
        "https://github.com/clockwork-dog/eslint-plugin-no-global-mutations/issues",
    },
  },
  postBuild() {
    // steps to run after building and before running the tests
    Deno.copyFileSync("LICENSE", "npm/LICENSE");
    Deno.copyFileSync("README.md", "npm/README.md");
  },
});
