import fs from "node:fs";
import { parse } from "csv-parse/sync";

const IMPACT_API_BASE = "https://impactco2.fr/api/v1";

let impactData = null;
let agribalyseData = null;

function findAgribalyse(label) {
  const normalized = label.toLowerCase().trim();

  // Helper: checks if the label contains "cru" or "crue"
  const includesCru = (text) =>
    text.includes("cru") || text.includes("crue");

  // 1. Filter rows that start with the given product name
  let candidates = agribalyseData.filter((row) => {
    const rowLabel = String(row["Nom du Produit en Français"] || "").toLowerCase();
    return rowLabel.startsWith(normalized);
  });

  // 2. Special rule: when searching for "pomme", exclude "pomme de terre"
  if (normalized === "pomme") {
    candidates = candidates.filter((row) => {
      const rowLabel = String(row["Nom du Produit en Français"] || "").toLowerCase();
      return !rowLabel.includes("de terre");
    });
  }

  // If no results at all, return nothing
  if (candidates.length === 0) {
    return null;
  }

  // 3. Prefer raw products ("cru" or "crue")
  let cru = candidates.filter((row) => {
    const rowLabel = String(row["Nom du Produit en Français"] || "").toLowerCase();
    return includesCru(rowLabel);
  });

  // If exactly one match found → return it
  if (cru.length === 1) {
    return cru[0];
  }

  // If multiple raw versions exist
  if (cru.length > 1) {
    // 4. Among raw products, prefer those with "pulpe"
    const pulpe = cru.filter((row) => {
      const rowLabel = String(row["Nom du Produit en Français"] || "").toLowerCase();
      return rowLabel.includes("pulpe");
    });

    // If pulpe variants exist → return the first one
    if (pulpe.length >= 1) {
      return pulpe[0];
    }

    // Otherwise return the first raw candidate
    return cru[0];
  }

  // 5. Fallback: return the first candidate if nothing matches cru/crue
  return candidates[0];
}

// 1) Fetch fruits & vegetables from Impact CO2
async function fetchImpactAlimentation() {
    // IMPORTANT: fill the real endpoint & parameters according to the docs
    const url = `${IMPACT_API_BASE}/fruitsetlegumes?language=fr`;

    const res = await fetch(url, {
        headers: {
            Accept: "application/json",
        },
    });

    if (!res.ok) {
        throw new Error(`Impact CO2 API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    if (!data || !data.data) {
        throw new Error("Invalid data from Impact CO2 API");
    }
    impactData = data.data;
    return;
}

// 2) Load simplified Agribalyse CSV
function loadAgribalyseSimplified(path) {
    const csv = fs.readFileSync(path, "utf8");

    agribalyseData = parse(csv, {
        columns: true,
        bom: true,
    });

    if (!agribalyseData || agribalyseData.length === 0) {
        throw new Error("Failed to load Agribalyse data");
    }
    return
}

// 3) Merge Impact CO2 data with Agribalyse
async function buildMergedDataset() {

    await fetchImpactAlimentation();
    loadAgribalyseSimplified("./agribalyse.csv");

    // Adjust this depending on the real shape of impactData JSON
    const items = impactData.items || impactData; // TODO: adapt

    const merged = [];

    for (const item of items) {

        const label = item.name;
        const agribalyseItem = findAgribalyse(label);
        if (!agribalyseItem) {
            console.warn(`No Agribalyse match for: ${label}`);
            continue;
        }
        console.log(agribalyseItem['Nom du Produit en Français'])

        // TO DO 
        // CHECKED UP TO THIS POINT 
        // CONTINUE FROM HERE 

        // merged.push({
        //     impact_id: item.id,
        //     label_fr: label,
        //     // adapt field name for CO2/kg from Impact CO2
        //     co2e_kg: item.value || item.impact_kgco2e || null,
        //     agribalyse_id: agribalyseId || null,
        //     // adapt CSV column names for Score unique PEF & DQR
        //     score_unique_pef: agbRow ? agbRow["SCORE_UNIQUE_PEF"] : null,
        //     dqr: agbRow ? agbRow["DQR"] : null,
        // });
    }
    console.log('done');
    return merged;
}

// 4) Save to JSON and/or generate Turtle skeleton
function saveJson(merged) {
    fs.writeFileSync(
        "./fruits_legumes_merged.json",
        JSON.stringify(merged, null, 2),
        "utf8"
    );
}

// Optionally generate a very simple Turtle file (RDF)
function saveTurtle(merged) {
    let ttl = `
@prefix ex:   <http://example.org/food#> .
@prefix agb:  <http://agribalyse.ademe.fr/id/> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .

`;

    for (const item of merged) {
        if (!item.agribalyse_id) continue;

        const localId = `fruit-${item.agribalyse_id}`;
        const safeLabel = item.label_fr.replace(/"/g, '\\"');

        ttl += `
ex:${localId} a ex:FoodProduct ;
  ex:labelFr "${safeLabel}"@fr ;
  ex:agribalyseRef agb:${item.agribalyse_id} ;
`;

        if (item.co2e_kg != null) {
            ttl += `  ex:co2ePerKg "${item.co2e_kg}"^^xsd:decimal ;\n`;
        }
        if (item.score_unique_pef != null) {
            ttl += `  ex:scoreUniquePEF "${item.score_unique_pef}"^^xsd:decimal ;\n`;
        }
        if (item.dqr != null) {
            ttl += `  ex:dqr "${item.dqr}"^^xsd:decimal ;\n`;
        }

        // close last triple with a dot
        ttl = ttl.replace(/;\n$/, " .\n");
    }

    fs.writeFileSync("./fruits_legumes_merged.ttl", ttl, "utf8");
}

(async () => {
    try {
        const merged = await buildMergedDataset();
        saveJson(merged);
        saveTurtle(merged);
        console.log(`Saved ${merged.length} merged items.`);
    } catch (err) {
        console.error(err);
    }
})();