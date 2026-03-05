/**
 * Arcadex Professional Blackjack Engine (JS Port)
 * -----------------------------------------------
 * Mirrors the C implementation for browser-side execution.
 */

export const GameActions = {
    HIT: 'HIT',
    STAND: 'STAND',
    DOUBLE: 'DOUBLE',
    SPLIT: 'SPLIT'
};

export const GameResult = {
    PENDING: 'PENDING',
    WIN: 'WIN',
    LOSE: 'LOSE',
    PUSH: 'PUSH',
    BLACKJACK: 'BLACKJACK'
};

export class BlackjackEngine {
    constructor(seed = Date.now()) {
        this.seed = seed;
        this.deck = [];
        this.deckIndex = 0;
        this.dealerHand = { cards: [], count: 0, isDone: false };
        this.playerHands = [{ cards: [], count: 0, bet: 0, isDone: false, isSplit: false, doubled: false }];
        this.activeHandIndex = 0;
    }

    // Xorshift32 PRNG (Pseudo-Random Number Generator)
    // Computers cannot generate true randomness. We use this math equation instead.
    // If we give it the exact same "seed" number, it will spit out the exact same "random" sequence.
    // This allows multiplayer games to perfectly sync without sending the whole deck over the internet.
    _random() {
        this.seed ^= this.seed << 13;
        this.seed ^= this.seed >> 17;
        this.seed ^= this.seed << 5;
        // The >>> 0 ensures we don't accidentally get a negative number from Javascript's bitwise operator
        return (this.seed >>> 0) / 4294967296;
    }

    _getCardValue(card) {
        const rank = (card % 13) + 1;
        if (rank > 10) return 10;
        if (rank === 1) return 11;
        return rank;
    }

    _calculateScore(hand) {
        let score = 0;
        let aces = 0;
        hand.cards.forEach(card => {
            const val = this._getCardValue(card);
            score += val;
            if (val === 11) aces++;
        });
        while (score > 21 && aces > 0) {
            score -= 10;
            aces--;
        }
        return score;
    }

    // The Fisher-Yates Shuffle Algorithm
    shuffle() {
        // Modern JS shortcut: instantiate an array of exactly 52 slots, filled with numbers 0-51
        this.deck = Array.from({ length: 52 }, (_, i) => i);

        // Loop backwards through the deck and mathematically swap each card with a random card before it
        for (let i = 51; i > 0; i--) {
            const j = Math.floor(this._random() * (i + 1));
            // ES6 Array Destructuring shortcut: swap two array items without needing a temporary middle variable
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
        this.deckIndex = 0;
    }

    drawCard() {
        if (this.deckIndex >= 52) this.shuffle();
        return this.deck[this.deckIndex++];
    }

    startDeal(bet) {
        this.shuffle();
        this.dealerHand = { cards: [], count: 0, isDone: false };
        this.playerHands = [{ cards: [this.drawCard(), this.drawCard()], bet, isDone: false, isSplit: false, doubled: false }];
        this.dealerHand.cards = [this.drawCard(), this.drawCard()];
        this.activeHandIndex = 0;

        // Check for immediate blackjack
        if (this._calculateScore(this.playerHands[0]) === 21) {
            this.playerHands[0].isDone = true;
        }
    }

    hit() {
        const active = this.playerHands[this.activeHandIndex];
        if (active.isDone) return;
        active.cards.push(this.drawCard());
        if (this._calculateScore(active) >= 21) {
            active.isDone = true;
        }
    }

    stand() {
        this.playerHands[this.activeHandIndex].isDone = true;
    }

    double() {
        const active = this.playerHands[this.activeHandIndex];
        if (active.cards.length !== 2 || active.isDone) return;
        active.bet *= 2;
        active.cards.push(this.drawCard());
        active.isDone = true;
        active.doubled = true;
    }

    split() {
        const active = this.playerHands[this.activeHandIndex];
        if (active.cards.length !== 2 || active.isDone) return;

        // Use rank check (card % 13) instead of value check
        if ((active.cards[0] % 13) !== (active.cards[1] % 13)) return;

        const newHand = {
            cards: [active.cards.pop()],
            bet: active.bet,
            isDone: false,
            isSplit: true,
            doubled: false
        };
        active.cards.push(this.drawCard());
        newHand.cards.push(this.drawCard());
        active.isSplit = true;
        this.playerHands.push(newHand);
    }

    dealerPlay() {
        while (this._calculateScore(this.dealerHand) < 17) {
            this.dealerHand.cards.push(this.drawCard());
        }
        this.dealerHand.isDone = true;
    }

    getHint() {
        const active = this.playerHands[this.activeHandIndex];
        const playerScore = this._calculateScore(active);
        const dealerUpcard = this._getCardValue(this.dealerHand.cards[0]);

        if (active.cards.length === 2) {
            const v1 = this._getCardValue(active.cards[0]);
            const v2 = this._getCardValue(active.cards[1]);
            if (v1 === v2) {
                if (v1 === 11 || v1 === 8) return GameActions.SPLIT;
                if (v1 >= 2 && v1 <= 7 && dealerUpcard <= 7) return GameActions.SPLIT;
            }
            if (playerScore === 11) return GameActions.DOUBLE;
            if (playerScore === 10 && dealerUpcard < 10) return GameActions.DOUBLE;
            if (playerScore === 9 && dealerUpcard >= 2 && dealerUpcard <= 6) return GameActions.DOUBLE;
        }

        const isSoft = active.cards.some(c => this._getCardValue(c) === 11) && this._calculateScore(active) <= 21;
        if (isSoft) {
            if (playerScore <= 17) return GameActions.HIT;
            if (playerScore === 18 && dealerUpcard >= 9) return GameActions.HIT;
            return GameActions.STAND;
        }

        if (dealerUpcard <= 6) {
            return playerScore >= 12 ? GameActions.STAND : GameActions.HIT;
        }
        return playerScore >= 17 ? GameActions.STAND : GameActions.HIT;
    }

    getResult() {
        const dealerScore = this._calculateScore(this.dealerHand);
        const playerResults = this.playerHands.map(hand => {
            const playerScore = this._calculateScore(hand);
            if (playerScore > 21) return GameResult.LOSE;
            if (dealerScore > 21) return GameResult.WIN;
            if (playerScore === 21 && hand.cards.length === 2 && !hand.isSplit) {
                return dealerScore === 21 && this.dealerHand.cards.length === 2 ? GameResult.PUSH : GameResult.BLACKJACK;
            }
            if (playerScore > dealerScore) return GameResult.WIN;
            if (playerScore < dealerScore) return GameResult.LOSE;
            return GameResult.PUSH;
        });
        return playerResults;
    }

    getState() {
        return {
            dealerHand: this.dealerHand,
            playerHands: this.playerHands,
            activeHandIndex: this.activeHandIndex,
            isGameOver: this.playerHands.every(h => h.isDone)
        };
    }
}
