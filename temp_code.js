function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getActiveSheet();
    const data = sheet.getDataRange().getValues();
    
    // Fetch update information from the 'update' sheet
    let updateInfo = "";
    const updateSheet = ss.getSheetByName("update");
    if (updateSheet) {
      const uData = updateSheet.getDataRange().getValues();
      if (uData.length > 1) {
        const uHeaders = uData[0];
        const updateIndex = uHeaders.findIndex(h => String(h).trim().toLowerCase() === "update data");
        if (updateIndex !== -1) {
           updateInfo = uData[1][updateIndex] !== undefined ? String(uData[1][updateIndex]) : "";
        }
      }
    }

    // Fetch videos from the 'link' sheet
    let videos = [];
    const linkSheet = ss.getSheetByName("link");
    if (linkSheet) {
      const lData = linkSheet.getDataRange().getValues();
      if (lData.length > 1) {
        const lHeaders = lData[0].map(h => String(h).trim().toLowerCase());
        const linkIndex = lHeaders.indexOf("link");
        const titleIndex = lHeaders.indexOf("judul");
        
        if (linkIndex !== -1) {
          for (let i = 1; i < lData.length; i++) {
            const url = lData[i][linkIndex] !== undefined ? String(lData[i][linkIndex]).trim() : "";
            if (url !== "") {
              const title = (titleIndex !== -1 && lData[i][titleIndex] !== undefined) ? String(lData[i][titleIndex]).trim() : "";
              videos.push({ url: url, title: title });
            }
          }
        }
      }
    }

    // Jika spreadsheet kosong
    if (data.length <= 1) {
      return createJsonResponse({
        status: "success",
        data: [],
        updateInfo: updateInfo,
        videos: videos
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
      data: result,
      updateInfo: updateInfo,
      videos: videos
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
