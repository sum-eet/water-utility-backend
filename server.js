// const express = require("express");
// const fs = require("fs");
// const csv = require("csv-parser");

// const app = express();
// const PORT = 5001;

// // Load and process the CSV
// let rawData = [];
// fs.createReadStream("big_data.csv")
//   .pipe(csv())
//   .on("data", (row) => rawData.push(row))
//   .on("end", () => {
//     console.log("CSV file successfully processed");
//   });

// // Helper function: Aggregate data by system code
// const aggregateData = () => {
//   const utilities = {};

//   rawData.forEach((row) => {
//     const systemCode = row["System Code"];
//     if (!utilities[systemCode]) {
//       utilities[systemCode] = {
//         Town: row.Town || "Unknown",
//         State: row.State || "Unknown",
//         ZipCode: row.ZipCode || "Unknown",
//         "System Code": systemCode,
//         "Utility Name": row["Utility Name"] || "Unknown",
//         Contaminants: [], // Initialize an empty array for contaminants
//       };
//     }

//     // Add contaminant-related information
//     utilities[systemCode].Contaminants.push({
//       "Contaminant Name": row["Contaminant Name"] || "Unknown",
//       "Potential Effect": row["Potential Effect"] || "Unknown",
//       "Times Above Guideline": row["Times Above Guideline"] || "Unknown",
//       "Utility Level": row["Utility Level"] || "Unknown",
//       "PFAS Name": row["PFAS Name"] || "Unknown",
//       "Detects Samples": row["Detects Samples"] || "Unknown",
//       "Percent Detected": row["Percent Detected"] || "Unknown",
//       Range: row.Range || "Unknown",
//       Dates: row.Dates || "Unknown",
//       "Proposed Limit": row["Proposed Limit"] || "Unknown",
//     });
//   });

//   return Object.values(utilities); // Convert the object to an array
// };

// // Enable CORS for Frontend Access
// app.use((req, res, next) => {
//   res.header("Access-Control-Allow-Origin", "*");
//   res.header("Access-Control-Allow-Methods", "GET, POST");
//   res.header("Access-Control-Allow-Headers", "Content-Type");
//   next();
// });

// // API Endpoint: Fetch All Records (Aggregated)
// app.get("/api/aggregated-records", (req, res) => {
//   const aggregatedData = aggregateData();
//   res.json(aggregatedData);
// });

// // API Endpoint: Fetch a Single Utility by System Code
// app.get("/api/aggregated-records/:systemCode", (req, res) => {
//   const { systemCode } = req.params;
//   const aggregatedData = aggregateData();
//   const utility = aggregatedData.find((u) => u["System Code"] === systemCode);

//   if (!utility) {
//     return res.status(404).json({ error: "Utility not found" });
//   }

//   res.json(utility);
// });

// // API Endpoint: Search by Town, State, ZipCode, or Utility Name
// app.get("/api/search", (req, res) => {
//   const { query } = req.query;
//   if (!query) {
//     return res.status(400).json({ error: "Query parameter is required" });
//   }

//   const aggregatedData = aggregateData();
//   const results = aggregatedData.filter(
//     (row) =>
//       row.Town.toLowerCase().includes(query.toLowerCase()) ||
//       row.State.toLowerCase().includes(query.toLowerCase()) ||
//       row.ZipCode.includes(query) ||
//       row["Utility Name"].toLowerCase().includes(query.toLowerCase())
//   );
//   res.json(results);
// });

// // API Endpoint: Fetch Paginated Records
// app.get("/api/aggregated-records/paginated", (req, res) => {
//   const { page = 1, limit = 50 } = req.query; // Default to page 1, 50 records per page
//   const aggregatedData = aggregateData();
//   const startIndex = (page - 1) * limit;
//   const endIndex = page * limit;
//   const paginatedData = aggregatedData.slice(startIndex, endIndex);
//   res.json(paginatedData);
// });

// // Start the Server
// app.listen(PORT, () => {
//   console.log(`Server running on http://localhost:${PORT}`);
// });

const express = require("express");
const fs = require("fs");
const csv = require("csv-parser");

const app = express();
const PORT = 5001;

// Load and process the CSV
let rawData = [];
fs.createReadStream("big_data.csv")
  .pipe(csv())
  .on("data", (row) => rawData.push(row))
  .on("end", () => {
    console.log("CSV file successfully processed");
  });

// Helper function: Calculate a score for a utility
const calculateUtilityScore = (contaminants) => {
  let severityScore = 0;
  let timesAboveGuidelineSum = 0;
  let utilityLevelSum = 0;
  let validContaminantCount = 0;

  contaminants.forEach((contaminant) => {
    const timesAbove = parseFloat(
      (contaminant["Times Above Guideline"] || "0")
        .replace("x", "")
        .replace(",", "")
    );
    const utilityLevel = parseFloat(
      (contaminant["Utility Level"] || "0").split(" ")[0]
    );

    const severity =
      contaminant["Potential Effect"] === "Potential Effect: cancer" ? 10 : 1;

    severityScore += severity;
    if (!isNaN(timesAbove)) timesAboveGuidelineSum += timesAbove;
    if (!isNaN(utilityLevel)) utilityLevelSum += utilityLevel;

    validContaminantCount += 1;
  });

  if (validContaminantCount === 0) return 0; // Avoid division by zero

  // Calculate averages
  const averageSeverity = severityScore / validContaminantCount;
  const averageTimesAbove = timesAboveGuidelineSum / validContaminantCount;
  const averageUtilityLevel = utilityLevelSum / validContaminantCount;

  // Normalize scores (you can adjust weights as needed)
  const normalizedSeverity = (averageSeverity / 10) * 40; // Max 40 points
  const normalizedTimesAbove = Math.min((averageTimesAbove / 1000) * 40, 40); // Cap at 40
  const normalizedUtilityLevel = Math.min((averageUtilityLevel / 10) * 20, 20); // Cap at 20

  // Total score out of 100
  return normalizedSeverity + normalizedTimesAbove + normalizedUtilityLevel;
};

// Helper function: Aggregate data by system code
const aggregateData = () => {
  const utilities = {};

  rawData.forEach((row) => {
    const systemCode = row["System Code"];
    if (!utilities[systemCode]) {
      utilities[systemCode] = {
        Town: row.Town || "Unknown",
        State: row.State || "Unknown",
        ZipCode: row.ZipCode || "Unknown",
        "System Code": systemCode,
        "Utility Name": row["Utility Name"] || "Unknown",
        Contaminants: [],
      };
    }

    utilities[systemCode].Contaminants.push({
      "Contaminant Name": row["Contaminant Name"] || "Unknown",
      "Potential Effect": row["Potential Effect"] || "Unknown",
      "Times Above Guideline": row["Times Above Guideline"] || "Unknown",
      "Utility Level": row["Utility Level"] || "Unknown",
      "PFAS Name": row["PFAS Name"] || "Unknown",
      "Detects Samples": row["Detects Samples"] || "Unknown",
      "Percent Detected": row["Percent Detected"] || "Unknown",
      Range: row.Range || "Unknown",
      Dates: row.Dates || "Unknown",
      "Proposed Limit": row["Proposed Limit"] || "Unknown",
    });
  });

  // Add scores to each utility
  Object.values(utilities).forEach((utility) => {
    utility.Score = calculateUtilityScore(utility.Contaminants);
  });

  return Object.values(utilities);
};

// Enable CORS for Frontend Access
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

// API Endpoints
app.get("/api/aggregated-records", (req, res) => {
  const aggregatedData = aggregateData();
  res.json(aggregatedData);
});

app.get("/api/aggregated-records/:systemCode", (req, res) => {
  const { systemCode } = req.params;
  const aggregatedData = aggregateData();
  const utility = aggregatedData.find((u) => u["System Code"] === systemCode);

  if (!utility) {
    return res.status(404).json({ error: "Utility not found" });
  }

  res.json(utility);
});

app.get("/api/search", (req, res) => {
  const { query } = req.query;
  if (!query) {
    return res.status(400).json({ error: "Query parameter is required" });
  }

  const aggregatedData = aggregateData();
  const results = aggregatedData.filter(
    (row) =>
      row.Town.toLowerCase().includes(query.toLowerCase()) ||
      row.State.toLowerCase().includes(query.toLowerCase()) ||
      row.ZipCode.includes(query) ||
      row["Utility Name"].toLowerCase().includes(query.toLowerCase())
  );
  res.json(results);
});

app.get("/api/aggregated-records/paginated", (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const aggregatedData = aggregateData();
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const paginatedData = aggregatedData.slice(startIndex, endIndex);
  res.json(paginatedData);
});

// Start the Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
