#!/usr/bin/env python3
"""Download local reference images for 100 anime and 50 game characters.

Anime portraits come from the public AniList character API. Game portraits
come from the Wikipedia REST summary image. Both are saved under
public/characters so the stall can run offline.
"""

from __future__ import annotations

import json
import shutil
import ssl
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "characters"
UA = "AutofitIGDC/1.0 (local kiosk; +https://github.com/kenzzhood/AuraFit)"
CTX = ssl.create_default_context()

# id, name, series, look, hair, search
ANIME = [
    ("naruto", "Naruto Uzumaki", "Naruto", "spiky blond hair, orange and black jacket, black shirt, orange trousers, blue sandals, leaf headband", "spiky blond hair", "Naruto Uzumaki"),
    ("sasuke", "Sasuke Uchiha", "Naruto", "spiky black hair, white high-collar shirt, blue shorts, rope belt", "spiky black hair", "Sasuke Uchiha"),
    ("sakura", "Sakura Haruno", "Naruto", "short pink hair, red dress over black shorts, dark arm guards", "short pink hair", "Sakura Haruno"),
    ("kakashi", "Kakashi Hatake", "Naruto", "silver spiky hair, dark mask, green flak jacket, dark blue clothes", "silver spiky hair", "Kakashi Hatake"),
    ("hinata", "Hinata Hyuga", "Naruto", "dark blue hime-cut hair, cream hooded jacket, lavender trousers", "dark blue hime-cut hair", "Hinata Hyuga"),
    ("itachi", "Itachi Uchiha", "Naruto", "long black hair in a low ponytail, black cloak with red clouds", "long black hair", "Itachi Uchiha"),
    ("gaara", "Gaara", "Naruto", "short red hair, gourd on the back, dark clothes under a crimson coat", "short red hair", "Gaara"),
    ("rock-lee", "Rock Lee", "Naruto", "black bowl-cut hair, green jumpsuit, orange leg warmers", "black bowl-cut hair", "Rock Lee"),
    ("minato", "Minato Namikaze", "Naruto", "spiky blond hair, white cloak with flame hems, green flak jacket", "spiky blond hair", "Minato Namikaze"),
    ("luffy", "Monkey D. Luffy", "One Piece", "black hair under a straw hat, open red vest, blue shorts, sandals", "black hair under a straw hat", "Monkey D. Luffy"),
    ("zoro", "Roronoa Zoro", "One Piece", "short green hair, black bandana, open shirt, green haramaki sash, black trousers", "short green hair", "Roronoa Zoro"),
    ("nami", "Nami", "One Piece", "orange hair, striped bikini top, jeans, blue shoulder tattoo as a small motif", "long orange hair", "Nami"),
    ("sanji", "Sanji", "One Piece", "blond hair covering one eye, black suit, dress shirt", "blond hair covering one eye", "Sanji"),
    ("robin", "Nico Robin", "One Piece", "long black hair, cowboy hat, purple crop top and shorts or a long coat", "long black hair", "Nico Robin"),
    ("boa", "Boa Hancock", "One Piece", "long black hair, red and gold qipao, cape, high heels", "long black hair", "Boa Hancock"),
    ("deku", "Izuku Midoriya", "My Hero Academia", "messy dark green hair, green jumpsuit, white gloves, red boots, mask around the neck", "messy dark green hair", "Izuku Midoriya"),
    ("bakugo", "Katsuki Bakugo", "My Hero Academia", "spiky ash-blond hair, black tank top, orange X straps, grenade gauntlets", "spiky ash-blond hair", "Katsuki Bakugo"),
    ("uraraka", "Ochaco Uraraka", "My Hero Academia", "short brown hair, pink and black bodysuit, round cheek pads, helmet at the hip", "short brown hair", "Ochaco Uraraka"),
    ("todoroki", "Shoto Todoroki", "My Hero Academia", "hair split white and red, white costume with a dark ice-colored panel", "hair split white and red", "Shoto Todoroki"),
    ("gojo", "Satoru Gojo", "Jujutsu Kaisen", "white hair, black blindfold, dark high-collar jacket, black trousers", "white hair", "Satoru Gojo"),
    ("itadori", "Yuji Itadori", "Jujutsu Kaisen", "spiky pink hair, red hoodie under a dark school uniform", "spiky pink hair", "Yuji Itadori"),
    ("megumi", "Megumi Fushiguro", "Jujutsu Kaisen", "spiky black hair, dark blue uniform jacket", "spiky black hair", "Megumi Fushiguro"),
    ("nobara", "Nobara Kugisaki", "Jujutsu Kaisen", "short orange-brown hair, dark uniform, hammer and nails left as a small belt pouch", "short orange-brown hair", "Nobara Kugisaki"),
    ("sukuna", "Ryomen Sukuna", "Jujutsu Kaisen", "spiky pink hair, black tattoos on chest and arms, white kimono worn open, black hakama", "spiky pink hair", "Ryomen Sukuna"),
    ("nezuko", "Nezuko Kamado", "Demon Slayer", "long black hair fading to orange, pink kimono, hemp-leaf haori, checkered obi, bamboo muzzle", "long black hair fading to orange", "Nezuko Kamado"),
    ("tanjiro", "Tanjiro Kamado", "Demon Slayer", "burgundy hair, hanafuda earrings, green-and-black checkered haori, dark uniform", "burgundy hair", "Tanjiro Kamado"),
    ("zenitsu", "Zenitsu Agatsuma", "Demon Slayer", "yellow hair with an orange tip, yellow triangle haori, dark uniform", "yellow hair", "Zenitsu Agatsuma"),
    ("inosuke", "Inosuke Hashibira", "Demon Slayer", "black hair under a grey boar mask, fur mantle, bare chest, dark hakama", "black hair under a boar mask", "Inosuke Hashibira"),
    ("giyu", "Giyu Tomioka", "Demon Slayer", "black hair in a low tie, half-and-half geometric haori, dark uniform", "black hair tied low", "Giyu Tomioka"),
    ("shinobu", "Shinobu Kocho", "Demon Slayer", "black hair with purple tips in a bun, butterfly hairpin, white haori with butterfly wings", "black hair with purple tips", "Shinobu Kocho"),
    ("rengoku", "Kyojuro Rengoku", "Demon Slayer", "bright yellow hair with red tips, flame-pattern haori, white uniform", "yellow hair with red tips", "Kyojuro Rengoku"),
    ("levi", "Levi Ackerman", "Attack on Titan", "black undercut, white cravat, Survey Corps jacket, harness, grey trousers", "black undercut", "Levi Ackerman"),
    ("mikasa", "Mikasa Ackerman", "Attack on Titan", "short black hair, long red scarf, Survey Corps jacket, white shirt, dark trousers", "short black hair", "Mikasa Ackerman"),
    ("eren", "Eren Yeager", "Attack on Titan", "brown undercut, Survey Corps jacket, white shirt, brown trousers, harness", "brown undercut", "Eren Yeager"),
    ("armin", "Armin Arlert", "Attack on Titan", "short blond hair, Survey Corps jacket, white shirt, brown boots", "short blond hair", "Armin Arlert"),
    ("goku", "Son Goku", "Dragon Ball", "tall spiky black hair, orange gi, blue undershirt, blue belt, blue wristbands and boots", "tall spiky black hair", "Son Goku"),
    ("vegeta", "Vegeta", "Dragon Ball", "flame-shaped black hair, white and gold armor, dark blue bodysuit, white gloves and boots", "flame-shaped black hair", "Vegeta"),
    ("bulma", "Bulma", "Dragon Ball", "short blue hair, casual jacket and cropped pants or a pink outfit", "short blue hair", "Bulma"),
    ("gohan", "Son Gohan", "Dragon Ball", "spiky black hair, purple gi or a green tracksuit with a sword on the back", "spiky black hair", "Son Gohan"),
    ("sailor-moon", "Usagi Tsukino", "Sailor Moon", "blonde hair in twin buns with long pigtails, white and blue sailor uniform, red bow, gold tiara", "blonde odango pigtails", "Usagi Tsukino"),
    ("sailor-mars", "Rei Hino", "Sailor Moon", "long black hair, purple sailor uniform, red bow", "long black hair", "Rei Hino"),
    ("tuxedo-mask", "Mamoru Chiba", "Sailor Moon", "black hair, black tuxedo, white mask as a small eye mask, top hat and cape", "black hair", "Mamoru Chiba"),
    ("light", "Light Yagami", "Death Note", "light brown hair, tan suit, white shirt, red tie", "light brown hair", "Light Yagami"),
    ("l", "L Lawliet", "Death Note", "messy black hair, loose white long-sleeve shirt, blue jeans, no shoes", "messy black hair", "L Lawliet"),
    ("misa", "Misa Amane", "Death Note", "blonde pigtails, black gothic lolita dress, cross necklace, lace", "blonde pigtails", "Misa Amane"),
    ("edward", "Edward Elric", "Fullmetal Alchemist", "long blond braid, red coat, black shirt, leather trousers, metal automail arm as a silver gauntlet", "long blond braid", "Edward Elric"),
    ("winry", "Winry Rockbell", "Fullmetal Alchemist", "blonde hair in a ponytail, tube top, blue work pants, tool belt", "blonde ponytail", "Winry Rockbell"),
    ("roy", "Roy Mustang", "Fullmetal Alchemist", "black hair, blue military coat, white gloves, black trousers", "black hair", "Roy Mustang"),
    ("spike", "Spike Spiegel", "Cowboy Bebop", "fluffy green hair, blue suit, white shirt, yellow shirt loosely tied", "fluffy green hair", "Spike Spiegel"),
    ("faye", "Faye Valentine", "Cowboy Bebop", "short purple hair, yellow shorts outfit, red jacket", "short purple hair", "Faye Valentine"),
    ("vash", "Vash the Stampede", "Trigun", "spiky blond hair, round orange glasses, long red coat, black undersuit", "spiky blond hair", "Vash the Stampede"),
    ("ichigo", "Ichigo Kurosaki", "Bleach", "spiky orange hair, black shihakusho, white under-sash", "spiky orange hair", "Ichigo Kurosaki"),
    ("rukia", "Rukia Kuchiki", "Bleach", "short black hair, black shihakusho, white sash", "short black hair", "Rukia Kuchiki"),
    ("orihime", "Orihime Inoue", "Bleach", "long orange hair with hairpins, school uniform or a white cape", "long orange hair", "Orihime Inoue"),
    ("byakuya", "Byakuya Kuchiki", "Bleach", "long black hair, white scarf, black captain haori over a shihakusho, kenseikan hairpiece", "long black hair", "Byakuya Kuchiki"),
    ("killua", "Killua Zoldyck", "Hunter x Hunter", "spiky silver hair, blue tunic, baggy shorts, skateboard optional", "spiky silver hair", "Killua Zoldyck"),
    ("gon", "Gon Freecss", "Hunter x Hunter", "spiky black hair, green jacket and shorts, boots", "spiky black hair", "Gon Freecss"),
    ("kurapika", "Kurapika", "Hunter x Hunter", "blond hair, blue tabard over black clothes, chains", "blond hair", "Kurapika"),
    ("hisoka", "Hisoka Morow", "Hunter x Hunter", "red hair, face paint as star and teardrop, jester crop top and shorts", "red hair", "Hisoka Morow"),
    ("asuka", "Asuka Langley", "Neon Genesis Evangelion", "long orange hair, red plugsuit with a headset", "long orange hair", "Asuka Langley Soryu"),
    ("rei", "Rei Ayanami", "Neon Genesis Evangelion", "short light-blue hair, white plugsuit", "short light-blue hair", "Rei Ayanami"),
    ("shinji", "Shinji Ikari", "Neon Genesis Evangelion", "short brown hair, blue plugsuit", "short brown hair", "Shinji Ikari"),
    ("zero-two", "Zero Two", "Darling in the Franxx", "long pink hair, red horns as a hairpiece, white and red military uniform", "long pink hair", "Zero Two"),
    ("power", "Power", "Chainsaw Man", "long blonde hair, red horns as a hairpiece, white shirt, loose black tie, dark trousers", "long blonde hair", "Power"),
    ("makima", "Makima", "Chainsaw Man", "long light-red hair in a braid, white shirt, black tie, black trousers", "long light-red braid", "Makima"),
    ("denji", "Denji", "Chainsaw Man", "messy blond hair, white shirt, loose tie, dark trousers", "messy blond hair", "Denji"),
    ("anya", "Anya Forger", "Spy x Family", "short pink hair with two cones, black dress with gold buttons, white knee socks", "short pink hair", "Anya Forger"),
    ("yor", "Yor Forger", "Spy x Family", "long black hair, gold headband, red off-shoulder sweater dress, black tights", "long black hair", "Yor Forger"),
    ("loid", "Loid Forger", "Spy x Family", "blond hair, green suit, white shirt, green tie", "blond hair", "Loid Forger"),
    ("violet", "Violet Evergarden", "Violet Evergarden", "blonde hair with a blue ribbon, emerald jacket dress, brooch, white gloves", "blonde hair with a ribbon", "Violet Evergarden"),
    ("rem", "Rem", "Re:Zero", "short light-blue hair covering one eye, black and white maid dress, rose hairpin", "short light-blue hair", "Rem"),
    ("emilia", "Emilia", "Re:Zero", "long silver hair, white and purple dress, purple gem, flower hairpin", "long silver hair", "Emilia"),
    ("miku", "Hatsune Miku", "Vocaloid", "long teal twin tails, sleeveless grey top, teal necktie, black skirt, thigh-highs", "long teal twin tails", "Hatsune Miku"),
    ("asuna", "Asuna Yuuki", "Sword Art Online", "long orange-brown hair, white and red knights uniform", "long orange-brown hair", "Asuna Yuuki"),
    ("kirito", "Kirito", "Sword Art Online", "black hair, long black coat over a black outfit", "black hair", "Kirito"),
    ("megumin", "Megumin", "KonoSuba", "brown hair, eyepatch, witch hat, red robe, staff left as a slim prop", "brown hair", "Megumin"),
    ("aqua", "Aqua", "KonoSuba", "long blue hair, blue hair loop, feather hairpin, blue vest and detached sleeves", "long blue hair", "Aqua"),
    ("saber", "Artoria Pendragon", "Fate", "blonde hair in a bun, blue dress with silver armor panels", "blonde hair in a bun", "Artoria Pendragon"),
    ("rin", "Rin Tohsaka", "Fate", "black twin tails, red turtleneck, black pleated skirt", "black twin tails", "Rin Tohsaka"),
    ("jotaro", "Jotaro Kujo", "JoJo's Bizarre Adventure", "black hair under a chain-trimmed cap, long dark coat, gold chain", "black hair under a cap", "Jotaro Kujo"),
    ("dio", "Dio Brando", "JoJo's Bizarre Adventure", "blond hair, heart headband, yellow jacket, open chest, dark trousers", "blond hair", "Dio Brando"),
    ("giorno", "Giorno Giovanna", "JoJo's Bizarre Adventure", "blond hair with donut curls, pink suit, ladybug brooches", "blond hair with curls", "Giorno Giovanna"),
    ("jolyne", "Jolyne Cujoh", "JoJo's Bizarre Adventure", "green hair in two buns, butterfly crop top, green pants", "green hair in two buns", "Jolyne Cujoh"),
    ("inuyasha", "Inuyasha", "Inuyasha", "long silver hair, dog ears as a hairpiece, red fire-rat robe, beads", "long silver hair", "Inuyasha"),
    ("kagome", "Kagome Higurashi", "Inuyasha", "long black hair, green and white school uniform, yellow backpack", "long black hair", "Kagome Higurashi"),
    ("sesshomaru", "Sesshomaru", "Inuyasha", "long silver hair, white kimono, magenta markings as face paint left off, fur stole", "long silver hair", "Sesshomaru"),
    ("lelouch", "Lelouch Lamperouge", "Code Geass", "black hair, black and gold royal uniform or a school blazer with a purple cape", "black hair", "Lelouch Lamperouge"),
    ("cc", "C.C.", "Code Geass", "long green hair, white straitjacket dress, gold headband", "long green hair", "C.C."),
    ("marin", "Marin Kitagawa", "My Dress-Up Darling", "long blonde hair with pink tips, school uniform with a pink cardigan", "long blonde hair", "Marin Kitagawa"),
    ("tohru", "Tohru", "Miss Kobayashi's Dragon Maid", "long blonde hair, maid headdress, black and white maid dress, horns as a hairpiece", "long blonde hair", "Tohru"),
    ("kanna", "Kanna Kamui", "Miss Kobayashi's Dragon Maid", "pale blue hair, small horns as a hairpiece, knit sweater, backpack", "pale blue hair", "Kanna Kamui"),
    ("albedo", "Albedo", "Overlord", "long black hair, white dress, gold trim, black horns as a hairpiece", "long black hair", "Albedo"),
    ("mai", "Mai Sakurajima", "Rascal Does Not Dream of Bunny Girl Senpai", "long black hair, school uniform or a black bunny-style leotard with a jacket", "long black hair", "Mai Sakurajima"),
    ("raphtalia", "Raphtalia", "The Rising of the Shield Hero", "raccoon ears as a hairpiece, brown hair, white and red demi-human tunic, short cape", "brown hair", "Raphtalia"),
    ("esdeath", "Esdeath", "Akame ga Kill", "long light-blue hair, white military cap, blue uniform with a fur collar", "long light-blue hair", "Esdeath"),
    ("android-18", "Android 18", "Dragon Ball", "blonde bob, denim vest, black shirt, striped leggings, boots", "blonde bob", "Android 18"),
    ("erza", "Erza Scarlet", "Fairy Tail", "long scarlet hair, silver heart-shaped armor or a white blouse and blue skirt", "long scarlet hair", "Erza Scarlet"),
    ("natsu", "Natsu Dragneel", "Fairy Tail", "spiky pink hair, white scale-pattern scarf, open black vest, white trousers", "spiky pink hair", "Natsu Dragneel"),
    ("lucy", "Lucy Heartfilia", "Fairy Tail", "long blonde hair, blue ribbon, white and blue top, short skirt, boots", "long blonde hair", "Lucy Heartfilia"),
    ("saitama", "Saitama", "One Punch Man", "bald head, yellow jumpsuit, white cape, red gloves and boots", "bald", "Saitama"),
    ("tatsumaki", "Tatsumaki", "One Punch Man", "short curly green hair, tight black dress, black boots", "short curly green hair", "Tatsumaki"),
    ("annie", "Annie Leonhart", "Attack on Titan", "blonde bun, Survey Corps jacket, white shirt", "blonde bun", "Annie Leonhart"),
    ("akame", "Akame", "Akame ga Kill", "long black hair, red mini-dress under a dark short coat, black tights", "long black hair", "Akame"),
    ("rimuru", "Rimuru Tempest", "That Time I Got Reincarnated as a Slime", "silver-blue bob, black coat with gold buttons, scarf", "silver-blue bob", "Rimuru Tempest"),
    ("fubuki", "Fubuki", "One Punch Man", "long dark green hair, white fur coat, black dress", "long dark green hair", "Fubuki"),
    ("gray", "Gray Fullbuster", "Fairy Tail", "spiky black hair, open white shirt or shirtless with a cross necklace, dark pants", "spiky black hair", "Gray Fullbuster"),
    ("shanks", "Shanks", "One Piece", "red hair, scar over one eye left as the visitor's face, black cape, open shirt", "red hair", "Shanks"),
    ("all-might", "All Might", "My Hero Academia", "blond hair swept up, blue yellow and red hero suit, white gloves", "blond hair swept up", "All Might"),
    ("historia", "Historia Reiss", "Attack on Titan", "long blonde hair, pale blue dress, white collar", "long blonde hair", "Historia Reiss"),
]

WIKI_FALLBACK = {
    "2B (Nier: Automata)": "YoRHa No.2 Type B",
    "Joker (Persona)": "Joker (Persona 5)",
    "Cynthia (Pokemon)": "Cynthia (Pokémon)",
    "Keqing": "Keqing (Genshin Impact)",
    "Ciri": "Ciri (The Witcher)",
    "Yennefer of Vengerberg": "Yennefer",
    "Doom Slayer": "Doomguy",
}

# id, name, series, look, hair, wikipedia title
GAMES = [
    ("mario", "Mario", "Super Mario", "red cap with an M, red shirt, blue overalls, white gloves, brown shoes", "brown hair under a red cap", "Mario"),
    ("luigi", "Luigi", "Super Mario", "green cap with an L, green shirt, blue overalls, white gloves", "brown hair under a green cap", "Luigi"),
    ("peach", "Princess Peach", "Super Mario", "blonde hair, gold crown, pink gown, blue brooch, long gloves", "blonde hair", "Princess Peach"),
    ("link", "Link", "The Legend of Zelda", "blond hair, green pointed cap, green tunic, brown belt, boots", "blond hair", "Link (The Legend of Zelda)"),
    ("zelda", "Princess Zelda", "The Legend of Zelda", "blonde hair, gold tiara, white and pink royal dress or a blue traveling tunic", "blonde hair", "Princess Zelda"),
    ("lara", "Lara Croft", "Tomb Raider", "brown ponytail, teal tank top, brown shorts, boots, holsters", "brown ponytail", "Lara Croft"),
    ("kratos", "Kratos", "God of War", "bald head, red body tattoo as paint, leather skirt, boots, chain across the chest", "bald", "Kratos (God of War)"),
    ("2b", "2B", "NieR: Automata", "short white hair, black blindfold, black dress with a high slit, thigh boots, gloves", "short white hair", "2B (Nier: Automata)"),
    ("cloud", "Cloud Strife", "Final Fantasy VII", "spiky blond hair, sleeveless black turtleneck, purple shoulder pauldron, dark baggy trousers", "spiky blond hair", "Cloud Strife"),
    ("tifa", "Tifa Lockhart", "Final Fantasy VII", "long black hair, white crop top, black suspenders, black miniskirt, gloves, boots", "long black hair", "Tifa Lockhart"),
    ("aerith", "Aerith Gainsborough", "Final Fantasy VII", "long brown braid with a pink ribbon, pink dress, red bolero jacket, brown boots", "long brown braid", "Aerith Gainsborough"),
    ("sephiroth", "Sephiroth", "Final Fantasy VII", "very long silver hair, long black coat, silver pauldrons, black leather", "very long silver hair", "Sephiroth (Final Fantasy)"),
    ("geralt", "Geralt of Rivia", "The Witcher", "long white hair, wolf medallion, dark leather armor, swords on the back left as straps", "long white hair", "Geralt of Rivia"),
    ("ciri", "Ciri", "The Witcher", "ashen hair, white shirt, leather vest, dark trousers, boots", "ashen hair", "Ciri"),
    ("yennefer", "Yennefer", "The Witcher", "black hair, black and white dress, fur collar", "black hair", "Yennefer of Vengerberg"),
    ("chief", "Master Chief", "Halo", "olive MJOLNIR armor, gold visor, full helmet", "helmet, no hair visible", "Master Chief (Halo)"),
    ("aloy", "Aloy", "Horizon", "red hair in braids, tribal leather and machine-thread armor, Focus earpiece", "red hair in braids", "Aloy"),
    ("ezio", "Ezio Auditore", "Assassin's Creed", "brown hair, white hooded robe with red sash, leather bracers, hidden-blade gauntlet", "brown hair", "Ezio Auditore da Firenze"),
    ("altair", "Altair", "Assassin's Creed", "white hooded robe, red sash, leather belt", "hood over brown hair", "Altaïr Ibn-La'Ahad"),
    ("kassandra", "Kassandra", "Assassin's Creed", "brown hair, Greek leather armor, red cape, bracers", "brown hair", "Kassandra (Assassin's Creed)"),
    ("arthur", "Arthur Morgan", "Red Dead Redemption", "brown hair, cowboy hat, dark vest, blue shirt, gun belt, boots", "brown hair under a cowboy hat", "Arthur Morgan (Red Dead Redemption)"),
    ("ellie", "Ellie", "The Last of Us", "brown ponytail, freckles left as the visitor's skin, flannel shirt, jeans, backpack", "brown ponytail", "Ellie (The Last of Us)"),
    ("joel", "Joel", "The Last of Us", "short brown hair, beard left off, flannel shirt, jeans, jacket", "short brown hair", "Joel (The Last of Us)"),
    ("drake", "Nathan Drake", "Uncharted", "brown hair, henley shirt, jeans, shoulder holster, boots", "brown hair", "Nathan Drake (character)"),
    ("snake", "Solid Snake", "Metal Gear", "brown hair, bandana, sneaking suit or olive tactical gear", "brown hair under a bandana", "Solid Snake"),
    ("bayonetta", "Bayonetta", "Bayonetta", "black hair in a beehive, glasses, black bodysuit, long gloves, heels", "black hair in a beehive", "Bayonetta (character)"),
    ("dante", "Dante", "Devil May Cry", "white hair, long red coat, black shirt, black gloves, boots", "white hair", "Dante (Devil May Cry)"),
    ("vergil", "Vergil", "Devil May Cry", "white hair swept back, long blue coat, dark vest", "white hair swept back", "Vergil (Devil May Cry)"),
    ("chun-li", "Chun-Li", "Street Fighter", "black hair in ox-horn buns with white covers, blue qipao, spiked bracelets, boots", "ox-horn buns", "Chun-Li"),
    ("ryu", "Ryu", "Street Fighter", "brown hair, red headband, white gi, black belt, red gloves, barefoot wraps", "brown hair", "Ryu (Street Fighter)"),
    ("cammy", "Cammy", "Street Fighter", "blonde braids, green leotard, red beret, red gauntlets, combat boots", "blonde braids", "Cammy (Street Fighter)"),
    ("jinx", "Jinx", "League of Legends", "long blue braids, crop top, shorts, tattoos as body paint, belts", "long blue braids", "Jinx (League of Legends)"),
    ("vi", "Vi", "League of Legends", "pink undercut, red jacket, hoodie, huge gauntlets, jeans", "pink undercut", "Vi (League of Legends)"),
    ("tracer", "Tracer", "Overwatch", "short brown hair, orange goggles, brown bomber jacket, leggings, chronal accelerator", "short brown hair", "Tracer (Overwatch)"),
    ("mercy", "Mercy", "Overwatch", "blonde high ponytail, white and gold suit, halo, wings as a light backpack", "blonde high ponytail", "Mercy (Overwatch)"),
    ("samus", "Samus Aran", "Metroid", "blonde ponytail, orange power suit with a helmet, or the blue zero suit", "blonde ponytail", "Samus Aran"),
    ("sora", "Sora", "Kingdom Hearts", "spiky brown hair, crown necklace, black red and white jacket, baggy shorts, oversized shoes", "spiky brown hair", "Sora (Kingdom Hearts)"),
    ("leon", "Leon Kennedy", "Resident Evil", "brown hair with a long fringe, RPD jacket or a brown bomber, tactical pants", "brown hair with a fringe", "Leon S. Kennedy"),
    ("ada", "Ada Wong", "Resident Evil", "black bob, red dress or a red turtleneck and black skirt, holster", "black bob", "Ada Wong"),
    ("jill", "Jill Valentine", "Resident Evil", "brown ponytail, blue beret, blue tactical tube top, white shirt, black skirt or pants", "brown ponytail", "Jill Valentine"),
    ("joker", "Joker", "Persona 5", "wavy black hair, long black coat, red gloves, white mask as a handheld prop, plaid pants", "wavy black hair", "Joker (Persona)"),
    ("steve", "Steve", "Minecraft", "brown hair and beard, cyan t-shirt, blue trousers, grey shoes", "brown hair", "Steve (Minecraft)"),
    ("sonic", "Sonic", "Sonic the Hedgehog", "blue outfit, white gloves, red sneakers with a white strap", "blue quills styled as swept hair", "Sonic the Hedgehog"),
    ("shadow", "Shadow", "Sonic the Hedgehog", "black and red outfit, white gloves, inhibitor rings, hover shoes", "black and red swept hair", "Shadow the Hedgehog"),
    ("cynthia", "Cynthia", "Pokemon", "long blonde hair, black coat over a black top, black pants, heels", "long blonde hair", "Cynthia (Pokemon)"),
    ("raiden-shogun", "Raiden Shogun", "Genshin Impact", "long purple braid, purple kimono with gold embroidery, hair ornament", "long purple braid", "Raiden Shogun"),
    ("hu-tao", "Hu Tao", "Genshin Impact", "long brown twintails, plum-blossom hat, dark coat with red lining, shorts", "long brown twintails", "Hu Tao (Genshin Impact)"),
    ("zhongli", "Zhongli", "Genshin Impact", "long dark hair with an amber tip, brown tailcoat, gold vest, gloves", "long dark hair with an amber tip", "Zhongli (Genshin Impact)"),
    ("keqing", "Keqing", "Genshin Impact", "light purple twintails, purple and white dress-coat, stockings, heels", "light purple twintails", "Keqing"),
    ("doom", "Doom Slayer", "Doom", "green Praetor armor, helmet with a visor, heavy boots", "helmet", "Doom Slayer"),
    ("claire", "Claire Redfield", "Resident Evil", "brown ponytail, red vest, white shirt, jeans, boots", "brown ponytail", "Claire Redfield"),
    ("lady", "Lady Dimitrescu", "Resident Evil", "black hair, wide white hat, long white dress, black gloves, pearl necklace", "black hair under a wide hat", "Alcina Dimitrescu"),
    ("kiryu", "Kazuma Kiryu", "Yakuza", "short black hair, grey suit, red shirt open at the collar", "short black hair", "Kazuma Kiryu"),
    ("phoenix", "Phoenix Wright", "Ace Attorney", "spiky black hair, blue suit, red tie, attorney badge", "spiky black hair", "Phoenix Wright"),
    ("shepard", "Commander Shepard", "Mass Effect", "short hair, N7 armor in black and red, or a dark dress uniform", "short hair", "Commander Shepard"),
    ("fox", "Fox McCloud", "Star Fox", "orange-red flight jacket, white scarf, green boots, headset", "headset over swept hair", "Fox McCloud"),
]


def fetch(url: str, timeout: int = 30) -> tuple[bytes, str]:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=timeout, context=CTX) as res:
        data = res.read(8_000_000)
        ctype = (res.headers.get("Content-Type") or "").lower()
    return data, ctype


def anilist_image(search: str) -> str | None:
    query = "query ($s: String) { Character(search: $s) { name { full } image { large } } }"
    body = json.dumps({"query": query, "variables": {"s": search}}).encode()
    req = urllib.request.Request(
        "https://graphql.anilist.co",
        data=body,
        headers={"Content-Type": "application/json", "Accept": "application/json", "User-Agent": UA},
    )
    with urllib.request.urlopen(req, timeout=25, context=CTX) as res:
        payload = json.loads(res.read().decode())
    image = ((payload.get("data") or {}).get("Character") or {}).get("image") or {}
    return image.get("large")


def wiki_image(title: str) -> str | None:
    url = "https://en.wikipedia.org/api/rest_v1/page/summary/" + urllib.request.quote(title)
    raw, _ = fetch(url)
    data = json.loads(raw.decode())
    original = (data.get("originalimage") or {}).get("source")
    thumb = (data.get("thumbnail") or {}).get("source")
    return original or thumb


def ext_of(raw: bytes, url: str) -> str | None:
    if raw[:3] == b"\xff\xd8\xff":
        return ".jpg"
    if raw[:8] == b"\x89PNG\r\n\x1a\n":
        return ".png"
    if raw[:4] == b"RIFF" and b"WEBP" in raw[:16]:
        return ".webp"
    lower = url.lower()
    if ".png" in lower:
        return ".png"
    if ".jpg" in lower or ".jpeg" in lower:
        return ".jpg"
    return None


def save(url: str, dest_stem: Path) -> str | None:
    try:
        raw, _ = fetch(url)
    except Exception as exc:
        print(f"  download fail {url}: {exc}")
        return None
    ext = ext_of(raw, url)
    if ext is None or len(raw) < 4000:
        print(f"  bad image {dest_stem.name} {len(raw)}")
        return None
    dest = dest_stem.with_suffix(ext)
    dest.write_bytes(raw)
    return dest.name


def template(folder: Path) -> None:
    payload = {
        "id": "example-id",
        "name": "Character name",
        "series": "Series",
        "image": "your-photo.jpg",
        "look": "hairstyle, outfit colours, cut and signature accessories",
        "hair": "hair cut and colour",
    }
    (folder / "_template.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def collect(rows, folder: Path, kind: str, limit: int) -> list[dict]:
    folder.mkdir(parents=True, exist_ok=True)
    saved = []
    for row in rows:
        if len(saved) >= limit:
            break
        cid, name, series, look, hair, search = row
        print(f"{kind} {name}", flush=True)
        image_url = None
        searches = [search]
        if kind == "game" and search in WIKI_FALLBACK:
            searches.append(WIKI_FALLBACK[search])
        for query in searches:
            try:
                image_url = anilist_image(query) if kind == "anime" else wiki_image(query)
            except Exception as exc:
                print(f"  lookup fail {name}: {exc}")
                image_url = None
            if image_url:
                break
        if not image_url:
            print(f"  no image {name}")
            time.sleep(0.2)
            continue
        filename = save(image_url, folder / cid)
        if not filename:
            continue
        saved.append(
            {
                "id": cid,
                "name": name,
                "series": series,
                "image": filename,
                "look": look,
                "hair": hair,
            }
        )
        time.sleep(0.25)
    return saved


def main() -> None:
    anime = collect(ANIME, OUT / "anime", "anime", 100)
    games = collect(GAMES, OUT / "games", "game", 50)
    for folder, rows in ((OUT / "anime", anime), (OUT / "games", games)):
        template(folder)
        keep = {row["image"] for row in rows}
        (folder / "items.json").write_text(
            json.dumps({"items": rows}, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        for file in folder.iterdir():
            if file.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"} and file.name not in keep:
                file.unlink()
    old_json = OUT / "characters.json"
    old_img = OUT / "images"
    if old_json.exists():
        old_json.unlink()
    if old_img.exists():
        shutil.rmtree(old_img)
    print(json.dumps({"anime": len(anime), "games": len(games)}, indent=2))


if __name__ == "__main__":
    main()
