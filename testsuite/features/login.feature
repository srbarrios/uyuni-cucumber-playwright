Feature: User Login
 As a registered user
 I want to log in to my account
 So that I can access my dashboard

 Scenario: Successful login with valid credentials
   Given I am on the login page
   When I enter valid credentials
   And I click the login button
   Then I should be redirected to a login success page
