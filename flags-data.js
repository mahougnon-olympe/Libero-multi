/* Donnees du jeu « Devine le drapeau » : partage entre le site (solo) et le serveur (salons).
   COPIE dans backend/flags-data.js : toute modification doit etre repercutee dans les deux fichiers
   (voir GUIDE-PROJET.md). Drapeaux : bibliotheque flag-icons (licence MIT), assets/flags/xx.svg. */
(function (root) {
  // [code ISO, continent (AF Afrique, EU Europe, AS Asie, AM Ameriques, OC Oceanie), niveau 1 facile / 2 moyen / 3 difficile]
  const LIST = [['DZ','AF',1],['AO','AF',2],['BJ','AF',1],['BW','AF',3],['BF','AF',3],['BI','AF',3],['CV','AF',3],['CM','AF',1],['CF','AF',3],['TD','AF',3],['KM','AF',3],['CG','AF',3],['CD','AF',3],['CI','AF',1],['DJ','AF',3],['EG','AF',1],['GQ','AF',3],['ER','AF',3],['SZ','AF',3],['ET','AF',1],['GA','AF',3],['GM','AF',3],['GH','AF',1],['GN','AF',2],['GW','AF',3],['KE','AF',1],['LS','AF',3],['LR','AF',3],['LY','AF',3],['MG','AF',2],['MW','AF',3],['ML','AF',1],['MR','AF',3],['MU','AF',3],['MA','AF',1],['MZ','AF',3],['NA','AF',3],['NE','AF',3],['NG','AF',1],['RW','AF',3],['ST','AF',3],['SN','AF',1],['SC','AF',3],['SL','AF',3],['SO','AF',3],['ZA','AF',1],['SS','AF',3],['SD','AF',3],['TZ','AF',2],['TG','AF',3],['TN','AF',1],['UG','AF',2],['ZM','AF',3],['ZW','AF',3],['AL','EU',3],['AD','EU',3],['AT','EU',2],['BY','EU',2],['BE','EU',1],['BA','EU',3],['BG','EU',2],['HR','EU',2],['CY','EU',2],['CZ','EU',2],['DK','EU',1],['EE','EU',3],['FI','EU',1],['FR','EU',1],['DE','EU',1],['GR','EU',1],['HU','EU',2],['IS','EU',2],['IE','EU',1],['IT','EU',1],['LV','EU',3],['LI','EU',3],['LT','EU',3],['LU','EU',3],['MT','EU',3],['MD','EU',3],['MC','EU',3],['ME','EU',3],['NL','EU',1],['MK','EU',3],['NO','EU',1],['PL','EU',1],['PT','EU',1],['RO','EU',2],['RU','EU',1],['SM','EU',3],['RS','EU',2],['SK','EU',3],['SI','EU',3],['ES','EU',1],['SE','EU',1],['CH','EU',1],['UA','EU',1],['GB','EU',1],['VA','EU',3],['AF','AS',2],['AM','AS',3],['AZ','AS',3],['BH','AS',3],['BD','AS',2],['BT','AS',3],['BN','AS',3],['KH','AS',3],['CN','AS',1],['GE','AS',2],['IN','AS',1],['ID','AS',1],['IR','AS',1],['IQ','AS',1],['IL','AS',1],['JP','AS',1],['JO','AS',2],['KZ','AS',2],['KW','AS',3],['KG','AS',3],['LA','AS',3],['LB','AS',2],['MY','AS',2],['MV','AS',3],['MN','AS',3],['MM','AS',3],['NP','AS',3],['KP','AS',2],['OM','AS',3],['PK','AS',1],['PH','AS',1],['QA','AS',3],['SA','AS',1],['SG','AS',2],['KR','AS',1],['LK','AS',3],['SY','AS',2],['TJ','AS',3],['TH','AS',1],['TL','AS',3],['TR','AS',1],['TM','AS',3],['AE','AS',1],['UZ','AS',3],['VN','AS',1],['YE','AS',3],['AG','AM',3],['AR','AM',1],['BS','AM',3],['BB','AM',3],['BZ','AM',3],['BO','AM',2],['BR','AM',1],['CA','AM',1],['CL','AM',1],['CO','AM',1],['CR','AM',2],['CU','AM',1],['DM','AM',3],['DO','AM',2],['EC','AM',2],['SV','AM',2],['GD','AM',3],['GT','AM',2],['GY','AM',3],['HT','AM',2],['HN','AM',2],['JM','AM',2],['MX','AM',1],['NI','AM',2],['PA','AM',2],['PY','AM',2],['PE','AM',1],['KN','AM',3],['LC','AM',3],['VC','AM',3],['SR','AM',3],['TT','AM',2],['US','AM',1],['UY','AM',2],['VE','AM',2],['AU','OC',1],['FJ','OC',2],['KI','OC',3],['MH','OC',3],['FM','OC',3],['NR','OC',3],['NZ','OC',1],['PW','OC',3],['PG','OC',2],['WS','OC',3],['SB','OC',3],['TO','OC',3],['TV','OC',3],['VU','OC',3]].map(r => ({ c: r[0], k: r[1], l: r[2] }));
  // Autres ecritures acceptees en saisie libre (sans accents ni ponctuation).
  const ALIAS = {
    US: ['usa', 'etats unis d amerique', 'united states of america', 'america', 'etats unis'], GB: ['uk', 'angleterre', 'england', 'grande bretagne', 'great britain', 'royaume uni'],
    CI: ['cote d ivoire', 'ivory coast'], CD: ['rdc', 'republique democratique du congo', 'congo kinshasa', 'democratic republic of the congo', 'drc'],
    CG: ['congo brazzaville', 'republic of the congo', 'congo'], CZ: ['tchequie', 'republique tcheque', 'czechia', 'czech republic'],
    MK: ['macedoine', 'macedoine du nord', 'north macedonia', 'macedonia'], SZ: ['swaziland', 'eswatini'], MM: ['birmanie', 'burma', 'myanmar'],
    TL: ['timor oriental', 'east timor', 'timor leste'], CV: ['cap vert', 'cabo verde'], KR: ['coree du sud', 'south korea', 'korea'], KP: ['coree du nord', 'north korea'],
    RU: ['russie', 'russia'], VA: ['vatican', 'saint siege', 'vatican city'], AE: ['emirats arabes unis', 'emirats', 'uae', 'united arab emirates'],
    NL: ['hollande', 'holland', 'pays bas', 'netherlands'], TR: ['turquie', 'turkey', 'turkiye'], BA: ['bosnie', 'bosnie herzegovine', 'bosnia', 'bosnia and herzegovina'],
    ST: ['sao tome', 'sao tome et principe', 'sao tome and principe'], KN: ['saint christophe et niceron', 'saint kitts', 'saint kitts and nevis'], LC: ['sainte lucie', 'saint lucia'],
    VC: ['saint vincent', 'saint vincent et les grenadines'], AG: ['antigua', 'antigua et barbuda', 'antigua and barbuda'], TT: ['trinite et tobago', 'trinidad', 'trinidad and tobago'],
    PG: ['papouasie', 'papouasie nouvelle guinee', 'papua new guinea'], FM: ['micronesie', 'micronesia'], GW: ['guinee bissau', 'guinea bissau'], GQ: ['guinee equatoriale', 'equatorial guinea'],
    CF: ['centrafrique', 'republique centrafricaine', 'central african republic'], DO: ['republique dominicaine', 'dominican republic'], SA: ['arabie saoudite', 'saudi arabia'],
    ZA: ['afrique du sud', 'south africa'], NZ: ['nouvelle zelande', 'new zealand'], LK: ['sri lanka', 'ceylan'], MU: ['maurice', 'mauritius'], SC: ['seychelles'],
  };
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const dn = {};
  function names(lang) {
    const l = lang === 'en' ? 'en' : 'fr';
    if (!dn[l]) { try { dn[l] = new Intl.DisplayNames([l], { type: 'region' }); } catch { dn[l] = { of: c => c }; } }
    return dn[l];
  }
  const name = (c, lang) => { try { return (names(lang).of(c) || c).replace(/’/g, "'").replace(' - ', '-'); } catch { return c; } };
  const byCode = {}; LIST.forEach(x => { byCode[x.c] = x; });
  function dist(a, b) {
    if (a === b) return 0; if (Math.abs(a.length - b.length) > 2) return 9;
    const m = []; for (let i = 0; i <= a.length; i++) { m[i] = [i]; } for (let j = 0; j <= b.length; j++) m[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return m[a.length][b.length];
  }
  // Saisie libre : accepte le nom francais ou anglais, des alias courants et une faute de frappe sur les longs noms.
  function match(c, text) {
    const t = norm(text); if (!t) return false;
    const cands = [norm(name(c, 'fr')), norm(name(c, 'en')), ...(ALIAS[c] || [])];
    return cands.some(x => x === t || x.replace(/ /g, '') === t.replace(/ /g, '') || (x.length >= 6 && dist(x, t) <= (x.length >= 10 ? 2 : 1)));
  }
  // n propositions : la bonne reponse + des intrus du meme continent et d'un niveau proche (meme si peu nombreux, on complete).
  function choices(c, n, rnd) {
    rnd = rnd || Math.random;
    const me = byCode[c], pool = LIST.filter(x => x.c !== c);
    const near = pool.filter(x => x.k === me.k && Math.abs(x.l - me.l) <= 1), rest = pool.filter(x => !near.includes(x));
    const pick = a => a.splice(Math.floor(rnd() * a.length), 1)[0];
    const out = [c]; const a = near.slice(), b = rest.slice();
    while (out.length < n && (a.length || b.length)) out.push((a.length ? pick(a) : pick(b)).c);
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return out;
  }
  const api = { LIST, byCode, name, match, choices, norm, ALIAS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FlagsData = api;
})(typeof window !== 'undefined' ? window : globalThis);
