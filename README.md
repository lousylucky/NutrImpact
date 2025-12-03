# NutrImpact – ImpactCO₂ × Agribalyse → RDF/TTL

> Projet de Lukasz Matyasik et Loïc Babolat

Ce projet fusionne :

- les données **Impact CO₂** (saisonnalité et empreinte carbone) pour les fruits & légumes
- les scores environnementaux **Agribalyse** en fonction des fruits et légumes d'**Impact CO₂**

en un **graphe de connaissances RDF/Turtle**, basé sur une ontologie personnalisée `nutr:`.

Le script principal est `nutriImpact.js`.  
Il interroge l'API Impact CO₂, charge un CSV Agribalyse simplifié, fait le rapprochement des produits, puis génère un fichier Turtle :

`fruits_legumes_merged.ttl`

## BUT du projet

Le but est de rassembler pour chaque fruit et légumes est d'afficher le CO2 dégager lors de la production du produit en ajouter les autres données de l'API impact gouv. Puis rassembler ces données avec les données d'Agribalyse qui permettent de savoir la répartition de cette consommation dans les différentes étapes du cycle de vie (transformation, emballage, transport...).

Tout cela sera rendu disponible dans une base de données RDF, il faut donc créer une ontologie qui rassemble tout cela. Pour créer cette ontologie, il faut se renseigner sur Agroportal

## 1. Sources de données

### Impact CO₂

- Base API : https://impactco2.fr/doc/api
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

Un fichier local [agribalyse.csv](./agribalyse.csv) contenant au minimum les colonnes :

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

#### 1. Chargement donnès API Impact CO₂

#### 2. Chargement donnès d'un fichier d’Agribalyse

#### 3. Rapprochement des produits

La fonction findAgribalyse(label) essaie de faire correspondre un produit Impact CO₂ (ex. "Pomme") à une ligne d’Agribalyse :

    •	Filtrage sur le préfixe de Nom du Produit en Français
    •	Préférence pour les produits crus ("cru" / "crue")
    •	Parmi les produits crus, préférence pour les entrées contenant "pulpe"

#### 4. Structure JSON fusionnée

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

Nous avons créé l'ontologie avec protégé, vous pouvez la truover dans le fichier [nutrimpact.owl](./ontology/nutrimpact.owl).

La fonction saveTurtle(merged) crée un graphe RDF avec les préfixes :

```
@prefix nutr: <http://nutrimpact.org/ontologies/2025/v1/nutrimpact#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .
```

### 4.1. Classes principales

- **Food**
  - **Fruit** (sous-classe de Food)
  - **Vegetable** (sous-classe de Food)
- **Month** : Représente les mois de l'année pour afficher durant lequel de ces mois un aliment est de saison
- **Data**
  - **EnvironmentalData** (sous-classe de Data) : Cette classe est utilisé pour les données environnemental global
    - **LifeCycleEnvData** (sous-classe de EnvironmentalData) : Cette classe est utilisé pour les données environnemental qui ne concerne qu'une seule étape du cycle de vie
- **LifeCycleStage** : Les étapes du cycle de vie sont définies avec cette classe
- **DataType** : Les type de données, nous avons créé une classe pour pouvoir faire des requêtes en fonction du type de données facilement

### 4.2. Exemple : instance de Food

```
nutr:pomme a nutr:Fruit ;
  nutr:hasName "Pomme"@fr ;
  nutr:hasCategory "fruits" ;
  nutr:hasEnvironmentalData nutr:pomme_co2,
                            nutr:pomme_ef_global,
                            nutr:pomme_agriculture_ef,
                            nutr:pomme_transformation_ef,
                            nutr:pomme_emballage_ef,
                            nutr:pomme_transport_ef,
                            nutr:pomme_supermarche_ef,
                            nutr:pomme_consommation_ef ;
  nutr:isInSeasonDuring nutr:jan, nutr:fev, nutr:mar, nutr:avr,
                        nutr:aou, nutr:sep, nutr:oct, nutr:nov, nutr:dec .
```

### 4.3. Mois de saison

```
nutr:jan a nutr:Month ;
  nutr:hasMonthNumber "1"^^xsd:int ;
  nutr:hasMonthFullName "Janvier"^^xsd:string ;
  rdfs:label "jan"^^xsd:string .

nutr:fev a nutr:Month ;
  nutr:hasMonthNumber "2"^^xsd:int ;
  nutr:hasMonthFullName "Février"^^xsd:string ;
  rdfs:label "fev"^^xsd:string .

# etc. pour tous les mois...
```

### 4.4. EnvironmentalData (ECV CO₂ & EF Global)

```
nutr:pomme_co2 a nutr:EnvironmentalData ;
  nutr:hasValue "0.40819489999999997"^^xsd:float ;
  nutr:hasUnit "kg CO2e/kg" ;
  nutr:hasDataType nutr:ImpactCO2Type ;
  nutr:hasDQR "2"^^xsd:float .

nutr:pomme_ef_global a nutr:EnvironmentalData ;
  nutr:hasValue "0.0439687"^^xsd:float ;
  nutr:hasUnit "mPt/kg de produit" ;
  nutr:hasDataType nutr:EnvironmentalFootprintType ;
  nutr:hasDQR "2"^^xsd:float ;
  nutr:hasLifeCycleData nutr:pomme_agriculture_ef ,
                        nutr:pomme_transformation_ef ,
                        nutr:pomme_emballage_ef ,
                        nutr:pomme_transport_ef ,
                        nutr:pomme_supermarche_ef ,
                        nutr:pomme_consommation_ef .

nutr:pomme_agriculture_ef a nutr:LifeCycleEnvData ;
  nutr:hasValue "0.0193"^^xsd:float ;
  nutr:hasUnit "mPt/kg de produit" ;
  nutr:hasDataType nutr:EnvironmentalFootprintType ;
  nutr:hasLifeCycleStage nutr:agriculture ;
  nutr:hasDQR "2"^^xsd:float .
```

### 4.5. Étapes du cycle de vie

```
nutr:agriculture a nutr:LifeCycleStage ;
  rdfs:label "Agriculture"@fr .

nutr:transformation a nutr:LifeCycleStage ;
  rdfs:label "Transformation"@fr .

nutr:emballage a nutr:LifeCycleStage ;
  rdfs:label "Emballage"@fr .

nutr:transport a nutr:LifeCycleStage ;
  rdfs:label "Transport"@fr .

nutr:supermarche a nutr:LifeCycleStage ;
  rdfs:label "Supermarché et distribution"@fr .

nutr:consommation a nutr:LifeCycleStage ;
  rdfs:label "Consommation"@fr .
```

### 4.6. Types de données créés :

```
nutr:ImpactCO2Type a nutr:DataType ;
  rdfs:label "Impact CO2"@fr ;
  nutr:hasDescription "ECV (ImpactCO2) – empreinte carbone par kg de produit"@fr .

nutr:EnvironmentalFootprintType a nutr:DataType ;
  rdfs:label "Empreinte Environnementale"@fr ;
  nutr:hasDescription "Score unique EF - Empreinte environnementale (Agribalyse)"@fr .
```
