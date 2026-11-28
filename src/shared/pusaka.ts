/**
 * Pusaka: the heirlooms and objects of the stories. Each solved scene gives
 * one; solved at par with no hints, it turns to gold leaf. Art lives in
 * public/pusaka/<id>.svg. Sources for each story: docs/STORY-SOURCES.md.
 */
export type Pusaka = {
  id: string;
  name: string;
  /** the wayang it belongs to (a figure id), or '' for the dalang's own things */
  owner: string;
  story: string;
  /** a short citation for the story */
  source?: string;
};

export const PUSAKA: Pusaka[] = [
  {
    id: 'blencong',
    name: 'Blencong',
    owner: '',
    story:
      'The oil lamp of the shadow play, made of brass or bronze and often shaped like the bird Garuda. It burns coconut oil, and its wick faces the screen so that every puppet throws a living shadow. The dalang trims the flame himself through the night. Today most shows use electric light, and the old blencong is lit mainly for palace rituals.',
    source: 'Wikipedia (id), "Blencong"',
  },
  {
    id: 'kayon',
    name: 'Gunungan Kayon',
    owner: '',
    story:
      'The kayon, or gunungan ("mountain"), is the tall leaf-shaped puppet carved with a gate, a tree of life and forest animals; its back is painted as fire. The dalang plants it in the middle of the screen before the story begins and again when it ends. In between it can be a forest, a mountain, wind or fire, and it marks every change of scene. It is read as a picture of the universe.',
    source:
      'Wikipedia (en), "Gunungan"; Robson & Wibisono, Javanese English Dictionary',
  },
  {
    id: 'rujakpolo',
    name: 'Gada Rujakpolo',
    owner: 'bima',
    story:
      'The great club of Bima (Werkudara), listed among his heirlooms in the wayang encyclopedias and sometimes spelled Rujakpala. In the Baratayuda war it is the club that finally brings down Duryudana.',
    source:
      'Ensiklopedi Wayang Purwa (Balai Pustaka 1991), via Wayang Networks; Lakon journal (ISI Surakarta)',
  },
  {
    id: 'pancanaka',
    name: 'Kuku Pancanaka',
    owner: 'bima',
    story:
      'The long, sharp thumbnail of Bima: not a forged weapon but part of his body. Hanoman, another son of the wind god Bayu, has the same nail. In the Dewaruci story Bima kills the sea serpent with it, and in older tales the giant king Baka dies by it.',
    source: 'Wayang Networks (Werkudara); Wikipedia (id), "Dewa Ruci"',
  },
  {
    id: 'keris-cakil',
    name: 'Keris Cakil',
    owner: 'cakil',
    story:
      'The wavy dagger of Cakil, the jutting-jawed giant. In the perang kembang, the "flower battle" a dalang stages in almost every lakon, Cakil attacks a calm young knight, twirling and slashing. He always loses, and in many performances he falls on his own keris. Dalang often read the scene as anger defeating itself.',
    source: 'Wikipedia (id), "Cakil"',
  },
  {
    id: 'kentongan',
    name: 'Kentongan',
    owner: 'petruk',
    story:
      'A hollow slit drum of wood or bamboo, hung in every Javanese village to raise the alarm or call people together. It is not a famous heirloom, just a village thing, which makes it right for the punakawan, the servants who are village folk at heart. In our telling Petruk and Gareng beat it while they argue about Bima.',
    source: "General ethnography; the link to Petruk is this game's own",
  },
  {
    id: 'dadu',
    name: 'Dadu Sengkuni',
    owner: 'sengkuni',
    story:
      'The dice of Sengkuni, patih of Astina and uncle of the Kurawa. In the Mahabharata he throws them for Duryudana against Yudhistira, who stakes and loses his kingdom, his brothers, himself and their wife Drupadi. The loss sends the Pandawa into exile for thirteen years. In wayang, Sengkuni is behind nearly every trap set for the Pandawa.',
    source: 'Mahabharata, Sabha Parva; Wayang Networks (Sengkuni)',
  },
  {
    id: 'tirta',
    name: 'Tirta Pawitra',
    owner: 'dewaruci',
    story:
      'The water of life (also called tirta perwita) that the teacher Durna sends Bima to find, first on Mount Candramuka and then at the bottom of the sea. Durna meant the errand to kill him. At the bottom of the ocean the tiny god Dewaruci shows Bima that the water was never outside him: it is the pure self within. The lakon Dewaruci is one of the best-loved teachings of Javanese mysticism.',
    source:
      'Serat Dewaruci; Santiko, "Bhima dan Toya Pawitra", Amerta 35/2; Wikipedia (id), "Dewa Ruci"',
  },
  {
    id: 'pulanggeni',
    name: 'Keris Pulanggeni',
    owner: 'arjuna',
    story:
      'One of the heirlooms of Arjuna, the most refined of the Pandawa, alongside his arrows Pasopati and Sarotama. A keris in Java is worn at the back of the waist, and is a sign of rank as much as a weapon.',
    source:
      'Ensiklopedi Wayang Purwa (Balai Pustaka 1991), via Wayang Networks (Arjuna)',
  },
  {
    id: 'kalimasada',
    name: 'Jamus Kalimasada',
    owner: 'yudhistira',
    story:
      'The sacred book of Yudhistira (Puntadewa), first among the heirlooms of the Pandawa kingdom Amarta. In the wayang it is stolen again and again, most famously in Petruk Dadi Ratu, and always comes home. Javanese tradition credits Sunan Kalijaga with reading its name as Kalimat Syahadat, the Islamic profession of faith.',
    source: 'Wikipedia (id), "Jamus Kalimasada"; Wikipedia (id), "Petruk"',
  },
  {
    id: 'gandewa',
    name: 'Busur Gandewa',
    owner: 'arjuna',
    story:
      "Arjuna's bow, the Gandiwa of the Mahabharata. The fire god Agni obtained it from Varuna, god of the waters, and gave it to Arjuna before the burning of the Khandawa forest. With it Arjuna becomes the finest archer of his age. On Mount Indrakila he sets even this aside to sit in stillness.",
    source: 'Mahabharata, Adi Parva (Khandava-daha); Wikipedia (en), "Gandiva"',
  },
  {
    id: 'wijayakusuma',
    name: 'Kembang Wijayakusuma',
    owner: '',
    story:
      'A white flower that opens at night. In the wayang it is an heirloom of Kresna, king of Dwarawati and counsellor of the Pandawa, and it can bring back to life someone who has died before their time. The kings of Mataram later treated the real flower as a sign of the right to rule. Kresna is not one of our puppets, so the flower waits here for him.',
    source:
      'Good News From Indonesia, "Kresna, manusia bijak setengah dewa"; detik.com, "Mitos bunga Wijaya Kusuma"',
  },
  {
    id: 'kendhi',
    name: 'Kendhi',
    owner: 'bagong',
    story:
      "A clay water jug with a spout, found in every Javanese kitchen and on every village porch. Like the kentongan it is no famous heirloom. In our telling it belongs to Bagong, the punakawan born from Semar's shadow, who empties it twice while retelling a battle he never fought.",
    source: "General ethnography; the link to Bagong is this game's own",
  },
  {
    id: 'gada-inten',
    name: 'Gada Kyai Inten',
    owner: 'duryudana',
    story:
      "The heirloom club of Duryudana, king of Astina and eldest of the hundred Kurawa. In one lakon the sea god Batara Baruna gives it to him after he flees to the ocean; it has no power on land and shrinks when it meets Bima's club Rujakpolo. At the end of the Baratayuda, Bima strikes him down.",
    source:
      'Ensiklopedi Wayang Purwa, via Wayang Networks (Duryudana); Lakon: Jurnal Pengkajian & Penciptaan Wayang',
  },
  {
    id: 'pasopati',
    name: 'Panah Pasopati',
    owner: 'arjuna',
    story:
      "The arrow Arjuna wins on Mount Indrakila. In Mpu Kanwa's Arjunawiwaha (about 1030), Siwa comes to him disguised as a Kirata hunter; they quarrel over a boar both have shot, and fight, until the god reveals himself and gives Arjuna the Pasupati. In the Javanese wayang Siwa is Batara Guru, and the arrow is Arjuna's most famous pusaka. Arjuna then frees heaven from the giant king Niwatakawaca.",
    source:
      'Arjunawiwaha (Mpu Kanwa); Robson, Arjunawiwaha (KITLV 2008); Wikipedia (id/en), "Arjunawiwaha"',
  },
  {
    id: 'guwawijaya',
    name: 'Busur Rama',
    owner: 'rama',
    story:
      "The bow of Rama, prince of Ayodya. In the Ramayana he wins Sinta by lifting and breaking the great bow of Siwa, which no other suitor could even string, and his own bow and arrows carry him through exile and war. At the end of the war Rama's arrow kills Rahwana.",
    source: 'Valmiki Ramayana, Bala Kanda and Yuddha Kanda',
  },
  {
    id: 'ampal',
    name: 'Cincin Rama',
    owner: 'rama',
    story:
      "Rama's ring, which he gives to Hanoman before the monkey leaps to Alengka. Sinta, held prisoner and afraid of Rahwana's tricks, believes Hanoman only when she sees it. It appears in the Sanskrit Ramayana and in every Javanese telling of Hanoman Duta.",
    source: 'Valmiki Ramayana, Sundara Kanda; Wikipedia (id), "Anoman"',
  },
  {
    id: 'poleng',
    name: 'Kampuh Poleng',
    owner: 'hanoman',
    story:
      "Cloth woven in a black-and-white check, the poleng pattern. Hanoman wears it, and so does Bima, whose checked kampuh is called Bintuluaji; both are sons of the wind god Bayu. The same check marks Hanoman in Balinese painting. Scholars of the wayang read the pattern on Bima's cloth as a sign of his spiritual strength rather than mere decoration.",
    source:
      'detik.com, "Tokoh Pandawa Lima"; Atrat: Jurnal Seni Rupa (ISBI) on Bima\'s poleng; Australian Museum, Hanoman and Bima painting',
  },
  {
    id: 'konde',
    name: 'Tusuk Konde Sinta',
    owner: 'sinta',
    story:
      "The jewel Sinta takes from her hair in the Argasoka garden and gives to Hanoman, so Rama will know she lives and waits. In Valmiki's Ramayana it is the cudamani, a jewel worn in the hair; when Hanoman brings it back, Rama weeps. Sinta refuses to be carried home by the monkey: Rama himself must come for her.",
    source: 'Valmiki Ramayana, Sundara Kanda 38 and 65–66',
  },
  {
    id: 'obor',
    name: 'Obor',
    owner: 'hanoman',
    story:
      "The fire on Hanoman's tail. Captured by Rahwana's son Indrajit, Hanoman lets the giants wrap his tail in oiled cloth and set it alight to shame him. He breaks free and leaps from roof to roof until Alengka burns, an episode the wayang calls Hanoman (or Anoman) Obong.",
    source:
      'Valmiki Ramayana, Sundara Kanda; Wikipedia (id), "Anoman" and "Anoman Obong"',
  },
  {
    id: 'mahkota',
    name: 'Mahkota Rahwana',
    owner: 'rahwana',
    story:
      'The crown of Rahwana, also called Dasamuka, "the ten-faced", giant king of Alengka. In the Javanese tellings his magic arts, Pancasona and Rawarontek, keep him from dying, so he believes no one can take his throne. He carried off Sinta and would not return her even when his own city burned. In the end Rama brings him down.',
    source: 'Wikipedia (id), "Rahwana"',
  },
  {
    id: 'astagina',
    name: 'Cupu Manik Astagina',
    owner: '',
    story:
      "A small jewelled casket in which the whole of heaven and earth can be seen. The sun god Batara Surya gave it to Dewi Windradi, wife of the sage Gotama; when their children Anjani, Subali and Sugriwa quarrelled over it, all were cursed, and Anjani became the mother of Hanoman. So it belongs to Hanoman's family rather than to him. Its story is often staged as a lakon of its own.",
    source: 'cwa-web.org, "Cupu Manik Asthagina"; Wayang Networks (Sugriwa)',
  },
];

export const pusaka = (id: string): Pusaka => {
  const p = PUSAKA.find((q) => q.id === id);
  if (!p) throw new Error(`unknown pusaka ${id}`);
  return p;
};

/** a pusaka's picture, under the Pages base path or on Reddit */
export const pusakaUrl = (base: string, id: string) =>
  `${base}pusaka/${id}.svg`;
