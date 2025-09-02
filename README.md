# lint-no-global-mutations

## [Playground](https://clockwork-dog.github.io/lint-no-global-mutations/)

A [CodeMirror](https://codemirror.net/) linter to warn against mutation of a
given global object schema.

Example usage:

```js
import { basicSetup, EditorView } from "codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { NoGlobalMutations } from "lint-no-global-mutations";

const schema = { window: { key: "value" } };
const noMutation = new NoGlobalMutations(schema);

const editor = new EditorView({
    extensions: [
        basicSetup,
        javascript(),
        noMutation.linter,
    ],
});
```

This will cause
[the following lint error](https://clockwork-dog.github.io/lint-no-global-mutations/#d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoKCkgPT4gewogIHdpbmRvdy5rZXkgPSAnbmV3IHZhbHVlJzsKfSk7Cg==):

```js
window.addEventListener(() => {
    window.key = "new value";
    ~~~~~~~~~~~~~~~~~~~~~~~~
});
```

[ESLint Code Explorer](https://explorer.eslint.org/#eslint-explorer)
