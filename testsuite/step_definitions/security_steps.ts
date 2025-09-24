import { Given, When, Then } from '@cucumber/cucumber';
// Central helpers (browser, page, utilities)
import * as Helpers from '../helpers';

When(/^I retrieve a "(.*)" static resource$/, async function (resource_type) {
  // TODO: Port this step body to Playwright/Helpers
  // Original Ruby implementation (commented line-by-line to avoid '*/' sequences in paths):
  //   static_resources = {
  //     'img' => 'action-add.gif',
  //     'css' => 'susemanager-sp-migration.css',
  //     'fonts' => 'DroidSans.ttf',
  //     'javascript' => 'actionchain.js'
  //   }
  //   @url = "#{Capybara.app_host}/#{resource_type}/#{static_resources[resource_type]}"
  //   URI.open(@url, ssl_verify_mode: OpenSSL::SSL::VERIFY_NONE) do |file|
  //     @headers = file.meta
  //   end
  //
  throw new Error('Step not yet implemented (auto-generated)')
});

Then(/^the response header "(.*?)" should be "(.*?)"$/, async function (name, value) {
  // TODO: Port this step body to Playwright/Helpers
  // Original Ruby implementation (commented line-by-line to avoid '*/' sequences in paths):
  //   assert_includes(@headers.keys, name.downcase, "Header '#{name}' not present in '#{@url}'")
  //   assert_equal(value, @headers[name.downcase], "Header '#{name}' in '#{@url}' is not '#{value}'")
  //
  throw new Error('Step not yet implemented (auto-generated)')
});

Then(/^the response header "(.*?)" should not be "(.*?)"$/, async function (name, value) {
  // TODO: Port this step body to Playwright/Helpers
  // Original Ruby implementation (commented line-by-line to avoid '*/' sequences in paths):
  //   refute_equal(value, @headers[name.downcase], "Header '#{name}' in '#{@url}' is '#{value}'")
  //
  throw new Error('Step not yet implemented (auto-generated)')
});

Then(/^the response header "(.*?)" should contain "(.*?)"$/, async function (name, value) {
  // TODO: Port this step body to Playwright/Helpers
  // Original Ruby implementation (commented line-by-line to avoid '*/' sequences in paths):
  //   assert_includes(@headers.keys, name.downcase, "Header '#{name}' not present in '#{@url}'")
  //   assert_includes(@headers[name.downcase], value, "Header '#{name}' in '#{@url}' does not contain '#{value}'")
  //
  throw new Error('Step not yet implemented (auto-generated)')
});

Then(/^the response header "(.*?)" should not be present$/, async function (name) {
  // TODO: Port this step body to Playwright/Helpers
  // Original Ruby implementation (commented line-by-line to avoid '*/' sequences in paths):
  //   refute_includes(@headers.keys, name.downcase, "Header '#{name}' present in '#{@url}'")
  //
  throw new Error('Step not yet implemented (auto-generated)')
});
