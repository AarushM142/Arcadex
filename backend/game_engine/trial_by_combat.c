#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_CHARGE 10
#define MAX_TURNS 25
#define MAX_DOT_STACKS 3
#define LOG_SIZE 8
#define MAX_NAME 32

typedef enum {
    KNIGHT = 0,
    MAGICIAN = 1,
    ALCHEMIST = 2
} ClassType;

typedef enum {
    ATK = 0,
    DEF = 1,
    DOT = 2,
    BUFF = 3,
    ULT = 4
} MoveType;

typedef struct {
    char name[MAX_NAME];
    int classId;
    int hp;
    int maxHp;
    int baseAtk;
    int baseDef;
    int baseSpd;
    int crt;
    int charge;
    int buffActive;
    int buffTurns;
    int buffStat; // 0: DEF, 1: SPD, 2: ATK
    int buffAmt;
    int dotStacks;
    int dotTurns;
    int defPenalty;
} Fighter;

// Minimal PRNG to match JS implementation
uint32_t prng_next(uint32_t* seed) {
    *seed = (uint64_t)(*seed) * 16807 % 2147483647;
    return *seed;
}

float prng_next_float(uint32_t* seed) {
    return (float)(prng_next(seed) - 1) / 2147483646.0f;
}

int rand_pct(uint32_t* seed) {
    return (int)(prng_next_float(seed) * 100);
}

// Stats constants
const int CHARGE_GAIN[] = {3, 2, 1, 1, 0};
const int BASE_ATK_DAMAGE[] = {15, 13, 14};
const int BASE_ULT_DAMAGE[] = {28, 26, 22};
const int DOT_BASE[] = {5, 8, 12};

// Exported functions for DLL
#ifdef _WIN32
#define EXPORT __declspec(dllexport)
#else
#define EXPORT
#endif

EXPORT void init_fighter(Fighter* f, const char* name, int classId) {
    strncpy(f->name, name, MAX_NAME - 1);
    f->classId = classId;
    f->crt = 12;
    f->charge = 0;
    f->buffActive = 0;
    f->buffTurns = 0;
    f->dotStacks = 0;
    f->dotTurns = 0;
    f->defPenalty = 0;

    switch (classId) {
        case KNIGHT:
            f->hp = f->maxHp = 115; f->baseAtk = 10; f->baseDef = 12; f->baseSpd = 9;
            f->buffStat = 0; f->buffAmt = 4; break;
        case MAGICIAN:
            f->hp = f->maxHp = 105; f->baseAtk = 10; f->baseDef = 10; f->baseSpd = 12;
            f->buffStat = 1; f->buffAmt = 4; break;
        case ALCHEMIST:
            f->hp = f->maxHp = 110; f->baseAtk = 12; f->baseDef = 10; f->baseSpd = 10;
            f->buffStat = 2; f->buffAmt = 4; break;
    }
}

int e_atk(Fighter* f) { return f->baseAtk + (f->buffActive && f->buffStat == 2 ? f->buffAmt : 0); }
int e_def(Fighter* f) {
    int d = f->baseDef + (f->buffActive && f->buffStat == 0 ? f->buffAmt : 0) - f->defPenalty;
    return d < 0 ? 0 : d;
}
int e_spd(Fighter* f) { return f->baseSpd + (f->buffActive && f->buffStat == 1 ? f->buffAmt : 0); }

int calc_damage(int base, int atk, int def) {
    int d = base + (atk / 2) - (def / 3);
    return d < 1 ? 1 : d;
}

int calc_dot_tick(int base, int atk, int def) {
    int d = base + (atk / 4) - (def / 4);
    return d < 1 ? 1 : d;
}

EXPORT int choose_move_ai(Fighter* ai, Fighter* opp, uint32_t* seed) {
    int hpPct = (ai->hp * 100) / ai->maxHp;
    if (ai->charge == MAX_CHARGE && rand_pct(seed) < 65) return ULT;
    if (hpPct < 25 && rand_pct(seed) < 60) return DEF;

    if (opp->buffActive) {
        int r = rand_pct(seed);
        if (r < 45) return ATK;
        if (r < 70 && ai->charge >= 3) return DOT;
    }
    if (opp->dotStacks < MAX_DOT_STACKS && ai->charge >= 3 && rand_pct(seed) < 35)
        return DOT;
    if (!ai->buffActive && ai->charge >= 2 && hpPct > 40 && rand_pct(seed) < 40)
        return BUFF;
    if (ai->charge >= 7 && ai->charge < MAX_CHARGE && rand_pct(seed) < 25)
        return DEF;
    return ATK;
}

EXPORT void resolve_turn(Fighter* p1, Fighter* p2, int move1, int move2, uint32_t* seed) {
    Fighter* fighters[2] = {p1, p2};
    int moves[2] = {move1, move2};

    for (int dir = 0; dir < 2; dir++) {
        Fighter* att = fighters[dir];
        Fighter* def = fighters[dir == 0 ? 1 : 0];
        int myT = moves[dir];
        int oppT = moves[dir == 0 ? 1 : 0];

        int aStat = e_atk(att);
        int dStat = e_def(def);
        int dodge = 5 + e_spd(def);

        if (myT == ATK) {
            if (rand_pct(seed) < dodge) {
                // Dodged
            } else {
                float mult = 1.0f;
                if (oppT == DEF) mult = 0.5f;
                if (oppT == BUFF) mult = 1.3f;
                int crit = (rand_pct(seed) < att->crt);
                int dmg = calc_damage(BASE_ATK_DAMAGE[att->classId], aStat, dStat);
                if (crit) dmg = (int)(dmg * 1.5f);
                dmg = (int)(dmg * mult);
                if (dmg < 1) dmg = 1;
                def->hp -= dmg;
            }
        }

        if (myT == DOT) {
            if (oppT != ATK && rand_pct(seed) >= dodge) {
                if (def->dotStacks < MAX_DOT_STACKS) def->dotStacks++;
                def->dotTurns = 3;
            }
        }

        if (myT == BUFF) {
            if (oppT != DEF) {
                att->buffActive = 1;
                att->buffTurns = 3;
            }
        }

        if (myT == ULT) {
            float mult = 1.0f;
            if (oppT == DEF) mult = 0.25f;
            if (oppT == BUFF) mult = 1.25f;
            int effDef = (att->classId == MAGICIAN) ? (dStat / 2) : dStat;
            int crit = (rand_pct(seed) < att->crt);
            int dmg = calc_damage(BASE_ULT_DAMAGE[att->classId], aStat, effDef);
            if (crit) dmg = (int)(dmg * 1.4f);
            dmg = (int)(dmg * mult);
            if (dmg < 1) dmg = 1;
            def->hp -= dmg;

            if (att->classId == KNIGHT) def->defPenalty += 2;
            if (att->classId == ALCHEMIST) {
                att->hp += dmg;
                if (att->hp > att->maxHp) att->hp = att->maxHp;
            }
        }
    }

    // DoT ticks
    for (int i = 0; i < 2; i++) {
        Fighter* f = fighters[i];
        Fighter* src = fighters[i == 0 ? 1 : 0];
        if (f->dotStacks > 0 && f->dotTurns > 0) {
            int tick = calc_dot_tick(DOT_BASE[f->dotStacks - 1], e_atk(src), e_def(f));
            f->hp -= tick;
            f->dotTurns--;
            if (f->dotTurns == 0) f->dotStacks = 0;
        }
    }

    // Charge & Buff update
    int costs[] = {0, 0, 3, 2, 10};
    for (int i = 0; i < 2; i++) {
        Fighter* f = fighters[i];
        f->charge += CHARGE_GAIN[moves[i]] - costs[moves[i]];
        if (f->charge > MAX_CHARGE) f->charge = MAX_CHARGE;
        if (f->charge < 0) f->charge = 0;
        if (f->buffActive) {
            f->buffTurns--;
            if (f->buffTurns <= 0) f->buffActive = 0;
        }
    }
}

EXPORT void resolve_gauntlet_turn(Fighter* player, Fighter* enemies, int numEnemies, int playerMove, int targetIdx, uint32_t* seed) {
    Fighter* target = &enemies[targetIdx];
    int pCosts[] = {0, 0, 3, 2, 10};

    if (target->hp > 0) {
        int myT = playerMove;
        int aStat = e_atk(player);
        int dStat = e_def(target);
        int dodge = 5 + e_spd(target);

        if (myT == ATK) {
            if (rand_pct(seed) >= dodge) {
                int crit = (rand_pct(seed) < player->crt);
                int dmg = calc_damage(BASE_ATK_DAMAGE[player->classId], aStat, dStat);
                if (crit) dmg = (int)(dmg * 1.5f);
                target->hp -= (dmg < 1 ? 1 : dmg);
            }
        } else if (myT == DOT) {
            if (rand_pct(seed) >= dodge) {
                if (target->dotStacks < MAX_DOT_STACKS) target->dotStacks++;
                target->dotTurns = 3;
            }
        } else if (myT == BUFF) {
            player->buffActive = 1;
            player->buffTurns = 3;
        } else if (myT == ULT) {
            int effDef = (player->classId == MAGICIAN) ? (dStat / 2) : dStat;
            int crit = (rand_pct(seed) < player->crt);
            int dmg = calc_damage(BASE_ULT_DAMAGE[player->classId], aStat, effDef);
            if (crit) dmg = (int)(dmg * 1.4f);
            target->hp -= (dmg < 1 ? 1 : dmg);
            if (player->classId == KNIGHT) target->defPenalty += 2;
            if (player->classId == ALCHEMIST) {
                player->hp += dmg;
                if (player->hp > player->maxHp) player->hp = player->maxHp;
            }
        }

        if (target->hp <= 0) {
            target->hp = 0;
            player->hp += 20;
            if (player->hp > player->maxHp) player->hp = player->maxHp;
        }
    }

    player->charge += CHARGE_GAIN[playerMove] - pCosts[playerMove];
    if (player->charge > MAX_CHARGE) player->charge = MAX_CHARGE;
    if (player->charge < 0) player->charge = 0;
    if (player->buffActive) {
        player->buffTurns--;
        if (player->buffTurns <= 0) player->buffActive = 0;
    }

    int playerDefending = (playerMove == DEF);
    for (int i = 0; i < numEnemies; i++) {
        Fighter* e = &enemies[i];
        if (e->hp <= 0) continue;

        int emove = choose_move_ai(e, player, seed);
        int dodge = 5 + e_spd(player);
        float defMult = playerDefending ? 0.5f : 1.0f;

        if (emove == ATK) {
            if (rand_pct(seed) >= dodge) {
                int crit = (rand_pct(seed) < e->crt);
                int dmg = calc_damage(BASE_ATK_DAMAGE[e->classId], e_atk(e), e_def(player));
                if (crit) dmg = (int)(dmg * 1.5f);
                dmg = (int)(dmg * defMult);
                player->hp -= (dmg < 1 ? 1 : dmg);
            }
        } else if (emove == ULT) {
            int crit = (rand_pct(seed) < e->crt);
            int dmg = calc_damage(BASE_ULT_DAMAGE[e->classId], e_atk(e), (e->classId == MAGICIAN ? e_def(player) / 2 : e_def(player)));
            if (crit) dmg = (int)(dmg * 1.4f);
            dmg = (int)(dmg * defMult);
            player->hp -= (dmg < 1 ? 1 : dmg);
        } else if (emove == BUFF) {
            e->buffActive = 1; e->buffTurns = 3;
        }

        e->charge += CHARGE_GAIN[emove] - pCosts[emove];
        if (e->charge > MAX_CHARGE) e->charge = MAX_CHARGE;
        if (e->charge < 0) e->charge = 0;
        if (e->buffActive) {
            e->buffTurns--;
            if (e->buffTurns <= 0) e->buffActive = 0;
        }
    }

    for (int i = 0; i < numEnemies; i++) {
        Fighter* e = &enemies[i];
        if (e->hp > 0 && e->dotStacks > 0 && e->dotTurns > 0) {
            int tick = calc_dot_tick(DOT_BASE[e->dotStacks - 1], e_atk(player), e_def(e));
            e->hp -= tick; e->dotTurns--;
            if (e->dotTurns == 0) e->dotStacks = 0;
            if (e->hp <= 0) {
                e->hp = 0;
                player->hp += 20;
                if (player->hp > player->maxHp) player->hp = player->maxHp;
            }
        }
    }
}
