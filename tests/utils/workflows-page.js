import { waitForJsonResponse } from './wait-response';

const gotoWorkflowsPage = async page => {
    const applicantMenu = await page.getByTestId('applications-menu');
    const appNavItem = await page.locator('li.nav-item', { has: applicantMenu });

    const maxHeight =  await appNavItem.locator('div').first()
        .evaluate(el => window.getComputedStyle(el).maxHeight);
    if (maxHeight === 0) {
        await page.getByTestId('applications-menu').click();
    }

    const [ workflowResponse ] = await Promise.all([
        page.waitForResponse(resp => resp.url().includes('workflows?fields[workflow]')
            && resp.request().method() === 'GET'
            && resp.ok()),
        page.getByTestId('workflows-submenu').click()
    ]);

    const { data: workflows } = await waitForJsonResponse(workflowResponse);

    return workflows;

};


export { gotoWorkflowsPage };
