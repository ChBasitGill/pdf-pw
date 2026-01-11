import os
import json
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from playwright.async_api import async_playwright
from jinja2 import Environment, FileSystemLoader
from google.cloud import storage

app = FastAPI()

# Initialize GCS client
storage_client = storage.Client()

@app.post("/generate")
async def generate_pdf(request_data: dict):
    template_name = request_data.get("templateName", "single-account.html")
    data = request_data.get("data", {})
    bucket_name = os.getenv("BUCKET_NAME", "pdf-pw-templates")

    try:
        # 1. Download template from GCS
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(template_name)
        template_str = blob.download_as_text()

        # 2. Render HTML with Jinja2
        # We pass items_json to match your D3.js requirement
        env = Environment(loader=FileSystemLoader("."))
        template = env.from_string(template_str)
        rendered_html = template.render(
            **data,
            items_json=json.dumps(data.get("items", []))
        )

        # 3. Generate PDF with Playwright
        async with async_playwright() as p:
            # We use --disable-dev-shm-usage for Cloud Run stability
            browser = await p.chromium.launch(args=["--disable-dev-shm-usage", "--no-sandbox"])
            page = await browser.new_page()
            
            # Set content and wait for D3.js/Animations
            await page.set_content(rendered_html, wait_until="networkidle")
            
            # Generate PDF
            pdf_content = await page.pdf(
                format="A4",
                print_background=True,
                margin={"top": "1cm", "bottom": "1cm", "left": "1cm", "right": "1cm"}
            )
            
            await browser.close()

        return Response(content=pdf_content, media_type="application/pdf")

    except Exception as e:
        print(f"Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))