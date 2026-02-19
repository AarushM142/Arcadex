/**
 * TicTacToe JS Port of C Engine
 * Unbeatable Minimax AI Logic
 */

export const GameMode = {
    PVP: 0,
    PV_AI: 1,
    ONLINE_PVP: 2
};

export const Player = {
    EMPTY: 0,
    X: 1,
    O: 2
};

export class TicTacToeEngine {
    constructor(mode = GameMode.PVP) {
        this.board = Array(9).fill(Player.EMPTY);
        this.currentPlayer = Player.X;
        this.gameMode = mode;
        this.winner = 0; // 0: None, 1: X, 2: O, 3: Draw
        this.isGameOver = false;
    }

    _checkWinner(board) {
        const patterns = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ];

        for (let p of patterns) {
            if (board[p[0]] !== Player.EMPTY &&
                board[p[0]] === board[p[1]] &&
                board[p[0]] === board[p[2]]) {
                return board[p[0]];
            }
        }

        if (!board.includes(Player.EMPTY)) return 3; // Draw
        return 0;
    }

    _minimax(board, depth, isMax) {
        const score = this._checkWinner(board);
        if (score === Player.O) return 10 - depth;
        if (score === Player.X) return depth - 10;
        if (score === 3) return 0;

        if (isMax) {
            let best = -Infinity;
            for (let i = 0; i < 9; i++) {
                if (board[i] === Player.EMPTY) {
                    board[i] = Player.O;
                    best = Math.max(best, this._minimax(board, depth + 1, false));
                    board[i] = Player.EMPTY;
                }
            }
            return best;
        } else {
            let best = Infinity;
            for (let i = 0; i < 9; i++) {
                if (board[i] === Player.EMPTY) {
                    board[i] = Player.X;
                    best = Math.min(best, this._minimax(board, depth + 1, true));
                    board[i] = Player.EMPTY;
                }
            }
            return best;
        }
    }

    makeMove(index) {
        if (this.isGameOver || this.board[index] !== Player.EMPTY) return null;

        this.board[index] = this.currentPlayer;
        this.winner = this._checkWinner(this.board);

        if (this.winner !== 0) {
            this.isGameOver = true;
            return this.getState();
        }

        this.currentPlayer = (this.currentPlayer === Player.X) ? Player.O : Player.X;

        // AI Move
        if (this.gameMode === GameMode.PV_AI && this.currentPlayer === Player.O) {
            let bestVal = -Infinity;
            let bestMove = -1;

            for (let i = 0; i < 9; i++) {
                if (this.board[i] === Player.EMPTY) {
                    this.board[i] = Player.O;
                    let moveVal = this._minimax(this.board, 0, false);
                    this.board[i] = Player.EMPTY;
                    if (moveVal > bestVal) {
                        bestMove = i;
                        bestVal = moveVal;
                    }
                }
            }

            if (bestMove !== -1) {
                this.board[bestMove] = Player.O;
                this.winner = this._checkWinner(this.board);
                if (this.winner !== 0) {
                    this.isGameOver = true;
                } else {
                    this.currentPlayer = Player.X;
                }
            }
        }

        return this.getState();
    }

    getHint() {
        if (this.isGameOver) return -1;
        let bestVal = (this.currentPlayer === Player.X) ? Infinity : -Infinity;
        let bestMove = -1;

        for (let i = 0; i < 9; i++) {
            if (this.board[i] === Player.EMPTY) {
                this.board[i] = this.currentPlayer;
                let moveVal = this._minimax(this.board, 0, this.currentPlayer === Player.O);
                this.board[i] = Player.EMPTY;

                if (this.currentPlayer === Player.X) {
                    if (moveVal < bestVal) {
                        bestVal = moveVal;
                        bestMove = i;
                    }
                } else {
                    if (moveVal > bestVal) {
                        bestVal = moveVal;
                        bestMove = i;
                    }
                }
            }
        }
        return bestMove;
    }

    getState() {
        return {
            board: [...this.board],
            currentPlayer: this.currentPlayer,
            winner: this.winner,
            isGameOver: this.isGameOver
        };
    }
}
