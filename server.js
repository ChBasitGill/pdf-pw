const express = require('express');
const playwright = require('playwright');
const handlebars = require('handlebars');
const { Storage } = require('@google-cloud/storage');
handlebars.registerHelper('json', function (context) {
    return JSON.stringify(context);
});
const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json({ limit: '50mb' }));

const storage = new Storage();
const BUCKET_NAME = 'pdf-pw-templates';

app.post('/generate', async (req, res) => {
    req.setTimeout(300000); // 5-minute timeout for 50+ pages
    const { templateName, data } = req.body;
    let browser;

    try {
        const [file] = await storage.bucket(BUCKET_NAME).file(templateName).download();
        const template = handlebars.compile(file.toString());
        const html = template(data);

        browser = await playwright.chromium.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        const page = await browser.newPage();

        // We use a data URI or setContent with a wait to ensure the Tailwind CDN and D3 load
        await page.setContent(html, { waitUntil: 'networkidle' });

        // Optional: Ensure the SVG is actually rendered before printing
        await page.waitForSelector('#svg-chart-container svg', { timeout: 10000 }).catch(() => null);

        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '80px', bottom: '80px', left: '40px', right: '40px' },
            displayHeaderFooter: true,
            headerTemplate: `<div style="font-size: 10px; width: 100%; text-align: right; margin-right: 20px;">${data.reportTitle || 'Financial Report'}</div>`,
            footerTemplate: `
                <div style="font-size: 10px; width: 100%; text-align: center; font-family: sans-serif;">
                    Page <span class="pageNumber"></span> of <span class="totalPages"></span>
                </div>`
        });

        await browser.close();
        res.contentType("application/pdf").send(pdf);
    } catch (e) {
        if (browser) await browser.close();
        console.error(e);
        res.status(500).send(e.message);
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));