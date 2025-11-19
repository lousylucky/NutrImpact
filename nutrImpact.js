import fs from "node:fs";
import { parse } from "csv-parse/sync";

const IMPACT_API_BASE = "https://impactco2.fr/api/v1";

// Manual mapping between ImpactCO2 labels and Agribalyse IDs
const agribalyseMapping = {
    "Pomme": "12061",
    "Pomme sèche": "13111",
    // TODO: fill this map for all fruits & vegetables you need
};

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
    return data;
}

// 2) Load simplified Agribalyse CSV
function loadAgribalyseSimplified(path) {
    const csv = fs.readFileSync(path, "utf8");
    const records = parse(csv, {
        columns: true,
        skip_empty_lines: true,
    });

    // Build index by Agribalyse ID (adapt column names!)
    const byId = new Map();
    for (const row of records) {
        const id = row["AGRIBALYSE_ID"] || row["Code_AGB"]; // example column names
        if (!id) continue;
        byId.set(String(id).trim(), row);
    }

    return byId;
}

// 3) Merge Impact CO2 data with Agribalyse
async function buildMergedDataset() {
    const impactData = await fetchImpactAlimentation();
    const agribalyseById = loadAgribalyseSimplified("./agribalyse_simplifie.csv");

    // Adjust this depending on the real shape of impactData JSON
    const items = impactData.items || impactData; // TODO: adapt

    const merged = [];

    for (const item of items) {
        // Example: check that this is "Fruits et légumes" group
        // You must adapt key names (group, theme, category, etc.)
        if (item.theme !== "Fruits et légumes") continue;

        const label = item.label_fr || item.name_fr || item.name;
        const agribalyseId = agribalyseMapping[label];

        const agbRow = agribalyseId ? agribalyseById.get(agribalyseId) : null;

        merged.push({
            impact_id: item.id,
            label_fr: label,
            // adapt field name for CO2/kg from Impact CO2
            co2e_kg: item.value || item.impact_kgco2e || null,
            agribalyse_id: agribalyseId || null,
            // adapt CSV column names for Score unique PEF & DQR
            score_unique_pef: agbRow ? agbRow["SCORE_UNIQUE_PEF"] : null,
            dqr: agbRow ? agbRow["DQR"] : null,
        });
    }

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