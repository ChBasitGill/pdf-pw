const express = require('express');
const playwright = require('playwright');
const handlebars = require('handlebars');
const { Storage } = require('@google-cloud/storage');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json({ limit: '50mb' }));

const storage = new Storage();
const BUCKET_NAME = 'pdf-pw-templates';

app.post('/generate', async (req, res) => {
    req.setTimeout(300000);
    const { templateName, data } = req.body;
    let browser;

    try {
        const [file] = await storage.bucket(BUCKET_NAME).file(templateName).download();
        const template = handlebars.compile(file.toString());
        const html = template(data);

        browser = await playwright.chromium.launch({ args: ['--no-sandbox'] });
        const page = await browser.newPage();

        // 1. Set the HTML content
        await page.setContent(html);

        // 2. Inject Tailwind CSS Playwright script 
        // This processes all Tailwind classes in your HTML instantly
        await page.addScriptTag({ url: 'https://cdn.tailwindcss.com' });

        // 3. Wait for the engine to apply styles and charts
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '60px', bottom: '60px', left: '40px', right: '40px' },
            displayHeaderFooter: true,
            footerTemplate: `
                <div style="font-size: 10px; width: 100%; text-align: center; font-family: sans-serif;">
                    Page <span class="pageNumber"></span> of <span class="totalPages"></span>
                </div>`
        });

        await browser.close();
        res.contentType("application/pdf").send(pdf);
    } catch (e) {
        if (browser) await browser.close();
        res.status(500).send(e.message);
    }
});

app.listen(PORT);