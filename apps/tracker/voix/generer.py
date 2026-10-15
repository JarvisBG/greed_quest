"""Voix off de l'écran géant (apps/tracker) : une phrase = un fichier MP3 (edge-tts, voix neuronales de Microsoft).

Usage : python apps/tracker/voix/generer.py
Écrit public/voix/NNN.mp3 et public/voix/index.json ({texte: fichier}). Les phrases déjà générées sont gardées.

Choix de Sivraj (2026-10-15, version « B » de l'essai d'écoute) :
- tout est dit en français par Henri (fr-FR-HenriNeural, voix uniquement française : Clear, Book, Hunters à la française) ;
- « Greed Island » seul est dit en anglais, par Rémy (fr-FR-RemyMultilingualNeural, la voix de la vidéo), puis recollé ;
- phrases fixes : aucun pseudo ni nom de carte, « un joueur » à la place.
"""
import asyncio, json, pathlib
import edge_tts
import edge_tts.communicate as ec

ICI = pathlib.Path(__file__).parent.parent / 'public' / 'voix'
FRANCAIS = 'fr-FR-HenriNeural'
ANGLAIS = 'fr-FR-RemyMultilingualNeural'
SSML_ANGLAIS = ec.mkssml  # edge-tts annonce l'anglais (en-US) : Rémy dit alors « Greed Island » à l'anglaise


def ssml_francais(tc, texte):
    """Même enveloppe qu'edge-tts, mais la langue annoncée est le français."""
    if isinstance(texte, bytes):
        texte = texte.decode('utf-8')
    return (
        "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='fr-FR'>"
        f"<voice name='{tc.voice}'><prosody pitch='{tc.pitch}' rate='{tc.rate}' volume='{tc.volume}'>{texte}</prosody></voice></speak>"
    )


# (texte, vitesse, hauteur) : les grands moments sont dits plus lentement et plus grave.
PHRASES = [
    ('Bienvenue dans Greed Island !', '+0%', '-4Hz'),
    ('Un nouveau joueur entre dans Greed Island !', '+8%', '+0Hz'),
    ('Carte rare ! Un joueur a tiré une carte de rang double S !', '+8%', '+0Hz'),
    ('Carte rare ! Un joueur a tiré une carte de rang S !', '+8%', '+0Hz'),
    ('Jarvis a parlé !', '-12%', '-10Hz'),
    ('Un joueur reçoit une carte par Décret. Les joueurs autour de lui sont gelés.', '+5%', '+0Hz'),
    ("Le Sceau d'Ange ! Un joueur a scellé le Book d'un autre joueur.", '+0%', '-4Hz'),
    ('Alerte ! La Brigade attaque ! Tous les Hunters au combat !', '+15%', '+2Hz'),
    ('La Brigade est vaincue ! Bravo les Hunters !', '+8%', '+0Hz'),
    ("La Brigade s'est enfuie.", '-5%', '-4Hz'),
    ('Clear ! Un joueur a réuni toutes les cartes désignées !', '+0%', '-2Hz'),
    ('Fin de la partie !', '-15%', '-10Hz'),
    ('Troisième place !', '+0%', '+0Hz'),
    ('Deuxième place !', '+0%', '+0Hz'),
    ('Et voici le vainqueur !', '-5%', '-4Hz'),
    ('Un joueur prend la tête !', '+10%', '+0Hz'),
    ('Dépassement ! Un joueur gagne une place !', '+10%', '+0Hz'),
    ('Évènement ! Pluie de cartes !', '+8%', '+0Hz'),
    ('Évènement ! Double gain !', '+8%', '+0Hz'),
    ('Évènement ! Une carte maudite circule !', '+0%', '-6Hz'),
    # Portage (2026-10-15) : les autres évènements de l'API (RG-12).
    ('Évènement ! Une apparition !', '+8%', '+0Hz'),
    ('Évènement ! Une zone est maudite !', '+0%', '-6Hz'),
    ('Évènement ! Krach de Masadora !', '+8%', '+0Hz'),
    ('Phase finale ! Les dernières minutes commencent !', '+12%', '+0Hz'),
    ('La partie est en pause.', '+0%', '+0Hz'),
    ('Reprise de la partie !', '+8%', '+0Hz'),
]


async def synthese(texte, voix, ssml, vitesse, hauteur):
    """Un morceau de phrase en MP3 (octets). Le service refuse parfois une connexion : on réessaie."""
    ec.mkssml = ssml
    for essai in range(4):
        try:
            morceaux = []
            async for m in edge_tts.Communicate(texte, voix, rate=vitesse, pitch=hauteur).stream():
                if m['type'] == 'audio':
                    morceaux.append(m['data'])
            return b''.join(morceaux)
        except Exception:
            if essai == 3:
                raise
            await asyncio.sleep(2)


async def phrase(texte, vitesse, hauteur):
    """Découpe autour de « Greed Island » : Henri en français, Rémy en anglais. Même format MP3, recollés bout à bout."""
    audio = b''
    for i, bout in enumerate(texte.split('Greed Island')):
        if i:
            audio += await synthese('Greed Island.', ANGLAIS, SSML_ANGLAIS, vitesse, hauteur)
        if bout.strip(' !.'):
            audio += await synthese(bout.strip(), FRANCAIS, ssml_francais, vitesse, hauteur)
    return audio


async def main():
    index_f = ICI / 'index.json'
    index = json.loads(index_f.read_text(encoding='utf-8')) if index_f.exists() else {}
    n = max([int(f[:3]) + 1 for f in index.values()], default=0)
    for texte, vitesse, hauteur in PHRASES:
        if texte in index and (ICI / index[texte]).exists():
            continue
        nom = f'{n:03d}.mp3'
        (ICI / nom).write_bytes(await phrase(texte, vitesse, hauteur))
        index[texte] = nom
        n += 1
        index_f.write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding='utf-8')
        print(nom, texte)


asyncio.run(main())
