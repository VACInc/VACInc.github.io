# vacinc.github.io

Single-page contact card served by GitHub Pages at <https://vacinc.github.io/>.

| File         | Purpose                                                     |
| ------------ | ----------------------------------------------------------- |
| `index.html` | The whole site: markup and inline CSS. No JavaScript.       |
| `qr.png`     | QR code that must encode `https://vacinc.github.io/`.       |
| `test/`      | Browser and static checks run by CI (`npm test`).           |

## Editing

- Change links and copy directly in `index.html`.
- If the canonical URL changes (e.g. a custom domain), regenerate `qr.png`
  **and** update its `alt` text and `SITE_URL` in `test/helpers.mjs` in the
  same commit. The test suite decodes the QR and fails if any of the three
  disagree, so a printed QR can never point somewhere stale.

## Running the checks locally

Requires Node.js 22+.

```sh
npm ci --ignore-scripts
npx playwright install chromium   # first time only
npm test
```

`npm test` validates the HTML (html-validate), decodes `qr.png`, checks link
hygiene, and loads the page in headless Chromium to catch console errors and
failed requests.

## Deployment

GitHub Pages publishes the `main` branch as-is. CI (`.github/workflows/ci.yml`)
runs on every push and pull request; it does not deploy.

Dev tooling files (`package.json`, `test/`, this README) are also served by
Pages. They contain nothing sensitive; the repository is public anyway.

## Security notes

- The page has no JavaScript, forms, or third-party resources.
- CI uses a read-only token, pins actions to commit SHAs, and installs
  dependencies with `--ignore-scripts`. Dependabot updates actions and npm
  dev dependencies weekly with a 7-day cooldown on new releases.
- Commit with your GitHub `noreply` address
  (`git config user.email <id>+<user>@users.noreply.github.com`) so personal
  email addresses don't end up in public history.
