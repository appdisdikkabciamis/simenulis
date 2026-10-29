function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const allSheets = ss.getSheets();
    
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

    // Fetch Instagram / Information popups from the 'ig' sheet
    let igPopups = [];
    const igSheet = allSheets.find(s => s.getName().trim().toLowerCase() === "ig");
    if (igSheet) {
      const igData = igSheet.getDataRange().getValues();
      if (igData.length > 1) {
        const igHeaders = igData[0].map(h => String(h).trim().toLowerCase());
        const linkIndex = igHeaders.findIndex(h => h === "link" || h === "url" || h === "link instagram" || h.includes("link") || h.includes("instagram"));
        const gambarIndex = igHeaders.findIndex(h => h === "gambar" || h === "foto" || h === "image" || h.includes("gambar"));
        const labelIndex = igHeaders.findIndex(h => h === "judul" || h === "label" || h === "tombol" || h === "teks" || h === "keterangan" || h === "title");
        
        for (let i = 1; i < igData.length; i++) {
          const row = igData[i];
          const link = (linkIndex !== -1 && row[linkIndex] !== undefined) ? String(row[linkIndex]).trim() : "";
          const gambar = (gambarIndex !== -1 && row[gambarIndex] !== undefined) ? String(row[gambarIndex]).trim() : "";
          const label = (labelIndex !== -1 && row[labelIndex] !== undefined) ? String(row[labelIndex]).trim() : "";
          if (gambar !== "" || link !== "") {
            igPopups.push({ gambar: gambar, link: link, label: label });
          }
        }
      }
    }

    // Fetch rejected NPSNs from 'ditolak' sheet
    let rejectedNpsns = new Set();
    const ditolakSheet = ss.getSheetByName("ditolak");
    if (ditolakSheet) {
      const dData = ditolakSheet.getDataRange().getValues();
      if (dData.length > 1) {
        const dHeaders = dData[0].map(h => String(h).trim().toLowerCase());
        const npsnIndex = dHeaders.indexOf("npsn");
        if (npsnIndex !== -1) {
          for (let i = 1; i < dData.length; i++) {
            const npsnVal = String(dData[i][npsnIndex]).trim();
            if (npsnVal) {
              rejectedNpsns.add(npsnVal);
            }
          }
        }
      }
    }

    // Helper function untuk mapping data sheet ke array of objects
    function extractSheetData(targetSheet) {
      if (!targetSheet) return { data: [], headers: [] };
      const values = targetSheet.getDataRange().getValues();
      if (values.length <= 1) return { data: [], headers: [] };
      
      const rawHeaders = values[0];
      const headers = rawHeaders.map(h => String(h).trim()).filter(Boolean);
      const rows = values.slice(1);
      
      const mappedRows = rows.map(row => {
        let obj = {};
        rawHeaders.forEach((header, index) => {
          const cleanHeader = String(header).trim();
          if (cleanHeader) {
            let cellVal = row[index];
            if (cellVal instanceof Date && !isNaN(cellVal.getTime())) {
              cellVal = Utilities.formatDate(cellVal, Session.getScriptTimeZone() || "Asia/Jakarta", "yyyy-MM-dd");
            }
            obj[cleanHeader] = cellVal !== undefined ? cellVal : "";
          }
        });
        
        // Tambahkan flag isRejected jika NPSN ada di sheet ditolak
        const npsnKey = Object.keys(obj).find(k => k.toLowerCase() === "npsn");
        obj.isRejected = false;
        if (npsnKey && obj[npsnKey]) {
          const currentNpsn = String(obj[npsnKey]).trim();
          if (rejectedNpsns.has(currentNpsn)) {
            obj.isRejected = true;
          }
        }
        
        return obj;
      });
      
      return { data: mappedRows, headers: headers };
    }

    // Sheet salur (Laporan Penerimaan Bantuan)
    const salurSheet = allSheets.find(s => s.getName().trim().toLowerCase() === "salur");
    const salurParsed = extractSheetData(salurSheet);

    // Sheet utama (Pengisian Data Bantuan)
    let mainSheet = ss.getActiveSheet();
    const reservedNames = ["salur", "update", "link", "ig", "ditolak"];
    if (reservedNames.includes(mainSheet.getName().trim().toLowerCase())) {
      mainSheet = allSheets.find(s => !reservedNames.includes(s.getName().trim().toLowerCase())) || allSheets[0];
    }
    const mainParsed = extractSheetData(mainSheet);

    // Jika request meminta parameter ?sheet=salur secara spesifik
    if (e && e.parameter && String(e.parameter.sheet).toLowerCase() === "salur") {
      return createJsonResponse({
        status: "success",
        data: salurParsed.data,
        headers: salurParsed.headers,
        salur: salurParsed.data,
        salurHeaders: salurParsed.headers,
        updateInfo: updateInfo,
        videos: videos,
        ig: igPopups,
        igPopups: igPopups
      });
    }

    return createJsonResponse({
      status: "success",
      data: mainParsed.data,
      headers: mainParsed.headers,
      salur: salurParsed.data,
      salurHeaders: salurParsed.headers,
      updateInfo: updateInfo,
      videos: videos,
      ig: igPopups,
      igPopups: igPopups
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
