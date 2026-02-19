/**
 * Minesweeper JS Port of Headless C Engine
 * Matches exactly 6x6, 8 Mines, and Lifeline mechanics
 */

export const GameStatus = {
    SAFE: 0,
    LIFELINE_TRIGGERED: 1,
    GAME_OVER: 2,
    WIN: 3,
    INVALID: 4
};

export class MinesweeperEngine {
    constructor(seed = Date.now()) {
        this.rows = 6;
        this.cols = 6;
        this.mineCount = 8;
        this.board = Array(this.rows).fill().map(() => Array(this.cols).fill().map(() => ({
            isMine: false,
            isRevealed: false,
            adjacentMines: 0
        })));

        this.minesHit = 0;
        this.lifelineUsed = false;
        this.lifelinePending = false;
        this.isGameOver = false;
        this.revealedCount = 0;

        // Simple seeded RNG for consistency with C engine prompt
        this.seed = seed;
        this._initBoard();
    }

    _rand() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }

    _initBoard() {
        // Place Mines
        let placed = 0;
        while (placed < this.mineCount) {
            let r = Math.floor(this._rand() * this.rows);
            let c = Math.floor(this._rand() * this.cols);
            if (!this.board[r][c].isMine) {
                this.board[r][c].isMine = true;
                placed++;
            }
        }

        // Calculate Adjacency
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.board[r][c].isMine) continue;
                let count = 0;
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        let nr = r + dr, nc = c + dc;
                        if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
                            if (this.board[nr][nc].isMine) count++;
                        }
                    }
                }
                this.board[r][c].adjacentMines = count;
            }
        }
    }

    _floodFill(r, c) {
        if (r < 0 || r >= this.rows || c < 0 || c >= this.cols || this.board[r][c].isRevealed || this.board[r][c].isMine) {
            return;
        }

        this.board[r][c].isRevealed = true;
        this.revealedCount++;

        if (this.board[r][c].adjacentMines === 0) {
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    this._floodFill(r + dr, c + dc);
                }
            }
        }
    }

    revealCell(r, c) {
        if (this.isGameOver || this.lifelinePending || r < 0 || r >= this.rows || c < 0 || c >= this.cols || this.board[r][c].isRevealed) {
            return GameStatus.INVALID;
        }

        if (this.board[r][c].isMine) {
            this.minesHit++;
            this.board[r][c].isRevealed = true;

            if (this.minesHit === 1 && !this.lifelineUsed) {
                this.lifelinePending = true;
                return GameStatus.LIFELINE_TRIGGERED;
            } else {
                this.isGameOver = true;
                return GameStatus.GAME_OVER;
            }
        }

        this._floodFill(r, c);

        if (this.revealedCount === (this.rows * this.cols) - this.mineCount) {
            this.isGameOver = true;
            return GameStatus.WIN;
        }

        return GameStatus.SAFE;
    }

    resolveLifeline(success) {
        this.lifelinePending = false;
        this.lifelineUsed = true;

        if (!success) {
            this.isGameOver = true;
            return GameStatus.GAME_OVER;
        }
        return GameStatus.SAFE;
    }

    getRoast() {
        const ROASTS = [
            "Is your brain also a 6x6 grid with nothing in it?",
            "Calculated risks? More like calculated failure.",
            "The mines were easier to find than your common sense.",
            "Error 404: Skill not found.",
            "Even a random number generator would have lasted longer.",
            "Did you think the numbers were just suggestions?",
            "Boom. There goes your ego.",
            "Maybe stick to Tic Tac Toe? Wait, you'd lose that too."
        ];
        return ROASTS[Math.floor(Math.random() * ROASTS.length)];
    }

    getGameState() {
        return {
            board: this.board.map(row => row.map(cell => ({ ...cell }))),
            isGameOver: this.isGameOver,
            lifelinePending: this.lifelinePending,
            lifelineUsed: this.lifelineUsed,
            revealedCount: this.revealedCount
        };
    }
}
