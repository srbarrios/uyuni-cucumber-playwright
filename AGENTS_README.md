Repository purpose and stack

- Goal: Proof-of-concept to migrate Uyuni/SUSE Manager web test automation from Ruby (Capybara+Selenium) to TypeScript (
  Playwright) with CucumberJS.
- Primary tech: Node.js, CucumberJS, Playwright (via @playwright/test APIs), TypeScript executed via ts-node.
- Test assets live under testsuite/ (features and step definitions). Cucumber config is in config/cucumber.cjs.

Common commands

- Install dependencies
  ```sh path=null start=null
  npm ci
  ```
- Install Playwright browser (local dev)
  ```sh path=null start=null
  npx playwright install chromium
  ```
- Run the full Cucumber test suite (with reporters configured in config/cucumber.cjs)
  ```sh path=null start=null
  npm run cucumber
  ```
- Run a single feature file
  ```sh path=null start=null
  npm run cucumber -- testsuite/features/login.feature
  ```
- Run a single scenario (by name)
  ```sh path=null start=null
  npm run cucumber -- --name "Successful login with valid credentials"
  ```
- Run a single scenario (by line number)
  ```sh path=null start=null
  npm run cucumber -- testsuite/features/login.feature:22
  ```
- Run by tag
  ```sh path=null start=null
  npm run cucumber -- --tags @smoke
  ```
- Headed/debug run (env.ts will disable headless when DEBUG=true)
  ```sh path=null start=null
  DEBUG=true npm run cucumber
  ```
- Publish results to cucumber.io (optional; mirrors CI)
  ```sh path=null start=null
  CUCUMBER_PUBLISH_ENABLED=true npm run cucumber
  ```

Notes on build/lint

- There is no compile/build step for running tests: ts-node is registered via Cucumber (requireModule:
  ts-node/register).
- No linter or formatter is configured in this repository at present.

What CI runs (reference)

- GitHub Actions workflow .github/workflows/playwright.yml uses:
    - npm ci
    - npx playwright install chromium
    - CUCUMBER_PUBLISH_ENABLED=true npm run cucumber

High-level architecture

- BDD flow
    - Feature files: testsuite/features/**/*.feature
    - Step definitions: testsuite/step_definitions/*.ts (CucumberJS, async/await style)
    - Cucumber config (config/cucumber.cjs):
        - Registers ts-node so TypeScript step definitions run directly.
        - Loads features from testsuite/features.
        - Outputs reports to reports/cucumber-report.(json|html) and prints progress/summary.

- Playwright integration
    - The project uses @playwright/test’s types and Browser/Page APIs, but the test runner is CucumberJS (not Playwright
      Test).
    - testsuite/helpers/core/env.ts centralizes browser lifecycle and environment toggles:
        - getBrowserConfig() maps env flags (e.g., DEBUG) to Playwright launch options.
        - initializeBrowser()/getBrowserInstances()/closeBrowser() manage a shared Browser/Context/Page.
        - TIMEOUTS/default taken from environment; applied as Playwright default timeouts.
        - Optional utilities: takeScreenshot(), isWebSessionActive(), logScenarioTiming().

- Test helpers (TypeScript)
    - Aggregated exports: testsuite/helpers/index.ts re-exports the helper modules to provide stable import paths.
    - Core utilities: testsuite/helpers/core/*
        - env.ts: environment and browser lifecycle (see above).
        - constants.ts: domain constants (hosts, channels, labels, etc.) used by Uyuni/SUMA test logic.
        - commonlib.ts, keyvalue_store.ts: shared utilities and types used across helpers and steps.
        - navigation_helper.ts: higher-level UI operations (e.g., toggling checkboxes, filtering lists) on Playwright
          Page objects.
    - API helpers: testsuite/helpers/api/* (http_client, xmlrpc_client, api_test) and corresponding namespaces.
    - Network/system helpers: testsuite/helpers/network/* and testsuite/helpers/system/* for remote node management and
      monitoring.
    - Many Ruby counterparts exist for parity during migration; TypeScript modules are the canonical path for
      Playwright+Cucumber.

- Typical execution path (conceptual)
    1) Cucumber loads step definitions via ts-node (config/cucumber.cjs).
    2) Steps import helpers from testsuite/helpers/index.ts.
    3) env.initializeBrowser() launches Chromium with flags derived from environment variables.
    4) Steps drive the UI via Playwright Page methods and higher-level helpers (e.g., navigation_helper.ts), using
       timeouts from env.ts.
    5) Results are emitted by Cucumber; optional screenshots and reports are written locally.

Environment flags and inputs

- Common toggles (read in testsuite/helpers/core/env.ts):
    - DEBUG=true: run headed and enable verbose logs.
    - QUALITY_INTELLIGENCE=true, CODE_COVERAGE=true (requires REDIS_HOST): enable optional modes if your stack provides
      them.
    - PROVIDER includes aws or podman: affects browser args; CONTAINER_RUNTIME set to k3s or podman marks containerized
      servers.
    - SERVER: required by some helpers (e.g., getAppHost()) to construct the base URL as https://$SERVER.
    - TEST_ENV_NUMBER: used to derive a non-conflicting remote debugging port when chromium devtools are enabled.

Key files to know

- package.json: defines the cucumber script (npm run cucumber).
- config/cucumber.cjs: Cucumber runner configuration and reporters.
- tsconfig.json: includes testsuite/**/* for TypeScript; execution is via ts-node at runtime.
- .github/workflows/playwright.yml: example of CI-complete setup.

Important bits from README

- Purpose and prerequisites (Node.js) and the basic command to run tests (npm run cucumber) are already documented.
- This repo organizes features in testsuite/features and step definitions in testsuite/step_definitions, with ts-node
  registered in Cucumber config.

Development tips specific to this repo

- If you need to see the browser/UI during a scenario, prefer DEBUG=true npm run cucumber which switches env.ts into
  headed mode and adds helpful Chromium flags.
- To scope runs, use feature paths, --name, line numbers, or --tags so you get rapid feedback during iteration without
  running the full suite.
