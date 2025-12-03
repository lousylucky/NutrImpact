# NutrImpact – ImpactCO₂ × Agribalyse → RDF/TTL

Ce projet fusionne :

- les données **Impact CO₂** (saisonnalité et empreinte carbone) pour les fruits & légumes
- les scores environnementaux **Agribalyse**

en un **graphe de connaissances RDF/Turtle**, basé sur une ontologie personnalisée `nutr:`.

Le script principal est `nutriImpact.js`.  
Il interroge l'API Impact CO₂, charge un CSV Agribalyse simplifié, fait le rapprochement des produits, puis génère un fichier Turtle :

`fruits_legumes_merged.ttl`

## BUT du projet

Le but est de rassembler pour chaque fruit et légumes est d'afficher le CO2 dégager lors de la production du produit en ajouter les autres données de l'API impact gouv. Puis rassembler ces données avec les données d'Agribalyse qui permettent de savoir la répartition de cette consommation dans les différentes étapes du cycle de vie (transformation, emballage, transport...).

Tout cela sera rendu disponible dans une base de données RDF, il faut donc créer une ontologie qui rassemble tout cela. Pour créer cette ontologie, il faut se renseigner sur Agroportal


## 1. Sources de données

### Impact CO₂

- Base API : `https://impactco2.fr/api/v1`
- Endpoint utilisé par ce script :  
  `GET /fruitsetlegumes?language=fr`

La réponse se présente par exemple ainsi :

```json
{
  "data": [
    {
      "name": "Pomme",
      "slug": "pomme",
      "months": [1, 2, 3, 4, 8, 9, 10, 11, 12],
      "ecv": 0.4081949,
      "category": "fruits"
    },
    ...
  ]
}
```

### CSV Agribalyse (simplifié)

Un fichier local agribalyse.csv (dans le même dossier que nutriImpact.js) contenant au minimum les colonnes :

    • Nom du Produit en Français
    • DQR - Global
    • Score unique EF - Agriculture
    • Score unique EF - Transformation
    • Score unique EF - Emballage
    • Score unique EF - Transport
    • Score unique EF - Supermarché et distribution
    • Score unique EF - Consommation


## 2. Installation

### Pré-requis :
    •	Node.js (>= 18 recommandé, pour disposer de fetch en natif)
    •	npm
    •	bibliothèque csv-parse


## 3. Aperçu du script (nutriImpact.js)

### 3.1 Chargement donnès API Impact CO₂

### 3.2 Chargement donnès d'un fichier d’Agribalyse

### 3.3 Rapprochement des produits

La fonction findAgribalyse(label) essaie de faire correspondre un produit Impact CO₂ (ex. "Pomme") à une ligne d’Agribalyse :

    •	Filtrage sur le préfixe de Nom du Produit en Français
    •	Préférence pour les produits crus ("cru" / "crue")
    •	Parmi les produits crus, préférence pour les entrées contenant "pulpe"

### 3.4. Structure JSON fusionnée

Pour chaque produit apparié, on construit un objet du type :

```json
{
  label_fr: "Pomme",
  category: "fruits",
  impactCO2: 0.4081949,      // ECV ImpactCO2
  months: [1,2,3,4,8,9,10,11,12],
  dqr_global: 3,

  ef_agriculture: ...,
  ef_transformation: ...,
  ef_emballage: ...,
  ef_transport: ...,
  ef_supermarche: ...,
  ef_consommation: ...,
  ef_global: ...             // somme de toutes les étapes EF
}

```

### 4. Génération Turtle / ontologie

La fonction saveTurtle(merged) crée un graphe RDF avec les préfixes :

```
@prefix nutr: <http://nutrimpact.org/ontologies/2025/v1/nutrimpact#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .
```

### 4.1. Classes principales

    •	nutr:Food
    •	nutr:Fruit (sous-classe de Food dans l’ontologie)
    •	nutr:Vegetable (sous-classe de Food)
    •	nutr:Season
    •	nutr:EnvironmentalData
    •	nutr:LifeCycleStage

### 4.2. Exemple : instance de Food

```
nutr:pomme a nutr:Fruit ;
  nutr:hasName "Pomme"@fr ;
  nutr:hasCategory "fruits" ;
  nutr:hasEnvironmentalData nutr:pomme_co2 ,
                            nutr:pomme_ef_global ,
                            nutr:pomme_agriculture_ef ,
                            ... ;
  nutr:isInSeasonDuring nutr:pomme_season .
```

### 4.3. Saison et mois

```sparql
nutr:pomme_season a nutr:Season ;
nutr:hasMonth "1", "2", "3", "4", "8", "9", "10", "11", "12" .
```

### 4.4. EnvironmentalData (ECV CO₂ & EF Global)

```
nutr:pomme_co2 a nutr:EnvironmentalData ;
  nutr:hasValue "0.4081949"^^xsd:float ;
  nutr:hasUnit "kg CO2e/kg" ;
  nutr:hasDescription "ECV (ImpactCO2) – empreinte carbone par kg de produit"@fr ;
  nutr:hasDQR "3"^^xsd:float .

nutr:pomme_ef_global a nutr:EnvironmentalData ;
  nutr:hasValue "..."^^xsd:float ;
  nutr:hasUnit "mPt/kg de produit" ;
  nutr:hasDescription "Score unique EF - Global (Agribalyse)"@fr ;
  nutr:hasDQR "3"^^xsd:float ;
  nutr:hasLifeCycleData nutr:pomme_agriculture_ef ,
                        nutr:pomme_transformation_ef ,
                        ... .
```

### 4.5. Étapes du cycle de vie

```
nutr:pomme_stage_agriculture a nutr:LifeCycleStage ;
  nutr:hasLifeCycleName "Agriculture"@fr .

nutr:pomme_agriculture_ef a nutr:EnvironmentalData ;
  nutr:hasValue "..."^^xsd:float ;
  nutr:hasUnit "mPt/kg de produit" ;
  nutr:hasDescription "Score unique EF - Agriculture (Agribalyse)"@fr ;
  nutr:hasLifeCycleStage nutr:pomme_stage_agriculture ;
  nutr:hasDQR "3"^^xsd:float .
```