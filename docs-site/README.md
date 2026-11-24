# Vue DICOM Canvas documentation website

Standalone Vue + Vite app consuming `vue-dicom-canvas`. Documentation reflects the published API.

The dependency uses an npm alias for the existing scoped release until the first unscoped release is available.

```sh
cd docs-site
npm ci
npm run dev
```

`npm run build` writes `dist/`. Deploy that folder. Source and demo data stay in GitHub and are excluded from the library package.
