Exemples de requêtes SPARQL simples

Prefix

```
PREFIX nutr: <http://nutrimpact.org/ontologies/2025/v1/nutrimpact#>
PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
```

1. Tous les produits avec leur nom et leur catégorie

```
PREFIX nutr: <http://nutrimpact.org/ontologies/2025/v1/nutrimpact#>
PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

SELECT ?food ?name ?category
WHERE {
  ?food rdf:type nutr:Food ;
        nutr:hasName ?name ;
        nutr:hasCategory ?category .
}
LIMIT 20
```

2. Toutes les données environnementales pour un produit (ex. pomme)

```
PREFIX nutr: <http://nutrimpact.org/ontologies/2025/v1/nutrimpact#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?data ?value ?unit ?typeLabel
WHERE {
  nutr:pomme nutr:hasEnvironmentalData ?data .
  ?data nutr:hasValue ?value ;
        nutr:hasUnit ?unit ;
        nutr:hasDataType ?dataType .
  ?dataType rdfs:label ?typeLabel .
}
```

3. Uniquement l'ECV (Impact CO₂) pour un produit

PREFIX nutr: <http://nutrimpact.org/ontologies/2025/v1/nutrimpact#>

```
SELECT ?value ?unit ?typeLabel
WHERE {
  nutr:pomme nutr:hasEnvironmentalData ?data .
  ?data nutr:hasValue ?value ;
        nutr:hasUnit ?unit ;
        nutr:hasDataType ?dataType .
  ?dataType rdfs:label ?typeLabel .
  FILTER(?dataType = nutr:ImpactCO2Type)
}
```

4. Décomposition EF par étape du cycle de vie (Agribalyse) pour un produit

```
PREFIX nutr: <http://nutrimpact.org/ontologies/2025/v1/nutrimpact#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?stageName ?value ?unit
WHERE {
  nutr:pomme nutr:hasEnvironmentalData ?data .
  ?data nutr:hasLifeCycleStage ?stage ;
        nutr:hasValue ?value ;
        nutr:hasUnit ?unit ;
        nutr:hasDataType nutr:EnvironmentalFootprintType .
  ?stage rdfs:label ?stageName .
}
ORDER BY ?stageName
```

5. Produits de saison pour un mois donné (ex. janvier)

```
PREFIX nutr: <http://nutrimpact.org/ontologies/2025/v1/nutrimpact#>
PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>

SELECT ?food ?name ?monthNumber
WHERE {
  ?food nutr:isInSeasonDuring ?month ;
        nutr:hasName ?name .
  ?month nutr:hasMonthNumber ?monthNumber .
  FILTER(?monthNumber = 1)   # janvier
}
ORDER BY ?name
```

6. Tous les fruits (classe Fruit) avec leur ECV (ImpactCO₂)

```
PREFIX nutr: <http://nutrimpact.org/ontologies/2025/v1/nutrimpact#>
PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

SELECT ?fruit ?name ?value ?unit
WHERE {
  ?fruit rdf:type nutr:Fruit ;
         nutr:hasName ?name ;
         nutr:hasEnvironmentalData ?data .
  ?data nutr:hasValue ?value ;
        nutr:hasUnit ?unit ;
        nutr:hasDataType nutr:ImpactCO2Type .
}
ORDER BY ?name
```

7. TOP 10 des produits avec le plus grand EF Global (Agribalyse)

```
PREFIX nutr: <http://nutrimpact.org/ontologies/2025/v1/nutrimpact#>

SELECT ?food ?name ?value
WHERE {
  ?food nutr:hasName ?name ;
        nutr:hasEnvironmentalData ?data .
  ?data nutr:hasValue ?value ;
        nutr:hasDataType nutr:EnvironmentalFootprintType .
  # Exclure les données de cycle de vie pour ne garder que les globales
  FILTER NOT EXISTS { ?data nutr:hasLifeCycleStage ?stage }
}
ORDER BY DESC(?value)
LIMIT 10
```

8. ECV moyen (ImpactCO₂) pour tous les produits

```
PREFIX nutr: <http://nutrimpact.org/ontologies/2025/v1/nutrimpact#>

SELECT (AVG(?value) AS ?avgEcv)
WHERE {
  ?food nutr:hasEnvironmentalData ?data .
  ?data nutr:hasValue ?value ;
        nutr:hasDataType nutr:ImpactCO2Type .
}
```

9. Fruit de décembre avec le plus petit footprint global et sa décomposition par étape

```
PREFIX nutr: <http://nutrimpact.org/ontologies/2025/v1/nutrimpact#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX ex: <http://example.org/result#>

CONSTRUCT {
  ?fruit ex:fruitName ?fruitName ;
         ex:globalFootprint ?globalValue ;
         ex:stageFootprint ?stageData .
  ?stageData ex:stageName ?stageName ;
             ex:stageValue ?stageValue .
}
WHERE {
  {
    SELECT ?fruit ?minValue WHERE {
      ?fruit a nutr:Fruit ;
             nutr:isInSeasonDuring nutr:dec ;
             nutr:hasEnvironmentalData ?globalData .
      ?globalData nutr:hasValue ?minValue ;
                  nutr:hasDataType nutr:EnvironmentalFootprintType .
      FILTER NOT EXISTS { ?globalData nutr:hasLifeCycleStage ?stage }
    }
    ORDER BY ?minValue
    LIMIT 1
  }

  ?fruit nutr:hasName ?fruitName ;
         nutr:hasEnvironmentalData ?globalData .
  ?globalData nutr:hasValue ?globalValue ;
              nutr:hasDataType nutr:EnvironmentalFootprintType .
  FILTER NOT EXISTS { ?globalData nutr:hasLifeCycleStage ?stage }

  ?fruit nutr:hasEnvironmentalData ?stageData .
  ?stageData nutr:hasValue ?stageValue ;
             nutr:hasDataType nutr:EnvironmentalFootprintType ;
             nutr:hasLifeCycleStage ?stageObj .
  ?stageObj rdfs:label ?stageName .
}
```
