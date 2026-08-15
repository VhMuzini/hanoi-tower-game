/**
 * Torre de Hanói — lógica do jogo e renderização em TypeScript puro (sem frameworks).
 */

type PegId = 0 | 1 | 2;

interface GameState {
  pegs: number[][]; // cada posição contém os tamanhos dos discos, do maior (base) pro menor (topo)
  diskCount: number;
  moves: number;
  selectedPeg: PegId | null;
  startTime: number | null;
  won: boolean;
}

const PEG_IDS: PegId[] = [0, 1, 2];
const MIN_DISKS = 3;
const MAX_DISKS = 8;
const STORAGE_KEY = "hanoi-best-scores";
const FLY_DURATION_MS = 220;

function minMoves(diskCount: number): number {
  return Math.pow(2, diskCount) - 1;
}

function createInitialState(diskCount: number): GameState {
  const pegs: number[][] = [[], [], []];
  for (let size = diskCount; size >= 1; size--) {
    pegs[0].push(size);
  }
  return {
    pegs,
    diskCount,
    moves: 0,
    selectedPeg: null,
    startTime: null,
    won: false,
  };
}

function topDisk(peg: number[]): number | undefined {
  return peg[peg.length - 1];
}

function canMove(state: GameState, from: PegId, to: PegId): boolean {
  if (from === to) return false;
  const disk = topDisk(state.pegs[from]);
  if (disk === undefined) return false;
  const targetTop = topDisk(state.pegs[to]);
  return targetTop === undefined || disk < targetTop;
}

function applyMove(state: GameState, from: PegId, to: PegId): GameState {
  if (!canMove(state, from, to)) return state;
  const pegs = state.pegs.map((p) => [...p]);
  const disk = pegs[from].pop() as number;
  pegs[to].push(disk);
  const moves = state.moves + 1;
  const won = pegs[2].length === state.diskCount;
  return { ...state, pegs, moves, won, startTime: state.startTime ?? Date.now() };
}

function loadBestScores(): Record<number, number> {
  try {
    const raw = localStorageSafe()?.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveBestScore(diskCount: number, moves: number): void {
  const scores = loadBestScores();
  if (!scores[diskCount] || moves < scores[diskCount]) {
    scores[diskCount] = moves;
    try {
      localStorageSafe()?.setItem(STORAGE_KEY, JSON.stringify(scores));
    } catch {
      /* localStorage indisponível — ignora silenciosamente */
    }
  }
}

function localStorageSafe(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Renderização / DOM
// ---------------------------------------------------------------------------

class HanoiUI {
  private state: GameState;
  private draggingFrom: PegId | null = null;
  private animating = false;

  private readonly boardEl: HTMLElement;
  private readonly movesEl: HTMLElement;
  private readonly minMovesEl: HTMLElement;
  private readonly bestEl: HTMLElement;
  private readonly messageEl: HTMLElement;
  private readonly diskSelect: HTMLSelectElement;
  private readonly resetBtn: HTMLButtonElement;

  constructor(root: HTMLElement, initialDiskCount: number) {
    this.state = createInitialState(initialDiskCount);

    this.boardEl = root.querySelector("#board") as HTMLElement;
    this.movesEl = root.querySelector("#moves") as HTMLElement;
    this.minMovesEl = root.querySelector("#min-moves") as HTMLElement;
    this.bestEl = root.querySelector("#best-score") as HTMLElement;
    this.messageEl = root.querySelector("#message") as HTMLElement;
    this.diskSelect = root.querySelector("#disk-count") as HTMLSelectElement;
    this.resetBtn = root.querySelector("#reset-btn") as HTMLButtonElement;

    this.populateDiskSelect();
    this.diskSelect.value = String(initialDiskCount);

    this.diskSelect.addEventListener("change", () => {
      const count = Number(this.diskSelect.value);
      this.state = createInitialState(count);
      this.render();
    });

    this.resetBtn.addEventListener("click", () => {
      this.state = createInitialState(this.state.diskCount);
      this.render();
    });

    this.render();
  }

  private populateDiskSelect(): void {
    this.diskSelect.innerHTML = "";
    for (let n = MIN_DISKS; n <= MAX_DISKS; n++) {
      const opt = document.createElement("option");
      opt.value = String(n);
      opt.textContent = `${n} discos`;
      this.diskSelect.appendChild(opt);
    }
  }

  private handlePegActivate(pegId: PegId): void {
    if (this.state.won || this.animating) return;

    if (this.state.selectedPeg === null) {
      if (topDisk(this.state.pegs[pegId]) !== undefined) {
        this.state = { ...this.state, selectedPeg: pegId };
        this.render();
      }
      return;
    }

    if (this.state.selectedPeg === pegId) {
      this.state = { ...this.state, selectedPeg: null };
      this.render();
      return;
    }

    const from = this.state.selectedPeg;
    if (canMove(this.state, from, pegId)) {
      this.performMove(from, pegId);
      return;
    }

    // seleção inválida: troca a seleção para o novo pino, se ele tiver disco
    if (topDisk(this.state.pegs[pegId]) !== undefined) {
      this.state = { ...this.state, selectedPeg: pegId };
    } else {
      this.state = { ...this.state, selectedPeg: null };
    }
    this.render();
  }

  private onAfterMove(): void {
    if (this.state.won) {
      saveBestScore(this.state.diskCount, this.state.moves);
    }
  }

  /** Aplica um movimento e dispara a animação de voo do disco entre os pinos. */
  private performMove(from: PegId, to: PegId): void {
    if (this.animating || !canMove(this.state, from, to)) return;

    const diskSize = topDisk(this.state.pegs[from]);
    const sourceEl = diskSize !== undefined ? this.findDiskEl(from, diskSize) : null;
    const startRect = sourceEl ? sourceEl.getBoundingClientRect() : null;

    this.state = applyMove(this.state, from, to);
    this.state = { ...this.state, selectedPeg: null };
    this.onAfterMove();
    this.render();

    if (startRect && diskSize !== undefined) {
      const targetEl = this.findDiskEl(to, diskSize);
      if (targetEl) {
        this.flyDisk(targetEl, startRect);
      }
    }
  }

  private findDiskEl(pegId: PegId, size: number): HTMLElement | null {
    return this.boardEl.querySelector(`.peg[data-peg="${pegId}"] .disk[data-size="${size}"]`);
  }

  /** Cria um clone do disco e o anima voando da posição de origem até a posição atual (destino). */
  private flyDisk(diskEl: HTMLElement, startRect: DOMRect): void {
    const endRect = diskEl.getBoundingClientRect();
    const dx = endRect.left - startRect.left;
    const dy = endRect.top - startRect.top;
    if (dx === 0 && dy === 0) return;

    this.animating = true;
    diskEl.style.visibility = "hidden";

    const clone = diskEl.cloneNode(true) as HTMLElement;
    clone.draggable = false;
    clone.style.position = "fixed";
    clone.style.left = `${startRect.left}px`;
    clone.style.top = `${startRect.top}px`;
    clone.style.width = `${startRect.width}px`;
    clone.style.height = `${startRect.height}px`;
    clone.style.margin = "0";
    clone.style.visibility = "visible";
    clone.style.pointerEvents = "none";
    clone.style.zIndex = "1000";
    clone.classList.add("disk--flying");
    document.body.appendChild(clone);

    const peakLift = Math.min(startRect.top, endRect.top) - 46;

    const animation = clone.animate(
      [
        { transform: "translate(0px, 0px) scale(1)", offset: 0 },
        {
          transform: `translate(${dx / 2}px, ${peakLift - startRect.top}px) scale(1.08)`,
          offset: 0.55,
        },
        { transform: `translate(${dx}px, ${dy}px) scale(1)`, offset: 1 },
      ],
      { duration: FLY_DURATION_MS, easing: "cubic-bezier(0.3, 0.7, 0.3, 1)" }
    );

    const finish = () => {
      clone.remove();
      diskEl.style.visibility = "visible";
      this.animating = false;
    };

    animation.onfinish = finish;
    animation.oncancel = finish;
  }

  private render(): void {
    this.boardEl.innerHTML = "";
    const maxDisk = this.state.diskCount;

    PEG_IDS.forEach((pegId) => {
      const pegEl = document.createElement("div");
      pegEl.className = "peg";
      pegEl.dataset.peg = String(pegId);
      if (this.state.selectedPeg === pegId) pegEl.classList.add("peg--selected");

      const rod = document.createElement("div");
      rod.className = "peg__rod";
      pegEl.appendChild(rod);

      const base = document.createElement("div");
      base.className = "peg__base";
      pegEl.appendChild(base);

      const disksWrap = document.createElement("div");
      disksWrap.className = "peg__disks";
      this.state.pegs[pegId].forEach((size) => {
        const diskEl = document.createElement("div");
        diskEl.className = "disk";
        diskEl.dataset.size = String(size);
        diskEl.draggable = !this.state.won;
        const widthPct = 30 + (size / maxDisk) * 65;
        diskEl.style.width = `${widthPct}%`;
        diskEl.style.setProperty("--hue", String((size * 360) / maxDisk));
        diskEl.textContent = String(size);

        diskEl.addEventListener("dragstart", (ev) => {
          this.draggingFrom = pegId;
          ev.dataTransfer?.setData("text/plain", String(pegId));
        });
        diskEl.addEventListener("dragend", () => {
          this.draggingFrom = null;
        });

        disksWrap.appendChild(diskEl);
      });
      pegEl.appendChild(disksWrap);

      pegEl.addEventListener("click", () => this.handlePegActivate(pegId));

      pegEl.addEventListener("dragover", (ev) => {
        ev.preventDefault();
      });
      pegEl.addEventListener("drop", (ev) => {
        ev.preventDefault();
        if (this.animating) return;
        const fromRaw = ev.dataTransfer?.getData("text/plain");
        const from = fromRaw !== undefined && fromRaw !== "" ? (Number(fromRaw) as PegId) : this.draggingFrom;
        if (from === null || from === undefined) return;
        if (canMove(this.state, from, pegId)) {
          this.performMove(from, pegId);
        }
      });

      this.boardEl.appendChild(pegEl);
    });

    this.movesEl.textContent = String(this.state.moves);
    this.minMovesEl.textContent = String(minMoves(this.state.diskCount));

    const best = loadBestScores()[this.state.diskCount];
    this.bestEl.textContent = best !== undefined ? String(best) : "—";

    if (this.state.won) {
      const optimal = this.state.moves === minMoves(this.state.diskCount);
      this.messageEl.textContent = optimal
        ? `Resolvido em ${this.state.moves} movimentos — solução ótima!`
        : `Resolvido em ${this.state.moves} movimentos (mínimo possível: ${minMoves(this.state.diskCount)}).`;
      this.messageEl.classList.add("message--won");
    } else {
      this.messageEl.textContent = "Mova todos os discos para a torre da direita.";
      this.messageEl.classList.remove("message--won");
    }
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const root = document.getElementById("app");
  if (root) {
    new HanoiUI(root, 5);
  }
});
