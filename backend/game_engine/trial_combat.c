#include <emscripten.h>
#include <stdlib.h>
#include <time.h>
#include <string.h>

#define MAX_MOVES 4

typedef struct {
    int id;
    int hp;
    int max_hp;
    int class_id; // 0=Knight, 1=Alchemist, 2=Mage, 3=Rogue
    int is_dead;
} Fighter;

typedef struct {
    Fighter p1;
    Fighter p2; // In 1v1, this is the opponent.
    Fighter gauntlet_enemies[3];
    int is_gauntlet;
    int gauntlet_index;
    int current_turn; // 0 for p1, 1 for p2/enemy
    int turn_number;
    int game_over;
} GameState;

GameState state;

// Emscripten exports
EMSCRIPTEN_KEEPALIVE
void initFighter(int id, int is_p1, int class_id) {
    Fighter* f = is_p1 ? &state.p1 : &state.p2;
    f->id = id;
    f->class_id = class_id;
    f->is_dead = 0;
    
    // Base stats
    if (class_id == 0) { f->max_hp = 120; f->hp = 120; } // Knight
    else if (class_id == 1) { f->max_hp = 90; f->hp = 90; } // Alchemist
    else if (class_id == 2) { f->max_hp = 80; f->hp = 80; } // Mage
    else { f->max_hp = 100; f->hp = 100; } // Rogue
}

EMSCRIPTEN_KEEPALIVE
void initGame(int is_gauntlet, int seed, int p1_class, int p2_class) {
    srand(seed);
    state.is_gauntlet = is_gauntlet;
    state.gauntlet_index = 0;
    state.current_turn = 0;
    state.turn_number = 1;
    state.game_over = 0;
    
    initFighter(1, 1, p1_class);
    
    if (is_gauntlet) {
        // Init 3 enemies
        for(int i=0; i<3; i++) {
            state.gauntlet_enemies[i].id = i+2;
            state.gauntlet_enemies[i].class_id = rand() % 4;
            state.gauntlet_enemies[i].max_hp = 60 + (i*20);
            state.gauntlet_enemies[i].hp = state.gauntlet_enemies[i].max_hp;
            state.gauntlet_enemies[i].is_dead = 0;
        }
        state.p2 = state.gauntlet_enemies[0];
    } else {
        initFighter(2, 0, p2_class);
    }
}

EMSCRIPTEN_KEEPALIVE
int chooseMoveAI(int fighter_id) {
    return rand() % 4; // Mock 4 moves
}

// Returns a compressed int indicating the result
// Result format: (damage_dealt << 16) | (move_used << 8) | (winner)
// Winner: 0=ongoing, 1=p1 wins, 2=p2 wins, 3=gauntlet advance
EMSCRIPTEN_KEEPALIVE
int resolveTurn(int p1_move, int p2_move) {
    if (state.game_over) return 0;
    
    // P1 attacks P2
    int p1_dmg = 10 + (rand() % 15);
    if (state.p1.class_id == 0) p1_dmg += 5; // Knight bonus
    else if (state.p1.class_id == 1) p1_dmg += (rand() % 10); // Alchemist bonus
    
    state.p2.hp -= p1_dmg;
    if (state.p2.hp <= 0) {
        state.p2.hp = 0;
        state.p2.is_dead = 1;
        
        if (state.is_gauntlet) {
            state.gauntlet_index++;
            if (state.gauntlet_index >= 3) {
                state.game_over = 1;
                return (p1_dmg << 16) | (p1_move << 8) | 1; // P1 wins overall
            } else {
                state.p2 = state.gauntlet_enemies[state.gauntlet_index]; // Next enemy
                return (p1_dmg << 16) | (p1_move << 8) | 3; // Advance
            }
        } else {
            state.game_over = 1;
            return (p1_dmg << 16) | (p1_move << 8) | 1; // P1 Wins
        }
    }
    
    // P2 attacks P1
    int p2_dmg = 8 + (rand() % 12);
    state.p1.hp -= p2_dmg;
    if (state.p1.hp <= 0) {
        state.p1.hp = 0;
        state.p1.is_dead = 1;
        state.game_over = 1;
        return (p2_dmg << 16) | (p2_move << 8) | 2; // P2 (or enemy) Wins
    }
    
    state.turn_number++;
    return (p1_dmg << 16) | (p1_move << 8) | 0; // Ongoing
}

EMSCRIPTEN_KEEPALIVE
int getP1HP() { return state.p1.hp; }
EMSCRIPTEN_KEEPALIVE
int getP1MaxHP() { return state.p1.max_hp; }
EMSCRIPTEN_KEEPALIVE
int getP1Class() { return state.p1.class_id; }

EMSCRIPTEN_KEEPALIVE
int getP2HP() { return state.p2.hp; }
EMSCRIPTEN_KEEPALIVE
int getP2MaxHP() { return state.p2.max_hp; }
EMSCRIPTEN_KEEPALIVE
int getP2Class() { return state.p2.class_id; }
