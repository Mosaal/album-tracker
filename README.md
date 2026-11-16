# Album Tracker

A React + TypeScript web app built with Vite and Ant Design.

Live at <https://mosaal.github.io/album-tracker/>.

## Sync across devices

Album Tracker keeps your collection in your browser. To have the same
collection on your phone, laptop and anywhere else, sync it through a private
GitHub repository of your own. There's no Album Tracker server or account: the
app talks to GitHub directly, and the repository is yours.

### Set up the first device

1. Open ⋯ → **Sync with GitHub…**.
2. Use **Create a repository** to make a private repository, such as
   `album-collection`, and enter its name.
3. Use **Create a token** to make a fine-grained personal access token. The link
   fills in its name, **Contents: Read and write** and no expiration. Under
   **Repository access**, choose **Only select repositories** and pick the
   repository. Paste the token into the app and select **Connect**.

The first device starts the collection: its albums are saved to `albums.json`
in the repository.

### Add more devices

On a device that's already syncing, open ⋯ → **Sync settings…** and copy the
setup code. On the new device, open ⋯ → **Sync with GitHub…** → **Setup code**
and paste it. The code includes the token, so only paste it on your own devices.

When a device connects to a repository that already has albums, they replace
the ones on that device. If it has albums the repository doesn't, the app offers
to export them first.

On iPhone and iPad, the app added to the Home Screen keeps its own data,
separate from Safari, so connect it as a device of its own.

### How it works

- Each device keeps its own copy, so the app works offline. It syncs when it
  opens, a couple of seconds after a change, when you come back to it, and when
  the connection returns. The icon next to the theme switch shows how it's going.
- Each sync is a commit to `albums.json`, so the repository's history is a
  backup of every change.
- You can edit `albums.json` on GitHub too. If an entry can't be read, the file
  is left as it is, and syncing stops with a message until it's fixed.
- The token is stored only in the browser on each device, and can only read and
  write the repository you picked. **Disconnect** in Sync settings removes it
  from a device. To revoke it everywhere, delete it in GitHub's
  [token settings](https://github.com/settings/personal-access-tokens).

### Limitations

- When the same album is changed on two devices before either syncs, the later
  change wins.
- Two devices that add the same album before syncing end up with two copies.
- Which change is later depends on each device's clock.
- Deleted albums are remembered, so a device that still has one can't bring it
  back. The list only grows, but each entry is tiny.

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

CI runs lint, format, tests and build on every pull request.

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
| `npm test`             | Run the tests once               |
| `npm run test:watch`   | Re-run the tests on every change |
