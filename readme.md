### Project Setup for Playwright with Cucumber

This guide outlines a baseline project structure for integrating **Playwright** and **Cucumber**. It covers the initial setup, provides steps for creating and running tests, and offers guidance for a more maintainable project.

-----

### Prerequisites

  * **Node.js**: Ensure Node.js is installed on your system.

-----

### Project Initialization

Follow these steps to set up the project from scratch:

1.  **Create a Project Directory**: Make a new folder for your project.

2.  **Initialize Node.js**: In your terminal, navigate to the new directory and run `npm init -y` to create a `package.json` file.

3.  **Install Dependencies**: Install the necessary libraries using npm:

      * `npm install playwright@latest`
      * `npm install @cucumber/cucumber --save-dev`
      * `npm install ts-node --save-dev`

4.  **Configure Project Structure**:

      * Delete the default files and folders created by Playwright, such as `playwright.config.ts`, `tests`, and `tests-examples`.
      * Create a dedicated structure for your feature files and step definitions:
          * `testsuite/features`
          * `testsuite/step-definitions`

5.  **Create Your First Feature File**:

      * Inside the `testsuite/features` folder, create a file named `login.feature`.
      * Add the following Gherkin syntax to define a test scenario:
        ```gherkin
        Feature: User Login
          As a registered user
          I want to log in to my account
          So that I can access my dashboard

        Scenario: Successful login with valid credentials
          Given I am on the login page
        ```

6.  **Configure TypeScript**: Create a `tsconfig.json` file in your project's root directory with the following configuration:

    ```json
    {
      "compilerOptions": {
        "target": "ESNext",
        "module": "CommonJS",
        "strict": true,
        "esModuleInterop": true,
        "outDir": "dist"
      },
      "include": ["testsuite/**/*"],
      "exclude": ["node_modules"]
    }
    ```

7.  **Configure Cucumber**: Create a `cucumber.json` file in the project root to set up Cucumber's behavior.

    ```json
    {
      "default": {
        "paths": ["testsuite/features"],
        "dry-run": false,
        "formatOptions": {
          "colorsEnabled": true,
          "snippetInterface": "async-await"
        },
        "require": ["testsuite/step-definitions/*.ts"],
        "requireModule": ["ts-node/register"]
      }
    }
    ```

8.  **Define a Step Definition**:

      * Create a file named `login.ts` inside `testsuite/step-definitions`.
      * Import the necessary `Given` function from `@cucumber/cucumber` and define the step from your feature file.

    <!-- end list -->

    ```typescript
    import { Given } from "@cucumber/cucumber";

    Given('A web browser is at the Oubiti login page', async function () {
      console.log('pass')
    });
    ```

9.  **Add a Run Script**: In your `package.json`, add a script to easily run your tests.

    ```json
    "scripts": {
      "cucumber": "cucumber-js"
    }
    ```

-----

### Running Your Tests

To execute the tests, use the following command in your terminal:

  * `npm run cucumber`

This command will run Cucumber, and you should see the `console.log` output:
`Test`

-----

### Advanced Configuration

To make the project more robust, consider these improvements:

#### Centralize Cucumber Configuration

  * Move the `cucumber.json` file to a `config` folder (e.g., `config/cucumber.js`).
  * Convert the JSON file to a JavaScript module for more flexibility.

<!-- end list -->

```javascript
module.exports = {
  default: {
    paths: ["testsuite/features"],
    dryRun: false,
    formatOptions: {
      colorsEnabled: true,
      snippetInterface: "async-await"
    },
    require: ["testsuite/step-definitions/*.ts"],
    requireModule: ["ts-node/register"]
  }
};
```

  * Update your `package.json` script to point to the new configuration file:
    `"cucumber": "cucumber-js --config config/cucumber.js"`

#### Create a Full-Fledged Test Scenario

Let's expand the login feature to perform a real action.

  * **Update `login.feature`**:

    ```gherkin
    Feature: User Login
      As a registered user,
      I want to log in to my account,
      So that I can access my dashboard.

      Scenario: Successful login with valid credentials
        Given I am on the login page
        When I enter valid credentials
        And I click the login button
        Then I should be redirected to a login success page
    ```

  * **Update `login.ts`**:

    ```typescript
    import { Given, When, Then } from "@cucumber/cucumber";
    import { Page, Browser, chromium, expect } from "@playwright/test";

    let browser: Browser;
    let page: Page;

    Given('I am on the login page', async function () {
      // Enable headless if you dont want to see the browser while running the tests.
      browser = await chromium.launch({ headless: false });
      page = await browser.newPage();
      await page.goto('https://www.oubiti.com/');
    });

    When('I enter valid credentials', async function () {
      await page.get_by_label("Username").fill("testuser");
      await page.get_by_label("Password").fill("testpass");
      await page.get_by_role("button", name="Login").click();
    });

    When('I click the login button', async function () {
      await page.get_by_role("button", name="Login").click();
    });

    Then('I should be redirected to a login success page', async function () {
      // Use modern Playwright expect assertions for auto-waiting and clarity
      expect(page).to_have_url("https://oubiti.com/login-success.html");
      expect(page.get_by_text( "You have successfully logged in.")).to_be_visible();
      await browser.close();
    });
    ```

  * Run the tests again to see the scenario pass. The output will show the test summary.

#### Generate Reports

To add reporting, update the `cucumber.js` configuration file with the `format` option.

```javascript
module.exports = {
  default: {
    paths: ["testsuite/features"],
    // ... other configurations
    format: [
      "progress-bar",
      "summary",
      "json:reports/cucumber-report.json",
      "html:reports/cucumber-report.html"
    ]
  }
};
```

This will generate both JSON and HTML reports, providing a detailed view of your test results.