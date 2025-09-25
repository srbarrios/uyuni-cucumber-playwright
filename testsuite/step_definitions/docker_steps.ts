import {Then, When, World} from '@cucumber/cucumber';

import {getBrowserInstances, globalVars, repeatUntilTimeout, retrieveBuildHostId} from '../helpers/index.js';
import {getApiTest} from '../helpers/index.js';
import { enterTextAsField, followLeftMenu } from '../helpers/embedded_steps/navigation_helper.js';
import { waitUntilDoNotSeeText } from '../helpers/embedded_steps/common_helper.js';

When(/^I enter "([^"]*)" relative to profiles as "([^"]*)"$/, async function (path, field) {
    const gitProfiles = process.env.GITPROFILES || '';
    await enterTextAsField(`${gitProfiles}/${path}`, field);
});

When(/^I enter URI, username and password for registry$/, async function (...args: any[]) {
    const [authRegistryUsername, authRegistryPassword] = (process.env.AUTH_REGISTRY_CREDENTIALS || '|').split('|');
    if (!globalVars.authRegistry) {
        throw new Error("AUTH_REGISTRY environment variable is required");
    }
    await enterTextAsField(globalVars.authRegistry, 'uri');
    await enterTextAsField(authRegistryUsername, 'username');
    await enterTextAsField(authRegistryPassword, 'password');
});

When(/^I wait at most (\d+) seconds until image "([^"]*)" with version "([^"]*)" is built successfully via API$/, async function (timeout, name, version) {
    let imageId = 0;
    await repeatUntilTimeout(async () => {
        if (imageId === 0) {
            const imagesList = await getApiTest().image.listImages();
            console.log(`List of images: ${JSON.stringify(imagesList)}`);
            const element = imagesList.find((el: any) => el.name === name && el.version === version);
            if (element) {
                imageId = element.id;
            }
        } else {
            const imageDetails = await getApiTest().image.getDetails(imageId);
            console.log(`Image Details: ${JSON.stringify(imageDetails)}`);
            if (imageDetails.buildStatus === 'completed') {
                return true;
            }
            if (imageDetails.buildStatus === 'failed') {
                throw new Error('image build failed.');
            }
        }
        await new Promise(r => setTimeout(r, 5000));
        return false;
    }, {message: 'image build did not complete', timeout: Number(timeout)});
    if (imageId === 0) {
        throw new Error('unable to find the image id');
    }
});

When(/^I wait at most (\d+) seconds until image "([^"]*)" with version "([^"]*)" is inspected successfully via API$/, async function (timeout, name, version) {
    const imagesList = await getApiTest().image.listImages();
    console.log(`List of images: ${JSON.stringify(imagesList)}`);
    let imageId = 0;
    const element = imagesList.find((el: any) => el.name === name && el.version === version);
    if (element) {
        imageId = element.id;
    }
    if (imageId === 0) {
        throw new Error('unable to find the image id');
    }
    await repeatUntilTimeout(async () => {
        const imageDetails = await getApiTest().image.getDetails(imageId);
        console.log(`Image Details: ${JSON.stringify(imageDetails)}`);
        if (imageDetails.inspectStatus === 'completed') {
            return true;
        }
        if (imageDetails.inspectStatus === 'failed') {
            throw new Error('image inspect failed.');
        }
        await new Promise(r => setTimeout(r, 5000));
        return false;
    }, {message: 'image inspection did not complete', timeout: Number(timeout)});
});

When(/^I wait at most (\d+) seconds until all "([^"]*)" container images are built correctly on the Image List page$/, async function (timeout, count) {
    const {page} = getBrowserInstances();
    await repeatUntilTimeout(async () => {
        await followLeftMenu('Images > Image List');
        await waitUntilDoNotSeeText('There are no entries to show.');
        if (await page.locator('xpath=//tr[td[text()=\'Container Image\']][td//*[contains(@title, \'Failed\')]]').count() > 0) {
            throw new Error('error detected while building images');
        }
        if (await page.locator('xpath=//tr[td[text()=\'Container Image\']][td//*[contains(@title, \'Built\')]]').count() >= Number(count)) {
            return true;
        }
        await new Promise(r => setTimeout(r, 5000));
        return false;
    }, {message: 'at least one image was not built correctly', timeout: Number(timeout)});
});

When(/^I schedule the build of image "([^"]*)" via API calls$/, async function (image) {
    const versionBuild = '';
    const buildHostId = await retrieveBuildHostId();
    const dateBuild = await getApiTest().getCurrentDate()
    await getApiTest().image.scheduleImageBuild(image, versionBuild, buildHostId, dateBuild);
});

When(/^I schedule the build of image "([^"]*)" with version "([^"]*)" via API calls$/, async function (image, version) {
    const versionBuild = version;
    const buildHostId = await retrieveBuildHostId();
    const dateBuild = await getApiTest().getCurrentDate()
    await getApiTest().image.scheduleImageBuild(image, versionBuild, buildHostId, dateBuild);
});

When(/^I delete the image "([^"]*)" with version "([^"]*)" via API calls$/, async function (imageNameTodel, version) {
    const imagesList = await getApiTest().image.listImages();
    if (!imagesList) {
        throw new Error('ERROR: no images at all were retrieved.');
    }
    let imageId = 0;
    const element = imagesList.find((el: any) => el.name === imageNameTodel.trim() && el.version === version.trim());
    if (element) {
        imageId = element.id;
    }
    if (imageId === 0) {
        console.log(`Image ${imageNameTodel} with version ${version} does not exist, skipping`);
    } else {
        await getApiTest().image.delete(imageId);
    }
});

Then(/^the list of packages of image "([^"]*)" with version "([^"]*)" is not empty$/, async function (name, version) {
    const imagesList = await getApiTest().image.listImages();
    console.log(`List of images: ${JSON.stringify(imagesList)}`);
    let imageId = 0;
    const element = imagesList.find((el: any) => el.name === name && el.version === version);
    if (element) {
        imageId = element.id;
    }
    if (imageId === 0) {
        throw new Error('unable to find the image id');
    }
    const imageDetails = await getApiTest().image.getDetails(imageId);
    console.log(`Image Details: ${JSON.stringify(imageDetails)}`);
    if (imageDetails.installedPackages === 0) {
        throw new Error('the list of image packages is empty');
    }
});

Then(/^the image "([^"]*)" with version "([^"]*)" doesn't exist via API calls$/, async function (imageNonExist, version) {
    const imagesList = await getApiTest().image.listImages();
    const found = imagesList.find((el: any) => el.name === imageNonExist && el.version === version.trim());
    if (found) {
        throw new Error(`${imageNonExist} should not exist anymore`);
    }
});

When(/^I create and delete an image store via API$/, async function () {
    await getApiTest().image.store.create('fake_store', 'https://github.com/uyuni-project/uyuni', 'registry');
    await getApiTest().image.store.delete('fake_store');
});

When(/^I list image store types and image stores via API$/, async function () {
    const storeTypes = await getApiTest().image.store.listImageStoreTypes();
    console.log(`Store types: ${JSON.stringify(storeTypes)}`);
    if (storeTypes.length !== 2) {
        throw new Error('We have only type support for Registry and OS Image store type! New method added?! please update the tests');
    }
    if (!storeTypes.some((type: any) => type.label === 'registry')) {
        throw new Error('We should have Registry as supported type');
    }
    if (!storeTypes.some((type: any) => type.label === 'os_image')) {
        throw new Error('We should have OS Image as supported type');
    }
    const stores = await getApiTest().image.store.listImageStores();
    console.log(`Image Stores: ${JSON.stringify(stores)}`);
    const registry = stores.find((store: any) => store.storetype === 'registry');
    if (!registry) {
        throw new Error('No registry store found');
    }
    if (registry.label !== 'galaxy-registry') {
        throw new Error(`Label ${registry.label} is different than 'galaxy-registry'`);
    }
    if (registry.uri !== globalVars.noAuthRegistry) {
        throw new Error(`URI ${registry.uri} is different than '${globalVars.noAuthRegistry}'`);
    }
});

When(/^I set and get details of image store via API$/, async function () {
    await getApiTest().image.store.create('Norimberga', 'https://github.com/uyuni-project/uyuni', 'registry');
    const detailsStore = {
        uri: 'Germania',
        username: '',
        password: ''
    };
    await getApiTest().image.store.setDetails('Norimberga', detailsStore);
    const details = await getApiTest().image.store.getDetails('Norimberga');
    if (details.uri !== 'Germania') {
        throw new Error(`uri should be Germania but is ${details.uri}`);
    }
    if (details.username !== '') {
        throw new Error(`username should be empty but is ${details.username}`);
    }
    await getApiTest().image.store.delete('Norimberga');
});

When(/^I create and delete profiles via API$/, async function () {
    await getApiTest().image.profile.create('fakeone', 'dockerfile', 'galaxy-registry', 'BiggerPathBiggerTest', '');
    await getApiTest().image.profile.delete('fakeone');
    await getApiTest().image.profile.create('fakeone', 'dockerfile', 'galaxy-registry', 'BiggerPathBiggerTest', '1-SUSE-KEY-x86_64');
    await getApiTest().image.profile.delete('fakeone');
});

When(/^I create and delete profile custom values via API$/, async function () {
    await getApiTest().image.profile.create('fakeone', 'dockerfile', 'galaxy-registry', 'BiggerPathBiggerTest', '');
    await getApiTest().system.custominfo.createKey('arancio', 'test containers');
    const values = {arancio: 'arancia API tests'};
    await getApiTest().image.profile.setCustomValues('fakeone', values);
    const proDet = await getApiTest().image.profile.getCustomValues('fakeone');
    if (proDet.arancio !== 'arancia API tests') {
        throw new Error(`setting custom profile value failed: ${proDet.arancio} != 'arancia API tests'`);
    }
    const proType = await getApiTest().image.profile.listImageProfileTypes();
    if (proType.length !== 2) {
        throw new Error(`Number of image profile types is ${proType.length}`);
    }
    if (proType[0] !== 'dockerfile') {
        throw new Error(`type ${proType[0]} is not dockerfile`);
    }
    if (proType[1] !== 'kiwi') {
        throw new Error(`type ${proType[1]} is not kiwi`);
    }
    const key = ['arancio'];
    await getApiTest().image.profile.deleteCustomValues('fakeone', key);
});

When(/^I list image profiles via API$/, async function () {
    const imaProfiles = await getApiTest().image.profile.listImageProfiles();
    console.log(imaProfiles);
    const imagelabel = imaProfiles.find((image: any) => image.label === 'fakeone');
    if (imagelabel.label !== 'fakeone') {
        throw new Error(`label of container should be fakeone! ${imagelabel.label} != 'fakeone'`);
    }
});

When(/^I set and get profile details via API$/, async function () {
    const details = {
        storeLabel: 'galaxy-registry',
        path: 'TestForFun',
        activationKey: ''
    };
    await getApiTest().image.profile.setDetails('fakeone', details);
    const contDetail = await getApiTest().image.profile.getDetails('fakeone');
    if (contDetail.label !== 'fakeone') {
        throw new Error(`label test fail! ${contDetail.label} != 'fakeone'`);
    }
    if (contDetail.imageType !== 'dockerfile') {
        throw new Error(`imagetype test fail! ${contDetail.imageType} != 'dockerfile'`);
    }
    await getApiTest().image.profile.delete('fakeone');
});
