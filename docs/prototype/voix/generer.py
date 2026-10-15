"""Voix off du prototype de l'écran géant : une phrase = un fichier MP3, voix neuronale Rémy (edge-tts).

Usage : python docs/prototype/voix/generer.py
Écrit voix/NNN.mp3 et voix/index.json ({texte: fichier}). Les phrases déjà générées sont gardées.
Même voix que la vidéo de video-event-quest : fr-FR-RemyMultilingualNeural, +8 %.
"""
import asyncio, json, pathlib
import edge_tts

ICI = pathlib.Path(__file__).parent
VOIX = 'fr-FR-RemyMultilingualNeural'
JOUEURS = ['Kirua', 'Gon', 'Biscuit', 'Kurapika', 'Leolio', 'Hisoka', 'Knuckle', 'Shoot', 'Palm', 'Morel', 'Ikalgo', 'Melody']
ARRIVANTS = ['Kite', 'Goreinu', 'Tsezgerra', 'Bara', 'Ging', 'Razor', 'Genthru', 'Nobunaga']

# (texte, vitesse, hauteur) : les grands moments sont dits plus lentement et plus grave.
PHRASES = [
    ('Bienvenue dans Greed Island !', '+0%', '-4Hz'),
    ('Carte rare ! Biscuit a tiré « Le bonheur du détenteur ». Rang double S !', '+8%', '+0Hz'),
    ('Carte rare ! Kurapika a tiré « Le souffle du grand ange ». Rang S !', '+8%', '+0Hz'),
    ('Jarvis a parlé !', '-12%', '-10Hz'),
    ('Gon reçoit Blue planet par Décret. Quatre Hunters sont gelés.', '+5%', '+0Hz'),
    ("Le Sceau d'Ange ! Leolio a scellé le Book de Kurapika.", '+0%', '-4Hz'),
    ('Alerte ! La Brigade attaque ! Tous les Hunters au combat !', '+15%', '+2Hz'),
    ('La Brigade est vaincue ! Bravo les Hunters !', '+8%', '+0Hz'),
    ("La Brigade s'est enfuie.", '-5%', '-4Hz'),
    ('Clear ! Kirua a réuni les 30 cartes désignées !', '+0%', '-2Hz'),
    ('Fin de la partie !', '-15%', '-10Hz'),
    ('Évènement ! Pluie de cartes dans la zone Forêt !', '+8%', '+0Hz'),
    ('Évènement ! Double gain dans la zone Prairie !', '+8%', '+0Hz'),
    ('Évènement ! Une carte maudite circule !', '+0%', '-6Hz'),
    ('Phase finale ! Les dernières minutes commencent !', '+12%', '+0Hz'),
    ('La partie est en pause.', '+0%', '+0Hz'),
    ('Reprise de la partie !', '+8%', '+0Hz'),
]
for p in JOUEURS:
    PHRASES += [
        (f'Troisième : {p}.', '+0%', '+0Hz'),
        (f'Deuxième : {p}.', '+0%', '+0Hz'),
        (f'Et la victoire revient à {p} !', '-5%', '-4Hz'),
        (f'{p} prend la tête !', '+10%', '+0Hz'),
        (f'Dépassement ! {p} gagne une place !', '+10%', '+0Hz'),
    ]
for p in ARRIVANTS:
    PHRASES.append((f'{p} entre dans Greed Island !', '+8%', '+0Hz'))


async def main():
    index_f = ICI / 'index.json'
    index = json.loads(index_f.read_text(encoding='utf-8')) if index_f.exists() else {}
    n = len(index)
    for texte, vitesse, hauteur in PHRASES:
        if texte in index and (ICI / index[texte]).exists():
            continue
        nom = f'{n:03d}.mp3'
        for essai in range(4):
            try:
                await edge_tts.Communicate(texte, VOIX, rate=vitesse, pitch=hauteur).save(str(ICI / nom))
                break
            except Exception as e:  # le service refuse parfois une connexion : on réessaie
                if essai == 3:
                    raise
                await asyncio.sleep(2)
        index[texte] = nom
        n += 1
        index_f.write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding='utf-8')
        print(nom, texte)


asyncio.run(main())
