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
    console.log("Item from agribalyse matched: " + agribalyseItem['Nom du Produit en Français']);

    const toNumber = (v) => v != null ? parseFloat(v) : 0;

    merged.push({
      label_fr: label,
      category: item.category,
      impactCO2: item.ecv,
      months: item.months,

      dqr_global: parseInt(agribalyseItem['DQR - Global'], 10),

      ef_agriculture: toNumber(agribalyseItem['Score unique EF - Agriculture']),
      ef_transformation: toNumber(agribalyseItem['Score unique EF - Transformation']),
      ef_emballage: toNumber(agribalyseItem['Score unique EF - Emballage']),
      ef_transport: toNumber(agribalyseItem['Score unique EF - Transport']),
      ef_supermarche: toNumber(agribalyseItem['Score unique EF - Supermarché et distribution']),
      ef_consommation: toNumber(agribalyseItem['Score unique EF - Consommation']),

      ef_global:
        toNumber(agribalyseItem['Score unique EF - Agriculture']) +
        toNumber(agribalyseItem['Score unique EF - Transformation']) +
        toNumber(agribalyseItem['Score unique EF - Emballage']) +
        toNumber(agribalyseItem['Score unique EF - Transport']) +
        toNumber(agribalyseItem['Score unique EF - Supermarché et distribution']) +
        toNumber(agribalyseItem['Score unique EF - Consommation'])
    });
  }
  console.log('merged', merged[0]);
  return merged;
}


function saveTurtle(merged) {
  let ttl = `
@prefix nutr: <http://nutrimpact.org/ontologies/2025/v1/nutrimpact#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .

# Relations de sous-classe explicites
nutr:Fruit rdfs:subClassOf nutr:Food .
nutr:Vegetable rdfs:subClassOf nutr:Food .
nutr:EnvironmentalData rdfs:subClassOf nutr:Data .
nutr:LifeCycleEnvData rdfs:subClassOf nutr:EnvironmentalData .
nutr:LifeCycleEnvData rdfs:subClassOf nutr:Data .

`;

  const slugify = (str) =>
    String(str)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");

  const escapeLiteral = (str) =>
    String(str).replace(/"/g, '\\"');

  // Définir les étapes de cycle de vie globales
  const lifeCycleStages = [
    { short: "agriculture", labelFr: "Agriculture" },
    { short: "transformation", labelFr: "Transformation" },
    { short: "emballage", labelFr: "Emballage" },
    { short: "transport", labelFr: "Transport" },
    { short: "supermarche", labelFr: "Supermarché et distribution" },
    { short: "consommation", labelFr: "Consommation" },
  ];

  // Définir les mois globaux
  const months = [
    { short: "jan", labelFr: "Janvier", number: 1 },
    { short: "fev", labelFr: "Février", number: 2 },
    { short: "mar", labelFr: "Mars", number: 3 },
    { short: "avr", labelFr: "Avril", number: 4 },
    { short: "mai", labelFr: "Mai", number: 5 },
    { short: "jun", labelFr: "Juin", number: 6 },
    { short: "jul", labelFr: "Juillet", number: 7 },
    { short: "aou", labelFr: "Août", number: 8 },
    { short: "sep", labelFr: "Septembre", number: 9 },
    { short: "oct", labelFr: "Octobre", number: 10 },
    { short: "nov", labelFr: "Novembre", number: 11 },
    { short: "dec", labelFr: "Décembre", number: 12 }
  ];

  // Fonction pour mapper les noms de mois de l'API aux instances Month
  const mapMonthToInstance = (monthName) => {
    // Si c'est un nombre, le convertir
    if (typeof monthName === 'number' || (!isNaN(monthName) && monthName !== '')) {
      const monthNum = parseInt(monthName);
      if (monthNum >= 1 && monthNum <= 12) {
        const monthObj = months.find(m => m.number === monthNum);
        return monthObj ? monthObj.short : null;
      }
      return null;
    }
    
    const normalized = String(monthName).toLowerCase().trim();
    
    // Vérifier si c'est déjà un nom court valide
    const validShortNames = months.map(m => m.short);
    if (validShortNames.includes(normalized)) {
      return normalized;
    }
    
    // Mapping des variantes possibles vers nos instances Month
    const monthMapping = {
      // Noms complets français
      'janvier': 'jan',
      'février': 'fev', 'fevrier': 'fev',
      'mars': 'mar',
      'avril': 'avr',
      'mai': 'mai',
      'juin': 'jun',
      'juillet': 'jul',
      'août': 'aou', 'aout': 'aou',
      'septembre': 'sep',
      'octobre': 'oct',
      'novembre': 'nov',
      'décembre': 'dec', 'decembre': 'dec'
    };

    return monthMapping[normalized] || null;
  };

  // Créer les instances Month globales une seule fois
  for (const month of months) {
    ttl += `
nutr:${month.short} a nutr:Month ;
  nutr:hasMonthNumber "${month.number}"^^xsd:int ;
  nutr:hasMonthFullName "${escapeLiteral(month.labelFr)}"^^xsd:string ;
  rdfs:label "${month.short}"^^xsd:string .
`;
  }

  // Créer les étapes de cycle de vie globales une seule fois
  for (const stage of lifeCycleStages) {
    ttl += `
nutr:${stage.short} a nutr:LifeCycleStage ;
  rdfs:label "${escapeLiteral(stage.labelFr)}"@fr .
`;
  }

  for (const item of merged) {
    const foodId = slugify(item.label_fr || "food");

    const co2DataId = `${foodId}_co2`;
    const efGlobalId = `${foodId}_ef_global`;

    // Mapping des données vers les étapes de cycle de vie
    const stageDataMapping = [
      { key: "ef_agriculture", stage: "agriculture" },
      { key: "ef_transformation", stage: "transformation" },
      { key: "ef_emballage", stage: "emballage" },
      { key: "ef_transport", stage: "transport" },
      { key: "ef_supermarche", stage: "supermarche" },
      { key: "ef_consommation", stage: "consommation" },
    ];

    const nameLiteral = escapeLiteral(item.label_fr || "");
    const categoryLiteral = escapeLiteral(item.category || "");

    // wybór klasy Food / Fruit / Vegetable
    let foodClass = "Food";
    const cat = (item.category || "").toLowerCase();
    if (cat.includes("fruit")) {
      foodClass = "Fruit";
    } else if (cat.includes("legume") || cat.includes("légume")) {
      foodClass = "Vegetable";
    }

    // CO2 i EF globalne jako EnvironmentalData
    const envDataIds = [];
    const stageDataIds = [];

    const co2Val =
      item.impactCO2 != null && item.impactCO2 !== ""
        ? Number(item.impactCO2)
        : NaN;
    if (Number.isFinite(co2Val)) {
      envDataIds.push(co2DataId);
    }

    const efGlobalVal =
      item.ef_global != null && item.ef_global !== ""
        ? Number(item.ef_global)
        : NaN;
    if (Number.isFinite(efGlobalVal)) {
      envDataIds.push(efGlobalId);
    }

    // dane EF per etap cyklu życia
    for (const stageMapping of stageDataMapping) {
      const val =
        item[stageMapping.key] != null && item[stageMapping.key] !== ""
          ? Number(item[stageMapping.key])
          : NaN;
      if (!Number.isFinite(val)) continue;

      const stageDataId = `${foodId}_${stageMapping.stage}_ef`;
      stageDataIds.push(stageDataId);
      envDataIds.push(stageDataId);
    }

    // sezonowość z Impact CO2 - mapper vers les vraies instances Month
    let monthsData = [];
    if (Array.isArray(item.months)) {
      monthsData = item.months;
    } else if (item.months && typeof item.months === "object") {
      // np. { jan: true, fev: false, ... }
      monthsData = Object.entries(item.months)
        .filter(([, v]) => v)
        .map(([k]) => k);
    }
    
    // Mapper les noms de mois vers les instances Month valides et dédupliquer
    const validMonthInstances = [...new Set(
      monthsData
        .map(mapMonthToInstance)
        .filter(m => m !== null)
    )]; // Utiliser Set pour éliminer les doublons
    
    const hasSeason = validMonthInstances.length > 0;

    const monthInstances = validMonthInstances
      .map((m) => `nutr:${m}`)
      .join(", ");

    // Log des mois non reconnus pour debug
    const unrecognizedMonths = monthsData.filter(m => mapMonthToInstance(m) === null);
    if (unrecognizedMonths.length > 0) {
      console.warn(`Mois non reconnus pour ${item.label_fr}:`, unrecognizedMonths);
    }

    // --- instancja Food/Fruit/Vegetable ---
    ttl += `
nutr:${foodId} a nutr:${foodClass} ;
  nutr:hasName "${nameLiteral}"@fr ;
  nutr:hasCategory "${categoryLiteral}"`;

    if (envDataIds.length > 0) {
      ttl += ` ;
  nutr:hasEnvironmentalData ${envDataIds
    .map((id) => `nutr:${id}`)
    .join(", ")}`;
    }

    if (hasSeason) {
      ttl += ` ;
  nutr:isInSeasonDuring ${monthInstances}`;
    }

    ttl += ` .\n`;

    // --- Season + months (Impact CO2) - Plus besoin de créer de Season ---

    // --- CO2 ECV comme EnvironmentalData ---
    const dqr = item.dqr_global != null ? Number(item.dqr_global) : NaN;

    if (Number.isFinite(co2Val)) {
      ttl += `
nutr:${co2DataId} a nutr:EnvironmentalData ;
  nutr:hasValue "${co2Val}"^^xsd:float ;
  nutr:hasUnit "kg CO2e/kg" ;
  nutr:hasDescription "ECV (ImpactCO2) – empreinte carbone par kg de produit"@fr`;
      if (Number.isFinite(dqr)) {
        ttl += ` ;
  nutr:hasDQR "${dqr}"^^xsd:float`;
      }
      ttl += ` .\n`;
    }

    // --- EF Global (Agribalyse) ---
    if (Number.isFinite(efGlobalVal)) {
      ttl += `
nutr:${efGlobalId} a nutr:EnvironmentalData ;
  nutr:hasValue "${efGlobalVal}"^^xsd:float ;
  nutr:hasUnit "mPt/kg de produit" ;
  nutr:hasDescription "Score unique EF - Global (Agribalyse)"@fr`;
      if (Number.isFinite(dqr)) {
        ttl += ` ;
  nutr:hasDQR "${dqr}"^^xsd:float`;
      }
      ttl += ` .\n`;
    }

    // --- LifeCycleStage + LifeCycleEnvData per etap (utilise les stages globaux) ---
    for (const stageMapping of stageDataMapping) {
      const val =
        item[stageMapping.key] != null && item[stageMapping.key] !== ""
          ? Number(item[stageMapping.key])
          : NaN;
      if (!Number.isFinite(val)) continue;

      const stageDataId = `${foodId}_${stageMapping.stage}_ef`;
      const stageLabel = lifeCycleStages.find(s => s.short === stageMapping.stage).labelFr;

      ttl += `
nutr:${stageDataId} a nutr:LifeCycleEnvData ;
  nutr:hasValue "${val}"^^xsd:float ;
  nutr:hasUnit "mPt/kg de produit" ;
  nutr:hasDescription "Score unique EF - ${escapeLiteral(
    stageLabel
  )} (Agribalyse)"@fr ;
  nutr:hasLifeCycleStage nutr:${stageMapping.stage}`;
      if (Number.isFinite(dqr)) {
        ttl += ` ;
  nutr:hasDQR "${dqr}"^^xsd:float`;
      }
      ttl += ` .\n`;
    }

    // --- połączenie EF global z danymi per etap (hasLifeCycleData) ---
    if (Number.isFinite(efGlobalVal) && stageDataIds.length > 0) {
      ttl += `
nutr:${efGlobalId} nutr:hasLifeCycleData ${stageDataIds
        .map((id) => `nutr:${id}`)
        .join(", ")} .
`;
    }
  }

  fs.writeFileSync("./fruits_legumes_merged.ttl", ttl, "utf8");
}


// ----------------------
// MAIN
// ----------------------
(async () => {
  try {
    console.log("Starting merge + RDF export...");
    const merged = await buildMergedDataset();
    console.log("Merged count:", merged.length);

    saveTurtle(merged);

    console.log("Done.");
  } catch (err) {
    console.error("ERROR during processing:", err);
  }
})();