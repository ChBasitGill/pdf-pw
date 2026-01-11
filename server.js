const express = require('express');
const playwright = require('playwright');
const handlebars = require('handlebars');
const { Storage } = require('@google-cloud/storage');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const app = express();
app.use(express.json({ limit: '50mb' })); // Large payload support

const storage = new Storage();
const BUCKET_NAME = 'pdf-pw-templates';

// Swagger Setup
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: { title: 'Pro PDF API', version: '1.1.0' },
        servers: [{ url: 'https://pdf-service-777155886854.europe-north1.run.app' }],
    },
    apis: [__filename],
};
const specs = swaggerJsdoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(specs));

/**
 * @openapi
 * /generate:
 * post:
 * summary: Generate large multi-page PDF with graphs
 * requestBody:
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * templateName: { type: string }
 * data: { type: object }
 */
app.post('/generate', async (req, res) => {
    req.setTimeout(300000); // 5 min timeout
    const { templateName, data } = req.body;
    let browser;

    try {
        const [file] = await storage.bucket(BUCKET_NAME).file(templateName).download();
        const template = handlebars.compile(file.toString());
        const html = template(data);

        browser = await playwright.chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
        const page = await browser.newPage();

        // Wait for Network Idle to ensure Chart.js renders
        await page.setContent(html, { waitUntil: 'networkidle', timeout: 60000 });

        // Final buffer for any JS animations
        await page.waitForTimeout(1000);

        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate: '<div style="font-size:10px; width:100%; text-align:right; padding-right:20px;">Confidential Report</div>',
            footerTemplate: '<div style="font-size:10px; width:100%; text-align:center;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
            margin: { top: '60px', bottom: '60px' }
        });

        await browser.close();
        res.contentType("application/pdf").send(pdf);
    } catch (e) {
        if (browser) await browser.close();
        res.status(500).send(e.message);
    }
});

app.get('/health', (req, res) => res.status(200).json({ status: 'UP' }));

app.listen(8080);