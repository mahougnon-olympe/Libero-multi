// Paquet « Monstres » d'Undercover (31 octobre) : memes paires que undercover-words.js
// [civils FR, undercover FR, civils EN, undercover EN], plus les indices des robots (4 par mot, FR et EN).
const pairs = [
  ['Vampire', 'Zombie', 'Vampire', 'Zombie'], ['Fantôme', 'Esprit', 'Ghost', 'Spirit'], ['Sorcière', 'Magicienne', 'Witch', 'Wizard'],
  ['Citrouille', 'Courge', 'Pumpkin', 'Squash'], ['Squelette', 'Momie', 'Skeleton', 'Mummy'], ['Loup-garou', 'Chauve-souris', 'Werewolf', 'Bat'],
  ['Cimetière', 'Église', 'Cemetery', 'Church'], ['Araignée', 'Scorpion', 'Spider', 'Scorpion'], ['Chaudron', 'Marmite', 'Cauldron', 'Pot'],
  ['Balai', 'Aspirateur', 'Broom', 'Vacuum'], ['Château hanté', 'Manoir', 'Haunted castle', 'Mansion'], ['Bonbon', 'Chewing-gum', 'Candy', 'Chewing gum'],
];
const fr = {
  'Vampire': 'dents,cape,sang,cercueil', 'Zombie': 'mort-vivant,lent,cerveau,cimetière', 'Fantôme': 'drap,hanter,chaîne,transparent', 'Esprit': 'invisible,âme,médium,planer',
  'Sorcière': 'chapeau,balai,potion,verrue', 'Magicienne': 'baguette,lapin,tour,spectacle', 'Citrouille': 'orange,lanterne,creuser,soupe', 'Courge': 'potager,chair,automne,gratin',
  'Squelette': 'os,crâne,côtes,anatomie', 'Momie': 'bandelettes,Égypte,pyramide,sarcophage', 'Loup-garou': 'pleine lune,poils,hurler,griffes', 'Chauve-souris': 'grotte,ailes,nuit,tête en bas',
  'Cimetière': 'tombes,silence,fleurs,croix', 'Église': 'cloche,messe,clocher,prière', 'Araignée': 'toile,huit pattes,fil,mouche', 'Scorpion': 'dard,désert,pinces,venin',
  'Chaudron': 'potion,feu,bouillir,noir', 'Marmite': 'cuisine,couvercle,soupe,anses', 'Balai': 'ménage,manche,poussière,sorcière', 'Aspirateur': 'bruit,sac,prise,tapis',
  'Château hanté': 'fantômes,sombre,couloirs,grincer', 'Manoir': 'riche,grand,parc,domaine', 'Bonbon': 'sucré,emballage,enfants,sucette', 'Chewing-gum': 'mâcher,bulle,menthe,coller',
};
const en = {
  'Vampire': 'fangs,cape,blood,coffin', 'Zombie': 'undead,slow,brains,graveyard', 'Ghost': 'sheet,haunt,chains,see-through', 'Spirit': 'invisible,soul,medium,float',
  'Witch': 'hat,broom,potion,wart', 'Wizard': 'wand,spell,beard,tower', 'Pumpkin': 'orange,lantern,carve,soup', 'Squash': 'garden,flesh,autumn,roast',
  'Skeleton': 'bones,skull,ribs,anatomy', 'Mummy': 'bandages,Egypt,pyramid,tomb', 'Werewolf': 'full moon,fur,howl,claws', 'Bat': 'cave,wings,night,upside down',
  'Cemetery': 'graves,silence,flowers,cross', 'Church': 'bell,mass,steeple,prayer', 'Spider': 'web,eight legs,thread,fly', 'Scorpion': 'sting,desert,claws,venom',
  'Cauldron': 'potion,fire,boil,black', 'Pot': 'kitchen,lid,soup,handles', 'Broom': 'sweep,handle,dust,witch', 'Vacuum': 'noise,bag,plug,carpet',
  'Haunted castle': 'ghosts,dark,corridors,creak', 'Mansion': 'rich,big,garden,estate', 'Candy': 'sweet,wrapper,children,lollipop', 'Chewing gum': 'chew,bubble,mint,stick',
};
module.exports = { pairs, fr, en };
