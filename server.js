const express = require('express');
const playwright = require('playwright');
const handlebars = require('handlebars');
const { Storage } = require('@google-cloud/storage');

const app = express();
app.use(express.json());

const storage = new Storage();
const BUCKET_NAME = 'pdf-pw-templates';

app.post('/generate', async (req, res) => {
    const { templateName, data } = req.body; // e.g., templateName: "single-account.html"

    let browser;
    try {
        // 1. Get HTML from GCS using the exact name provided in JSON
        const [file] = await storage.bucket(BUCKET_NAME).file(templateName).download();
        const htmlContent = file.toString();

        // 2. Compile with Data
        const template = handlebars.compile(htmlContent);
        const finalHtml = template(data);

        // 3. Launch Playwright
        browser = await playwright.chromium.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        // Wait for network to be idle to ensure styles/images load
        await page.setContent(finalHtml, { waitUntil: 'networkidle' });

        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true
        });

        await browser.close();

        res.contentType("application/pdf");
        res.send(pdf);
    } catch (error) {
        if (browser) await browser.close();
        console.error(error);
        res.status(500).send(`Error: ${error.message}`);
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));