import axios from "axios";
import { PDFDocument } from "pdf-lib";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Initialize S3 client
const s3Client = new S3Client({ region: "ap-south-1" });

// Replace with your S3 bucket name
const S3_BUCKET_NAME = "dev-az-fillable-forms-pdf";

export const handler = async (event) => {
  try {
    const { method, path } = event.requestContext.http;
    if (method === "GET" && path === "/") {
      // Replace with your S3 object key for the PDF
      const S3_PDF_KEY = event.rawQueryString || "pdf1page.pdf";

      // Generate a pre-signed URL for downloading the PDF from S3
      const downloadUrl = await getSignedUrl(
        s3Client,
        new GetObjectCommand({
          Bucket: S3_BUCKET_NAME,
          Key: S3_PDF_KEY,
        }),
        { expiresIn: 3600 } // URL expires in 1 hour
      );

      console.log("downloadUrl");
      console.log(downloadUrl);

      // ✅ Generate a pre-signed URL for uploading a PDF to S3
      const uploadFileName = `updated_${new Date().toISOString()}.pdf`;
      const uploadUrl = await getSignedUrl(
        s3Client,
        new PutObjectCommand({
          Bucket: S3_BUCKET_NAME,
          Key: `uploads/${uploadFileName}`,
          ContentType: "application/pdf",
        }),
        { expiresIn: 3600 }
      );

      console.log("uploadUrl");
      console.log(uploadUrl);

      // Fetch the PDF from S3 using the pre-signed URL
      const response = await axios.get(downloadUrl, {
        responseType: "arraybuffer",
      });

      console.log("response");
      console.log(response);

      const pdfBase64 = Buffer.from(response.data).toString("base64");

      // Return HTML page
      return {
        statusCode: 200,
        headers: { "Content-Type": "text/html" },
        body: `
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
                #save-button { margin: 20px; padding: 10px 20px; font-size: 16px; cursor: pointer; }
            </style>
        </head>
        <body>

            <h1>Fillable PDF Viewer</h1>
            <input type="hidden" id="upload-url" value="${uploadUrl}">
              <button id="save-button">Save & Upload PDF</button>
            <div class="wrapper">
                <div id="pdf-container"></div>
            </div>

            <script>
                document.addEventListener("DOMContentLoaded", async () => {
                    const pdfData = atob("${pdfBase64}");
                    const pdfViewerContainer = document.getElementById("pdf-container");
                    const saveButton = document.getElementById("save-button");

                    let formFields = [];

                    try {
                        const loadingTask = pdfjsLib.getDocument({ data: Uint8Array.from([...pdfData].map(c => c.charCodeAt(0))), annotationMode: 2 });
                        const pdf = await loadingTask.promise;

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

                    document.getElementById("save-button").addEventListener("click", async () => {
                          try {
                              const pdfBytes = Uint8Array.from(atob("${pdfBase64}"), c => c.charCodeAt(0));
                              const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes, { ignoreEncryption: true });

                              // Save updated PDF
                              const updatedPdfBytes = await pdfDoc.save();
                              const pdfBlob = new Blob([updatedPdfBytes], { type: "application/pdf" });

                              // Get the pre-signed URL from hidden field
                              const uploadUrl = document.getElementById("upload-url").value;

                              // Upload PDF to S3 using Pre-Signed URL
                              const uploadResponse = await fetch(uploadUrl, {
                                  method: "PUT",
                                  body: pdfBlob,
                                  headers: { "Content-Type": "application/pdf" }
                              });

                              if (uploadResponse.ok) {
                                  alert("✅ PDF uploaded successfully!");
                                  window.close();
                              } else {
                                  alert("❌ Failed to upload PDF.");
                              }
                          } catch (error) {
                              console.error("❌ Error saving & uploading PDF:", error);
                              alert("An error occurred while saving the PDF.");
                          }
                      });
               

                });
            </script>
        </body>
        </html>
        `,
      };
    } else {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Not Found" }),
      };
    }
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
};
