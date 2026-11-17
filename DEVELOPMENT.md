# DEVELOPMENT

Tips:

- [Mashup Font of FiraCode and Script12](https://github.com/kencrocken/FiraCodeiScript)
- [Monospaced font with programming ligatures](https://github.com/tonsky/FiraCode)
- [Combined programming mono font with italics and font ligatures made from Fira Code and Pacifico for Italics](https://github.com/kosimst/Firicico)

## TypeScript and modules

devChat is ESM-only. Use `import` instead of `require('devchat')`; CommonJS
builds and package entry points are not provided.

The project requires Node.js 26 and npm 10 or newer. `npm run build` and
`npm run lint:ts` use TypeScript 7 via the `@typescript/native` npm alias.
Type-only dependencies must use `import type` or inline `type` modifiers;
`verbatimModuleSyntax` is enabled for both the build and semantic check.
No decorator syntax or emitted decorator metadata is used, so the legacy
decorator compiler options are omitted.
`npm run lint:biome` runs TypeScript lint rules without depending on the
TypeScript compiler API.

Node.js runs the TypeScript sources directly with its built-in type stripping:
tests, scripts, examples, and the `cli`, `doctor`, `io-client`, and
`puppet-install` npm scripts need no build step. Compilation to `dist/` happens
only when packaging, in `scripts/npm-pack-testing.sh` and the Dockerfiles, which
run on every push and pull request through the npm and Docker workflows.

Type stripping imposes two rules, both enforced by `npm run lint:ts`:

- Relative imports use `.ts` extensions. `rewriteRelativeImportExtensions`
  rewrites them to `.js` in the compiled JavaScript. Generated `.d.ts` files
  keep `.ts` specifiers, which TypeScript 5.0 and later resolve, so
  downstream TypeScript users need TypeScript 5.0 or later.
- Only erasable syntax is allowed (`erasableSyntaxOnly`): no enums,
  namespaces with values, or constructor parameter properties. Declare a class
  field and assign it in the constructor instead of `constructor (public id)`.

TypeScript's semantic check remains required: type stripping does not check
types, so it does not replace `npm run lint:ts`. Other runtimes may use
different type checkers, so their execution success is not a substitute for
the canonical TypeScript check.

The Docker entrypoint still runs user bot files with `tsx`, because user code
may use syntax that Node.js cannot strip.

Commit `package-lock.json` alongside dependency changes. Use `npm ci` for a
clean installation from the lockfile.

## Tests

Unit tests use `node:test` and `node:assert/strict`. `npm test` lints and runs the
complete unit suite with Node.js directly from the `*.test.ts` sources, without a
build. Run one Node test file with
`npm run test:unit:file -- src/plugin.test.ts`.
For Deno, use
`NODE_BINARY="$(command -v node)" npm run test:unit:deno:file -- src/plugin.test.ts`.
`npm run coverage` (or `npm run coverage:node`) collects Node.js native
coverage for the complete `src/**/*.ts` production scope and writes LCOV,
totals, and navigable HTML under `coverage/node/`. It requires Node.js 26.13.0
and `genhtml` from the LCOV package for HTML rendering. Native Node coverage
includes unloaded source files without importing them. Specs, declaration
files, and generated `src/package-json.ts` are excluded.
The Node HTML renderer shows line and function coverage; its version does not
display Node's native branch records. Branch totals remain available in the
Node LCOV and machine-readable report.

The same suite runs under Deno 2.9.8 with
`NODE_BINARY="$(command -v node)" npm run test:unit:deno`. Deno is not a
supported runtime yet; its CI job is experimental and does not fail the
workflow. The command grants access to
the repository and `/tmp`, only the Git and Node subprocesses used by the
fixtures, and the hostname system query required by `cuid`. The command starts
Deno with a sanitized environment containing only `PATH`, `HOME`, `CI`, and
`NODE_BINARY`; the broad env permission is needed by a dependency that
enumerates `process.env`. It also allows loading the `leveldown` prebuilt native
modules required by the package's memory-card dependency.
Deno uses `--no-check` because its checker cannot resolve a declaration import
inside the `json-rpc-peer` dependency; `npm run lint:ts` remains the mandatory
canonical check.

Run `npm run coverage:deno` with Node.js 26.13.0, Deno 2.9.8, and `genhtml` to
collect Deno-native profiles and write LCOV, totals, and navigable HTML under
`coverage/deno/`. Deno's native report covers loaded modules only. To represent
the other production files without importing them, the LCOV report adds
zero-hit records for only those missing files from a separate Node native
include-all run. The Node LCOV reporter can report `LH` hits for type-only
lines whose `DA` counters are all zero, so the supplement validates those
counters and normalizes its added records to zero hits. Deno's loaded-file
counts remain Deno-native, and its native HTML renderer includes branch
coverage. The runtimes are never averaged or merged.
Machine-readable totals use the detailed `DA`, `FNDA`, and `BRDA` records, so
their percentages match the HTML renderer instead of inconsistent aggregate
LCOV tags. The renderer-only LCOV input normalizes source paths and makes
repeated function names unique; the native reports and measured counters remain
unchanged.
`coverage/node/` and `coverage/deno/` are published as separate GitHub Actions
artifacts, and each runtime is checked against its reviewed baseline in
`.github/coverage-baselines/`.

The committed line/function/branch floors in
`.github/coverage-baselines/node.json` and
`.github/coverage-baselines/deno.json` were measured independently from the full
shared suite at the versions above. Baseline changes require review; the
workflow never lowers them automatically.

`npm run lint:ts` remains the canonical TypeScript check; the test runner does
not replace it. Lifecycle tests register `t.after()` cleanup before starting
bots. Windows-specific pre-push and puppet-installer exclusions remain limited
to the existing symlink/shebang fixtures.

## Git hooks

`npm install` links `scripts/pre-push.ts` into a Git metadata directory using
Git's required `pre-push` hook name. Node.js 26 runs the TypeScript hook
directly.

Ordinary feature-branch pushes run lint, then succeed with the same version,
`HEAD`, and tags. Tag-only pushes and deletion-only pushes skip versioning.
Set `NO_HOOK=1` to skip the hook.

Versioning runs only when the checked-out branch is a release branch and the
push contains one live update from that branch to an eligible release
destination. Eligible refs use the npm publish pattern from
`.github/workflows/npm.yml`: `^refs/heads/(main|v[0-9]+\.[0-9]+.*)$`
(`main` and branches such as `v1.10`). Alpha prereleases bump to the next
alpha version, and stable versions bump by patch. The bump updates
`package-lock.json` when it is present and creates a local tag.

The nested push is `git push --no-follow-tags <remote-url> <source>:<destination>`.
The remote URL and explicit refspec publish that destination on the first
push, before an upstream is configured, and leave every other ref unchanged.
The original release push then exits 1 because it was prepared before the
version commit existed. Push the local tag separately with
`git push --no-follow-tags origin <tag>`.

The hook rejects a release push before `npm version` when more than one live
branch update includes a release branch, when a release update's source is
not the checked-out release branch, or when the remote has more than one push
URL. The repository is left unchanged in those cases.

## Releases

Releases are not automated yet. To publish to npm, run `npm test`,
`npm run dist`, and `npm publish` from a clean checkout of `main`.

## FiraCode

`Font Book` -> New Collection -> Downloaded -> Save Fira Code TTFs in it.

`.vscode/settings.json`

```json
  , "editor.fontFamily": "'Fira Code iScript', 'Fira Code', 'Courier New', Consolas, monospace"
  , "editor.fontLigatures": true
```
