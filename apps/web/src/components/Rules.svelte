<script lang="ts">
  import Modal from './Modal.svelte';
  import Icon from './Icon.svelte';
  import Sloth from './Sloth.svelte';

  let { onclose }: { onclose: () => void } = $props();
</script>

<Modal {onclose} label="Regole del gioco">
  <div class="row">
    <h2 class="grow">Come si gioca</h2>
    <button type="button" class="icon-btn" onclick={onclose} aria-label="Chiudi"><Icon name="close" /></button>
  </div>

  <section class="goal">
    <span class="pic"><Sloth variant={2} mood="sleepy" /></span>
    <p>
      Metti <b>un bradipo in ogni riga</b>, <b>in ogni colonna</b> e <b>in ogni regione colorata</b>.
      Due bradipi <b>non si toccano</b>, nemmeno in diagonale.
    </p>
  </section>
  <p class="muted">Ogni livello ha una sola soluzione e si risolve con la logica: non serve mai tirare a indovinare.</p>

  <h3>Comandi</h3>
  <ul>
    <li><b>Un tocco</b>: segni una X dove il bradipo non può stare.</li>
    <li><b>Doppio tocco</b>: metti un bradipo.</li>
    <li><b>Tocca</b> una X o un bradipo per toglierli.</li>
    <li><b>Trascina</b> il dito per mettere o togliere tante X insieme.</li>
  </ul>

  <h3>Aiuto</h3>
  <p>Il primo tocco ti dice <b>dove guardare</b>, il secondo ti <b>spiega</b> il ragionamento. Se c'è un errore te lo segnala prima di tutto. Ogni aiuto toglie un po' di punti.</p>

  <h3>Percorso</h3>
  <p>Una strada di livelli, <b>uguale per tutti</b>, che cresce piano piano: griglie più grandi e ogni tanto un livello <b>Difficile</b>. La <b>stella</b> in alto conta i livelli che hai completato.</p>

  <h3>Punti</h3>
  <ul>
    <li><b>Difficoltà</b>: più il livello è impegnativo, più punti vale.</li>
    <li><b>Velocità</b>: punti in più se finisci prima del tempo di riferimento (nei livelli Difficili contano il doppio).</li>
    <li><b>Partita pulita</b> (mai un bradipo fuori posto): ×1,2.</li>
    <li><b>Senza aiuti</b>: ×1,5; ogni aiuto riduce il moltiplicatore.</li>
  </ul>

  <h3>Grado, serie e premi</h3>
  <p>
    Ogni punto vale un <b>XP</b>: la barra in fondo alla Home mostra quanto manca al prossimo <b>grado</b>.
    Gioca almeno una partita al giorno per allungare la <b>serie</b> <span class="ic"><Icon name="flame" /></span>.
    Gradi e <b>medaglie</b> sbloccano gli accessori per i tuoi bradipi.
  </p>

  <h3>Sfide</h3>
  <p>Sfida gli <b>amici del portale</b> sullo stesso livello, ognuno quando vuole. Vince chi fa più punti; a parità, chi ha usato meno aiuti, poi chi è stato più veloce.</p>

  <button type="button" class="btn btn-sun btn-block" onclick={onclose}>Ho capito</button>
</Modal>

<style>
  h3 { font-size: 1.1rem; margin-top: 2px; }
  ul { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 4px; }
  p { margin: 0; }
  .goal { display: flex; gap: 12px; align-items: center; background: var(--sun-l); border: 2.5px solid var(--ink); border-radius: 16px; padding: 10px 12px; }
  .pic { width: 56px; height: 56px; flex: none; }
  .ic { display: inline-block; width: 18px; height: 18px; vertical-align: -3px; color: var(--berry); }
  .ic :global(svg) { width: 18px; height: 18px; }
</style>
