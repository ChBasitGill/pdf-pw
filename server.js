const express = require('express');
const playwright = require('playwright');
const handlebars = require('handlebars');
const { Storage } = require('@google-cloud/storage');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const app = express();
app.use(express.json({ limit: '50mb' })); // Allow large data objects for 50-page reports

const storage = new Storage();
const BUCKET_NAME = 'pdf-pw-templates';

// --- Swagger Configuration ---
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Production PDF Generator',
            version: '1.1.0',
            description: 'Optimized for 50+ page reports with graphs and tables',
        },
        servers: [{ url: 'https://pdf-service-777155886854.europe-north1.run.app' }],
    },
    // Using __filename ensures JSDoc finds the comments in this file
    apis: [__filename],
};
const specs = swaggerJsdoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(specs));

/**
 * @openapi
 * /generate:
 * post:
 * summary: Generate a large multi-page PDF
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * templateName:
 * type: string
 * data:
 * type: object
 * responses:
 * 200:
 * description: PDF Generated
 */
app.post('/generate', async (req, res) => {
    // 1. Extend Express timeout for heavy 50-page reports
    req.setTimeout(300000); // 5 minutes

    const { templateName, data } = req.body;
    let browser;

    try {
        const [file] = await storage.bucket(BUCKET_NAME).file(templateName).download();
        const htmlContent = file.toString();
        const template = handlebars.compile(htmlContent);
        const finalHtml = template(data);

        browser = await playwright.chromium.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        const context = await browser.newContext();
        const page = await context.newPage();

        // Use a longer timeout (120s) for page loading
        await page.setContent(finalHtml, {
            waitUntil: 'networkidle',
            timeout: 120000
        });

        // SAFETY: Wait an extra 2 seconds for JS graphs/animations to finish rendering
        await page.waitForTimeout(2000);

        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            timeout: 180000, // 3 minutes for the actual PDF engine to run
            displayHeaderFooter: true,
            headerTemplate: '<span style="font-size: 10px; margin-left: 20px;">Report</span>',
            footerTemplate: '<div style="font-size: 10px; width: 100%; text-align: center;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
            margin: { top: '60px', bottom: '60px' }
        });

        await browser.close();
        res.contentType("application/pdf");
        res.send(pdf);

    } catch (error) {
        if (browser) await browser.close();
        console.error("PDF Error:", error);
        res.status(500).send(`Generation Failed: ${error.message}`);
    }
});

app.get('/health', (_req, res) => res.status(200).send('OK'));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));