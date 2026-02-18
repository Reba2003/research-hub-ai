import * as pdfjsLib from 'pdfjs-dist';

// Set up the worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

/**
 * Extract all text content from a PDF file using pdf.js (client-side).
 * This avoids memory issues with large PDFs in edge functions.
 */
export async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  const pageTexts: string[] = [];
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: unknown) => {
        const textItem = item as { str: string };
        return textItem.str;
      })
      .join(' ');
    
    if (pageText.trim()) {
      pageTexts.push(pageText.trim());
    }
  }
  
  const fullText = pageTexts.join('\n\n');
  console.log(`[pdf-extract] Extracted ${fullText.length} chars from ${pdf.numPages} pages`);
  return fullText;
}

export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}
