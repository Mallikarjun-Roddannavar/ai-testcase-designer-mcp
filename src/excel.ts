import ExcelJS from "exceljs";
import * as fs from "fs";
import * as path from "path";

/**
 * Generates an Excel test plan from LLM-generated JSON and saves it to disk.
 * @param rows The formatted rows for test cases (array of arrays of strings)
 * @param outDir Output directory
 * @param endpoint API endpoint string
 * @param method HTTP method string
 * @returns The file path of the generated Excel file
 */
export async function generateTestPlanExcel(
  rows: string[][],
  outDir: string,
  endpoint: string,
  method: string
): Promise<string> {
  const safeEndpoint = endpoint.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 60);
  const safeMethod = String(method).toLowerCase();
  const fname = `generated_tests_${safeMethod}_${safeEndpoint}_${Date.now()}.xlsx`;
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const xlsxPath = path.join(outDir, fname);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("TestCases");

  worksheet.addRow([
    "Sl no",
    "Test Name",
    "Pre-Condition",
    "Steps",
    "Expected Result"
  ]);
  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD700" }, // Gold
    };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });

  for (let i = 0; i < rows.length; ++i) {
    worksheet.addRow(rows[i]);
  }

  const colCount = worksheet.columnCount;
  for (let idx = 1; idx <= colCount; idx++) {
    const column = worksheet.getColumn(idx);
    let maxLength = 10;
    column.eachCell({ includeEmpty: true }, (cell) => {
      maxLength = Math.max(maxLength, cell.value ? String(cell.value).length : 0);
    });
    column.width = maxLength + 2;
  }

  worksheet.eachRow({ includeEmpty: true }, (row) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        top:    { style: "thin" },
        left:   { style: "thin" },
        bottom: { style: "thin" },
        right:  { style: "thin" },
      };
    });
  });

  await workbook.xlsx.writeFile(xlsxPath);

  return xlsxPath;
}
