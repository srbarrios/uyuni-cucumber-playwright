# Uyuni Test Framework with Playwright and CucumberJS

This project serves as a new test framework for Uyuni, migrating web interaction tests from Capybara+Selenium (Ruby) to
Playwright (TypeScript) with CucumberJS as the test runner.

### Prerequisites

* **Node.js**: Ensure Node.js is installed on your system.

### Project Setup

1. **Install Dependencies**:
   Install the necessary libraries using npm:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Before running any tests, you **must** edit the `.env` file to configure your environment variables.

### Project Structure

* `testsuite/features/`: Contains the Gherkin feature files, which define the high-level test scenarios.
* `testsuite/step_definitions/`: Implements the actual test steps in TypeScript, linking them to the feature files.
* `testsuite/helpers/`: Provides various utility functions and modules used across the tests, including API clients,
  configuration, and common actions.
* `config/`: Holds configuration files, such as `cucumber.cjs` for Cucumber settings.

### Running Your Tests

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

```
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

#### Generate Reports

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
