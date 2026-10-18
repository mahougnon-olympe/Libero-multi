// Paires de mots d'Undercover : [civils FR, undercover FR, civils EN, undercover EN].
// Deux mots proches mais differents. Le serveur tire au sort lequel va aux civils.
module.exports = [
  // Cuisine et boissons
  ['Café', 'Thé', 'Coffee', 'Tea'], ['Pain', 'Brioche', 'Bread', 'Brioche'], ['Pizza', 'Quiche', 'Pizza', 'Quiche'],
  ['Riz', 'Pâtes', 'Rice', 'Pasta'], ['Beurre', 'Margarine', 'Butter', 'Margarine'], ['Miel', 'Confiture', 'Honey', 'Jam'],
  ['Chocolat', 'Caramel', 'Chocolate', 'Caramel'], ['Glace', 'Sorbet', 'Ice cream', 'Sorbet'], ['Lait', 'Yaourt', 'Milk', 'Yogurt'],
  ['Orange', 'Mandarine', 'Orange', 'Tangerine'], ['Pomme', 'Poire', 'Apple', 'Pear'], ['Banane', 'Plantain', 'Banana', 'Plantain'],
  ['Mangue', 'Papaye', 'Mango', 'Papaya'], ['Citron', 'Lime', 'Lemon', 'Lime'], ['Fraise', 'Framboise', 'Strawberry', 'Raspberry'],
  ['Tomate', 'Poivron', 'Tomato', 'Bell pepper'], ['Oignon', 'Ail', 'Onion', 'Garlic'], ['Poulet', 'Dinde', 'Chicken', 'Turkey'],
  ['Poisson', 'Crevette', 'Fish', 'Shrimp'], ['Hamburger', 'Sandwich', 'Hamburger', 'Sandwich'], ['Frites', 'Chips', 'Fries', 'Crisps'],
  ['Soda', 'Jus', 'Soda', 'Juice'], ['Eau', 'Limonade', 'Water', 'Lemonade'], ['Vin', 'Bière', 'Wine', 'Beer'],
  ['Gâteau', 'Beignet', 'Cake', 'Doughnut'], ['Igname', 'Manioc', 'Yam', 'Cassava'], ['Couscous', 'Semoule', 'Couscous', 'Semolina'],
  ['Soupe', 'Sauce', 'Soup', 'Sauce'], ['Cacahuète', 'Noix de cajou', 'Peanut', 'Cashew'],
  // Animaux
  ['Chat', 'Tigre', 'Cat', 'Tiger'], ['Chien', 'Loup', 'Dog', 'Wolf'], ['Cheval', 'Âne', 'Horse', 'Donkey'],
  ['Lion', 'Léopard', 'Lion', 'Leopard'], ['Éléphant', 'Rhinocéros', 'Elephant', 'Rhinoceros'], ['Girafe', 'Zèbre', 'Giraffe', 'Zebra'],
  ['Crocodile', 'Lézard', 'Crocodile', 'Lizard'], ['Serpent', 'Anguille', 'Snake', 'Eel'], ['Aigle', 'Faucon', 'Eagle', 'Falcon'],
  ['Perroquet', 'Corbeau', 'Parrot', 'Crow'], ['Canard', 'Oie', 'Duck', 'Goose'], ['Poule', 'Pigeon', 'Hen', 'Pigeon'],
  ['Abeille', 'Guêpe', 'Bee', 'Wasp'], ['Papillon', 'Libellule', 'Butterfly', 'Dragonfly'], ['Dauphin', 'Requin', 'Dolphin', 'Shark'],
  ['Baleine', 'Phoque', 'Whale', 'Seal'], ['Singe', 'Gorille', 'Monkey', 'Gorilla'], ['Mouton', 'Chèvre', 'Sheep', 'Goat'],
  ['Vache', 'Taureau', 'Cow', 'Bull'], ['Lapin', 'Lièvre', 'Rabbit', 'Hare'], ['Fourmi', 'Termite', 'Ant', 'Termite'],
  // Objets
  ['Stylo', 'Crayon', 'Pen', 'Pencil'], ['Livre', 'Cahier', 'Book', 'Notebook'], ['Chaise', 'Tabouret', 'Chair', 'Stool'],
  ['Canapé', 'Fauteuil', 'Sofa', 'Armchair'], ['Lit', 'Hamac', 'Bed', 'Hammock'], ['Fourchette', 'Cuillère', 'Fork', 'Spoon'],
  ['Assiette', 'Bol', 'Plate', 'Bowl'], ['Verre', 'Tasse', 'Glass', 'Cup'], ['Couteau', 'Ciseaux', 'Knife', 'Scissors'],
  ['Brosse', 'Peigne', 'Brush', 'Comb'], ['Savon', 'Shampooing', 'Soap', 'Shampoo'], ['Lunettes', 'Jumelles', 'Glasses', 'Binoculars'],
  ['Montre', 'Horloge', 'Watch', 'Clock'], ['Téléphone', 'Tablette', 'Phone', 'Tablet'], ['Ordinateur', 'Télévision', 'Computer', 'Television'],
  ['Radio', 'Casque', 'Radio', 'Headphones'], ['Parapluie', 'Imperméable', 'Umbrella', 'Raincoat'], ['Sac', 'Valise', 'Bag', 'Suitcase'],
  ['Chapeau', 'Casquette', 'Hat', 'Cap'], ['Chaussure', 'Sandale', 'Shoe', 'Sandal'], ['Pantalon', 'Short', 'Trousers', 'Shorts'],
  ['Pull', 'Veste', 'Sweater', 'Jacket'], ['Bague', 'Bracelet', 'Ring', 'Bracelet'], ['Miroir', 'Fenêtre', 'Mirror', 'Window'],
  ['Clé', 'Cadenas', 'Key', 'Padlock'], ['Bougie', 'Lampe', 'Candle', 'Lamp'], ['Balai', 'Aspirateur', 'Broom', 'Vacuum cleaner'],
  ['Oreiller', 'Coussin', 'Pillow', 'Cushion'], ['Seau', 'Bassine', 'Bucket', 'Basin'],
  // Transports et lieux
  ['Voiture', 'Camion', 'Car', 'Truck'], ['Vélo', 'Moto', 'Bicycle', 'Motorbike'], ['Avion', 'Hélicoptère', 'Plane', 'Helicopter'],
  ['Bateau', 'Pirogue', 'Boat', 'Canoe'], ['Train', 'Métro', 'Train', 'Subway'], ['Taxi', 'Bus', 'Taxi', 'Bus'],
  ['École', 'Université', 'School', 'University'], ['Hôpital', 'Pharmacie', 'Hospital', 'Pharmacy'], ['Plage', 'Piscine', 'Beach', 'Swimming pool'],
  ['Forêt', 'Jungle', 'Forest', 'Jungle'], ['Montagne', 'Colline', 'Mountain', 'Hill'], ['Rivière', 'Lac', 'River', 'Lake'],
  ['Désert', 'Savane', 'Desert', 'Savanna'], ['Marché', 'Supermarché', 'Market', 'Supermarket'], ['Cinéma', 'Théâtre', 'Cinema', 'Theatre'],
  ['Stade', 'Gymnase', 'Stadium', 'Gym'], ['Île', 'Presqu\'île', 'Island', 'Peninsula'], ['Château', 'Palais', 'Castle', 'Palace'],
  // Metiers et personnages
  ['Médecin', 'Infirmier', 'Doctor', 'Nurse'], ['Professeur', 'Directeur', 'Teacher', 'Principal'], ['Policier', 'Soldat', 'Police officer', 'Soldier'],
  ['Pilote', 'Chauffeur', 'Pilot', 'Driver'], ['Cuisinier', 'Boulanger', 'Cook', 'Baker'], ['Chanteur', 'Danseur', 'Singer', 'Dancer'],
  ['Roi', 'Président', 'King', 'President'], ['Voleur', 'Pirate', 'Thief', 'Pirate'], ['Sorcier', 'Magicien', 'Wizard', 'Magician'],
  ['Pompier', 'Ambulancier', 'Firefighter', 'Paramedic'], ['Avocat', 'Juge', 'Lawyer', 'Judge'], ['Photographe', 'Peintre', 'Photographer', 'Painter'],
  // Sports et loisirs
  ['Football', 'Rugby', 'Football', 'Rugby'], ['Basket', 'Volley', 'Basketball', 'Volleyball'], ['Tennis', 'Ping-pong', 'Tennis', 'Table tennis'],
  ['Natation', 'Plongée', 'Swimming', 'Diving'], ['Boxe', 'Judo', 'Boxing', 'Judo'], ['Guitare', 'Violon', 'Guitar', 'Violin'],
  ['Piano', 'Orgue', 'Piano', 'Organ'], ['Tambour', 'Bongo', 'Drum', 'Bongo'], ['Film', 'Série', 'Movie', 'TV series'],
  ['Roman', 'Bande dessinée', 'Novel', 'Comic book'], ['Échecs', 'Dames', 'Chess', 'Checkers'], ['Karaoké', 'Concert', 'Karaoke', 'Concert'],
  ['Marathon', 'Sprint', 'Marathon', 'Sprint'], ['Camping', 'Randonnée', 'Camping', 'Hiking'],
  // Nature et divers
  ['Soleil', 'Lune', 'Sun', 'Moon'], ['Pluie', 'Orage', 'Rain', 'Storm'], ['Neige', 'Glace', 'Snow', 'Ice'],
  ['Vent', 'Tempête', 'Wind', 'Hurricane'], ['Feu', 'Fumée', 'Fire', 'Smoke'], ['Fleur', 'Arbre', 'Flower', 'Tree'],
  ['Rose', 'Tulipe', 'Rose', 'Tulip'], ['Diamant', 'Cristal', 'Diamond', 'Crystal'], ['Or', 'Argent', 'Gold', 'Silver'],
  ['Sable', 'Terre', 'Sand', 'Soil'], ['Étoile', 'Planète', 'Star', 'Planet'], ['Nuage', 'Brouillard', 'Cloud', 'Fog'],
  ['Mariage', 'Anniversaire', 'Wedding', 'Birthday'], ['Cadeau', 'Surprise', 'Gift', 'Surprise'], ['Rêve', 'Cauchemar', 'Dream', 'Nightmare'],
];
