module.exports = {
    default: {
        format: [
            "pretty",
            "json:reports/cucumber-report.json",
            "html:reports/cucumber-report.html"
        ],
        formatOptions: {
            colorsEnabled: true,
            snippetInterface: "async-await"
        },
        import: [
            "testsuite/step_definitions/*.ts"
        ],
        dryRun: false,
        publish: false,
        timeout: 60000
    },

    // A profile to run only core features
    core: {
        paths: [
            "testsuite/features/core/srv_first_settings.feature",
            "testsuite/features/core/srv_disable_local_repos_off.feature",
            "testsuite/features/core/srv_organization_credentials.feature",
            "testsuite/features/core/srv_user_preferences.feature",
            "testsuite/features/core/srv_osimage.feature",
            "testsuite/features/core/srv_docker.feature"
        ],
        format: [
            "pretty",
            "json:reports/cucumber-core-report.json",
            "html:reports/cucumber-core-report.html"
        ],
        formatOptions: {
            colorsEnabled: true,
            snippetInterface: "async-await"
        },
        import: ["testsuite/step_definitions/*.ts"],
        timeout: 60000,
        dryRun: false,
        publish: false
    },

    // A profile to run only client initialization features
    init_clients: {
        paths: ["testsuite/features/init_clients/**/*.feature"], // This one is already correct
        format: [
            "pretty",
            "json:reports/cucumber-init-clients-report.json",
            "html:reports/cucumber-init-clients-report.html"
        ],
        formatOptions: {
            colorsEnabled: true,
            snippetInterface: "async-await"
        },
        import: ["testsuite/step_definitions/*.ts"],
        timeout: 60000,
        dryRun: false,
        publish: false
    },

    // A profile to run only proxy features
    proxy: {
        paths: [
            "testsuite/features/proxy/proxy_container.feature",
            "testsuite/features/proxy/proxy_rbs_container_branch_network.feature"
        ],
        format: [
            "pretty",
            "json:reports/cucumber-core-report.json",
            "html:reports/cucumber-core-report.html"
        ],
        formatOptions: {
            colorsEnabled: true,
            snippetInterface: "async-await"
        },
        import: ["testsuite/step_definitions/*.ts"],
        timeout: 60000,
        dryRun: false,
        publish: false
    }
}
