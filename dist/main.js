"use strict";
/**
 * Torre de Hanói — lógica do jogo e renderização em TypeScript puro (sem frameworks).
 */
const PEG_IDS = [0, 1, 2];
const MIN_DISKS = 3;
const MAX_DISKS = 8;
const STORAGE_KEY = "hanoi-best-scores";
function minMoves(diskCount) {
    return Math.pow(2, diskCount) - 1;
}
function createInitialState(diskCount) {
    const pegs = [[], [], []];
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
function topDisk(peg) {
    return peg[peg.length - 1];
}
function canMove(state, from, to) {
    if (from === to)
        return false;
    const disk = topDisk(state.pegs[from]);
    if (disk === undefined)
        return false;
    const targetTop = topDisk(state.pegs[to]);
    return targetTop === undefined || disk < targetTop;
}
function applyMove(state, from, to) {
    if (!canMove(state, from, to))
        return state;
    const pegs = state.pegs.map((p) => [...p]);
    const disk = pegs[from].pop();
    pegs[to].push(disk);
    const moves = state.moves + 1;
    const won = pegs[2].length === state.diskCount;
    return { ...state, pegs, moves, won, startTime: state.startTime ?? Date.now() };
}
function loadBestScores() {
    try {
        const raw = localStorageSafe()?.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    }
    catch {
        return {};
    }
}
function saveBestScore(diskCount, moves) {
    const scores = loadBestScores();
    if (!scores[diskCount] || moves < scores[diskCount]) {
        scores[diskCount] = moves;
        try {
            localStorageSafe()?.setItem(STORAGE_KEY, JSON.stringify(scores));
        }
        catch {
            /* localStorage indisponível — ignora silenciosamente */
        }
    }
}
function localStorageSafe() {
    try {
        return window.localStorage;
    }
    catch {
        return null;
    }
}
// ---------------------------------------------------------------------------
// Renderização / DOM
// ---------------------------------------------------------------------------
class HanoiUI {
    constructor(root, initialDiskCount) {
        this.draggingFrom = null;
        this.state = createInitialState(initialDiskCount);
        this.boardEl = root.querySelector("#board");
        this.movesEl = root.querySelector("#moves");
        this.minMovesEl = root.querySelector("#min-moves");
        this.bestEl = root.querySelector("#best-score");
        this.messageEl = root.querySelector("#message");
        this.diskSelect = root.querySelector("#disk-count");
        this.resetBtn = root.querySelector("#reset-btn");
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
    populateDiskSelect() {
        this.diskSelect.innerHTML = "";
        for (let n = MIN_DISKS; n <= MAX_DISKS; n++) {
            const opt = document.createElement("option");
            opt.value = String(n);
            opt.textContent = `${n} discos`;
            this.diskSelect.appendChild(opt);
        }
    }
    handlePegActivate(pegId) {
        if (this.state.won)
            return;
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
        if (canMove(this.state, this.state.selectedPeg, pegId)) {
            this.state = applyMove(this.state, this.state.selectedPeg, pegId);
            this.state = { ...this.state, selectedPeg: null };
            this.onAfterMove();
        }
        else {
            // seleção inválida: troca a seleção para o novo pino, se ele tiver disco
            if (topDisk(this.state.pegs[pegId]) !== undefined) {
                this.state = { ...this.state, selectedPeg: pegId };
            }
            else {
                this.state = { ...this.state, selectedPeg: null };
            }
        }
        this.render();
    }
    onAfterMove() {
        if (this.state.won) {
            saveBestScore(this.state.diskCount, this.state.moves);
        }
    }
    render() {
        this.boardEl.innerHTML = "";
        const maxDisk = this.state.diskCount;
        PEG_IDS.forEach((pegId) => {
            const pegEl = document.createElement("div");
            pegEl.className = "peg";
            pegEl.dataset.peg = String(pegId);
            if (this.state.selectedPeg === pegId)
                pegEl.classList.add("peg--selected");
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
                const fromRaw = ev.dataTransfer?.getData("text/plain");
                const from = fromRaw !== undefined && fromRaw !== "" ? Number(fromRaw) : this.draggingFrom;
                if (from === null || from === undefined)
                    return;
                if (canMove(this.state, from, pegId)) {
                    this.state = applyMove(this.state, from, pegId);
                    this.state = { ...this.state, selectedPeg: null };
                    this.onAfterMove();
                    this.render();
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
        }
        else {
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
