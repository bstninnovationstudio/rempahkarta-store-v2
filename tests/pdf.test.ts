import { test } from "node:test";
import assert from "node:assert";

test("invoice PDF generation test", async () => {
  const { default: jsPDF } = await import("jspdf");
  const autoTableModule = await import("jspdf-autotable");
  const autoTable = autoTableModule.default || autoTableModule;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  assert.ok(doc);

  if (typeof autoTable === "function") {
    autoTable(doc, {
      head: [["Col1", "Col2"]],
      body: [["Val1", "Val2"]],
    });
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (doc as any).autoTable({
      head: [["Col1", "Col2"]],
      body: [["Val1", "Val2"]],
    });
  }

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  assert.ok(pdfBuffer.length > 0);
});
