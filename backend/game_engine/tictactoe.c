#include <stdint.h>
#include <stdbool.h>

/**
 * TicTacToe C Engine (WASM-Ready)
 * Supports: Player vs Player (Local), Player vs AI
 */

#define EMPTY 0
#define PLAYER_X 1
#define PLAYER_O 2
#define BOARD_SIZE 9

// Game Modes
#define MODE_PVP 0
#define MODE_PV_AI 1

typedef struct {
    int8_t board[BOARD_SIZE];
    int8_t currentPlayer;
    int8_t gameMode; // 0: PvP, 1: PvAI
    int8_t winner;   // 0: None, 1: X, 2: O, 3: Draw
    bool isGameOver;
} TicTacToeState;

// Utility to check winner
static int8_t check_winner(const int8_t* board) {
    const int win_patterns[8][3] = {
        {0, 1, 2}, {3, 4, 5}, {6, 7, 8}, // Rows
        {0, 3, 6}, {1, 4, 7}, {2, 5, 8}, // Cols
        {0, 4, 8}, {2, 4, 6}             // Diagonals
    };

    for (int i = 0; i < 8; i++) {
        if (board[win_patterns[i][0]] != EMPTY &&
            board[win_patterns[i][0]] == board[win_patterns[i][1]] &&
            board[win_patterns[i][0]] == board[win_patterns[i][2]]) {
            return board[win_patterns[i][0]];
        }
    }

    bool full = true;
    for (int i = 0; i < BOARD_SIZE; i++) {
        if (board[i] == EMPTY) {
            full = false;
            break;
        }
    }
    return full ? 3 : 0; // 3 for Draw, 0 for None
}

// Minimax for AI
static int minimax(int8_t* board, int depth, bool isMax) {
    int score = check_winner(board);
    if (score == PLAYER_O) return 10 - depth; // AI is O
    if (score == PLAYER_X) return depth - 10; // Player is X
    if (score == 3) return 0;

    if (isMax) {
        int best = -1000;
        for (int i = 0; i < BOARD_SIZE; i++) {
            if (board[i] == EMPTY) {
                board[i] = PLAYER_O;
                int val = minimax(board, depth + 1, false);
                if (val > best) best = val;
                board[i] = EMPTY;
            }
        }
        return best;
    } else {
        int best = 1000;
        for (int i = 0; i < BOARD_SIZE; i++) {
            if (board[i] == EMPTY) {
                board[i] = PLAYER_X;
                int val = minimax(board, depth + 1, true);
                if (val < best) best = val;
                board[i] = EMPTY;
            }
        }
        return best;
    }
}

// Public Interface
TicTacToeState init_game(int8_t mode) {
    TicTacToeState state;
    for (int i = 0; i < BOARD_SIZE; i++) state.board[i] = EMPTY;
    state.currentPlayer = PLAYER_X;
    state.gameMode = mode;
    state.winner = 0;
    state.isGameOver = false;
    return state;
}

TicTacToeState make_move(TicTacToeState state, int index) {
    if (state.isGameOver || index < 0 || index >= BOARD_SIZE || state.board[index] != EMPTY) {
        return state;
    }

    // Player move
    state.board[index] = state.currentPlayer;
    state.winner = check_winner(state.board);
    
    if (state.winner != 0) {
        state.isGameOver = true;
        return state;
    }

    // Switch turns
    state.currentPlayer = (state.currentPlayer == PLAYER_X) ? PLAYER_O : PLAYER_X;

    // AI Move if needed
    if (state.gameMode == MODE_PV_AI && state.currentPlayer == PLAYER_O && !state.isGameOver) {
        int bestVal = -1000;
        int bestMove = -1;

        for (int i = 0; i < BOARD_SIZE; i++) {
            if (state.board[i] == EMPTY) {
                state.board[i] = PLAYER_O;
                int moveVal = minimax(state.board, 0, false);
                state.board[i] = EMPTY;
                if (moveVal > bestVal) {
                    bestMove = i;
                    bestVal = moveVal;
                }
            }
        }

        if (bestMove != -1) {
            state.board[bestMove] = PLAYER_O;
            state.winner = check_winner(state.board);
            if (state.winner != 0) {
                state.isGameOver = true;
            } else {
                state.currentPlayer = PLAYER_X;
            }
        }
    }

    return state;
}

// Hint Engine
int get_hint(TicTacToeState state) {
    if (state.isGameOver) return -1;
    
    int8_t temp_board[BOARD_SIZE];
    for (int i = 0; i < BOARD_SIZE; i++) temp_board[i] = state.board[i];

    int bestVal = (state.currentPlayer == PLAYER_X) ? 1000 : -1000;
    int bestMove = -1;

    for (int i = 0; i < BOARD_SIZE; i++) {
        if (temp_board[i] == EMPTY) {
            temp_board[i] = state.currentPlayer;
            int moveVal = minimax(temp_board, 0, (state.currentPlayer == PLAYER_X) ? true : false);
            temp_board[i] = EMPTY;
            
            if (state.currentPlayer == PLAYER_X) {
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
