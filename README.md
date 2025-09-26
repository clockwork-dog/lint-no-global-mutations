# lint-no-global-mutations

## [Playground](https://clockwork-dog.github.io/lint-no-global-mutations/)

A [CodeMirror](https://codemirror.net/) linter to warn against mutation of a
given global object schema.

Example usage:

```js
import { basicSetup, EditorView } from "codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { NoGlobalMutations } from "lint-no-global-mutations";

const schema = { window: { isDev: false } };
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
[the following lint error](https://clockwork-dog.github.io/lint-no-global-mutations/#aWYgKHdpbmRvdy5pc0RldiA9IHRydWUpIHsKICAgIGNvbnNvbGUuZGVidWcoJ2RldmVsb3BtZW50IG1vZGUnKQp9):

```js
if (window.isDev = true) {
    ~~~~~~~~~~~~~~~~~~~
    console.debug('development mode')
}
```

[ESLint Code Explorer](https://explorer.eslint.org/#eslint-explorer)
