const express = require('express');
const playwright = require('playwright');
const handlebars = require('handlebars');
const { Storage } = require('@google-cloud/storage');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const app = express();
app.use(express.json());

const storage = new Storage();
const BUCKET_NAME = 'pdf-pw-templates';

// --- Swagger Configuration ---
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Playwright PDF Generator API',
            version: '1.0.0',
            description: 'A GCP Cloud Run service to generate PDFs from GCS templates',
        },
        servers: [{ url: 'https://pdf-service-777155886854.europe-north1.run.app' }],
    },
    apis: ['./server.js'],
};
const specs = swaggerJsdoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(specs));

// --- Health Check Endpoint ---
/**
 * @openapi
 * /health:
 * get:
 * description: Check if the service is alive
 * responses:
 * 200:
 * description: Service is healthy
 */
app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'UP', timestamp: new Date() });
});

// --- PDF Generation Endpoint ---
/**
 * @openapi
 * /generate:
 * post:
 * description: Generates a PDF from a template
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * templateName:
 * type: string
 * example: "single-account.html"
 * data:
 * type: object
 * responses:
 * 200:
 * description: A PDF file
 * content:
 * application/pdf:
 * schema:
 * type: string
 * format: binary
 */
app.post('/generate', async (req, res) => {
    const { templateName, data } = req.body;
    let browser;
    try {
        const [file] = await storage.bucket(BUCKET_NAME).file(templateName).download();
        const htmlContent = file.toString();
        const template = handlebars.compile(htmlContent);
        const finalHtml = template(data);

        browser = await playwright.chromium.launch({ args: ['--no-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(finalHtml, { waitUntil: 'networkidle' });
        const pdf = await page.pdf({ format: 'A4', printBackground: true });

        await browser.close();
        res.contentType("application/pdf");
        res.send(pdf);
    } catch (error) {
        if (browser) await browser.close();
        res.status(500).send(error.message);
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));