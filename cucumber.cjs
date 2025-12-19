module.exports = {
    default: {
        format: [
            "pretty",
            "json:cucumber_report/cucumber-report.json",
            "html:cucumber_report/cucumber-report.html"
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
    sanity_check: {
        paths: [
            "testsuite/features/core/allcli_sanity.feature"
        ],
        format: [
            "pretty",
            "json:cucumber_report/cucumber-sanity-check-report.json",
            "html:cucumber_report/cucumber-sanity-check-report.html"
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
            "json:cucumber_report/cucumber-core-report.json",
            "html:cucumber_report/cucumber-core-report.html"
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

    // A profile to run only reposync features
    reposync: {
        paths: [
            "testsuite/features/reposync/srv_disable_scheduled_reposync.feature",
            "testsuite/features/reposync/srv_sync_channels.feature",
            "testsuite/features/reposync/srv_sync_products.feature",
            "testsuite/features/reposync/srv_create_fake_channels.feature",
            "testsuite/features/reposync/srv_create_fake_repositories.feature",
            "testsuite/features/reposync/srv_create_devel_channels.feature",
            "testsuite/features/reposync/srv_sync_fake_channels.feature",
            "testsuite/features/reposync/srv_sync_devel_channels.feature",
            "testsuite/features/reposync/srv_create_activationkey.feature",
            "testsuite/features/reposync/allcli_update_activationkeys.feature",
            "testsuite/features/reposync/srv_create_bootstrap_repositories.feature"
        ],
        format: [
            "pretty",
            "json:cucumber_report/cucumber-reposync-report.json",
            "html:cucumber_report/cucumber-reposync-report.html"
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
            "json:cucumber_report/cucumber-init-clients-report.json",
            "html:cucumber_report/cucumber-init-clients-report.html"
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
            "json:cucumber_report/cucumber-proxy-report.json",
            "html:cucumber_report/cucumber-proxy-report.html"
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


    // A profile to run only finishing features
    finishing: {
        paths: [
            "testsuite/features/finishing/srv_selinux.feature",
            "testsuite/features/finishing/srv_debug.feature",
            "testsuite/features/finishing/allcli_debug.feature",
            "testsuite/features/finishing/srv_count_scc_access.feature"
        ],
        format: [
            "pretty",
            "json:cucumber_report/cucumber-finishing-report.json",
            "html:cucumber_report/cucumber-finishing-report.html"
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
