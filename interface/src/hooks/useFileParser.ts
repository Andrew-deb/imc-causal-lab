import { useState, useEffect } from "react";
import * as XLSX from "xlsx";

export interface ParsedFile {
  name: string;
  headers: string[];
}

function parseCSVHeaders(text: string): string[] {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return [];
  return lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
}

function parseExcelHeaders(buffer: ArrayBuffer): string[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
  if (data.length === 0) return [];
  return (data[0] as string[]).map((h) => String(h ?? ""));
}

export function useFileParser(files: File[]) {
  const [parsedFiles, setParsedFiles] = useState<ParsedFile[]>([]);

  useEffect(() => {
    const load = async () => {
      const results: ParsedFile[] = [];
      for (const file of files) {
        if (file.name.endsWith(".csv")) {
          const text = await file.text();
          results.push({ name: file.name, headers: parseCSVHeaders(text) });
        } else {
          const buffer = await file.arrayBuffer();
          results.push({ name: file.name, headers: parseExcelHeaders(buffer) });
        }
      }
      setParsedFiles(results);
    };
    load();
  }, [files]);

  const allColumns = parsedFiles.flatMap((f) =>
    f.headers.map((h) => ({ dataset: f.name, column: h }))
  );

  const uniqueColumns = [...new Set(parsedFiles.flatMap((f) => f.headers))];

  return { parsedFiles, allColumns, uniqueColumns };
}
