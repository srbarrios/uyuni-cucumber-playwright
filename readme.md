# Uyuni Test Framework with Playwright and CucumberJS

This project serves as a new test framework for Uyuni, migrating web interaction tests from Capybara+Selenium (Ruby) to
Playwright (TypeScript) with CucumberJS as the test runner.

## Prerequisites

* **Node.js**: Ensure Node.js is installed on your system.

## Project Setup

1. **Install Dependencies**:
   Install the necessary libraries using npm:
```bash
npm install
```

2. **Configure Environment Variables**:
   Before running any tests, you **must** edit the `.env` file to configure your environment variables.

## Project Structure

* `testsuite/features/`: Contains the Gherkin feature files, which define the high-level test scenarios.
* `testsuite/step_definitions/`: Implements the actual test steps in TypeScript, linking them to the feature files.
* `testsuite/helpers/`: Provides various utility functions and modules used across the tests, including API clients,
  configuration, and common actions.
* `config/`: Holds configuration files, such as `cucumber.cjs` for Cucumber settings.

## Running Your Tests

To execute the tests, use the following commands in your terminal:

* `npm run cucumber:sanity_check`
* `npm run cucumber:core`
* `npm run cucumber:reposync`
* `npm run cucumber:init_clients`
* `npm run cucumber:proxy`
* `npm run cucumber:finishing`

These scripts are defined in the `scripts` section of `package.json` and provide a convenient way to execute tests for
specific profiles:

* `npm run cucumber:sanity_check`: Runs tests defined in the `sanity_check` profile.
* `npm run cucumber:core`: Runs tests defined in the `core` profile.
* `npm run cucumber:reposync`: Runs tests defined in the `reposync` profile.
* `npm run cucumber:init_clients`: Runs tests defined in the `init_clients` profile.
* `npm run cucumber:proxy`: Runs tests defined in the `proxy` profile.
* `npm run cucumber:finishing`: Runs tests defined in the `finishing` profile.

Each of these commands internally calls `npm run cucumber` with the `--profile` flag, specifying which Cucumber profile
to use.

### Running a Subset of Tests with Profiles

The `config/cucumber.cjs` file defines various profiles that allow you to run specific subsets of feature files. Each
profile specifies a `paths` array, which lists the feature files to be executed. The order in which these feature files
are listed in the `paths` array determines their execution order.

For example, to run the `core` features, you would use:

```bash
npm run cucumber:core
```

This command executes the feature files defined in the `core` profile within `config/cucumber.cjs` in the order they are
listed.

**To customize the test execution order or run a different subset of tests:**

1. **Modify an existing profile**: Edit the `paths` array within a profile in `config/cucumber.cjs` to change the
   included feature files or their execution order.
2. **Create a new profile**: Add a new entry to `module.exports` in `config/cucumber.cjs` with a unique name and a
   `paths` array specifying your desired feature files and their order.
   Example of a new profile:
```javascript
// A profile for specific sanity checks
sanity_checks: {
    paths: [
        "testsuite/features/sanity/a.feature",
        "testsuite/features/sanity/b.feature",
    ]
    // ... other configurations (can inherit from default or other profiles)
}
```

After creating a new profile, you would need to add a corresponding script to `package.json` to easily run it:

```json
"scripts": {
    "cucumber:sanity_check": "cucumber-js --profile sanity_check"
}

```

Then you can run it with:

```bash
npm run cucumber:sanity_check
```

This approach provides flexibility to define various test stages, which can be integrated into CI/CD pipelines like
Jenkins stages.

### Running Cucumber Features in IntelliJ/WebStorm IDE

You can configure a **Run/Debug Configuration** in your JetBrains IDE (like IntelliJ IDEA or WebStorm) to easily execute a single feature file or a directory of features.

#### Configuration Type: Cucumber.js

1. Go to **Run** > **Edit Configurations...**
2. Click the **+** button and select **Cucumber.js**.

#### Configuration Fields

| Field | Value/Configuration                                                                                    | Purpose |
| --- |--------------------------------------------------------------------------------------------------------| --- |
| **Name** | `Sanity Checks`                                                                                        | A descriptive name for your configuration. |
| **Feature file or directory** | `<YOUR_PATH>/uyuni-cucumber-playwright/testsuite/features/core/allCli_Sanity.feature`                  | This specifies the single feature file (`allCli_Sanity.feature`) to be executed. Alternatively, you can point to a directory like `testsuite/features/core/` to run all features within it. |
| **Cucumber arguments** | `NODE_OPTIONS=l"--disable-warning=DEP0180l" npx cucumber-js --loader ts-node/esm --config cucumber.cjs` | These are the arguments passed to the Cucumber runner. They typically include: * `NODE_OPTIONS`: For suppressing specific Node.js warnings. * `npx cucumber-js`: Calls the Cucumber runner. * `--loader ts-node/esm`: Enables running TypeScript files using ESM syntax. * `--config cucumber.cjs`: Points to your main Cucumber configuration file. |
| **Name Filter** | (Empty)                                                                                                | Leave empty to run all scenarios in the specified feature file. |
| **Node runtime** | `Project`                                                    | Select the Node.js interpreter configured for your project. |
| **Cucumber package** | `<YOUR_PATH>/uyuni-cucumber-playwright/node_modules/@cucumber/cucumber`                                | The path to the installed Cucumber package in your `node_modules` directory. |
| **Working directory** | `<YOUR_PATH>/uyuni-cucumber-playwright`                                                                | The root directory of your project where configuration files and `package.json` reside. |
| **Environment variables** | `SERVER=uyuni-ci-master-playwright-server.mgr.suse.de` (example)                                       | Use this to set environment variables required by your tests, such as the target server URL. |

#### Before launch

* **Task**: The screenshot shows a **Compile TypeScript** task.
* **Purpose**: This ensures all your TypeScript step definitions and helpers are successfully compiled before the test runner starts, guaranteeing you are running the latest code.



By setting up this configuration, you can easily run, debug, and manage your Playwright-Cucumber tests directly within the IDE, targeting individual feature files for focused development and debugging.

## Generate Reports

To add reporting, update the `cucumber.cjs` configuration file with the `format` option.

```javascript
module.exports = {
    default: {
        // ... other configurations
        format: [
            "json:cucumber_report/cucumber-report.json",
            "html:cucumber_report/cucumber-report.html"
        ]
    }
};
```

This will generate both JSON and HTML reports, providing a detailed view of your test results.
