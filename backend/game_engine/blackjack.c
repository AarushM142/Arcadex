#include <stdint.h>
#include <stdbool.h>

/**
 * Arcadex Professional Blackjack Engine
 * ------------------------------------
 * High-performance logic engine designed for WASM compilation.
 * Implements standard casino rules, soft-hand logic, splitting, 
 * doubling down, and basic strategy hints.
 */

#define MAX_HAND_CARDS 12
#define MAX_HANDS 4      // Support for initial hand + splits
#define DECK_SIZE 52

// --- Types ---

typedef enum {
    ACTION_HIT,
    ACTION_STAND,
    ACTION_DOUBLE,
    ACTION_SPLIT
} PlayerAction;

typedef enum {
    RESULT_PENDING,
    RESULT_WIN,
    RESULT_LOSE,
    RESULT_PUSH,
    RESULT_BLACKJACK
} GameResult;

typedef struct {
    uint8_t cards[MAX_HAND_CARDS];
    uint8_t count;
    uint8_t bet;
    bool is_done;
    bool is_split;
    bool doubled;
} Hand;

typedef struct {
    uint8_t deck[DECK_SIZE];
    uint16_t deck_index;
    
    Hand dealer_hand;
    Hand player_hands[MAX_HANDS];
    uint8_t hand_count;
    uint8_t active_hand_index;
    
    uint32_t seed;
    uint32_t bankroll;
} GameState;

// --- PRNG (Xorshift) ---

static uint32_t xorshift32(uint32_t* state) {
    uint32_t x = *state;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    *state = x;
    return x;
}

// --- Internal Helpers ---

static uint8_t get_card_value(uint8_t card) {
    uint8_t rank = (card % 13) + 1; // 1 (Ace) to 13 (King)
    if (rank > 10) return 10;
    if (rank == 1) return 11; // Default Ace to 11
    return rank;
}

static uint8_t calculate_score(Hand* hand) {
    uint8_t score = 0;
    uint8_t aces = 0;
    
    for (int i = 0; i < hand->count; i++) {
        uint8_t val = get_card_value(hand->cards[i]);
        score += val;
        if (val == 11) aces++;
    }
    
    // Soft hand logic: adjustment
    while (score > 21 && aces > 0) {
        score -= 10;
        aces--;
    }
    
    return score;
}

static void shuffle(GameState* state) {
    for (int i = 0; i < DECK_SIZE; i++) {
        state->deck[i] = i;
    }
    
    for (int i = DECK_SIZE - 1; i > 0; i--) {
        uint32_t j = xorshift32(&state->seed) % (i + 1);
        uint8_t temp = state->deck[i];
        state->deck[i] = state->deck[j];
        state->deck[j] = temp;
    }
    state->deck_index = 0;
}

static uint8_t draw_card(GameState* state) {
    if (state->deck_index >= DECK_SIZE) {
        shuffle(state);
    }
    return state->deck[state->deck_index++];
}

// --- API Functions (WASM Exports) ---

void init_game(GameState* state, uint32_t seed, uint32_t initial_bankroll) {
    state->seed = seed;
    state->bankroll = initial_bankroll;
    state->deck_index = 0;
    shuffle(state);
}

void start_deal(GameState* state, uint8_t bet) {
    // Reset hands
    state->dealer_hand.count = 0;
    state->dealer_hand.is_done = false;
    
    state->hand_count = 1;
    state->active_hand_index = 0;
    state->player_hands[0].count = 0;
    state->player_hands[0].bet = bet;
    state->player_hands[0].is_done = false;
    state->player_hands[0].is_split = false;
    state->player_hands[0].doubled = false;
    
    // Deal initial cards
    state->player_hands[0].cards[state->player_hands[0].count++] = draw_card(state);
    state->dealer_hand.cards[state->dealer_hand.count++] = draw_card(state);
    state->player_hands[0].cards[state->player_hands[0].count++] = draw_card(state);
    state->dealer_hand.cards[state->dealer_hand.count++] = draw_card(state); // Dealer second card hidden in UI usually
}

bool player_hit(GameState* state) {
    Hand* active = &state->player_hands[state->active_hand_index];
    if (active->is_done) return false;
    
    active->cards[active->count++] = draw_card(state);
    if (calculate_score(active) >= 21) {
        active->is_done = true;
    }
    return true;
}

void player_stand(GameState* state) {
    state->player_hands[state->active_hand_index].is_done = true;
}

bool player_double(GameState* state) {
    Hand* active = &state->player_hands[state->active_hand_index];
    if (active->count != 2 || active->is_done) return false;
    
    active->bet *= 2;
    active->cards[active->count++] = draw_card(state);
    active->is_done = true;
    active->doubled = true;
    return true;
}

bool player_split(GameState* state) {
    if (state->hand_count >= MAX_HANDS) return false;
    
    Hand* active = &state->player_hands[state->active_hand_index];
    if (active->count != 2 || active->is_done) return false;
    
    uint8_t v1 = get_card_value(active->cards[0]);
    uint8_t v2 = get_card_value(active->cards[1]);
    if (v1 != v2) return false;
    
    // Create new hand
    Hand* new_hand = &state->player_hands[state->hand_count++];
    new_hand->cards[0] = active->cards[1];
    new_hand->count = 1;
    new_hand->bet = active->bet;
    new_hand->is_done = false;
    new_hand->is_split = true;
    new_hand->doubled = false;
    
    active->count = 1;
    active->is_split = true;
    
    // Draw 1 card for each (Casinos usually deal second card immediately on split)
    active->cards[active->count++] = draw_card(state);
    new_hand->cards[new_hand->count++] = draw_card(state);
    
    return true;
}

void dealer_play(GameState* state) {
    while (calculate_score(&state->dealer_hand) < 17) {
        state->dealer_hand.cards[state->dealer_hand.count++] = draw_card(state);
    }
    state->dealer_hand.is_done = true;
}

// --- Strategy Hint Engine ---

PlayerAction get_hint(GameState* state) {
    Hand* active = &state->player_hands[state->active_hand_index];
    uint8_t player_score = calculate_score(active);
    uint8_t dealer_upcard = get_card_value(state->dealer_hand.cards[0]);
    
    // Pair Splitting
    if (active->count == 2) {
        uint8_t v1 = get_card_value(active->cards[0]);
        uint8_t v2 = get_card_value(active->cards[1]);
        if (v1 == v2) {
            if (v1 == 11 || v1 == 8) return ACTION_SPLIT;
            if (v1 >= 2 && v1 <= 7 && dealer_upcard <= 7) return ACTION_SPLIT;
        }
    }
    
    // Double Down Logic
    if (active->count == 2) {
        if (player_score == 11) return ACTION_DOUBLE;
        if (player_score == 10 && dealer_upcard < 10) return ACTION_DOUBLE;
        if (player_score == 9 && dealer_upcard >= 2 && dealer_upcard <= 6) return ACTION_DOUBLE;
    }
    
    // Soft Hand Strategy
    bool is_soft = false;
    for(int i=0; i<active->count; i++) if(get_card_value(active->cards[i]) == 11) is_soft = true;
    // Recalculate if it really behaves soft (score has been adjusted or not)
    // For simplicity in hint: if score <= 17 and has an ace, usually hit.
    
    if (is_soft) {
        if (player_score <= 17) return ACTION_HIT;
        if (player_score == 18 && (dealer_upcard >= 9)) return ACTION_HIT;
        return ACTION_STAND;
    }
    
    // Hard Hand Strategy
    if (dealer_upcard <= 6) {
        if (player_score >= 12) return ACTION_STAND;
        return ACTION_HIT;
    } else {
        if (player_score >= 17) return ACTION_STAND;
        return ACTION_HIT;
    }
}
