// Robots d'Undercover : banque d'indices ecrite a la main (3 a 4 mots par mot secret, FR et EN),
// phrases de debat et choix de vote. Un robot ne triche pas : il ne connait que SON mot.
const FR = {
  'Café': 'noir,matin,tasse,expresso', 'Thé': 'infusion,vert,théière,menthe', 'Pain': 'baguette,boulangerie,croûte,mie', 'Brioche': 'dimanche,sucré,moelleux,viennoiserie',
  'Pizza': 'italienne,fromage,four,part', 'Quiche': 'lorraine,tarte,oeufs,lardons', 'Riz': 'grain,blanc,cuit,asie', 'Pâtes': 'italie,spaghetti,sauce,bouillies',
  'Beurre': 'tartine,jaune,gras,motte', 'Margarine': 'végétale,tartiner,barquette,alternative', 'Miel': 'ruche,doré,sucré,collant', 'Confiture': 'pot,fruits,tartine,fraise',
  'Chocolat': 'cacao,tablette,fondre,noir', 'Caramel': 'sucre,fondu,brun,bonbon', 'Glace': 'cornet,été,froid,vanille', 'Sorbet': 'fruité,givré,sans lait,dessert',
  'Lait': 'blanc,vache,verre,céréales', 'Yaourt': 'pot,nature,fermenté,crémeux', 'Orange': 'agrume,jus,vitamines,pressée', 'Mandarine': 'noël,facile,pépins,petite',
  'Pomme': 'verger,croquante,rouge,tarte', 'Poire': 'juteuse,verte,fruit,compote', 'Banane': 'jaune,peau,singe,courbée', 'Plantain': 'frit,alloco,cuire,tropical',
  'Mangue': 'tropicale,noyau,sucrée,jus', 'Papaye': 'orange,graines,exotique,mûre', 'Citron': 'acide,jaune,pressé,zeste', 'Lime': 'mojito,verte,acide,cocktail',
  'Fraise': 'rouge,été,pépins,tarte', 'Framboise': 'petite,rouge,coulis,délicate', 'Tomate': 'salade,rouge,sauce,potager', 'Poivron': 'farci,coloré,creux,grillé',
  'Oignon': 'pleurer,couche,rond,haché', 'Ail': 'gousse,vampire,haleine,piquant', 'Poulet': 'rôti,volaille,cuisse,ferme', 'Dinde': 'noël,farcie,grosse,volaille',
  'Poisson': 'écailles,nager,pêche,arêtes', 'Crevette': 'rose,décortiquer,mer,cocktail', 'Hamburger': 'steak,bun,fast-food,américain', 'Sandwich': 'pain,jambon,déjeuner,garni',
  'Frites': 'patates,friteuse,salées,ketchup', 'Chips': 'sachet,apéro,croustillantes,salées', 'Soda': 'bulles,sucré,canette,gazeux', 'Jus': 'fruits,pressé,verre,brique',
  'Eau': 'soif,source,bouteille,robinet', 'Limonade': 'citron,pétillante,été,fraîche', 'Vin': 'raisin,cave,rouge,bouteille', 'Bière': 'houblon,mousse,pression,blonde',
  'Gâteau': 'bougies,four,pâtisserie,part', 'Beignet': 'frit,sucre,huile,rond', 'Igname': 'tubercule,pilé,tradition,racine', 'Manioc': 'tapioca,racine,gari,tropical',
  'Couscous': 'maghreb,légumes,graines,vapeur', 'Semoule': 'fine,blé,grains,dessert', 'Soupe': 'chaude,cuillère,bouillon,hiver', 'Sauce': 'accompagner,tomate,verser,piment',
  'Cacahuète': 'arachide,coque,apéritif,beurre', 'Noix de cajou': 'courbée,chère,anacarde,grillée',
  'Chat': 'ronronner,moustaches,souris,griffes', 'Tigre': 'rayures,jungle,félin,orange', 'Chien': 'aboyer,laisse,fidèle,os', 'Loup': 'hurler,meute,forêt,lune',
  'Cheval': 'galop,selle,écurie,crinière', 'Âne': 'braire,têtu,oreilles,bât', 'Lion': 'roi,crinière,rugir,savane', 'Léopard': 'taches,arbre,rapide,félin',
  'Éléphant': 'trompe,gris,défenses,mémoire', 'Rhinocéros': 'corne,épais,lourd,savane', 'Girafe': 'cou,grande,taches,feuilles', 'Zèbre': 'rayé,noir,blanc,savane',
  'Crocodile': 'dents,marais,sac,mâchoire', 'Lézard': 'queue,soleil,mur,écailles', 'Serpent': 'ramper,venin,sifflement,mue', 'Anguille': 'glissante,longue,rivière,électrique',
  'Aigle': 'rapace,sommet,serres,royal', 'Faucon': 'chasse,rapide,dressé,perché', 'Perroquet': 'répéter,plumes,coloré,parler', 'Corbeau': 'noir,croasser,champ,sinistre',
  'Canard': 'mare,coin-coin,plumes,palmés', 'Oie': 'foie gras,jars,troupeau,cacarder', 'Poule': 'pondre,oeuf,basse-cour,coq', 'Pigeon': 'ville,roucouler,place,gris',
  'Abeille': 'miel,ruche,butiner,reine', 'Guêpe': 'piqûre,rayée,pique-nique,nid', 'Papillon': 'ailes,chenille,léger,colorés', 'Libellule': 'étang,volante,fine,mare',
  'Dauphin': 'sauter,intelligent,mer,sourire', 'Requin': 'ailerons,dents,océan,attaque', 'Baleine': 'géante,souffle,océan,mammifère', 'Phoque': 'banquise,moustaches,glisser,froid',
  'Singe': 'banane,branche,grimper,malin', 'Gorille': 'fort,forêt,poitrine,primate', 'Mouton': 'laine,troupeau,bêler,berger', 'Chèvre': 'cornes,fromage,montagne,barbiche',
  'Vache': 'lait,pré,meugler,étable', 'Taureau': 'corrida,cornes,rouge,fort', 'Lapin': 'carotte,terrier,oreilles,sauter', 'Lièvre': 'rapide,champs,course,long',
  'Fourmi': 'colonie,minuscule,travail,piste', 'Termite': 'bois,termitière,ronger,colonie',
  'Stylo': 'encre,écrire,bille,capuchon', 'Crayon': 'gomme,mine,dessin,taille', 'Livre': 'pages,lire,bibliothèque,histoire', 'Cahier': 'classe,spirale,écrire,rentrée',
  'Chaise': 'asseoir,quatre pieds,table,dossier', 'Tabouret': 'bar,sans dossier,petit,rond', 'Canapé': 'salon,télé,coussins,affalé', 'Fauteuil': 'accoudoirs,lecture,confort,roi',
  'Lit': 'dormir,matelas,draps,chambre', 'Hamac': 'suspendu,sieste,arbres,balancer', 'Fourchette': 'dents,piquer,couvert,assiette', 'Cuillère': 'soupe,louche,manger,métal',
  'Assiette': 'plate,repas,vaisselle,table', 'Bol': 'petit-déjeuner,creux,céréales,rond', 'Verre': 'boire,transparent,casser,eau', 'Tasse': 'anse,café,soucoupe,chaude',
  'Couteau': 'lame,couper,tranchant,table', 'Ciseaux': 'papier,couper,deux lames,bricolage', 'Brosse': 'poils,cheveux,nettoyer,frotter', 'Peigne': 'dents,coiffer,démêler,plastique',
  'Savon': 'mousse,laver,bain,parfumé', 'Shampooing': 'cheveux,flacon,mousse,rincer', 'Lunettes': 'vue,verres,nez,monture', 'Jumelles': 'observer,loin,oiseaux,deux',
  'Montre': 'poignet,heure,bracelet,cadran', 'Horloge': 'mur,aiguilles,tic-tac,sonner', 'Téléphone': 'appeler,sonnerie,écran,numéro', 'Tablette': 'tactile,écran,plate,lire',
  'Ordinateur': 'clavier,souris,écran,bureau', 'Télévision': 'chaîne,télécommande,salon,émission', 'Radio': 'ondes,musique,fréquence,écouter', 'Casque': 'oreilles,musique,moto,protéger',
  'Parapluie': 'pluie,mouillé,pliant,tenir', 'Imperméable': 'étanche,pluie,veste,capuche', 'Sac': 'bretelle,fourre-tout,école,porter', 'Valise': 'voyage,roulettes,départ,bagages',
  'Chapeau': 'tête,soleil,paille,tirer', 'Casquette': 'visière,sport,tête,ado', 'Chaussure': 'lacets,pied,semelle,paire', 'Sandale': 'été,plage,ouvertes,orteils',
  'Pantalon': 'jambes,ceinture,poches,jean', 'Short': 'été,jambes,court,sport', 'Pull': 'laine,chaud,col,hiver', 'Veste': 'zip,manches,poches,mi-saison',
  'Bague': 'doigt,mariage,diamant,alliance', 'Bracelet': 'poignet,perles,bijou,montre', 'Miroir': 'reflet,salle de bain,se voir,glace', 'Fenêtre': 'vitre,rideau,ouvrir,lumière',
  'Clé': 'serrure,porte,trousseau,tourner', 'Cadenas': 'vélo,fermer,code,anse', 'Bougie': 'cire,flamme,mèche,gâteau', 'Lampe': 'ampoule,lumière,interrupteur,bureau',
  'Balai': 'sorcière,poussière,manche,balayer', 'Aspirateur': 'bruit,sac,poussière,tapis', 'Oreiller': 'dormir,tête,plume,taie', 'Coussin': 'canapé,décoration,mou,brodé',
  'Seau': 'sable,eau,anse,plage', 'Bassine': 'lessive,ronde,grande,laver',
  'Voiture': 'volant,route,garage,essence', 'Camion': 'remorque,gros,livraison,poids lourd', 'Vélo': 'pédaler,roues,casque,guidon', 'Moto': 'casque,deux roues,vitesse,moteur',
  'Avion': 'aéroport,ailes,décoller,vol', 'Hélicoptère': 'pales,hélice,voler,sauvetage', 'Bateau': 'mer,voile,port,capitaine', 'Pirogue': 'rame,fleuve,bois,pêcheur',
  'Train': 'rails,gare,wagon,quai', 'Métro': 'souterrain,station,ticket,ligne', 'Taxi': 'course,chauffeur,compteur,jaune', 'Bus': 'arrêt,ligne,voyageurs,scolaire',
  'École': 'cour,élèves,cloche,maître', 'Université': 'amphithéâtre,étudiants,licence,campus', 'Hôpital': 'patients,urgences,chambre,blouse', 'Pharmacie': 'croix verte,ordonnance,médicaments,comptoir',
  'Plage': 'sable,vagues,serviette,parasol', 'Piscine': 'plongeoir,chlore,bassin,maillot', 'Forêt': 'arbres,champignons,sentier,ombre', 'Jungle': 'lianes,tropicale,tarzan,dense',
  'Montagne': 'sommet,neige,alpiniste,altitude', 'Colline': 'verte,pente,douce,petite', 'Rivière': 'courant,pont,pêche,berges', 'Lac': 'calme,barque,eau douce,rive',
  'Désert': 'dunes,chameau,sec,oasis', 'Savane': 'lions,herbe,safari,girafes', 'Marché': 'étals,vendeuse,légumes,marchander', 'Supermarché': 'caddie,caisse,rayons,courses',
  'Cinéma': 'écran,popcorn,salle,séance', 'Théâtre': 'scène,rideau,acteurs,pièce', 'Stade': 'supporters,pelouse,match,gradins', 'Gymnase': 'sport,salle,tapis,cours',
  'Île': 'entourée,mer,plage,bateau', 'Presqu\'île': 'presque,bande,terre,côte', 'Château': 'tours,roi,douves,fort', 'Palais': 'luxueux,couronne,richesse,gardes',
  'Médecin': 'consultation,ordonnance,stéthoscope,cabinet', 'Infirmier': 'piqûre,soins,blouse,hôpital', 'Professeur': 'classe,tableau,cours,notes', 'Directeur': 'bureau,chef,école,équipe',
  'Policier': 'uniforme,sirène,enquête,loi', 'Soldat': 'armée,casque,caserne,guerre', 'Pilote': 'cockpit,course,voler,casque', 'Chauffeur': 'volant,route,conduire,passagers',
  'Cuisinier': 'toque,fourneaux,recettes,restaurant', 'Boulanger': 'farine,four,aube,baguette', 'Chanteur': 'micro,voix,scène,refrain', 'Danseur': 'pas,rythme,scène,chorégraphie',
  'Roi': 'couronne,trône,royaume,reine', 'Président': 'élection,pays,discours,palais', 'Voleur': 'cambriolage,nuit,police,sac', 'Pirate': 'bandeau,trésor,navire,perroquet',
  'Sorcier': 'potion,maléfice,baguette,chaudron', 'Magicien': 'tour,chapeau,lapin,spectacle', 'Pompier': 'incendie,lance,casque,camion rouge', 'Ambulancier': 'urgence,civière,sirène,transport',
  'Avocat': 'plaidoirie,robe,client,procès', 'Juge': 'tribunal,marteau,verdict,loi', 'Photographe': 'objectif,flash,clic,portrait', 'Peintre': 'pinceau,toile,palette,tableau',
  'Football': 'ballon,but,mondial,crampons', 'Rugby': 'ovale,mêlée,essai,plaquer', 'Basket': 'panier,dribble,dunk,orange', 'Volley': 'filet,smash,sable,passe',
  'Tennis': 'raquette,balle,court,set', 'Ping-pong': 'table,petite balle,raquette,rebond', 'Natation': 'bassin,crawl,lunettes,longueur', 'Plongée': 'bouteille,fonds,masque,corail',
  'Boxe': 'gants,ring,coups,round', 'Judo': 'tatami,kimono,ceinture,projeter', 'Guitare': 'cordes,accords,gratter,manche', 'Violon': 'archet,cordes,orchestre,menton',
  'Piano': 'touches,clavier,noires,blanches', 'Orgue': 'église,tuyaux,pédales,messe', 'Tambour': 'baguettes,battre,peau,roulement', 'Bongo': 'percussion,mains,afro,rythme',
  'Film': 'cinéma,acteur,réalisateur,scènes', 'Série': 'épisodes,saisons,plateforme,suite', 'Roman': 'chapitres,auteur,fiction,écrivain', 'Bande dessinée': 'bulles,dessins,cases,héros',
  'Échecs': 'roi,pion,échiquier,mat', 'Dames': 'pions,damier,sauter,noirs', 'Karaoké': 'micro,paroles,chanter,soirée', 'Concert': 'scène,public,artiste,billet',
  'Marathon': 'longue,course,quarante-deux,endurance', 'Sprint': 'rapide,court,finish,vitesse', 'Camping': 'tente,feu,nature,sac de couchage', 'Randonnée': 'sentier,marcher,chaussures,montagne',
  'Soleil': 'jour,chaud,rayons,lever', 'Lune': 'nuit,croissant,pleine,phases', 'Pluie': 'gouttes,averse,nuages,flaque', 'Orage': 'éclairs,tonnerre,grondement,foudre',
  'Neige': 'flocons,hiver,blanche,bonhomme', 'Vent': 'souffler,brise,voile,rafale', 'Tempête': 'violente,mer,dégâts,sombre', 'Feu': 'flammes,brûler,bois,chaleur',
  'Fumée': 'noire,cheminée,cigarette,monter', 'Fleur': 'pétales,bouquet,parfum,printemps', 'Arbre': 'tronc,feuilles,racines,ombre', 'Rose': 'épines,rouge,amour,bouquet',
  'Tulipe': 'bulbe,pays-bas,printemps,jardin', 'Diamant': 'bague,brillant,dur,carats', 'Cristal': 'verre,transparent,lustre,fragile', 'Or': 'lingot,jaune,précieux,bijou',
  'Argent': 'gris,métal,monnaie,médaille', 'Sable': 'plage,grains,dune,château', 'Terre': 'planète,sol,jardin,labour', 'Étoile': 'ciel,nuit,briller,filante',
  'Planète': 'orbite,système,univers,Mars', 'Nuage': 'ciel,blanc,vapeur,pluie', 'Brouillard': 'visibilité,matin,épais,gris', 'Mariage': 'robe,alliance,mairie,invités',
  'Anniversaire': 'bougies,gâteau,année,cadeaux', 'Cadeau': 'paquet,papier,noël,offrir', 'Surprise': 'inattendue,cri,fête,effet', 'Rêve': 'dormir,sommeil,imaginaire,nuit',
  'Cauchemar': 'peur,nuit,réveil,sueur',
};
const EN = {
  'Coffee': 'black,morning,mug,espresso', 'Tea': 'kettle,green,herbal,cup', 'Bread': 'loaf,bakery,crust,toast', 'Brioche': 'sweet,sunday,soft,pastry',
  'Pizza': 'italian,cheese,oven,slice', 'Quiche': 'savoury,tart,eggs,bacon', 'Rice': 'grain,white,steamed,asia', 'Pasta': 'italy,spaghetti,boiled,sauce',
  'Butter': 'toast,yellow,fat,spread', 'Margarine': 'vegetable,spread,tub,alternative', 'Honey': 'hive,golden,sweet,sticky', 'Jam': 'jar,fruit,toast,strawberry',
  'Chocolate': 'cocoa,bar,melt,dark', 'Caramel': 'sugar,melted,brown,sweet', 'Ice cream': 'cone,summer,cold,vanilla', 'Sorbet': 'fruity,frozen,dairy-free,dessert',
  'Milk': 'white,cow,glass,cereal', 'Yogurt': 'pot,plain,creamy,fermented', 'Orange': 'citrus,juice,vitamin,squeezed', 'Tangerine': 'christmas,easy,peel,small',
  'Apple': 'orchard,crunchy,red,pie', 'Pear': 'juicy,green,fruit,compote', 'Banana': 'yellow,peel,monkey,curved', 'Plantain': 'fried,cooked,tropical,starchy',
  'Mango': 'tropical,stone,sweet,juice', 'Papaya': 'orange,seeds,exotic,ripe', 'Lemon': 'sour,yellow,squeezed,zest', 'Lime': 'mojito,green,sour,cocktail',
  'Strawberry': 'red,summer,seeds,tart', 'Raspberry': 'small,red,coulis,delicate', 'Tomato': 'salad,red,sauce,garden', 'Bell pepper': 'stuffed,colourful,hollow,grilled',
  'Onion': 'cry,layers,round,chopped', 'Garlic': 'clove,vampire,breath,pungent', 'Chicken': 'roast,poultry,drumstick,farm', 'Turkey': 'thanksgiving,stuffed,big,poultry',
  'Fish': 'scales,swim,angling,bones', 'Shrimp': 'pink,peel,sea,cocktail', 'Hamburger': 'patty,bun,fast food,american', 'Sandwich': 'bread,ham,lunch,filling',
  'Fries': 'potato,fryer,salty,ketchup', 'Crisps': 'bag,snack,crunchy,salty', 'Soda': 'bubbles,sweet,can,fizzy', 'Juice': 'fruit,squeezed,glass,carton',
  'Water': 'thirst,spring,bottle,tap', 'Lemonade': 'lemon,sparkling,summer,cool', 'Wine': 'grapes,cellar,red,bottle', 'Beer': 'hops,foam,draught,lager',
  'Cake': 'candles,oven,pastry,slice', 'Doughnut': 'fried,sugar,oil,round', 'Yam': 'tuber,pounded,tradition,root', 'Cassava': 'tapioca,root,gari,tropical',
  'Couscous': 'maghreb,vegetables,grains,steamed', 'Semolina': 'fine,wheat,grains,dessert', 'Soup': 'hot,spoon,broth,winter', 'Sauce': 'accompany,tomato,pour,chilli',
  'Peanut': 'groundnut,shell,snack,butter', 'Cashew': 'curved,pricey,nut,roasted',
  'Cat': 'purr,whiskers,mouse,claws', 'Tiger': 'stripes,jungle,feline,orange', 'Dog': 'bark,leash,loyal,bone', 'Wolf': 'howl,pack,forest,moon',
  'Horse': 'gallop,saddle,stable,mane', 'Donkey': 'bray,stubborn,ears,burden', 'Lion': 'king,mane,roar,savanna', 'Leopard': 'spots,tree,fast,feline',
  'Elephant': 'trunk,grey,tusks,memory', 'Rhinoceros': 'horn,thick,heavy,savanna', 'Giraffe': 'neck,tall,spots,leaves', 'Zebra': 'striped,black,white,savanna',
  'Crocodile': 'teeth,swamp,bag,jaws', 'Lizard': 'tail,sun,wall,scales', 'Snake': 'slither,venom,hiss,shed', 'Eel': 'slippery,long,river,electric',
  'Eagle': 'raptor,summit,talons,royal', 'Falcon': 'hunt,fast,trained,perched', 'Parrot': 'repeat,feathers,colourful,talk', 'Crow': 'black,caw,field,sinister',
  'Duck': 'pond,quack,feathers,webbed', 'Goose': 'honk,flock,gander,farm', 'Hen': 'lay,egg,farmyard,rooster', 'Pigeon': 'city,coo,square,grey',
  'Bee': 'honey,hive,buzz,queen', 'Wasp': 'sting,striped,picnic,nest', 'Butterfly': 'wings,caterpillar,light,colourful', 'Dragonfly': 'pond,flying,thin,marsh',
  'Dolphin': 'jump,clever,sea,smile', 'Shark': 'fin,teeth,ocean,attack', 'Whale': 'giant,blow,ocean,mammal', 'Seal': 'ice,whiskers,slide,cold',
  'Monkey': 'banana,branch,climb,clever', 'Gorilla': 'strong,forest,chest,primate', 'Sheep': 'wool,flock,bleat,shepherd', 'Goat': 'horns,cheese,mountain,beard',
  'Cow': 'milk,meadow,moo,barn', 'Bull': 'matador,horns,red,strong', 'Rabbit': 'carrot,burrow,ears,hop', 'Hare': 'fast,fields,race,long',
  'Ant': 'colony,tiny,work,trail', 'Termite': 'wood,mound,gnaw,colony',
  'Pen': 'ink,write,ballpoint,cap', 'Pencil': 'eraser,lead,drawing,sharpen', 'Book': 'pages,read,library,story', 'Notebook': 'class,spiral,write,school',
  'Chair': 'sit,four legs,table,back', 'Stool': 'bar,backless,small,round', 'Sofa': 'living room,tv,cushions,lounge', 'Armchair': 'armrests,reading,comfort,cosy',
  'Bed': 'sleep,mattress,sheets,bedroom', 'Hammock': 'hanging,nap,trees,swing', 'Fork': 'prongs,stab,cutlery,plate', 'Spoon': 'soup,ladle,eat,metal',
  'Plate': 'flat,meal,dishes,table', 'Bowl': 'breakfast,deep,cereal,round', 'Glass': 'drink,transparent,break,water', 'Cup': 'handle,coffee,saucer,hot',
  'Knife': 'blade,cut,sharp,table', 'Scissors': 'paper,cut,two blades,crafts', 'Brush': 'bristles,hair,clean,scrub', 'Comb': 'teeth,style,untangle,plastic',
  'Soap': 'lather,wash,bath,scented', 'Shampoo': 'hair,bottle,lather,rinse', 'Glasses': 'sight,lenses,nose,frame', 'Binoculars': 'observe,far,birds,two',
  'Watch': 'wrist,time,strap,dial', 'Clock': 'wall,hands,tick,chime', 'Phone': 'call,ringtone,screen,number', 'Tablet': 'touch,screen,flat,read',
  'Computer': 'keyboard,mouse,screen,desk', 'Television': 'channel,remote,lounge,show', 'Radio': 'waves,music,frequency,listen', 'Headphones': 'ears,music,wireless,listen',
  'Umbrella': 'rain,wet,fold,hold', 'Raincoat': 'waterproof,rain,jacket,hood', 'Bag': 'strap,tote,school,carry', 'Suitcase': 'travel,wheels,departure,luggage',
  'Hat': 'head,sun,straw,tip', 'Cap': 'peak,sport,head,teen', 'Shoe': 'laces,foot,sole,pair', 'Sandal': 'summer,beach,open,toes',
  'Trousers': 'legs,belt,pockets,jeans', 'Shorts': 'summer,legs,short,sport', 'Sweater': 'wool,warm,neck,winter', 'Jacket': 'zip,sleeves,pockets,spring',
  'Ring': 'finger,wedding,diamond,band', 'Bracelet': 'wrist,beads,jewellery,charm', 'Mirror': 'reflection,bathroom,see,glass', 'Window': 'pane,curtain,open,light',
  'Key': 'lock,door,keyring,turn', 'Padlock': 'bike,secure,code,shackle', 'Candle': 'wax,flame,wick,cake', 'Lamp': 'bulb,light,switch,desk',
  'Broom': 'witch,dust,handle,sweep', 'Vacuum cleaner': 'noise,bag,dust,carpet', 'Pillow': 'sleep,head,feather,case', 'Cushion': 'sofa,decoration,soft,embroidered',
  'Bucket': 'sand,water,handle,beach', 'Basin': 'laundry,round,large,wash',
  'Car': 'wheel,road,garage,petrol', 'Truck': 'trailer,big,delivery,heavy', 'Bicycle': 'pedal,wheels,helmet,handlebar', 'Motorbike': 'helmet,two wheels,speed,engine',
  'Plane': 'airport,wings,takeoff,flight', 'Helicopter': 'blades,rotor,hover,rescue', 'Boat': 'sea,sail,harbour,captain', 'Canoe': 'paddle,river,wood,fisherman',
  'Train': 'rails,station,carriage,platform', 'Subway': 'underground,station,ticket,line', 'Taxi': 'fare,driver,meter,yellow', 'Bus': 'stop,route,passengers,school',
  'School': 'playground,pupils,bell,teacher', 'University': 'lecture,students,degree,campus', 'Hospital': 'patients,emergency,ward,gown', 'Pharmacy': 'green cross,prescription,medicine,counter',
  'Beach': 'sand,waves,towel,parasol', 'Swimming pool': 'diving board,chlorine,lane,swimsuit', 'Forest': 'trees,mushrooms,trail,shade', 'Jungle': 'vines,tropical,tarzan,dense',
  'Mountain': 'summit,snow,climber,altitude', 'Hill': 'green,slope,gentle,small', 'River': 'current,bridge,fishing,banks', 'Lake': 'calm,rowing,freshwater,shore',
  'Desert': 'dunes,camel,dry,oasis', 'Savanna': 'lions,grass,safari,giraffes', 'Market': 'stalls,vendor,vegetables,haggle', 'Supermarket': 'trolley,checkout,aisles,groceries',
  'Cinema': 'screen,popcorn,hall,showing', 'Theatre': 'stage,curtain,actors,play', 'Stadium': 'fans,pitch,match,stands', 'Gym': 'sport,hall,mats,workout',
  'Island': 'surrounded,sea,beach,boat', 'Peninsula': 'almost,strip,land,coast', 'Castle': 'towers,king,moat,fort', 'Palace': 'luxurious,crown,wealth,guards',
  'Doctor': 'consultation,prescription,stethoscope,surgery', 'Nurse': 'injection,care,scrubs,hospital', 'Teacher': 'class,board,lesson,marks', 'Principal': 'office,boss,school,staff',
  'Police officer': 'uniform,siren,investigation,law', 'Soldier': 'army,helmet,barracks,war', 'Pilot': 'cockpit,race,fly,helmet', 'Driver': 'wheel,road,drive,passengers',
  'Cook': 'apron,stove,recipes,restaurant', 'Baker': 'flour,oven,dawn,loaf', 'Singer': 'mic,voice,stage,chorus', 'Dancer': 'steps,rhythm,stage,choreography',
  'King': 'crown,throne,realm,queen', 'President': 'election,country,speech,palace', 'Thief': 'burglary,night,police,sack', 'Pirate': 'eyepatch,treasure,ship,parrot',
  'Wizard': 'potion,curse,wand,cauldron', 'Magician': 'trick,hat,rabbit,show', 'Firefighter': 'blaze,hose,helmet,red truck', 'Paramedic': 'emergency,stretcher,siren,transport',
  'Lawyer': 'plea,gown,client,trial', 'Judge': 'court,gavel,verdict,law', 'Photographer': 'lens,flash,click,portrait', 'Painter': 'brush,canvas,palette,picture',
  'Football': 'ball,goal,world cup,boots', 'Rugby': 'oval,scrum,try,tackle', 'Basketball': 'hoop,dribble,dunk,orange', 'Volleyball': 'net,spike,sand,pass',
  'Tennis': 'racket,ball,court,set', 'Table tennis': 'table,small ball,paddle,bounce', 'Swimming': 'pool,crawl,goggles,lengths', 'Diving': 'tank,depths,mask,coral',
  'Boxing': 'gloves,ring,punches,round', 'Judo': 'mat,kimono,belt,throw', 'Guitar': 'strings,chords,strum,neck', 'Violin': 'bow,strings,orchestra,chin',
  'Piano': 'keys,keyboard,black,white', 'Organ': 'church,pipes,pedals,mass', 'Drum': 'sticks,beat,skin,roll', 'Bongo': 'percussion,hands,afro,rhythm',
  'Movie': 'cinema,actor,director,scenes', 'TV series': 'episodes,seasons,platform,sequel', 'Novel': 'chapters,author,fiction,writer', 'Comic book': 'bubbles,drawings,panels,hero',
  'Chess': 'king,pawn,board,checkmate', 'Checkers': 'pieces,board,jump,black', 'Karaoke': 'mic,lyrics,sing,party', 'Concert': 'stage,crowd,artist,ticket',
  'Marathon': 'long,race,endurance,runners', 'Sprint': 'fast,short,finish,speed', 'Camping': 'tent,fire,nature,sleeping bag', 'Hiking': 'trail,walk,boots,mountain',
  'Sun': 'day,hot,rays,rise', 'Moon': 'night,crescent,full,phases', 'Rain': 'drops,umbrella,clouds,puddle', 'Storm': 'lightning,thunder,rumble,dark',
  'Snow': 'flakes,winter,white,sled', 'Ice': 'frozen,cold,cube,slippery', 'Wind': 'blow,breeze,sail,gust', 'Hurricane': 'violent,sea,damage,eye',
  'Fire': 'flames,burn,wood,heat', 'Smoke': 'black,chimney,cigarette,rise', 'Flower': 'petals,bouquet,scent,spring', 'Tree': 'trunk,leaves,roots,shade',
  'Rose': 'thorns,red,love,bouquet', 'Tulip': 'bulb,netherlands,spring,garden', 'Diamond': 'ring,sparkle,hard,carats', 'Crystal': 'glass,transparent,chandelier,fragile',
  'Gold': 'ingot,yellow,precious,jewellery', 'Silver': 'grey,metal,coin,medal', 'Sand': 'beach,grains,dune,castle', 'Soil': 'planet,ground,garden,plough',
  'Star': 'sky,night,shine,shooting', 'Planet': 'orbit,system,universe,Mars', 'Cloud': 'sky,white,vapour,rain', 'Fog': 'visibility,morning,thick,grey',
  'Wedding': 'dress,ring,town hall,guests', 'Birthday': 'candles,cake,year,presents', 'Gift': 'parcel,paper,christmas,give', 'Surprise': 'unexpected,shout,party,reaction',
  'Dream': 'sleep,imaginary,night,rest', 'Nightmare': 'fear,night,wake,sweat',
};
const split = o => { const r = {}; for (const k of Object.keys(o)) r[k] = o[k].split(','); return r; };
const HW = require('./undercover-words-halloween');
const BANK = { fr: split({ ...HW.fr, ...FR }), en: split({ ...HW.en, ...EN }) };
// Mots vagues pour Mr. White quand il n'a rien d'utile a imiter.
const VAGUE = {
  fr: ['commun', 'utile', 'quotidien', 'connu', 'simple', 'classique', 'populaire', 'courant', 'agréable', 'habituel', 'pratique', 'naturel'],
  en: ['common', 'useful', 'daily', 'known', 'simple', 'classic', 'popular', 'usual', 'pleasant', 'handy', 'natural', 'normal'],
};
// Prenoms, caracteres et portraits des robots (options gratuites du portrait, voir portrait.js).
const BOTS = [
  { name: 'Awa',   mood: 'careful', portrait: { face: 1, skin: 13, brows: 1, eyes: 1, mouth: 0, marks: 2, beard: 0, hair: 2,  hairCol: 0, acc: 4, top: 0, topCol: 3, bg: 2, frame: 0 } },
  { name: 'Koffi', mood: 'chatty',  portrait: { face: 0, skin: 14, brows: 2, eyes: 1, mouth: 1, marks: 0, beard: 3, hair: 5,  hairCol: 0, acc: 3, top: 3, topCol: 1, bg: 4, frame: 3 } },
  { name: 'Mina',  mood: 'sharp',   portrait: { face: 3, skin: 6,  brows: 3, eyes: 4, mouth: 5, marks: 3, beard: 0, hair: 6,  hairCol: 2, acc: 0, top: 5, topCol: 4, bg: 6, frame: 5 } },
  { name: 'Théo',  mood: 'careful', portrait: { face: 2, skin: 3,  brows: 0, eyes: 5, mouth: 2, marks: 0, beard: 1, hair: 0,  hairCol: 5, acc: 7, top: 1, topCol: 0, bg: 1, frame: 0 } },
  { name: 'Sika',  mood: 'chatty',  portrait: { face: 1, skin: 12, brows: 1, eyes: 2, mouth: 3, marks: 1, beard: 0, hair: 4,  hairCol: 1, acc: 0, top: 0, topCol: 5, bg: 3, frame: 3 } },
  { name: 'Ben',   mood: 'sharp',   portrait: { face: 4, skin: 8,  brows: 3, eyes: 6, mouth: 5, marks: 4, beard: 2, hair: 11, hairCol: 1, acc: 0, top: 3, topCol: 6, bg: 5, frame: 5 } },
  { name: 'Léa',   mood: 'careful', portrait: { face: 3, skin: 2,  brows: 1, eyes: 0, mouth: 0, marks: 2, beard: 0, hair: 7,  hairCol: 8, acc: 4, top: 0, topCol: 2, bg: 7, frame: 0 } },
  { name: 'Ali',   mood: 'chatty',  portrait: { face: 2, skin: 5,  brows: 2, eyes: 3, mouth: 1, marks: 0, beard: 3, hair: 3,  hairCol: 0, acc: 3, top: 1, topCol: 7, bg: 0, frame: 3 } },
  { name: 'Zoé',   mood: 'sharp',   portrait: { face: 0, skin: 0,  brows: 0, eyes: 2, mouth: 5, marks: 2, beard: 0, hair: 1,  hairCol: 3, acc: 7, top: 5, topCol: 1, bg: 6, frame: 5 } },
];
// Repliques du debat. `mood` : reserve a un caractere. {n} : nom de la cible.
const LINES = {
  fr: {
    accuse: ['Je trouve que {n} est vague.', '{n}, ton indice ne m\'a pas convaincu.', 'Franchement, {n} me semble louche.', 'Pour moi c\'est {n}.', '{n} a dit ça trop vite, non ?', 'L\'indice de {n} ne colle à rien.', 'Je garde un oeil sur {n}.', '{n}, tu peux m\'expliquer ton indice ?', 'Moi je vote {n}, ça sent l\'infiltré.', 'Pourquoi {n} reste si calme ?', '{n} répète ce que les autres disent, non ?', 'Je ne sens pas {n} sur ce coup.', 'Quelque chose cloche chez {n}.', 'Si je devais parier, ce serait {n}.', 'Avec {n}, les indices ne s\'emboîtent pas.', 'Et si c\'était {n} depuis le début ?'],
    defend: ['Moi je suis sûr de mon mot.', 'Je ne suis pas l\'infiltré, promis.', 'Mon indice était clair, non ?', 'Pourquoi tout le monde me regarde ?', 'J\'ai joué franc, je n\'ai rien à cacher.', 'Mon mot est solide, vous pouvez me croire.', 'Doucement, je suis dans le bon camp.', 'Si j\'étais l\'infiltré, je serais plus discret.', 'Vous perdez du temps avec moi.', 'Relisez mon indice, il colle bien.'],
    neutral: ['Difficile cette fois...', 'Je ne sais pas trop qui croire.', 'Les indices se ressemblent beaucoup.', 'On y va doucement.', 'Je relis tous les indices.', 'Ce tour est serré.', 'Je n\'ai pas encore d\'idée claire.', 'Quelqu\'un a un soupçon ?', 'Il faut comparer les indices un par un.', 'On dirait que tout le monde est proche du mot.', 'Hmm, je réfléchis.', 'Il y a un détail qui m\'échappe.'],
    chatty: ['Bon, on fait le tour des soupçons ?', 'Je parie qu\'on va se tromper encore !', 'Allez, un peu d\'ambiance, qui parle ?', 'Je sens que ça va être serré, haha.', 'J\'adore ce moment du débat.'],
    sharp: ['Les faits : un indice ne colle pas.', 'Je compare, et il y a une faille.', 'Un seul indice sort du lot.', 'Ça se joue sur un détail.'],
    careful: ['Prenons le temps avant de voter.', 'Pas de précipitation, d\'accord ?', 'Je préfère attendre un autre indice.', 'Je ne veux accuser personne à tort.'],
  },
  en: {
    accuse: ['I find {n} a bit vague.', '{n}, your clue did not convince me.', 'Honestly, {n} looks suspicious.', 'For me it is {n}.', '{n} said that too fast, no?', 'The clue from {n} fits nothing.', 'I am keeping an eye on {n}.', '{n}, can you explain your clue?', 'I vote {n}, smells like the infiltrator.', 'Why is {n} so calm?', '{n} is just repeating what the others said.', 'I am not feeling {n} this round.', 'Something is off with {n}.', 'If I had to bet, it would be {n}.', 'With {n}, the clues do not fit together.', 'What if it was {n} all along?'],
    defend: ['I am sure about my word.', 'I am not the infiltrator, promise.', 'My clue was clear, right?', 'Why is everyone looking at me?', 'I played it straight, nothing to hide.', 'My word is solid, you can trust me.', 'Easy, I am on the right side.', 'If I were the infiltrator I would be quieter.', 'You are wasting time on me.', 'Read my clue again, it fits.'],
    neutral: ['Tough one this time...', 'Not sure who to trust.', 'The clues look a lot alike.', 'Let us go slowly.', 'I am rereading all the clues.', 'This round is tight.', 'I have no clear idea yet.', 'Does anyone have a suspicion?', 'We should compare the clues one by one.', 'Everyone seems close to the word.', 'Hmm, thinking.', 'There is a detail I am missing.'],
    chatty: ['So, shall we go around the suspicions?', 'I bet we will get it wrong again!', 'Come on, some life here, who talks?', 'This is going to be tight, haha.', 'I love this part of the debate.'],
    sharp: ['The facts: one clue does not fit.', 'I compared, and there is a flaw.', 'Only one clue stands out.', 'It comes down to one detail.'],
    careful: ['Let us take our time before voting.', 'No rush, okay?', 'I would rather wait for another clue.', 'I do not want to accuse anyone wrongly.'],
  },
};
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const rnd = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const bankOf = (l, w) => (BANK[l] && BANK[l][w]) || [];

// Meilleur mot (de la langue) qui explique le plus d'indices deja donnes ; sert au bluff et a la devinette de Mr. White.
function bestGuess(l, clues, exclude) {
  const set = clues.map(norm).filter(Boolean); let best = null, bs = 0;
  for (const w of Object.keys(BANK[l])) {
    if (exclude && exclude.includes(norm(w))) continue;
    const n = BANK[l][w].reduce((a, c) => a + (set.includes(norm(c)) ? 1 : 0), 0);
    if (n > bs) { bs = n; best = w; }
  }
  return best;
}
// Indice d'un robot : un mot lie a SON mot, jamais le mot lui-meme, jamais deja dit.
// Sans mot (Mr. White) : il imite le meilleur mot devine, sinon un mot vague.
function clueFor(l, own, said) {
  const used = said.map(norm), ok = c => !used.includes(norm(c)) && (!own || norm(c) !== norm(own));
  let pool = own ? bankOf(l, own).filter(ok) : [];
  if (!own) { const g = bestGuess(l, said); if (g) pool = bankOf(l, g).filter(ok); }
  if (!pool.length) pool = VAGUE[l].filter(ok);
  return rnd(pool.length ? pool : VAGUE[l]);
}
// Vote : on soupconne ceux dont l'indice ne colle a rien de ce que je connais, ceux qui n'ont rien dit,
// et on suit un peu le debat. Le caractere dose le hasard.
function chooseVote(l, bot, ownWord, targets, clues, chat) {
  const mine = ownWord ? bankOf(l, ownWord).map(norm) : [];
  const score = {};
  targets.forEach(t => {
    let s = Math.random() * (bot.mood === 'careful' ? 0.6 : bot.mood === 'chatty' ? 1.4 : 1);
    const c = clues[t] || [];
    if (!c.length || c.every(x => !x)) s += 1.5;
    else if (mine.length && !c.some(x => mine.includes(norm(x)))) s += 0.9;
    if (chat[t]) s += 0.4 * chat[t];                 // nombre d'accusations recues
    score[t] = s;
  });
  if (bot.mood === 'sharp') { const hum = targets.filter(t => !String(t).startsWith('bot')); if (hum.length && Math.random() < .3) score[rnd(hum)] += 1.2; }
  return targets.slice().sort((a, b) => score[b] - score[a])[0];
}
// `used` : ensemble des repliques deja dites dans la partie, pour ne pas se repeter. `mood` ajoute les repliques du caractere.
function sayLine(l, kind, name, used, mood) {
  let pool = LINES[l][kind].concat(kind === 'neutral' && mood && LINES[l][mood] ? LINES[l][mood] : []);
  let fresh = used ? pool.filter(x => !used.has(x)) : pool;
  if (!fresh.length) { if (used) pool.forEach(x => used.delete(x)); fresh = pool; }
  const line = rnd(fresh); if (used) used.add(line);
  return line.replace('{n}', name || '');
}

module.exports = { BOTS, BANK, VAGUE, clueFor, chooseVote, bestGuess, sayLine, shuffle, norm };
