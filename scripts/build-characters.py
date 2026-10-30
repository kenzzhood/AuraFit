#!/usr/bin/env python3
"""Original geometric portraits for the character mode catalog.

Not official art and not scraped from studios. Character names identify
copyrighted series; the SVGs are simple original color keys for the demo.
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "characters"
IMG = OUT / "images"

# name, series, look, hair, outfit, accent
RAW = [
    ("Eren Yeager", "Attack on Titan", "short brown undercut, Survey Corps brown jacket, white shirt, brown trousers, leather harness and tall boots", "#5c3b28", "#6b4f38", "#efe6d8"),
    ("Mikasa Ackerman", "Attack on Titan", "short black undercut, long red scarf, Survey Corps brown jacket, white shirt, dark trousers", "#1c1c1c", "#5c4033", "#9b2331"),
    ("Levi Ackerman", "Attack on Titan", "short black undercut, white cravat, Survey Corps jacket, slim grey trousers, harness straps", "#111111", "#3d3a36", "#f4f4f4"),
    ("Armin Arlert", "Attack on Titan", "short blond side part, Survey Corps jacket, white shirt, brown boots", "#e6c56a", "#6d5438", "#f7f1e4"),
    ("Historia Reiss", "Attack on Titan", "long blonde hair, pale blue dress, white collar, small gold hairpin", "#f0d78c", "#d5e4f2", "#f7f3ea"),
    ("Annie Leonhart", "Attack on Titan", "blonde hair in a bun, Survey Corps jacket, white shirt, tan boots", "#e7d39a", "#6a5340", "#f3eee4"),
    ("Hange Zoe", "Attack on Titan", "brown hair tied back, round glasses, Survey Corps jacket, white shirt, brown trousers", "#6b4a32", "#5e4636", "#d9d3c8"),
    ("Reiner Braun", "Attack on Titan", "short blond hair, Survey Corps jacket and tan trousers", "#d7c07a", "#6e563c", "#efe6d4"),
    ("Naruto Uzumaki", "Naruto", "spiky blond hair, orange and black jacket, black undershirt, orange trousers, blue sandals", "#f0d15a", "#f08a1a", "#1d1d1d"),
    ("Sasuke Uchiha", "Naruto", "spiky black hair, white high-collar shirt, blue shorts, rope belt", "#1a1a1a", "#f5f5f5", "#2a3f73"),
    ("Sakura Haruno", "Naruto", "short pink hair, red dress, black shorts, dark arm guards", "#f3a6c8", "#c83b4a", "#f7f4ef"),
    ("Kakashi Hatake", "Naruto", "silver spiky hair, dark face mask, green flak jacket, dark blue clothes", "#c5c8cc", "#3f6b4a", "#2c3444"),
    ("Hinata Hyuga", "Naruto", "dark blue hime-cut hair, cream hooded jacket, lavender trousers", "#3d4c86", "#f3efe6", "#c9b7d8"),
    ("Itachi Uchiha", "Naruto", "long black hair in a low ponytail, dark cloak with red cloud motifs", "#161616", "#2a2a2a", "#8d2a2a"),
    ("Gaara", "Naruto", "short red hair, dark clothes under a crimson coat, pale cloth wraps", "#b94a3a", "#8e2430", "#f0e6d8"),
    ("Rock Lee", "Naruto", "black bowl-cut hair, green jumpsuit, orange leg warmers", "#1b1b1b", "#2f6b3a", "#ef7a1a"),
    ("Shikamaru Nara", "Naruto", "black hair in a small ponytail, green flak jacket, dark grey clothes", "#222222", "#3e5c45", "#6d6a64"),
    ("Jiraiya", "Naruto", "long wild white hair, green haori over a red inner robe", "#f2f2f2", "#c5362b", "#2f6a45"),
    ("Tsunade", "Naruto", "long blonde hair, green haori, grey kimono-style top, dark obi", "#e7d48a", "#2f6b45", "#c9c3b6"),
    ("Minato Namikaze", "Naruto", "spiky blond hair, long white cloak with flame-like hems, green flak jacket", "#f2d56a", "#f7f7f2", "#3f6b4a"),
    ("Son Goku", "Dragon Ball", "tall spiky black hair, orange gi, blue undershirt, blue belt, blue wristbands and boots", "#1a1a1a", "#ef7d1a", "#2a4f9a"),
    ("Vegeta", "Dragon Ball", "tall flame-shaped black hair, white and gold Saiyan armor, dark blue jumpsuit, white gloves and boots", "#161616", "#f4f4f4", "#d4b15a"),
    ("Gohan", "Dragon Ball", "spiky black hair, purple gi over a blue undershirt, red belt", "#1c1c1c", "#5a3d86", "#2a4f9a"),
    ("Trunks", "Dragon Ball", "short lavender hair, black jacket with a Capsule Corp logo left off, white shirt, dark trousers", "#b7a6d4", "#1e1e1e", "#f3f3f3"),
    ("Bulma", "Dragon Ball", "teal bob hair, pink cropped jacket, white top, denim shorts or a blue skirt", "#3aa8b5", "#e56b93", "#f7f4ef"),
    ("Android 18", "Dragon Ball", "blonde bob, blue denim vest, black shirt, striped trousers, gold hoop earrings", "#e6d28a", "#3a6ea5", "#111111"),
    ("Piccolo", "Dragon Ball", "bald head with antennae suggested only by a pointed collar, white cape, purple gi, blue sash", "#3d7a45", "#5a3d86", "#f4f4f4"),
    ("Krillin", "Dragon Ball", "bald head, orange gi, blue undershirt, blue belt and boots", "#e6c8b0", "#ef7d1a", "#2a4f9a"),
    ("Monkey D. Luffy", "One Piece", "short black hair, straw hat with a red band, open red vest, blue shorts, sandals", "#1a1a1a", "#c83b3b", "#f0d78c"),
    ("Roronoa Zoro", "One Piece", "short green hair, white haramaki, dark green trousers, black shirt, three gold earrings", "#3f8f55", "#f4f4f4", "#1d1d1d"),
    ("Nami", "One Piece", "orange shoulder-length hair, striped orange and white top, blue jeans, tattoo left off", "#e07a2f", "#f3f3f3", "#2a4f9a"),
    ("Sanji", "One Piece", "blond hair covering one eye, black suit, dress shirt, tie", "#e6c56a", "#1a1a1a", "#f7f4ef"),
    ("Nico Robin", "One Piece", "long black hair, purple cowboy hat, light purple top, dark jeans", "#1a1a1a", "#6b4e86", "#c9b6d8"),
    ("Usopp", "One Piece", "long black curly hair, a long nose left as the visitor's own face, brown overalls, goggles on the head", "#1c1c1c", "#6b4a2e", "#d8c3a0"),
    ("Franky", "One Piece", "bright blue pompadour, red and yellow open Hawaiian shirt, speedo-style trunks swapped for blue shorts", "#2f6adf", "#e23b3b", "#f0d24a"),
    ("Shanks", "One Piece", "red hair, short beard stubble only if the visitor already has it, black cloak, white shirt, dark trousers", "#8d2e2e", "#1c1c1c", "#f4f4f4"),
    ("Portgas D. Ace", "One Piece", "freckles left off unless the visitor has them, black hair, orange hat, open shirt, shorts, necklace of red beads", "#1a1a1a", "#ef7d1a", "#111111"),
    ("Boa Hancock", "One Piece", "long black hair, red cape, white and red dress, gold earrings", "#161616", "#f7f4ef", "#9b2331"),
    ("Trafalgar Law", "One Piece", "dark hair under a spotted white hat, yellow hoodie, dark jeans", "#2a2a2a", "#f2f2f2", "#e2c15a"),
    ("Jinbe", "One Piece", "black hair, a small topknot, yellow kimono-style robe, dark obi, sea-captain coat", "#1a1a1a", "#e2c15a", "#2a3f55"),
    ("Izuku Midoriya", "My Hero Academia", "messy dark green hair, green jumpsuit with white accents, red boots, gloves", "#2f5a3a", "#1f8a4c", "#f4f4f4"),
    ("Katsuki Bakugo", "My Hero Academia", "spiky ash-blond hair, black tank with an orange X, green cargo trousers, grenade-like gauntlets left as plain orange cuffs", "#d9c07a", "#1a1a1a", "#ef7a1a"),
    ("Shoto Todoroki", "My Hero Academia", "hair split white on one side and red on the other, white and grey hero costume, ice-blue boots", "#f4f4f4", "#d9dde3", "#b94a3a"),
    ("Ochaco Uraraka", "My Hero Academia", "short brown hair, pink and black hero bodysuit, rounded helmet collar, pink boots", "#6b4632", "#e89ab8", "#1a1a1a"),
    ("Tenya Iida", "My Hero Academia", "dark blue hair, glasses, armored blue and white hero suit with engine-like boot cuffs shown as silver boots", "#243056", "#2a4f9a", "#f4f4f4"),
    ("Tsuyu Asui", "My Hero Academia", "dark green hair in a low style, green and black bodysuit, large goggles at the neck", "#1f4a32", "#2f6b3a", "#111111"),
    ("Eijiro Kirishima", "My Hero Academia", "spiky red hair, red gear with black shoulder straps, dark trousers", "#a33b32", "#8d2a2a", "#1a1a1a"),
    ("Momo Yaoyorozu", "My Hero Academia", "long black hair in a ponytail, red and white hero costume with a high collar and gold belt", "#161616", "#c83b3b", "#f4f4f4"),
    ("All Might", "My Hero Academia", "blond hair swept back, white and blue hero suit with red and gold accents, a cape", "#e6c56a", "#f7f7f2", "#2a4f9a"),
    ("Shota Aizawa", "My Hero Academia", "long messy black hair, grey scarf wrapped high, black jumpsuit, goggles at the neck", "#1a1a1a", "#2a2a2a", "#8a8a8a"),
    ("Hawks", "My Hero Academia", "ash-blond tousled hair, yellow visor glasses, dark jacket with a high fur collar, gold headset", "#cbb98a", "#1c1c1c", "#e2c15a"),
    ("Dabi", "My Hero Academia", "black spiky hair, stapled-coat look shown as a dark turquoise long coat over a white shirt, dark trousers", "#1a1a1a", "#1f4a55", "#f4f4f4"),
    ("Satoru Gojo", "Jujutsu Kaisen", "spiky white hair, black blindfold or round dark sunglasses, black high-collar jacket, dark trousers", "#f4f4f4", "#161616", "#2a2a2a"),
    ("Yuji Itadori", "Jujutsu Kaisen", "spiky pink hair, red hoodie under a dark school-style jacket, black trousers", "#e7a0b4", "#c83b3b", "#1a1a1a"),
    ("Megumi Fushiguro", "Jujutsu Kaisen", "spiky black hair, dark blue high-collar uniform, black trousers", "#1a1a1a", "#243056", "#111111"),
    ("Nobara Kugisaki", "Jujutsu Kaisen", "short orange-brown hair, dark gakuran-style uniform, black skirt or trousers, a belt", "#a86a45", "#2a2a2a", "#1a1a1a"),
    ("Kento Nanami", "Jujutsu Kaisen", "blond hair neatly parted, blue suit, white shirt, spotted tie, glasses", "#e0c57a", "#2a3f55", "#f7f4ef"),
    ("Suguru Geto", "Jujutsu Kaisen", "long black hair half tied up, loose dark robes over a monk-like top", "#161616", "#2c241c", "#f0e6d4"),
    ("Ryomen Sukuna", "Jujutsu Kaisen", "spiky pink hair, black tattoos as face and body markings only if they read as face paint, white kimono, dark scarf", "#e7a0b4", "#f4f1ea", "#1a1a1a"),
    ("Maki Zenin", "Jujutsu Kaisen", "green hair in a ponytail, glasses, dark uniform, utility belt", "#3f6b45", "#2a2a2a", "#d9d3c8"),
    ("Yuta Okkotsu", "Jujutsu Kaisen", "messy black hair, white uniform jacket, dark trousers, a ring", "#1a1a1a", "#f7f7f2", "#243056"),
    ("Toji Fushiguro", "Jujutsu Kaisen", "black hair, a scar at the mouth only as a small line, black tight shirt, dark pants, a belt", "#161616", "#1c1c1c", "#6d6a64"),
    ("Tanjiro Kamado", "Demon Slayer", "burgundy hair with a forehead scar left off unless natural, green-and-black checkered haori, dark uniform, hanafuda earrings", "#6b2e3a", "#1f3a2a", "#e8e0d4"),
    ("Nezuko Kamado", "Demon Slayer", "long black hair fading to orange tips, pink kimono, hemp-leaf haori, a bamboo muzzle left off so the visitor's face stays clear", "#1a1a1a", "#e7b7c6", "#ef7a1a"),
    ("Zenitsu Agatsuma", "Demon Slayer", "yellow hair with an orange tip, yellow haori with white triangle pattern, dark uniform", "#f0d15a", "#e2c15a", "#f7f4ef"),
    ("Inosuke Hashibira", "Demon Slayer", "black hair, boar mask left off so the face stays the visitor's, fur-trimmed bare chest swapped for a fur-collared dark vest, loose pants", "#1a1a1a", "#6b5344", "#d8c3a0"),
    ("Kyojuro Rengoku", "Demon Slayer", "bright yellow hair with red tips, flame-patterned white haori, dark uniform, white belt", "#f0c14a", "#f7f4ef", "#c83b3b"),
    ("Shinobu Kocho", "Demon Slayer", "black hair with purple tips in a bun, butterfly haori in pale purple, dark uniform", "#2a2a3a", "#e4d4ee", "#1a1a1a"),
    ("Mitsuri Kanroji", "Demon Slayer", "thick pink hair in braids fading to green tips, low-cut uniform replaced with a modest dark uniform and a white haori, striped socks", "#f3a6c8", "#f7f4ef", "#3f8f55"),
    ("Giyu Tomioka", "Demon Slayer", "messy black hair, half-and-half haori of solid maroon and green geometric pattern, dark uniform", "#1a1a1a", "#6b2e3a", "#2f5a3a"),
    ("Tengen Uzui", "Demon Slayer", "white hair, jeweled headband, flamboyant sleeveless uniform with gems, dark trousers", "#f4f4f4", "#2a2a2a", "#d4b15a"),
    ("Muichiro Tokito", "Demon Slayer", "long black hair fading to teal, dark uniform, white belt", "#1a1a1a", "#1f3a3a", "#7ec8c3"),
    ("Usagi Tsukino", "Sailor Moon", "blonde hair in twin buns with long pigtails, white and navy sailor uniform, blue skirt, red bow, gold tiara, white gloves", "#f0d78c", "#f7f7f2", "#2a3f73"),
    ("Ami Mizuno", "Sailor Moon", "short blue hair, sailor uniform with a blue skirt and blue bow", "#4a6db5", "#f7f7f2", "#2a4f9a"),
    ("Rei Hino", "Sailor Moon", "long black hair, sailor uniform with a red skirt and red bow", "#161616", "#f7f7f2", "#9b2331"),
    ("Makoto Kino", "Sailor Moon", "brown ponytail, sailor uniform with a green skirt and pink bow", "#6b4632", "#f7f7f2", "#2f6b3a"),
    ("Minako Aino", "Sailor Moon", "blonde hair with a red bow, sailor uniform with an orange skirt and blue bow", "#f0d78c", "#f7f7f2", "#ef7a1a"),
    ("Light Yagami", "Death Note", "neat light brown hair, beige suit, white shirt, red tie", "#a67c52", "#d8c3a0", "#9b2331"),
    ("L", "Death Note", "messy black hair, loose white long-sleeve shirt, blue jeans, no shoes or white sneakers", "#1a1a1a", "#f7f7f2", "#2a4f9a"),
    ("Misa Amane", "Death Note", "blonde pigtails, black gothic dress with a cross necklace, lace trim", "#f0d78c", "#161616", "#c9b6d8"),
    ("Edward Elric", "Fullmetal Alchemist", "long blond braid, red coat, black clothes, white gloves", "#e6c56a", "#9b2331", "#1a1a1a"),
    ("Alphonse Elric", "Fullmetal Alchemist", "armor look translated as a steel-colored coat and helmet-like collar, the visitor's face remaining visible", "#c5c8cc", "#d9dde3", "#8a8a8a"),
    ("Winry Rockbell", "Fullmetal Alchemist", "blonde hair in a ponytail, white tank under blue denim overalls", "#e6c56a", "#3a6ea5", "#f7f4ef"),
    ("Roy Mustang", "Fullmetal Alchemist", "black hair, blue military coat with gold trim, white gloves", "#1a1a1a", "#243056", "#d4b15a"),
    ("Riza Hawkeye", "Fullmetal Alchemist", "blonde hair pinned up, blue military jacket, white shirt, dark skirt or trousers", "#e6c56a", "#2a3f55", "#f7f4ef"),
    ("Jotaro Kujo", "JoJo's Bizarre Adventure", "black hair under a dark cap, long dark coat, gold chain, white shirt", "#1a1a1a", "#1c1c1c", "#d4b15a"),
    ("Joseph Joestar", "JoJo's Bizarre Adventure", "brown hair, fingerless gloves, brown jacket, light shirt", "#6b4632", "#6b4a2e", "#e6c8b0"),
    ("Josuke Higashikata", "JoJo's Bizarre Adventure", "black pompadour, purple school uniform, gold heart pin, peace-sign badge left as a small pin", "#161616", "#5a3d86", "#d4b15a"),
    ("Giorno Giovanna", "JoJo's Bizarre Adventure", "blond hair with a distinctive donut curl, pink suit, ladybug brooches, heart-shaped chest window filled with a pink shirt", "#e6c56a", "#e7b7c6", "#1a1a1a"),
    ("Jolyne Cujoh", "JoJo's Bizarre Adventure", "green-and-blue braided hair, green crop jacket and dark pants with butterfly motifs", "#2f8f6b", "#1f6b4a", "#3aa8b5"),
    ("Bruno Bucciarati", "JoJo's Bizarre Adventure", "black bob with a braid, white suit with black teardrop cutouts shown as a patterned white suit", "#1a1a1a", "#f7f7f2", "#111111"),
    ("Dio Brando", "JoJo's Bizarre Adventure", "blond hair, peaked cap, long yellow jacket, dark shirt, heart-shaped headband detail as a thin gold band", "#e6c56a", "#e2c15a", "#1a1a1a"),
    ("Jonathan Joestar", "JoJo's Bizarre Adventure", "blue-black hair, gentleman's blue jacket, white shirt, cravat", "#243056", "#2a3f73", "#f7f4ef"),
    ("Loid Forger", "Spy x Family", "neat blond hair, green suit, white shirt, black tie", "#e0c57a", "#2f5a3a", "#f7f4ef"),
    ("Yor Forger", "Spy x Family", "long black hair, red off-shoulder dress with a rose at the hip, gold headband, black gloves", "#161616", "#9b2331", "#d4b15a"),
    ("Anya Forger", "Spy x Family", "pink hair in two cones, black dress with a gold hem, white socks, black shoes", "#f3a6c8", "#1a1a1a", "#d4b15a"),
    ("Denji", "Chainsaw Man", "messy blond hair, white shirt, loose red tie, black trousers", "#e6c56a", "#f7f7f2", "#9b2331"),
    ("Power", "Chainsaw Man", "long blonde hair, red horns left off, white shirt, black tie, dark trousers", "#f0d78c", "#f4f4f4", "#1a1a1a"),
    ("Aki Hayakawa", "Chainsaw Man", "black hair in a topknot, dark suit, white shirt, sword-shaped earring", "#1a1a1a", "#2a2a2a", "#f7f4ef"),
    ("Makima", "Chainsaw Man", "long light-red hair in a braid, yellow eyes left as the visitor's eyes, white shirt, black tie, dark trousers", "#c96a62", "#f7f7f2", "#1a1a1a"),
    ("Shinji Ikari", "Neon Genesis Evangelion", "short brown hair, white shirt, blue plugsuit collar shown as a blue and white high collar, dark trousers", "#6b4632", "#f7f7f2", "#2a4f9a"),
    ("Asuka Langley", "Neon Genesis Evangelion", "long red hair with interface clips as small red hairpins, red plugsuit shown as a red high-collar bodysuit", "#a33b32", "#c83b3b", "#f4f4f4"),
    ("Rei Ayanami", "Neon Genesis Evangelion", "short light-blue hair, red eyes left as the visitor's eyes, white plugsuit shown as a white high-collar bodysuit", "#c5d4e0", "#f7f7f2", "#9b2331"),
    ("Misato Katsuragi", "Neon Genesis Evangelion", "dark purple hair, red jacket, black dress, gold cross necklace", "#4a3d6b", "#9b2331", "#1a1a1a"),
    ("Saitama", "One Punch Man", "bald head, yellow jumpsuit, white cape, red gloves and boots", "#e6c8b0", "#e2c15a", "#f7f7f2"),
    ("Genos", "One Punch Man", "blond hair, black shirt, mechanical arms shown as silver arm guards, dark jeans", "#e6c56a", "#1a1a1a", "#c5c8cc"),
    ("Tatsumaki", "One Punch Man", "short curly green hair, black dress, green cape", "#3f8f55", "#161616", "#2f6b3a"),
    ("Frieren", "Frieren", "long silver hair, twin tails, white and gold mage coat, striped skirt, pointed hat", "#d9dde3", "#f7f4ef", "#d4b15a"),
    ("Fern", "Frieren", "long purple hair, black and white mage dress, staff left out", "#5a3d86", "#2a2a2a", "#f7f7f2"),
    ("Himmel", "Frieren", "short blue hair, hero's blue tunic, white sleeves, brown boots", "#3a6ea5", "#2a4f9a", "#f7f4ef"),
    ("Killua Zoldyck", "Hunter x Hunter", "spiky silver hair, blue long-sleeve top, baggy white pants", "#d9dde3", "#3a6ea5", "#f7f7f2"),
    ("Gon Freecss", "Hunter x Hunter", "spiky black-green hair, green jacket, orange shorts, boots", "#2f4a32", "#2f6b3a", "#ef7d1a"),
    ("Kurapika", "Hunter x Hunter", "blond hair, blue tabard over a white tunic, red contacts left as the visitor's eyes", "#e6c56a", "#2a4f9a", "#f7f4ef"),
    ("Zero Two", "Darling in the Franxx", "long pink hair, red horns left off, white and red military uniform with a cap", "#f3a6c8", "#f7f7f2", "#c83b3b"),
    ("Hiro", "Darling in the Franxx", "dark blue hair, white and blue pilot uniform", "#243056", "#f7f7f2", "#2a4f9a"),
    ("Violet Evergarden", "Violet Evergarden", "blonde hair with a blue ribbon, emerald brooch, white jacket, blue skirt, brown boots, white gloves", "#e6c56a", "#f7f7f2", "#1f6b5a"),
    ("Lelouch Lamperouge", "Code Geass", "black hair, purple eyes left as the visitor's eyes, black and gold royal uniform or a school blazer with a purple cape", "#1a1a1a", "#2a2a2a", "#d4b15a"),
    ("C.C.", "Code Geass", "long green hair, white straitjacket-style coat, gold headband", "#3f8f55", "#f7f7f2", "#d4b15a"),
    ("Kirito", "Sword Art Online", "black hair, long black coat, black clothes, white and black sword straps", "#1a1a1a", "#161616", "#f4f4f4"),
    ("Asuna", "Sword Art Online", "long orange-brown hair, white and red knight coat, breastplate shown as a white chest panel", "#c47a4a", "#f7f7f2", "#c83b3b"),
    ("Spike Spiegel", "Cowboy Bebop", "fluffy green hair, blue suit, yellow shirt, yellow tie", "#3f6b4a", "#2a3f55", "#e2c15a"),
    ("Faye Valentine", "Cowboy Bebop", "purple bob, yellow short jacket, red top, yellow shorts shown as a short yellow skirt", "#5a3d86", "#e2c15a", "#9b2331"),
    ("Vash the Stampede", "Trigun", "spiky blond hair, red coat, black shirt, round orange glasses", "#e6c56a", "#c83b3b", "#1a1a1a"),
    ("Inuyasha", "Inuyasha", "long silver hair, dog ears left off, red fire-rat robe, white undershirt, sword strap", "#d9dde3", "#9b2331", "#f7f4ef"),
    ("Kagome Higurashi", "Inuyasha", "long black hair, green and white school sailor uniform", "#1a1a1a", "#f7f7f2", "#2f6b3a"),
    ("Sesshomaru", "Inuyasha", "long silver hair, crescent mark left off, white kimono, purple sash, fluffy collar", "#e6e6e6", "#f7f7f2", "#5a3d86"),
    ("Light No More", "skip", "skip", "#000", "#000", "#000"),
]


def slug(name: str) -> str:
    out = []
    for ch in name.lower():
        if ch.isalnum():
            out.append(ch)
        elif ch in " .'":
            out.append("-")
    text = "".join(out)
    while "--" in text:
        text = text.replace("--", "-")
    return text.strip("-")


def svg(name: str, hair: str, outfit: str, accent: str) -> str:
    parts = name.split()
    mark = (parts[0][0] + (parts[-1][0] if len(parts) > 1 else "")).upper()
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 640">
  <rect width="480" height="640" fill="#14110e"/>
  <rect x="36" y="28" width="408" height="500" rx="36" fill="#1c1814"/>
  <ellipse cx="240" cy="230" rx="92" ry="104" fill="#e7cbb4"/>
  <path d="M148 210 C140 90 340 90 332 214 C360 120 300 70 240 72 C180 70 120 120 148 210 Z" fill="{hair}"/>
  <rect x="150" y="330" width="180" height="230" rx="46" fill="{outfit}"/>
  <rect x="188" y="368" width="104" height="22" rx="8" fill="{accent}"/>
  <circle cx="214" cy="214" r="6" fill="#2a211c"/>
  <circle cx="266" cy="214" r="6" fill="#2a211c"/>
  <text x="240" y="590" text-anchor="middle" font-family="Georgia, serif" font-size="34" fill="#f6f1e8">{mark}</text>
</svg>
"""


def main() -> None:
    raise SystemExit("Use scripts/build-character-refs.py. Characters live in public/characters/anime and public/characters/games.")
    IMG.mkdir(parents=True, exist_ok=True)
    items = []
    for name, series, look, hair, outfit, accent in RAW:
        if series == "skip":
            continue
        cid = slug(name)
        path = IMG / f"{cid}.svg"
        path.write_text(svg(name, hair, outfit, accent), encoding="utf-8")
        items.append(
            {
                "id": cid,
                "name": name,
                "series": series,
                "look": look,
                "hair": look.split(",")[0],
                "image": f"/characters/images/{cid}.svg",
            }
        )
    payload = {
        "note": "Original geometric portraits for a local demo. Not official artwork. Character names belong to their rights holders.",
        "total": len(items),
        "items": items,
    }
    (OUT / "characters.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {len(items)} characters")


if __name__ == "__main__":
    main()
