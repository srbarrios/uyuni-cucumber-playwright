## New Uyuni Test Framework

This PoC aims to replace our current stack for web interactions, migrating from Capybara+Selenium to Playwright. It also
implies a change of programming language from Ruby to Typescript, and so our test runner will be CucumberJS.

### Project Setup for Playwright with Cucumber

This guide outlines a baseline project structure for integrating **Playwright** and **Cucumber**. It covers the initial
setup, provides steps for creating and running tests, and offers guidance for a more maintainable project.

-----

### Prerequisites

* **Node.js**: Ensure Node.js is installed on your system.

-----

### Install Dependencies

Install the necessary libraries using npm:

* `npm install playwright@latest`
* `npm install @cucumber/cucumber --save-dev`
* `npm install ts-node --save-dev`
* `npm install`

-----

### Running Your Tests

To execute the tests, use the following command in your terminal:

* `npm run cucumber:core`
* `npm run cucumber:init_clients`
* `npm run cucumber:proxy`

-----

#### Generate Reports

To add reporting, update the `cucumber.cjs` configuration file with the `format` option.

```javascript
module.exports = {
  default: {
    // ... other configurations
    format: [
      "json:reports/cucumber-report.json",
      "html:reports/cucumber-report.html"
    ]
  }
};
```

This will generate both JSON and HTML reports, providing a detailed view of your test results.
