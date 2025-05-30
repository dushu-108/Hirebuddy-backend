import { readFile } from 'fs/promises';
import pdfParse from 'pdf-parse';

export default async function parsePDF(filePath) {
  try {
    const buffer = await readFile(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error("Error parsing PDF:", error);
    throw new Error(`Failed to parse PDF file: ${error.message}`);
  }
}