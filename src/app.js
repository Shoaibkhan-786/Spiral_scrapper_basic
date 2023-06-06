const puppeteer = require('puppeteer');
const { getNormalUrl } = require('./normal_url');
const path = require('path');

(async () => {

    const companyDomain = 'https://sprinto.com/';

    const browser = await puppeteer.launch({ headless: false });

    const context = await browser.createIncognitoBrowserContext();

    const page = await context.newPage();

    const viewport = { width: 1440, height: 1080, deviceScaleFactor: 1 };

    await page.goto(companyDomain, { timeout: 1000 * 60 * 2, waitUntil: 'networkidle0' });

    await page.setViewport(viewport);

    let vwoExpData = await page.evaluate(() => {

        const { _vwo_exp } = window;

        const data = Object.keys(_vwo_exp).reduce((result, key) => {

            if (_vwo_exp[key].type === 'SPLIT_URL' || _vwo_exp[key].type === 'VISUAL_AB') {


                let splitUrl = _vwo_exp[key].type === 'SPLIT_URL' ? _vwo_exp[key].sections['1'].variations : null

                const experiment = {
                    experimentId: key,
                    name: _vwo_exp[key].name,
                    type: _vwo_exp[key].type,
                    pc_traffic: _vwo_exp[key].pc_traffic,
                    allocationName: _vwo_exp[key].comb_n,
                    allocation: _vwo_exp[key].combs,
                    urlRegex: _vwo_exp[key].urlRegex,
                    urlNormal: _vwo_exp[key].urlRegex,
                    splitUrl

                }

                result.push(experiment);
            }

            return result;
        }, [])

        return data

    })


    for (const expData of vwoExpData) {
        const { urlRegex } = expData;
        expData["urlNormal"] = await getNormalUrl({ domain: companyDomain, urlRegex })
    }

    for (const expData of vwoExpData) {

        const { type, allocationName, urlNormal, splitUrl } = expData;

        if (type === 'SPLIT_URL') {

            for (const url of Object.keys(splitUrl)) {

                await page.goto(splitUrl[url], { timeout: 1000 * 60 * 2, waitUntil: 'networkidle0' });

                await page.screenshot({
                    path: path.join(__dirname, `/spliturl-screenshot/${expData.experimentId}_${url}.png`,),
                    fullPage: true
                })
            }

        } else {

            await page.goto(urlNormal);

            let cookies = await page.cookies();

            const vwoRegex = {
                combiRegex: /^_vis_opt_exp_[0-9]*_combi$/gi,
                splitRegex: /^_vis_opt_exp_[0-9]*_split$/gi
            }

            cookies = cookies.reduce((result, cookie) => {
                const { name } = cookie;
                const { combiRegex, splitRegex } = vwoRegex;

                if (combiRegex.test(name) || splitRegex.test(name)) {
                    result.push(cookie)
                };

                return result;

            }, [])


            for (const allocation of Object.keys(allocationName)) {

                cookies = cookies.map(cookie => {
                    cookie.value = allocation
                    return cookie;
                });
             
                await page.setCookie(...cookies);
                await page.reload({ timeout: 0, waitUntil: 'networkidle0' });

                await page.screenshot({
                    path: path.join(__dirname, `/visualab-screenshot/${expData.experimentId}_${allocation}.png`),
                    fullPage: true
                });
            }
        }
    }
})()