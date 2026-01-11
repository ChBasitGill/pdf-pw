import os
import json
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import Response
from playwright.async_api import async_playwright
from google.cloud import storage
from jinja2 import Template

app = FastAPI()
storage_client = storage.Client()
BUCKET_NAME = "pdf-pw-templates"

@app.post("/generate")
async def generate_pdf(request: Request):
    body = await request.json()
    template_name = body.get("templateName")
    data = body.get("data")

    try:
        bucket = storage_client.bucket(BUCKET_NAME)
        blob = bucket.blob(template_name)
        template_str = blob.download_as_text()

        # Render with Jinja2 - passing items_json for the SVG script
        template = Template(template_str)
        html_content = template.render(
            data=data, 
            items_json=json.dumps(data.get("items", []))
        )

        async with async_playwright() as p:
            browser = await p.chromium.launch(args=["--no-sandbox"])
            page = await browser.new_page()
            await page.set_content(html_content, wait_until="networkidle")
            
            pdf = await page.pdf(
                format="A4",
                print_background=True,
                margin={"top": "80px", "bottom": "80px", "left": "40px", "right": "40px"},
                display_header_footer=True,
                footer_template='<div style="font-size:10px; width:100%; text-align:center;">Python | Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>'
            )
            await browser.close()
            return Response(content=pdf, media_type="application/pdf")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health():
    return {"status": "UP"}