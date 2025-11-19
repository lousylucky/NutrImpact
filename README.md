# NutrImpact

## Liens utiles 

- API ADEME Gouv Impact CO2 Fruit et légumes de saison : [https://impactco2.fr/doc/api](https://impactco2.fr/doc/api)

Les données de base pour notre projet, les autres données seront récupérer en se basant sur le résultat de cette API. Comprend l'impact CO2, les mois où l'aliment est de saison et la catégorie.

- Agribalyse 
    - Site internet : https://agribalyse.ademe.fr/
    - Données : https://data.ademe.fr/datasets/agribalyse-31-detail-par-etape

Comprend les données sur l'impact CO2 et d'autres données de l'impact environnemental des aliments


- Agroportal : https://agroportal.lirmm.fr/

Le foyer des ontologies et des artefacts sémantiques dans l'agroalimentaire et les domaines connexes.

## BUT du projet

Le but est de rassembler pour chaque fruit et légumes est d'afficher le CO2 dégager lors de la production du produit en ajouter les autres données de l'API impact gouv. Puis rassembler ces données avec les données d'Agribalyse qui permettent de savoir la répartition de cette consommation dans les différentes étapes du cycle de vie (transformation, emballage, transport...).

Tout cela sera rendu disponible dans une base de données RDF, il faut donc créer une ontologie qui rassemble tout cela. Pour créer cette ontologie, il faut se renseigner sur Agroportal