// RG-5.1 amendé (2026-10-20) : code de secours du joueur, pour reprendre sa partie sur un autre téléphone.
// Montré en grand avec le kit (première fois), puis rappelé sous la licence.
export function CodeSecours({ code, premiere = false }: { code: string; premiere?: boolean }) {
  return (
    <section className="gi-case code-secours" aria-label="Ton code de secours">
      <span className="code-secours-titre">Ton code de secours</span>
      <b className="code-secours-code" aria-label={code.split('').join(' ')}>
        {code}
      </b>
      <p className="doux">
        {premiere
          ? 'Note-le ou fais une capture d’écran. Si ton téléphone s’éteint ou se casse, ce code te permet de reprendre ta partie sur un autre.'
          : 'Sur un autre téléphone : « Je suis déjà inscrit », ton pseudo et ce code. Ne le donne à personne.'}
      </p>
    </section>
  );
}
