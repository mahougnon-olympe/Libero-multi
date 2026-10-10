/* Portrait dessine (photo de profil sans vraie photo).
   Moteur partage : app.js (editeur, affichage) l'utilise via window.LiberoPortrait.
   Chaque option est un index ; les index listes dans `lock` sont des cosmetiques
   payants (id `pt-<cle>-<index>`, prix PT_PRICE) que le serveur verifie aussi. */
(function () {
  const SKIN=['#fbe6d4','#f6dcc4','#efc7a3','#e8b98f','#d9a57c','#cf9467','#c48a5e','#b07447','#a8693f','#96603a','#8a5634','#7a4a2a','#6b3f24','#56321c','#4a2a17','#33200f'];
  const HAIRCOL=['#0f0b09','#1d1612','#3b2417','#4a2e1c','#6b4226','#8a5a2b','#a0522d','#c46a2c','#d9b061','#efd99a','#9aa0a6','#eef0f2','#c33b3b','#3d64b8','#e07aa8','#7a4fc0','#2f8a55','#e8742c'];
  const TOPCOL=['#3d64b8','#d23a4f','#2f8a55','#e0a800','#2b2b2b','#f4f4f0','#7a4fc0','#e8742c'];
  const BGS=[
    {n:['Surligneur','Highlighter'],c:'#fff27a'},{n:['Ciel','Sky'],c:'#bfe3ff'},{n:['Buvard','Blotting paper'],c:'#ffd0d8'},{n:['Menthe','Mint'],c:'#c9efc9'},
    {n:['Lilas','Lilac'],c:'#e5d7ff'},{n:['Feuille blanche','White sheet'],c:'#ffffff'},{n:['Page Seyès','Ruled page'],c:'#fdfdf9',p:'seyes'},
    {n:['Petits carreaux','Graph paper'],c:'#fdfdf9',p:'quad'},{n:['Ardoise','Slate'],c:'#1f2a26',p:'slate'},{n:['Ciel étoilé à la craie','Chalk starry sky'],c:'#1c2440',p:'stars'},
    {n:['Pagne wax','Wax print'],c:'#e8742c',p:'wax'}
  ];
  const DEF={face:0,skin:10,brows:1,eyes:0,mouth:0,marks:0,beard:0,hair:1,hairCol:1,acc:0,top:0,topCol:0,bg:0,frame:0};
  const L=(fr,en)=>[fr,en];
  const OPTS=[
    {g:'face',k:'face',t:L('Forme du visage','Face shape'),v:[L('Rond','Round'),L('Ovale','Oval'),L('Carré','Square'),L('Cœur','Heart'),L('Long','Long')]},
    {g:'face',k:'skin',t:L('Teint','Skin tone'),sw:SKIN},
    {g:'face',k:'brows',t:L('Sourcils','Eyebrows'),v:[L('Droits','Straight'),L('Arqués','Arched'),L('Épais','Thick'),L('Froncés','Frowning')]},
    {g:'face',k:'eyes',t:L('Yeux','Eyes'),v:[L('Ouverts','Open'),L('Rieurs','Smiling'),L("Clin d'œil",'Wink'),L('Étonnés','Surprised'),L('Endormis','Sleepy'),L('Lunettes rondes','Round glasses'),L('Lunettes carrées','Square glasses'),L('Lunettes de soleil','Sunglasses')],lock:[7]},
    {g:'face',k:'mouth',t:L('Bouche','Mouth'),v:[L('Sourire','Smile'),L('Grand rire','Big laugh'),L('Calme','Calm'),L('Langue tirée','Tongue out'),L('Bouche en O','O mouth'),L('Sourire en coin','Smirk'),L('Dents du bonheur','Gap teeth')],lock:[6]},
    {g:'face',k:'marks',t:L('Détails','Details'),v:[L('Aucun','None'),L('Joues roses','Rosy cheeks'),L('Taches de rousseur','Freckles'),L('Grain de beauté','Beauty mark'),L('Pansement','Plaster'),L('Paillettes de craie','Chalk glitter')],lock:[5]},
    {g:'face',k:'beard',t:L('Barbe','Beard'),v:[L('Aucune','None'),L('Moustache','Moustache'),L('Bouc','Goatee'),L('Barbe courte','Short beard'),L('Collier','Chin strap')]},
    {g:'hair',k:'hair',t:L('Coiffure','Hairstyle'),v:[L('Ras','Buzz cut'),L('Afro','Afro'),L('Tresses','Braids'),L('Locks','Locs'),L('Bantu knots','Bantu knots'),L('Dégradé','Fade'),L('Queue de cheval','Ponytail'),L('Couettes','Bunches'),L('Crête','Mohawk'),L('Foulard (gèlè)','Headwrap (gele)'),L('Chignon','Bun'),L('Chauve','Bald')],lock:[8,9,10]},
    {g:'hair',k:'hairCol',t:L('Couleur des cheveux','Hair colour'),sw:HAIRCOL,lock:[12,13,14,15,16,17]},
    {g:'outfit',k:'top',t:L('Haut','Top'),v:[L('T-shirt','T-shirt'),L('Uniforme kaki','Khaki uniform'),L('Maillot de foot','Football shirt'),L('Sweat à capuche','Hoodie'),L('Chemise en pagne','Wax shirt'),L('Blouse de labo','Lab coat'),L('Veste de champion','Champion jacket')],lock:[2,4,6]},
    {g:'outfit',k:'topCol',t:L('Couleur du haut','Top colour'),sw:TOPCOL},
    {g:'outfit',k:'acc',t:L('Accessoire','Accessory'),v:[L('Aucun','None'),L('Casquette','Cap'),L('Bonnet','Beanie'),L('Bandeau','Headband'),L('Nœud','Bow'),L('Écouteurs','Headphones'),L("Boucles d'oreilles",'Earrings'),L("Crayon sur l'oreille",'Pencil behind the ear'),L('Bob','Bucket hat'),L('Couronne','Crown')],lock:[1,2,5,6,8,9]},
    {g:'decor',k:'bg',t:L('Fond','Background'),sw:BGS.map(b=>b.c),names:BGS.map(b=>b.n),pat:BGS.map(b=>b.p||''),lock:[8,9,10]},
    {g:'decor',k:'frame',t:L('Cadre','Frame'),v:[L("Photo d'identité",'ID photo'),L('Polaroïd','Polaroid'),L('Timbre','Stamp'),L('Ruban adhésif','Tape'),L('Cadre doré','Gold frame'),L('Étiquette de cahier','Notebook label')],lock:[1,2,4]}
  ];
  const GROUPS=[['face',L('Visage','Face')],['hair',L('Cheveux','Hair')],['outfit',L('Tenue','Outfit')],['decor',L('Décor','Setting')]];
  const PT_PRICE=40;
  let uid=0;
  function svg(st){
    const id='p'+(uid++); const ink='#22252b'; const sk=SKIN[st.skin]; const hc=HAIRCOL[st.hairCol]; const tc=TOPCOL[st.topCol];
    const W=`stroke="${ink}" stroke-width="2.2"`;
    const bgd=BGS[st.bg];
    const pat={
      seyes:`<pattern id="${id}b" width="100" height="16" patternUnits="userSpaceOnUse"><path d="M0 15.5h100" stroke="rgba(80,130,205,.55)"/><path d="M0 3.5h100M0 7.5h100M0 11.5h100" stroke="rgba(120,160,220,.25)"/></pattern>`,
      quad:`<pattern id="${id}b" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M8 0V8H0" fill="none" stroke="rgba(80,130,205,.35)"/></pattern>`,
      slate:`<pattern id="${id}b" width="100" height="100" patternUnits="userSpaceOnUse"><rect width="100" height="100" fill="#1f2a26"/><path d="M8 20q20-6 40 0M58 80q16-5 34 2M6 70q10-3 20 0" stroke="rgba(238,241,234,.22)" stroke-width="3" fill="none"/></pattern>`,
      stars:`<pattern id="${id}b" width="50" height="50" patternUnits="userSpaceOnUse"><rect width="50" height="50" fill="#1c2440"/><path d="M10 10l1.5 3.5 3.5 .5-2.6 2.4.7 3.6-3.1-1.8-3.1 1.8.7-3.6-2.6-2.4 3.5-.5zM36 30l1 2.4 2.4.3-1.8 1.6.5 2.4-2.1-1.2-2.1 1.2.5-2.4-1.8-1.6 2.4-.3z" fill="none" stroke="rgba(255,241,170,.85)" stroke-width="1"/><circle cx="40" cy="8" r="1" fill="#fff"/><circle cx="18" cy="40" r="1" fill="#fff"/></pattern>`,
      wax:`<pattern id="${id}b" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="#e8742c"/><circle cx="10" cy="10" r="6" fill="#173a8a"/><circle cx="10" cy="10" r="3" fill="#ffe169"/><circle cx="0" cy="0" r="3" fill="#2f8a55"/><circle cx="20" cy="20" r="3" fill="#2f8a55"/></pattern>`
    };
    const bgFill=bgd.p?`url(#${id}b)`:bgd.c;
    const defs=`<defs>${bgd.p?pat[bgd.p]:''}<pattern id="${id}w" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="${tc}"/><circle cx="6" cy="6" r="3.6" fill="#ffe169" stroke="#22252b" stroke-width=".8"/><path d="M0 0l12 12" stroke="rgba(0,0,0,.25)"/></pattern><clipPath id="${id}c"><rect width="100" height="100"/></clipPath></defs>`;

    /* Cheveux de l'arriere */
    const back={
      1:`<circle cx="50" cy="44" r="31" fill="${hc}" ${W}/>`,
      2:`<path d="M26 50c0-20 11-28 24-28s24 8 24 28v36q-6 3-12 0v-20h-24v20q-6 3-12 0z" fill="${hc}" ${W}/><path d="M31 56v28M36 54v30M64 54v30M69 56v28" stroke="rgba(255,255,255,.22)" stroke-width="1.6" stroke-dasharray="3 2"/>`,
      3:`<path d="M25 50c0-20 11-29 25-29s25 9 25 29c2 14 0 26-3 36q-6 3-10 0v-20h-24v20q-4 3-10 0c-3-10-5-22-3-36z" fill="${hc}" ${W}/><path d="M30 58q-2 12 1 26M36 58q-2 12 1 26M64 58q2 12-1 26M70 58q2 12-1 26" stroke="rgba(255,255,255,.22)" stroke-width="1.6" fill="none"/>`,
      6:`<path d="M58 28c18-2 26 18 22 34-2 10-6 16-10 18-1-10 1-22-4-30-3-6-8-12-8-22z" fill="${hc}" ${W}/>`,
      10:`<circle cx="50" cy="18" r="10" fill="${hc}" ${W}/>`
    }[st.hair]||'';

    /* Haut */
    const torso=`M18 100c2-14 14-21 32-21s30 7 32 21z`;
    const tops=[
      `<path d="${torso}" fill="${tc}" ${W}/><path d="M41 80q9 8 18 0" fill="none" ${W}/>`,
      `<path d="${torso}" fill="#c8a46a" ${W}/><path d="M38 80l12 14 12-14M50 94v6" fill="none" ${W}/><path d="M38 80l-6 10 10-2M62 80l6 10-10-2" fill="#d8b77e" ${W}/><circle cx="50" cy="97" r="1.6" fill="${ink}"/>`,
      `<path d="${torso}" fill="${tc}" ${W}/><path d="M34 84v16M66 84v16" stroke="#fff" stroke-width="5"/><path d="M41 80q9 8 18 0" fill="none" ${W}/><text x="50" y="99" text-anchor="middle" font-family="Archivo Black" font-size="10" fill="#fff" stroke="${ink}" stroke-width=".6">10</text>`,
      `<path d="M30 82q20 14 40 0" fill="${tc}" ${W}/><path d="${torso}" fill="${tc}" ${W}/><path d="M36 82q14 12 28 0" fill="none" ${W}/><path d="M45 88v8M55 88v8" ${W}/>`,
      `<path d="${torso}" fill="url(#${id}w)" ${W}/><path d="M42 79l8 9 8-9" fill="#f4f4f0" ${W}/>`,
      `<path d="${torso}" fill="#f4f4f0" ${W}/><path d="M42 80l8 20 8-20" fill="${tc}" ${W}/><path d="M66 90h8v6h-8z" fill="none" ${W}/><path d="M70 86v6" stroke="#d23a4f" stroke-width="2"/>`,
      `<path d="${torso}" fill="${tc}" ${W}/><path d="M41 80l9 20 9-20" fill="#e0a800" ${W}/><circle cx="68" cy="92" r="4" fill="#e0a800" ${W}/><path d="M66 87l2-4 2 4" stroke="#d23a4f" stroke-width="2" fill="none"/>`
    ][st.top];

    const faceP=[
      `<ellipse cx="50" cy="56" rx="22" ry="24"/>`,
      `<ellipse cx="50" cy="56" rx="19" ry="26"/>`,
      `<rect x="29" y="33" width="42" height="46" rx="12"/>`,
      `<path d="M28 48c0-14 10-17 22-17s22 3 22 17c0 18-12 30-22 32-10-2-22-14-22-32z"/>`,
      `<rect x="31" y="31" width="38" height="50" rx="18"/>`
    ][st.face];
    const neck=`<path d="M43 74v8q7 4 14 0v-8" fill="${sk}" ${W}/>`;
    const ears=`<path d="M28 56q-5 0-4 6 1 5 6 3M72 56q5 0 4 6-1 5-6 3" fill="${sk}" stroke="${ink}" stroke-width="2"/>`;

    /* Cheveux de devant */
    const cap=`<path d="M29 48c0-17 9-24 21-24s21 7 21 24c-4-7-11-10-21-10s-17 3-21 10z" fill="${hc}" ${W}/>`;
    const front=[
      `<path d="M30 46c0-15 9-21 20-21s20 6 20 21c-4-6-10-8-20-8s-16 2-20 8z" fill="${hc}"/>`,
      `<path d="M28 50c0-16 10-22 22-22s22 6 22 22q-3-6-7-8-3 4-6 1-3 4-6 0-3 4-6 0-3 4-6-1-4 2-7 8z" fill="${hc}"/>`,
      `<path d="M28 50c0-18 10-26 22-26s22 8 22 26c-5-7-12-11-22-11s-17 4-22 11z" fill="${hc}" ${W}/><path d="M38 28v10M46 25v12M54 25v12M62 28v10" stroke="${ink}" stroke-width="1.2" opacity=".5"/>`,
      `<path d="M28 50c0-18 10-26 22-26s22 8 22 26c-5-7-12-11-22-11s-17 4-22 11z" fill="${hc}" ${W}/><path d="M38 28q-4 6-3 12M50 25v13M62 28q4 6 3 12" stroke="rgba(255,255,255,.22)" stroke-width="1.6" fill="none"/>`,
      `${cap}<g fill="${hc}" ${W}><circle cx="33" cy="33" r="6"/><circle cx="43" cy="24" r="6"/><circle cx="57" cy="24" r="6"/><circle cx="67" cy="33" r="6"/></g><path d="M38 38l5-14M62 38l-5-14" stroke="${ink}" stroke-width="1" opacity=".4"/>`,
      `<path d="M30 46v-9q0-12 20-12t20 12v9c-4-5-10-7-20-7s-16 2-20 7z" fill="${hc}" ${W}/><path d="M29 50v-6M71 50v-6" stroke="${hc}" stroke-width="3" opacity=".5"/><path d="M42 28l-3 7" stroke="#fff" stroke-width="1.4" opacity=".7"/>`,
      `${cap}<path d="M64 30q8-2 6 8" fill="none" stroke="#d23a4f" stroke-width="3"/>`,
      `<g fill="${hc}" ${W}><circle cx="25" cy="40" r="10"/><circle cx="75" cy="40" r="10"/></g>${cap}<path d="M30 36l4 6M70 36l-4 6" stroke="#d23a4f" stroke-width="3.4" stroke-linecap="round"/>`,
      `<path d="M29 48c0-17 9-24 21-24s21 7 21 24c-4-7-11-10-21-10s-17 3-21 10z" fill="${hc}" opacity=".45"/><path d="M40 42q0-30 10-34 10 4 10 34-5-3-10-3t-10 3z" fill="${hc}" ${W}/>`,
      `<path d="M24 46c-2-16 10-28 26-28s30 10 26 28c-8-6-16-8-26-8s-18 2-26 8z" fill="#e2485d" ${W}/><path d="M70 22c10-8 18-2 15 8-4-3-9-2-13 2" fill="#e0a800" stroke="${ink}" stroke-width="2"/><path d="M30 30c8 4 32 4 40 0M28 38c10 4 34 4 44 0" stroke="${ink}" stroke-width="1.4" fill="none"/><path d="M36 26l4 4M48 24l4 4M60 26l4 4" stroke="#ffe169" stroke-width="2"/>`,
      `<path d="M30 46c0-15 9-21 20-21s20 6 20 21c-4-6-10-8-20-8s-16 2-20 8z" fill="${hc}" ${W}/>`,
      `<path d="M36 36q6-4 10-2" stroke="#fff" stroke-width="2" opacity=".55" fill="none"/>`
    ][st.hair];

    const bc=st.hair===11?ink:hc;
    const brows=[
      `<path d="M37 48h9M54 48h9" stroke="${bc}" stroke-width="2.4" stroke-linecap="round"/>`,
      `<path d="M37 49q4.5-4 9 0M54 49q4.5-4 9 0" stroke="${bc}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
      `<path d="M36 48h10M54 48h10" stroke="${bc}" stroke-width="4" stroke-linecap="round"/>`,
      `<path d="M37 46l9 3M63 46l-9 3" stroke="${bc}" stroke-width="2.6" stroke-linecap="round"/>`
    ][st.brows];
    const eyes=[
      `<circle cx="42" cy="55" r="2.6" fill="${ink}"/><circle cx="58" cy="55" r="2.6" fill="${ink}"/>`,
      `<path d="M38 56q4-4 8 0M54 56q4-4 8 0" stroke="${ink}" stroke-width="2.2" fill="none"/>`,
      `<circle cx="42" cy="55" r="2.6" fill="${ink}"/><path d="M54 56q4-4 8 0" stroke="${ink}" stroke-width="2.2" fill="none"/>`,
      `<circle cx="42" cy="55" r="4" fill="#fff" ${W}/><circle cx="58" cy="55" r="4" fill="#fff" ${W}/><circle cx="42" cy="55" r="1.6" fill="#22252b"/><circle cx="58" cy="55" r="1.6" fill="#22252b"/>`,
      `<path d="M38 55q4 3 8 0M54 55q4 3 8 0" stroke="${ink}" stroke-width="2.2" fill="none"/>`,
      `<circle cx="42" cy="55" r="6" fill="rgba(255,255,255,.35)" ${W}/><circle cx="58" cy="55" r="6" fill="rgba(255,255,255,.35)" ${W}/><path d="M48 55h4M36 54l-6-2M64 54l6-2" ${W}/><circle cx="42" cy="55" r="1.8" fill="${ink}"/><circle cx="58" cy="55" r="1.8" fill="${ink}"/>`,
      `<rect x="35" y="50" width="13" height="10" rx="2" fill="rgba(255,255,255,.35)" ${W}/><rect x="52" y="50" width="13" height="10" rx="2" fill="rgba(255,255,255,.35)" ${W}/><path d="M48 54h4M35 53l-6-1M65 53l6-1" ${W}/><circle cx="42" cy="55" r="1.8" fill="${ink}"/><circle cx="58" cy="55" r="1.8" fill="${ink}"/>`,
      `<path d="M34 51h14l-2 9h-10zM52 51h14l-2 9h-10z" fill="#22252b" ${W}/><path d="M48 53h4M34 52l-5-1M66 52l5-1" ${W}/><path d="M37 53l4 0" stroke="#fff" stroke-width="1.4" opacity=".7"/>`
    ][st.eyes];
    const nose=`<path d="M50 58v5l-2 1" stroke="${ink}" stroke-width="1.8" fill="none"/>`;
    const mouth=[
      `<path d="M42 67q8 7 16 0" stroke="${ink}" stroke-width="2.4" fill="none"/>`,
      `<path d="M41 65q9 12 18 0z" fill="#fff" ${W}/>`,
      `<path d="M44 68h12" stroke="${ink}" stroke-width="2.4"/>`,
      `<path d="M42 66q8 6 16 0" stroke="${ink}" stroke-width="2.4" fill="none"/><path d="M47 69q3 7 6 0" fill="#e2485d" stroke="${ink}" stroke-width="1.8"/>`,
      `<ellipse cx="50" cy="68" rx="3.2" ry="4" fill="#5a1a22" ${W}/>`,
      `<path d="M43 68q8 2 14-4" stroke="${ink}" stroke-width="2.4" fill="none"/>`,
      `<path d="M41 65q9 12 18 0z" fill="#fff" ${W}/><path d="M50 65v4" stroke="${ink}" stroke-width="1.6"/>`
    ][st.mouth];
    const marks=['',
      `<circle cx="36" cy="63" r="4.2" fill="#ff8e8e" opacity=".55"/><circle cx="64" cy="63" r="4.2" fill="#ff8e8e" opacity=".55"/>`,
      `<g fill="#8a4b2a" opacity=".7"><circle cx="37" cy="61" r=".9"/><circle cx="40" cy="63" r=".9"/><circle cx="35" cy="64" r=".9"/><circle cx="63" cy="61" r=".9"/><circle cx="60" cy="63" r=".9"/><circle cx="65" cy="64" r=".9"/><circle cx="48" cy="60" r=".8"/><circle cx="52" cy="60" r=".8"/></g>`,
      `<circle cx="61" cy="66" r="1.4" fill="${ink}"/>`,
      `<g transform="rotate(-25 38 64)"><rect x="32" y="61.5" width="12" height="5" rx="2" fill="#f2d2a6" stroke="${ink}" stroke-width="1.2"/><path d="M36 62.5v3M40 62.5v3" stroke="${ink}" stroke-width=".7"/></g>`,
      `<g stroke="#fff" stroke-width="1.3" stroke-linecap="round"><path d="M33 62l2-2M64 61l3 1M66 66l1 2M35 67l-2 1"/></g><path d="M68 44l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill="#ffe169" stroke="${ink}" stroke-width=".8"/>`
    ][st.marks];
    const beard=['',
      `<path d="M41 64q4-4 9-1 5-3 9 1-4 3-9 1-5 2-9-1z" fill="${hc}" stroke="${ink}" stroke-width="1.4"/>`,
      `<path d="M44 73q6 9 12 0q-6 3-12 0z" fill="${hc}" stroke="${ink}" stroke-width="1.6"/>`,
      `<path d="M29 58c0 15 9 23 21 23s21-8 21-23c-3 8-9 12-14 12q-7-4-14 0c-5 0-11-4-14-12z" fill="${hc}" stroke="${ink}" stroke-width="1.8" opacity=".92"/>`,
      `<path d="M30 60c2 14 10 20 20 20s18-6 20-20c-2 8-8 14-20 14s-18-6-20-14z" fill="${hc}" stroke="${ink}" stroke-width="1.6"/><path d="M42 64q4-3 8-1 4-2 8 1" stroke="${hc}" stroke-width="3" fill="none"/>`
    ][st.beard];
    const acc=['',
      `<path d="M27 42c2-14 12-20 23-20s21 6 23 20z" fill="${tc}" ${W}/><path d="M50 42h28c3 0 3 4 0 5H52" fill="${tc}" ${W}/><circle cx="50" cy="22" r="2" fill="${ink}"/>`,
      `<path d="M27 46c0-18 10-26 23-26s23 8 23 26z" fill="${tc}" ${W}/><rect x="26" y="40" width="48" height="8" rx="3" fill="${tc}" ${W}/><path d="M30 41v6M36 41v6M42 41v6M48 41v6M54 41v6M60 41v6M66 41v6" stroke="${ink}" stroke-width="1" opacity=".45"/><circle cx="50" cy="18" r="5" fill="#f4f4f0" ${W}/>`,
      `<path d="M27 42q23-7 46 0v6q-23-7-46 0z" fill="${tc}" ${W}/>`,
      `<path d="M58 30l10-6v12zM58 30l-10-6v12z" fill="#e2485d" ${W}/><circle cx="58" cy="30" r="2.6" fill="#e2485d" ${W}/>`,
      `<path d="M27 56c0-22 10-32 23-32s23 10 23 32" stroke="${ink}" stroke-width="3" fill="none"/><rect x="21" y="50" width="9" height="15" rx="4" fill="${tc}" stroke="${ink}" stroke-width="2"/><rect x="70" y="50" width="9" height="15" rx="4" fill="${tc}" stroke="${ink}" stroke-width="2"/>`,
      `<circle cx="27" cy="67" r="3.5" fill="#e0a800" stroke="${ink}" stroke-width="1.8"/><circle cx="73" cy="67" r="3.5" fill="#e0a800" stroke="${ink}" stroke-width="1.8"/>`,
      ``,
      `<path d="M30 40c0-14 9-19 20-19s20 5 20 19z" fill="${tc}" ${W}/><path d="M22 42q28-6 56 0l-2 5q-26-5-52 0z" fill="${tc}" ${W}/>`,
      `<path d="M34 30l4-12 7 8 5-12 5 12 7-8 4 12z" fill="#e0a800" ${W}/><circle cx="50" cy="22" r="1.8" fill="#d23a4f"/>`
    ][st.acc];
    const bald=st.hair===11;
    return `<svg viewBox="0 0 100 100" class="pt-svg" aria-hidden="true">${defs}<g clip-path="url(#${id}c)"><rect width="100" height="100" fill="${bgFill}"/>
      ${back}${tops}${neck}${st.acc===7?`<g transform="translate(-2 0)"><path d="M74 38.6h5.6v-2.4q0-2.6-2.8-2.6t-2.8 2.6z" fill="#f29bb0" stroke="${ink}" stroke-width="1.4"/><rect x="74" y="38.6" width="5.6" height="3" fill="#b9bec6" stroke="${ink}" stroke-width="1.3"/><path d="M74 41.6h5.6v26H74z" fill="#e0a800" stroke="${ink}" stroke-width="1.5"/><path d="M75.9 41.6v26M77.7 41.6v26" stroke="#b8860b" stroke-width=".8"/><path d="M74 67.6h5.6l-2.8 6z" fill="#f2d2a6" stroke="${ink}" stroke-width="1.4"/><path d="M76.2 72.3l.6 1.3.6-1.3z" fill="${ink}"/></g>`:''}<g fill="${sk}" ${W}>${faceP}</g>${ears}${marks}${bald?front:front}${brows}${eyes}${nose}${mouth}${beard}${acc}</g></svg>`;
  }

  function normalize(p){
    const out=Object.assign({},DEF);
    if(p&&typeof p==='object') for(const o of OPTS){const n=(o.v||o.sw).length,x=p[o.k];if(Number.isInteger(x)&&x>=0&&x<n)out[o.k]=x;}
    return out;
  }
  function lockedIds(p){const q=normalize(p),ids=[];for(const o of OPTS){if((o.lock||[]).includes(q[o.k]))ids.push('pt-'+o.k+'-'+q[o.k]);}return ids;}

  // Portrait de base (« a dessiner ») : silhouette en pointilles sur une page Seyes, point
  // d'interrogation rouge et le MEME crayon que l'accessoire « crayon sur l'oreille », en plus grand.
  function blank(){
    const ink='#22252b';
    const pencil=`<g transform="translate(80 8) rotate(28) scale(1.1)"><path d="M0 5v-2.4q0-2.6 2.8-2.6t2.8 2.6v2.4z" fill="#f29bb0" stroke="${ink}" stroke-width="1.2"/><rect x="0" y="5" width="5.6" height="3" fill="#b9bec6" stroke="${ink}" stroke-width="1.1"/><path d="M0 8h5.6v20H0z" fill="#e0a800" stroke="${ink}" stroke-width="1.3"/><path d="M1.9 8v20M3.7 8v20" stroke="#b8860b" stroke-width=".7"/><path d="M0 28h5.6l-2.8 6z" fill="#f2d2a6" stroke="${ink}" stroke-width="1.2"/><path d="M2.2 32.7l.6 1.3.6-1.3z" fill="${ink}"/></g>`;
    const rules=[12,24,36,48,60,72,84,96].map(y=>`<path d="M0 ${y}h100" stroke="rgba(80,130,205,.35)" stroke-width="1"/>`).join('');
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="100" height="100" fill="#fdfdf9"/>${rules}<path d="M12 0v100" stroke="#e2485d" stroke-width="1.2" opacity=".6"/><g fill="none" stroke="#5e6470" stroke-width="2.2" stroke-dasharray="5 4" stroke-linecap="round"><ellipse cx="50" cy="44" rx="20" ry="24"/><path d="M14 100q4-26 36-28 32 2 36 28"/></g><text x="50" y="53" text-anchor="middle" font-family="Caveat, 'Segoe Print', cursive" font-weight="700" font-size="28" fill="#e2485d">?</text>${pencil}</svg>`;
  }
  window.LiberoPortrait={OPTS,GROUPS,DEF,PT_PRICE,BGS,svg:p=>svg(normalize(p)),blank,normalize,lockedIds};
})();
