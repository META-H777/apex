// Les tenues (le dressing) : pour chaque singe, sa robe naturelle puis des tenues entières. Une tenue est un autre atlas de pièces (singes/<fichier>.png et .json),
// posé sur le même squelette ; elle peut corriger l'allure (par exemple une tête plus grosse sous un casque).
// LIANE — les quatre singes. Chacun a son corps (proportions), son allure (comment poser ses pièces peintes) et ses points de compétence.
// Les points vont de 1 à 5, et chaque singe en a seize : aucun n'est le meilleur partout.
// Sources des proportions et des aptitudes : liane/SINGE-REEL.md (partie « Les quatre singes »).
//
// Ce que valent les points dans les règles (jeu.js) :
//   vitesse  : sa vitesse de balancement sans élan (en flux, tous vont aussi vite : la forêt est vérifiée jusque-là, pas au-delà)
//   reprise  : la force avec laquelle il se relance quand il a perdu sa vitesse
//   saut     : la pesanteur qu'il ressent en vol (un bon sauteur plane plus longtemps, et saisit la liane plus haut)
//   allonge  : la distance à laquelle ses mains saisissent une liane
//   prise    : la largeur de l'arc doré (un singe sûr de sa prise pardonne un lâcher moins précis)
const PTS = {
  vitesse: [1, 1.015, 1.03, 1.045, 1.06],
  reprise: [0.75, 0.88, 1, 1.15, 1.3],
  saut: [1, 0.985, 0.97, 0.955, 0.94],
  allonge: [0.78, 0.85, 0.92, 0.99, 1.06],
  prise: [0.78, 0.9, 1, 1.12, 1.25],
};
export const COMPETENCES = [['vitesse', 'Vitesse'], ['reprise', 'Reprise'], ['saut', 'Saut'], ['allonge', 'Allonge'], ['prise', 'Prise']];
// Les réglages du mouvement tirés des points. Un singe sans points (les éclaireurs, les rivaux) joue avec la règle de base.
export const regles = (p, pouvoir) => ({ pouvoir, amp: PTS.vitesse[p.vitesse - 1], pump: PTS.reprise[p.reprise - 1], vol: PTS.saut[p.saut - 1], portee: PTS.allonge[p.allonge - 1], arc: PTS.prise[p.prise - 1] });

export const ESPECES = [
  { id: 'araignee', nom: 'Singe-araignée', latin: 'Ateles geoffroyi', mot: 'Le plus sûr',
    trait: 'Sa queue est une cinquième main : sa prise pardonne beaucoup. Rapide sans plus.',
    geste: 'Suspendu par un bras, le corps couché en arrière, il plonge à l\'horizontale.',
    pouvoir: { id: 'queue', nom: 'La cinquième main', texte: 'Sa queue rattrape la liane la plus proche.' },
    points: { vitesse: 3, reprise: 2, saut: 2, allonge: 4, prise: 5 },
    corps: { K: 1.4, tronc: 0.66, bras: 0.37, avant: 0.36, main: 0.2, cuisse: 0.33, jambe: 0.32, pied: 0.17, tete: 0.108, queue: 1.18 },
    allure: { tete: 0.3, tronc: 0.74, queue: 1.5, trait: [0.1, 0.028], ombre: 0.36 },
    tenues: [{ id: 'naturel', nom: 'Naturel', fichier: 'araignee' }, { id: 'ninja', nom: 'Ninja', fichier: 'araignee-ninja' }] },
  { id: 'gibbon', nom: 'Gibbon', latin: 'Hylobates lar', mot: 'Le plus rapide',
    trait: 'Le roi du balancement : des bras immenses, une vitesse folle. Sans queue, il ne pardonne rien.',
    geste: 'Le corps droit sous le bras, les jambes repliées, il vole debout d\'une prise à l\'autre.',
    pouvoir: { id: 'ami', nom: 'Le duo', texte: 'Sa compagne descend de la canopée et lui tend une liane.' },
    points: { vitesse: 5, reprise: 2, saut: 3, allonge: 5, prise: 1 },
    corps: { style: 'gibbon', K: 1.4, tronc: 0.58, bras: 0.45, avant: 0.47, main: 0.22, cuisse: 0.27, jambe: 0.27, pied: 0.16, tete: 0.11, queue: 0 },
    allure: { tete: 0.3, tronc: 0.74, queue: 0, trait: [0, 0], ombre: 0.16 },
    tenues: [{ id: 'naturel', nom: 'Naturel', fichier: 'gibbon' }, { id: 'astronaute', nom: 'Astronaute', fichier: 'gibbon-astronaute', allure: { tete: 0.46 } }] },
  { id: 'colobe', nom: 'Colobe guéréza', latin: 'Colobus guereza', mot: 'Le grand sauteur',
    trait: 'Ses jambes le jettent très loin et sa cape le porte en l\'air. Bras courts, balancement lent.',
    geste: 'Accroupi sur la liane, mains et pieds dessus, il se détend et saute bras et jambes ouverts.',
    pouvoir: { id: 'cape', nom: 'La cape', texte: 'Sa cape s\'ouvre : il plane jusqu\'à la liane suivante.' },
    points: { vitesse: 2, reprise: 3, saut: 5, allonge: 2, prise: 4 },
    corps: { style: 'colobe', K: 1.4, tronc: 0.7, bras: 0.3, avant: 0.3, main: 0.17, cuisse: 0.36, jambe: 0.36, pied: 0.19, tete: 0.108, queue: 1.25 },
    allure: { tete: 0.3, tronc: 0.74, queue: 1.5, trait: [0.07, 0.05], ombre: 0.3 },
    tenues: [{ id: 'naturel', nom: 'Naturel', fichier: 'colobe' }, { id: 'pirate', nom: 'Pirate', fichier: 'colobe-pirate', allure: { tete: 0.36 } }] },
  { id: 'tamarin', nom: 'Tamarin-lion doré', latin: 'Leontopithecus rosalia', mot: 'Le plus vif',
    trait: 'Minuscule et nerveux : il repart en un éclair. Ses petits bras l\'obligent à viser juste.',
    geste: 'Collé à la liane comme un écureuil, il bondit tout étiré.',
    pouvoir: { id: 'ricochet', nom: 'Le ricochet', texte: 'Il rebondit sur une brindille : un second saut en plein vol.' },
    points: { vitesse: 4, reprise: 5, saut: 4, allonge: 1, prise: 2 },
    corps: { style: 'tamarin', K: 1.05, tronc: 0.62, bras: 0.28, avant: 0.28, main: 0.18, cuisse: 0.29, jambe: 0.3, pied: 0.17, tete: 0.13, queue: 1.3 },
    allure: { tete: 0.42, tronc: 0.74, queue: 1.2, trait: [0.07, 0.03], ombre: 0.2 },
    tenues: [{ id: 'naturel', nom: 'Naturel', fichier: 'tamarin' }, { id: 'rockeur', nom: 'Rockeur', fichier: 'tamarin-rockeur', allure: { tete: 0.46 } }] },
];
for (const e of ESPECES) e.regles = regles(e.points, e.pouvoir.id);
export const espece = (id) => ESPECES.find((e) => e.id === id) || ESPECES[0];
