# Contributing to devChat

Thank you for helping make devChat better! Every contribution counts: code,
docs, bug reports, translations and answering questions.

## Ways to contribute

- **Report a bug:** open an [issue](https://github.com/jrnoorbaloch/devChat/issues)
  with your OS, `node --version`, the messenger you use and the full output.
- **Suggest a feature:** open an issue first so we can agree on the API before
  you write code.
- **Improve the docs:** every docs page has an "Edit this page on GitHub" link.
  The site source is in [`website/`](website/).
- **Write code:** look for issues labelled `good first issue` or `help wanted`.

## Development setup

```sh
git clone https://github.com/jrnoorbaloch/devChat.git
cd devChat
npm ci
npm test          # lint + typecheck + unit tests
```

Node.js 26+ runs the TypeScript sources directly; there is no build step for
development. See [DEVELOPMENT.md](DEVELOPMENT.md) for details.

## Pull request checklist

- [ ] `npm test` passes
- [ ] New behaviour has tests next to the code (`*.test.ts`)
- [ ] Public functions have TSDoc comments
- [ ] Docs updated (`website/pages/` and/or `README.md`) when behaviour changes

## Code of conduct

Be kind and constructive. See [CODE_OF_CONDUCT.md](.github/CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contributions are licensed under the
[Apache License 2.0](LICENSE).
