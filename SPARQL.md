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

SELECT ?data ?value ?unit ?desc
WHERE {
  nutr:pomme nutr:hasEnvironmentalData ?data .
  ?data nutr:hasValue ?value ;
        nutr:hasUnit ?unit ;
        nutr:hasDescription ?desc .
}
```

3. Uniquement l’ECV (Impact CO₂) pour un produit

PREFIX nutr: <http://nutrimpact.org/ontologies/2025/v1/nutrimpact#>

```
SELECT ?value ?unit
WHERE {
  nutr:pomme nutr:hasEnvironmentalData ?data .
  ?data nutr:hasValue ?value ;
        nutr:hasUnit ?unit ;
        nutr:hasDescription ?desc .
  FILTER(CONTAINS(?desc, "ImpactCO2"))
}
```

4. Décomposition EF par étape du cycle de vie (Agribalyse) pour un produit

```
PREFIX nutr: <http://nutrimpact.org/ontologies/2025/v1/nutrimpact#>

SELECT ?stageName ?value ?unit
WHERE {
  nutr:pomme nutr:hasEnvironmentalData ?data .
  ?data nutr:hasLifeCycleStage ?stage ;
        nutr:hasValue ?value ;
        nutr:hasUnit ?unit .
  ?stage nutr:hasLifeCycleName ?stageName .
}
ORDER BY ?stageName
```

5. Produits de saison pour un mois donné (ex. janvier = “1”)

```
PREFIX nutr: <http://nutrimpact.org/ontologies/2025/v1/nutrimpact#>
PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>

SELECT ?food ?name ?month
WHERE {
  ?food nutr:isInSeasonDuring ?season ;
        nutr:hasName ?name .
  ?season nutr:hasMonth ?month .
  FILTER(?month = "1"^^xsd:string)   # janvier
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
        nutr:hasDescription ?desc .
  FILTER(CONTAINS(?desc, "ImpactCO2"))
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
        nutr:hasDescription ?desc .
  FILTER(CONTAINS(?desc, "Global (Agribalyse)"))
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
        nutr:hasDescription ?desc .
  FILTER(CONTAINS(?desc, "ImpactCO2"))
}
```