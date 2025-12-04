import {Then, When} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import {globalVars, getContext, addContext, getBrowserInstances} from '../helpers/index.js';

const static_resources: { [key: string]: string } = {
  'img': 'action-add.gif',
  'css': 'susemanager-sp-migration.css',
  'fonts': 'DroidSans.ttf',
  'javascript': 'actionchain.js'
};

When(/^I retrieve a "(.*)" static resource$/, async function (resource_type: string) {
  addContext('url', `${process.env.BASE_URL}/${resource_type}/${static_resources[resource_type]}`);
  addContext('response', await getBrowserInstances().context.request.get(<string>getContext('url'), { ignoreHTTPSErrors: true }));
  addContext('headers', await getContext('response').headers());
});

Then(/^the response header "(.*?)" should be "(.*?)"$/, async function (name: string, value: string) {
  expect(getContext('headers')).toHaveProperty(name.toLowerCase(), `Header '${name}' not present in '${getContext('url')}'`);
  expect(getContext('headers')[name.toLowerCase()]).toEqual(value);
});

Then(/^the response header "(.*?)" should not be "(.*?)"$/, async function (name: string, value: string) {
  expect(getContext('headers')[name.toLowerCase()]).not.toEqual(value);
});

Then(/^the response header "(.*?)" should contain "(.*?)"$/, async function (name: string, value: string) {
  expect(getContext('headers')).toHaveProperty(name.toLowerCase(), `Header '${name}' not present in '${getContext('url')}'`);
  expect(getContext('headers')[name.toLowerCase()]).toContain(value);
});

Then(/^the response header "(.*?)" should not be present$/, async function (name: string) {
  expect(getContext('headers')).not.toHaveProperty(name.toLowerCase(), `Header '${name}' present in '${getContext('url')}'`);
});
