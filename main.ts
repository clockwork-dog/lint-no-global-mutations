import { parse } from "espree";
import { traverse, types } from "estree-toolkit";

const NON_MUTATING_OBJECT_PROTOTYPE_METHODS = new Set([
  // "assign",
  "create",
  // "defineProperties",
  // "defineProperty",
  "entries",
  // "freeze",
  "fromEntries",
  "getOwnPropertyDescriptor",
  "getOwnPropertyDescriptors",
  "getOwnPropertyNames",
  "getOwnPropertySymbols",
  "getPrototypeOf",
  "groupBy",
  "hasOwn",
  "is",
  "isExtensible",
  "isFrozen",
  "isSealed",
  "keys",
  // "preventExtensions",
  // "seal",
  // "setPrototypeOf",
  "values",
]);

const NON_MUTATING_ARRAY_INSTANCE_METHODS = new Set([
  "at",
  "concat",
  // "copyWithin",
  "entries",
  "every",
  // "fill",
  "filter",
  "find",
  "findIndex",
  "findLast",
  "findLastIndex",
  "flat",
  "flatMap",
  "forEach",
  "includes",
  "indexOf",
  "join",
  "keys",
  "lastIndexOf",
  "map",
  // "pop",
  // "push",
  "reduce",
  "reduceRight",
  // "reverse",
  // "shift",
  "slice",
  "some",
  // "sort",
  // "splice",
  "toLocaleString",
  "toReversed",
  "toSorted",
  "toSpliced",
  "toString",
  // "unshift",
  "values",
  "with",
]);

export class LintingError extends Error {
  constructor(
    msg: string,
    public readonly start?: number,
    public readonly end?: number,
  ) {
    super(msg);
  }

  override get name() {
    return this.constructor.name;
  }
}
function node2LintingError(msg: string, n: types.Node): LintingError {
  let start: number | undefined;
  let end: number | undefined;
  if ("start" in n && typeof n.start === "number") {
    start = n.start;
  }
  if ("end" in n && typeof n.end === "number") {
    end = n.end;
  }
  return new LintingError(msg, start, end);
}

type IdentFlags = {
  isGloballyDependent: boolean;
  isMutationFunction: boolean;
  isObjectPrototype: boolean;
};
const NO_FLAGS: IdentFlags = {
  isGloballyDependent: false,
  isMutationFunction: false,
  isObjectPrototype: false,
};
function mergeFlags(
  base: IdentFlags,
  override: Partial<IdentFlags>,
): void {
  for (
    const [key, value] of Object.entries(override)
  ) {
    if (value) {
      base[key as keyof Partial<IdentFlags>] = value;
    }
  }
}

type Scope = Record<string, IdentFlags>;

function getLocalIdentifier(
  name: string,
  scopes: Scope[],
): IdentFlags | undefined {
  if (scopes.length === 0) {
    return undefined;
  }
  const nextScopes = [...scopes];
  const currentScope = nextScopes.pop();
  return currentScope?.[name] ?? getLocalIdentifier(name, nextScopes);
}

type AnyExpression =
  | types.Expression
  | types.Pattern
  | types.SpreadElement
  | types.RestElement
  | types.Property
  | types.Super;

function getDeepFlags(
  ex:
    | AnyExpression
    | null
    | undefined,
  scopes: Scope[],
  flags: IdentFlags = { ...NO_FLAGS },
): IdentFlags {
  if (ex == null) {
    return flags;
  }
  switch (ex.type) {
    case "Literal":
      return flags;

    case "Identifier": {
      if (scopes.length === 0) {
        mergeFlags(flags, {
          isGloballyDependent: true,
          isObjectPrototype: ex.name === "Object",
        });
        return flags;
      }
      const nextScopes = [...scopes];
      const currentScope = nextScopes.pop();
      const localIdentifier = currentScope?.[ex.name];
      if (localIdentifier) {
        return localIdentifier;
      } else {
        mergeFlags(flags, getDeepFlags(ex, nextScopes));
        return flags;
      }
    }

    case "ArrayExpression": {
      const newFlags = { ...flags };
      ex.elements.forEach((elem) => {
        mergeFlags(newFlags, getDeepFlags(elem, scopes));
      });
      return newFlags;
    }
    case "ObjectExpression": {
      const newFlags = { ...flags };
      ex.properties.forEach((elem) => {
        mergeFlags(newFlags, getDeepFlags(elem, scopes));
      });
      return newFlags;
    }
    case "SpreadElement": {
      return getDeepFlags(ex.argument, scopes);
    }
    case "Property": {
      return getDeepFlags(ex.value, scopes);
    }
    case "ObjectPattern":
    case "RestElement":
    case "ArrayPattern":
    case "AssignmentPattern":
      // TODO: all object asignment + destructuring
      break;
    case "MemberExpression": {
      if (ex.object.type === "Identifier") {
        const ident = getDeepFlags(ex.object, scopes);
        if (!ident.isGloballyDependent) {
          mergeFlags(flags, ident);
          return flags;
        }
        // Is it accessing the Object prototype?
        if (ident.isObjectPrototype || ex.object.name === "Object") {
          if (
            ex.property.type !== "Identifier" ||
            !NON_MUTATING_OBJECT_PROTOTYPE_METHODS.has(ex.property.name)
          ) {
            mergeFlags(flags, {
              isObjectPrototype: true,
              isMutationFunction: true,
            });
          }
        }
      }

      mergeFlags(flags, getDeepFlags(ex.object, scopes));
      return flags;
    }

    case "CallExpression": {
      if (ex.callee.type !== "Super") {
        mergeFlags(flags, getDeepFlags(ex.callee, scopes));
      }
      ex.arguments.forEach((arg) => {
        mergeFlags(flags, getDeepFlags(arg, scopes));
      });
      return flags;
    }
    case "JSXElement":
    case "JSXFragment":
    case "ThisExpression":
    case "FunctionExpression":
    case "UnaryExpression":
    case "UpdateExpression":
    case "BinaryExpression":
    case "AssignmentExpression":
    case "LogicalExpression":
    case "ConditionalExpression":
    case "NewExpression":
    case "SequenceExpression":
    case "ArrowFunctionExpression":
    case "YieldExpression":
    case "TemplateLiteral":
    case "TaggedTemplateExpression":
    case "ClassExpression":
    case "MetaProperty":
    case "AwaitExpression":
    case "ChainExpression":
    case "ImportExpression":
    case "Super":
  }
  console.log(ex.type);

  throw new Error("Unhandled case");
}

function setDeepFlags(
  ex:
    | AnyExpression
    | null
    | undefined,
  scopes: Scope[],
  flags: Partial<IdentFlags>,
): void {
  if (ex == null) {
    return;
  }
  switch (ex.type) {
    case "Literal":
      return;
    case "Identifier": {
      const identifier = getLocalIdentifier(ex.name, scopes);
      if (identifier) {
        mergeFlags(identifier, flags);
      }
      return;
    }
    case "MemberExpression":
      return setDeepFlags(ex.object, scopes, flags);
    case "ObjectPattern":
      return ex.properties.forEach((property) =>
        setDeepFlags(property, scopes, flags)
      );
    case "ArrayPattern":
      return ex.elements.forEach((elem) => setDeepFlags(elem, scopes, flags));
    case "RestElement":
      return setDeepFlags(ex.argument, scopes, flags);
    case "AssignmentPattern":
    case "ArrayExpression":
    case "ArrowFunctionExpression":
    case "AssignmentExpression":
    case "AwaitExpression":
    case "BinaryExpression":
    case "CallExpression":
    case "ChainExpression":
    case "ClassExpression":
    case "ConditionalExpression":
    case "FunctionExpression":
    case "ImportExpression":
    case "LogicalExpression":
    case "MetaProperty":
    case "NewExpression":
    case "ObjectExpression":
    case "SequenceExpression":
    case "TaggedTemplateExpression":
    case "TemplateLiteral":
    case "ThisExpression":
    case "UnaryExpression":
    case "UpdateExpression":
    case "YieldExpression":
    case "JSXElement":
    case "JSXFragment":
    case "SpreadElement":
    case "Property":
    case "Super":
  }
}

export function stopGlobalMutationLinter(
  program: ReturnType<typeof parse>,
): LintingError[] {
  const lintingErrors: LintingError[] = [];
  const scopes: Scope[] = [{}];

  traverse(program, {
    /**
     * Keep track everywhere where a global reference could be assigned...
     * Declaration: let a = state;
     * Assignment: a.reference = state;
     * Object.assign: Object.assign(a, state);
     *
     * Remember which local variables are in which scope
     */
    VariableDeclarator(path) {
      if (path.node) {
        const currentScope = scopes[scopes.length - 1];
        switch (path.node.id.type) {
          case "Identifier": {
            const { id } = path.node;
            const init = path.node.init;
            if (currentScope) {
              currentScope[id.name] = getDeepFlags(init, scopes);
            }
            return;
          }

          case "MemberExpression":
          case "ObjectPattern":
          case "ArrayPattern":
          case "RestElement":
          case "AssignmentPattern":
        }
      }
    },

    /**
     * Be careful!
     * We need to watch for references to naughty things mutation aliases:
     *     const o = Object; o.assign(state, 'key', {value: 'value})
     * But we also need to watch for mutation itself:
     *     Object.assign = () => {};
     */
    AssignmentExpression(path) {
      if (!path.node) {
        return;
      }

      // Mutation check
      if (
        getDeepFlags(path.node.left, scopes).isGloballyDependent
      ) {
        lintingErrors.push(
          node2LintingError("Invalid mutation", path.node),
        );
      }

      // Bookkeeping
      if (getDeepFlags(path.node.right, scopes).isGloballyDependent) {
        setDeepFlags(path.node.left, scopes, {
          isGloballyDependent: true,
        });
      }
      if (path.node.right.type) {
        //
      }
    },
    /**
     * Keep track of current scope
     */
    BlockStatement: {
      enter() {
        scopes.push({});
      },
      leave() {
        scopes.pop();
      },
    },

    UpdateExpression(path) {
      if (
        path.node &&
        getDeepFlags(path.node.argument, scopes).isGloballyDependent
      ) {
        lintingErrors.push(
          node2LintingError("Invalid mutation", path.node),
        );
      }
    },
    CallExpression(path) {
      if (!path.node) {
        return;
      }
      const callee = path.node.callee;
      if (callee.type === "Super") {
        return;
      }
      const flags = getDeepFlags(callee, scopes);
      // Object prototype mutation with global as argument
      if (getDeepFlags(callee, scopes).isMutationFunction) {
        lintingErrors.push(node2LintingError("Invalid mutation", path.node));
      }

      // Array instance mutation method
      if (
        callee.type === "MemberExpression" &&
        getDeepFlags(callee.object, scopes).isGloballyDependent
      ) {
        if (
          callee.property.type === "Identifier" &&
          NON_MUTATING_ARRAY_INSTANCE_METHODS.has(callee.property.name)
        ) {
          // These are allowed
        } else {
          // These are not
          lintingErrors.push(node2LintingError("Invalid mutation", path.node));
        }
      }
    },
    TaggedTemplateExpression() {
      // TODO: You can execute code this way too
      // Is it possible to mutate something this way?
    },
  });

  return lintingErrors;
}
