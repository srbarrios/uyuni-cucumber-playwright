module.exports ={
    default: {
        paths: [
            "testsuite/features"
        ],
        dryRun: false,
        format: [
            "progress-bar",
            "summary",
            "json:reports/cucumber-report.json",
            "html:reports/cucumber-report.html"
        ],
        formatOptions: {
            colorsEnabled: true,
            snippetInterface: "async-await"
        },
        require: [
            "testsuite/step_definitions/*.ts"
        ],
        requireModule: [
            "ts-node/register"
        ]
    }
}
