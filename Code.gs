function doGet(e) {
  try {
    // Membuka spreadsheet yang aktif
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = sheet.getDataRange().getValues();
    
    // Jika spreadsheet kosong
    if (data.length <= 1) {
      return createJsonResponse({
        status: "success",
        data: []
      });
    }

    const headers = data[0];
    const rows = data.slice(1);
    
    // Mapping data baris berdasarkan nama header
    const result = rows.map(row => {
      let obj = {};
      headers.forEach((header, index) => {
        // Membersihkan nama header dari spasi berlebih
        const cleanHeader = String(header).trim();
        obj[cleanHeader] = row[index] !== undefined ? row[index] : "";
      });
      return obj;
    });

    return createJsonResponse({
      status: "success",
      data: result
    });

  } catch (error) {
    return createJsonResponse({
      status: "error",
      message: error.toString()
    });
  }
}

// Helper function untuk output JSON + CORS
function createJsonResponse(responseObject) {
  return ContentService.createTextOutput(JSON.stringify(responseObject))
    .setMimeType(ContentService.MimeType.JSON);
}

// (Opsional) Jika sewaktu-waktu ingin menyimpan data via POST
function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    const newRow = headers.map(header => {
      const paramName = String(header).trim();
      return e.parameter[paramName] || "";
    });
    
    sheet.appendRow(newRow);
    
    return createJsonResponse({
      status: "success",
      message: "Data berhasil ditambahkan"
    });
  } catch (error) {
    return createJsonResponse({
      status: "error",
      message: error.toString()
    });
  }
}
