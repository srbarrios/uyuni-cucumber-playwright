# Copyright 2017-2023 SUSE LLC
# Licensed under the terms of the MIT license.
#
# This feature is a dependency for all features and scenarios that include the @scc_credentials tag

@skip_if_containerized_server
@scc_credentials
@no_mirror
Feature: Organization credentials in the Setup Wizard
    In order to access SUSE Customer Center resources
    As an admin user
    I want to enter valid SCC credentials in the Setup Wizard

  Scenario: Enter valid SCC credentials
    Given I am authorized for the "Admin" section
    When I follow the left menu "Admin > Setup Wizard > Organization Credentials"
    And I ask to add new credentials
    And I enter the SCC credentials
    And I click on "Save"
    And I wait until the SCC credentials are valid
