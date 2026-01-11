const express = require('express');
const playwright = require('playwright');
const handlebars = require('handlebars');
const { Storage } = require('@google-cloud/storage');

const app = express();
app.use(express.json({ limit: '50mb' }));

const storage = new Storage();
const BUCKET_NAME = 'pdf-pw-templates';

// Helper to pass JSON data safely to the <script> tag in the HTML
handlebars.registerHelper('json', (context) => JSON.stringify(context));

app.post('/generate', async (req, res) => {
    req.setTimeout(300000);
    const { templateName, data } = req.body;
    let browser;

    try {
        const [file] = await storage.bucket(BUCKET_NAME).file(templateName).download();
        const template = handlebars.compile(file.toString());

        // Pass 'items_json' specifically for the D3 script
        const html = template({ data, items_json: JSON.stringify(data.items) });

        browser = await playwright.chromium.launch({ args: ['--no-sandbox'] });
        const page = await browser.newPage();

        await page.setContent(html, { waitUntil: 'networkidle' });

        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '80px', bottom: '80px', left: '40px', right: '40px' },
            displayHeaderFooter: true,
            footerTemplate: '<div style="font-size:10px; width:100%; text-align:center;">Node.js | Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>'
        });

        await browser.close();
        res.contentType("application/pdf").send(pdf);
    } catch (e) {
        if (browser) await browser.close();
        res.status(500).send(e.message);
    }
});

app.get('/health', (_req, res) => res.status(200).json({ status: 'UP' }));
app.listen(8080);