# Album Tracker

A React + TypeScript web app built with Vite and Ant Design.

Live at <https://mosaal.github.io/album-tracker/>.

## Development

```
npm install
npm run dev
```

## Contributing

`main` is protected. All changes land through a pull request:

```
git checkout -b feat/my-change
# ...commit...
git push -u origin feat/my-change
```

CI runs lint, format and build on every pull request.

### Commit messages

Commits follow [Conventional Commits](https://www.conventionalcommits.org/).
The prefix determines the next version:

| Prefix                        | Version bump | Changelog        |
| ----------------------------- | ------------ | ---------------- |
| `feat:`                       | minor        | Features         |
| `fix:`                        | patch        | Bug Fixes        |
| `feat!:` / `BREAKING CHANGE:` | major        | Breaking Changes |
| `chore:` / `docs:` / `test:`  | none         | omitted          |

When squash-merging, the PR title becomes the commit message, so the title
must follow the same convention.

### Releases

Releases are automated by
[release-please](https://github.com/googleapis/release-please). It watches
`main` and maintains an open release pull request that bumps the version in
`package.json` and updates `CHANGELOG.md`. Merging that pull request tags the
version and publishes a GitHub release.

## Scripts

| Script                 | Purpose                          |
| ---------------------- | -------------------------------- |
| `npm run dev`          | Start the dev server             |
| `npm run build`        | Type-check and build to `dist/`  |
| `npm run preview`      | Serve the production build       |
| `npm run lint`         | Run ESLint                       |
| `npm run lint:fix`     | Run ESLint with autofix          |
| `npm run format`       | Format with Prettier             |
| `npm run format:check` | Check formatting without writing |

| Script                 | Purpose                          |
| ---------------------- | -------------------------------- |
| `npm run dev`          | Start the dev server             |
| `npm run build`        | Type-check and build to `dist/`  |
| `npm run preview`      | Serve the production build       |
| `npm run lint`         | Run ESLint                       |
| `npm run lint:fix`     | Run ESLint with autofix          |
| `npm run format`       | Format with Prettier             |
| `npm run format:check` | Check formatting without writing |
