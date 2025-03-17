const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
const PORT = 3000;
const PDF_URL =
  "https://www.uscis.gov/sites/default/files/document/forms/i-9.pdf";

app.use(cors());
const uploadUrl =
  "https://dev-az-fillable-forms-pdf.s3.ap-south-1.amazonaws.com/uploads/updated_2025-03-13T15%3A23%3A06.679Z.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=ASIA4O5WXD7GZAPIHYLE%2F20250313%2Fap-south-1%2Fs3%2Faws4_request&X-Amz-Date=20250313T152306Z&X-Amz-Expires=3600&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEI%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCmFwLXNvdXRoLTEiRzBFAiBBGLK5FDsbTa3vw14EbNlcNHPa8NyFROIyIG9KH%2FPdEgIhAO0sq2g9svDqH8zcEq8hEk3QeM8wSh5cnJ1rlaGhlviQKo4DCNn%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEQARoMODU2NjkyMzAxNzczIgzGkDPK3%2FkyX2%2Bd43cq4gLgVzWx9CFvSiBo5x2OqS1vXx3%2BEWGI5T8SLXNTpyecizX5wNtD0qCWzrXrpFQrJYDaGeg1bBBQVTUS9cOLWtX4tmeByJaXzarLbV1ManZL%2FrqzWHGsH8MNFN799%2BzjQmtn9CqeiQDYuYSWC3w7YBgeTm%2FhTDhzlIVGuDyRzR%2FHxYL4uxKh8tg3SjTYffYR6oVbSwY%2BoBOMLPweXOQC53ZX%2FU4s%2FwQSk28Wh92frRHmBP7RONXWjYwvNu5bAdjHuxgD1hBAg%2BUCaoGdocNvSFX6Pe4OZwmuOi69ekjUdYYV80rKKK2HsaDT0xKYWGep13HHRir0HyanjFRGYM%2Bdnvz%2BC9nAyWLV63RmlMeuYOGH6nsBrioFVpXpOinCcl%2F8eYzuEkNBLgF0iH4REVnvtq1eZSmCfhVO1TQWH5Bux1hWDvMkK3ialK0kDfztq03GaDvuEV16zjWv8TXOdUqTYXVccrcw2fDLvgY6ngEbEmPinZnVOLWKmuhVBYQacEF1qtJieYjJnvTQilw918pjNwFi0tvNlmO1JBROSbTL1Qopq26S40xyep9S6udLk4707S%2BTo5eEbNkWV4ttFbt0HmtM%2FKEEauDhieCY68LiWxh1bwbNHk1BzUc2nq3wu95Qz69UUKE3P7mv%2BVGgIhm3jPNXAyMngj%2BDhs2qOjfdrIEYTu6aDTQqWlJLQg%3D%3D&X-Amz-Signature=18dbca381f80d2775a9237438ecaf247196fb80d8395fcdaf986c337b20ee3d4&X-Amz-SignedHeaders=host&x-amz-checksum-crc32=AAAAAA%3D%3D&x-amz-sdk-checksum-algorithm=CRC32&x-id=PutObject";

app.get("/", async (req, res) => {
  try {
    // Fetch PDF as array buffer
    const response = await axios.get(PDF_URL, { responseType: "arraybuffer" });
    const pdfBase64 = Buffer.from(response.data).toString("base64");

    // Send back HTML page
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>Fillable PDF Viewer</title>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.3.122/pdf.min.js"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.3.122/pdf.worker.min.js"></script>
            <script src="https://unpkg.com/pdf-lib"></script>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; }
                .wrapper { width: 90%; margin: auto; }
                #pdf-container { width: 100%; border: 1px solid #ccc; position: relative; }
                .input-field, .checkbox-field, .radio-field, .select-field { position: absolute; background: transparent; font-size: 16px; border: none; }
                button { margin: 10px; padding: 10px 20px; font-size: 16px; cursor: pointer; }
            </style>
        </head>
        <body>

            <h1>Fillable PDF Viewer</h1>
            <button id="save-button">Save Updated PDF</button>
            <div class="wrapper">
                <div id="pdf-container"></div>
            </div>

            <script>
                document.addEventListener("DOMContentLoaded", async () => {
                    const pdfData = atob("${pdfBase64}");
                    const pdfViewerContainer = document.getElementById("pdf-container");

                   
                    let pdfDoc;
                    const loadingTask = pdfjsLib.getDocument({ data: Uint8Array.from([...pdfData].map(c => c.charCodeAt(0))), annotationMode: 2 });
                    const pdf = await loadingTask.promise;

                    pdfDoc = await PDFLib.PDFDocument.load(Uint8Array.from([...pdfData].map(c => c.charCodeAt(0))), { ignoreEncryption: true });
                    const form = pdfDoc.getForm();

                    try {
                        let formFields = [];
                        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                            const page = await pdf.getPage(pageNum);
                            const scale = 1.5;
                            const viewport = page.getViewport({ scale });

                            const pageContainer = document.createElement("div");
                            pageContainer.style.position = "relative";
                            pageContainer.style.width = viewport.width + "px";
                            pageContainer.style.height = viewport.height + "px";

                            const canvas = document.createElement("canvas");
                            const context = canvas.getContext("2d");
                            canvas.height = viewport.height;
                            canvas.width = viewport.width;
                            pageContainer.appendChild(canvas);
                            pdfViewerContainer.appendChild(pageContainer);

                            await page.render({ canvasContext: context, viewport }).promise;

                            const annotations = await page.getAnnotations();
                            annotations.forEach(annotation => {
                                let field;
                                if (annotation.fieldType === "Tx") {
                                    field = document.createElement("input");
                                    field.type = "text";
                                } else if (annotation.fieldType === "Btn" && annotation.checkBox) {
                                    field = document.createElement("input");
                                    field.type = "checkbox";
                                    field.checked = annotation.fieldValue === "Yes";
                                } else if (annotation.fieldType === "Btn" && annotation.radioButton) {
                                    field = document.createElement("input");
                                    field.type = "radio";
                                    field.name = annotation.fieldName;
                                    field.checked = annotation.fieldValue === "Yes";
                                } else if (annotation.fieldType === "Ch") {
                                    field = document.createElement("select");
                                    annotation.options.forEach(option => {
                                        const opt = document.createElement("option");
                                        opt.value = option.value;
                                        opt.textContent = option.displayValue;
                                        if (annotation.fieldValue === option.value) opt.selected = true;
                                        field.appendChild(opt);
                                    });
                                }

                                if (field) {
                                    field.style.position = "absolute";
                                    field.style.left = annotation.rect[0] * scale + "px";
                                    field.style.top = (viewport.height - annotation.rect[3] * scale) + "px";
                                    field.style.width = (annotation.rect[2] - annotation.rect[0]) * scale + "px";
                                    field.style.height = (annotation.rect[3] - annotation.rect[1]) * scale + "px";
                                    pageContainer.appendChild(field);
                                    formFields.push({ id: annotation.fieldName, value: field.value, element: field });
                                }
                            });
                        }
                    } catch (error) {
                        console.error("Error loading PDF:", error);
                        pdfViewerContainer.innerHTML = "<p>Failed to load PDF.</p>";
                    }

                    

                    






                   
                });
            </script>
        </body>
        </html>
        `);
  } catch (error) {
    res.status(500).send("Error fetching PDF");
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
