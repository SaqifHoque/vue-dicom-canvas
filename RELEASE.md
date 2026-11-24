# npm releases

The package is published publicly as `vue-dicom-canvas`. The earlier
`@saqif/vue-dicom-canvas` releases are separate npm versions and remain available for
existing installations. See [MIGRATION.md](MIGRATION.md) for the import changes.

## First unscoped release

The first publication uses an npm maintainer account. From the reviewed `main` commit,
run `npm ci`, `npm run check`, and `npm run verify:package`. After CI passes,
run `npm publish --access public` and complete npm's sign-in and two-factor verification.

In the new package's npm settings under **Trusted publishing**, choose **GitHub Actions**.
Use owner `SaqifHoque`, repository `vue-dicom-canvas`, workflow filename
`publish.yml`, and enable direct `npm publish`. Leave the environment blank.
npm requires the existing package before it will accept this configuration.
Replace the docs site and minimal example's temporary npm aliases with the
published unscoped version after the first publication.

## Later releases

Update the version in `package.json` and `package-lock.json` and add a changelog entry.
Merge the version bump into `main` after CI passes. GitHub Actions checks the registry,
verifies the package and consumer builds, runs Chromium tests, and publishes the
verified tarball with npm provenance. The workflow skips versions already on npm.
Use **Run workflow** on `main` to retry a release.
