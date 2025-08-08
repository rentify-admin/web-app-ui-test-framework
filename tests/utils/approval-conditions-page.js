import { waitForJsonResponse } from './wait-response';

const gotoApprovalCondPage = async page => {
    const applicantMenu = await page.getByTestId('applications-menu');
    const appNavItem = await page.locator('li.nav-item', { has: applicantMenu });

    const maxHeight =  await appNavItem.locator('div').first()
        .evaluate(el => window.getComputedStyle(el).maxHeight);
    if (maxHeight === 0) {
        await page.getByTestId('applications-menu').click();
    }

    const [ approvalConditionResponse ] = await Promise.all([
        page.waitForResponse(resp => resp.url().includes('/flag-collections?')
            && resp.request().method() === 'GET'
            && resp.ok()),
        page.getByTestId('approval-conditions-submenu').click()
    ]);

    const { data: approvalConditions } = await waitForJsonResponse(approvalConditionResponse);

    return approvalConditions;

};


export { gotoApprovalCondPage };
