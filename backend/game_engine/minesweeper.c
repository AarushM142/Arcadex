#include <stdint.h>
#include <stdlib.h>
#include <stdbool.h>
#include <time.h>

/**
 * Minesweeper "Headless" Engine (WASM-Ready)
 * 6x6 Grid | 8 Mines | Lifeline System
 */

#define ROWS 6
#define COLS 6
#define MINE_COUNT 8

typedef struct {
    bool isMine;
    bool isRevealed;
    int8_t adjacentMines;
} Cell;

typedef enum {
    STATUS_SAFE = 0,
    STATUS_LIFELINE_TRIGGERED = 1,
    STATUS_GAME_OVER = 2,
    STATUS_WIN = 3,
    STATUS_INVALID = 4
} GameStatus;

typedef struct {
    Cell board[ROWS][COLS];
    int8_t minesHit;
    bool lifelineUsed;
    bool lifelinePending;
    bool isGameOver;
    int8_t revealedCount;
} GameState;

static GameState game;

const char* ROASTS[] = {
    "Is your brain also a 6x6 grid with nothing in it?",
    "Calculated risks? More like calculated failure.",
    "The mines were easier to find than your common sense.",
    "Error 404: Skill not found.",
    "Even a random number generator would have lasted longer.",
    "Did you think the numbers were just suggestions?",
    "Boom. There goes your ego.",
    "Maybe stick to Tic Tac Toe? Wait, you'd lose that too."
};

// Internal: Place mines randomly
static void place_mines() {
    int placed = 0;
    while (placed < MINE_COUNT) {
        int r = rand() % ROWS;
        int c = rand() % COLS;
        if (!game.board[r][c].isMine) {
            game.board[r][c].isMine = true;
            placed++;
        }
    }
}

// Internal: Calculate adjacency counts
static void calculate_adjacency() {
    for (int r = 0; r < ROWS; r++) {
        for (int c = 0; c < COLS; c++) {
            if (game.board[r][c].isMine) continue;
            
            int8_t count = 0;
            for (int dr = -1; dr <= 1; dr++) {
                for (int dc = -1; dc <= 1; dc++) {
                    int nr = r + dr;
                    int nc = c + dc;
                    if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
                        if (game.board[nr][nc].isMine) count++;
                    }
                }
            }
            game.board[r][c].adjacentMines = count;
        }
    }
}

// Internal: Recursive flood fill
static void flood_fill(int r, int c) {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS || game.board[r][c].isRevealed || game.board[r][c].isMine) {
        return;
    }

    game.board[r][c].isRevealed = true;
    game.revealedCount++;

    if (game.board[r][c].adjacentMines == 0) {
        for (int dr = -1; dr <= 1; dr++) {
            for (int dc = -1; dc <= 1; dc++) {
                if (dr == 0 && dc == 0) continue;
                flood_fill(r + dr, c + dc);
            }
        }
    }
}

// WASM EXPORT: Reset the board
void init_game(unsigned int seed) {
    srand(seed);
    for (int r = 0; r < ROWS; r++) {
        for (int c = 0; c < COLS; c++) {
            game.board[r][c].isMine = false;
            game.board[r][c].isRevealed = false;
            game.board[r][c].adjacentMines = 0;
        }
    }
    game.minesHit = 0;
    game.lifelineUsed = false;
    game.lifelinePending = false;
    game.isGameOver = false;
    game.revealedCount = 0;

    place_mines();
    calculate_adjacency();
}

// WASM EXPORT: Handle lifeline result
int resolve_lifeline(bool success) {
    game.lifelinePending = false;
    game.lifelineUsed = true;

    if (!success) {
        game.isGameOver = true;
        return STATUS_GAME_OVER;
    }
    // If successful, the game continues. The mine that was hit remains "revealed" but user lives.
    return STATUS_SAFE;
}

// WASM EXPORT: Process a move
int reveal_cell(int r, int c) {
    if (game.isGameOver || game.lifelinePending || r < 0 || r >= ROWS || c < 0 || c >= COLS || game.board[r][c].isRevealed) {
        return STATUS_INVALID;
    }

    if (game.board[r][c].isMine) {
        game.minesHit++;
        game.board[r][c].isRevealed = true; // Mark it as revealed/hit

        if (game.minesHit == 1 && !game.lifelineUsed) {
            game.lifelinePending = true;
            return STATUS_LIFELINE_TRIGGERED;
        } else {
            game.isGameOver = true;
            return STATUS_GAME_OVER;
        }
    }

    flood_fill(r, c);

    if (game.revealedCount == (ROWS * COLS) - MINE_COUNT) {
        game.isGameOver = true;
        return STATUS_WIN;
    }

    return STATUS_SAFE;
}

// WASM EXPORT: Get board state for JS
GameState* get_gameState() {
    return &game;
}

// WASM EXPORT: Get a random roast based on seed
const char* get_roast(int index) {
    return ROASTS[index % 8];
}
