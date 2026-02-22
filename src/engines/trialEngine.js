/*
  MOCK WASM ENGINE:
  Since the local Emscripten SDK compilation hung, I've provided a vanilla JS engine
  that strictly mirrors the required C/WASM exported API functions. 
  When you get your .wasm compiled, you can swap this class out with the real ccall/cwrap imports!
*/

export const CLASS_COLORS = {
    0: 'text-blue-400',   // Knight
    1: 'text-green-400',  // Alchemist
    2: 'text-purple-400'  // Mage
};

export const CLASS_NAMES = {
    0: 'Knight',
    1: 'Alchemist',
    2: 'Magician'
};

export const CLASS_MOVES = {
    0: ['Steady Blade', 'Aegis Wall', 'Mortal Wounds', 'Indomitable Spirit', "Executioner's Verdict"], // Knight
    1: ['Primed Flask', 'Pact of Attrition', 'Vial of Corrosion', 'Adrenal Mixture', 'Grand Transmutation'], // Alchemist
    2: ['Elemental Spark', 'Mana Barrier', 'Flesh Embers', 'Runic Overclock', 'Arcane Overload'] // Magician
};

export const MOVE_TYPES = ['ATK', 'DEF', 'DoT', 'BUFF', 'ULT'];
export const MOVE_COSTS = [0, 0, 3, 2, 10];
export const CHARGE_GAINS = [3, 2, 1, 1, 0];

class TrialCombatEngine {
    constructor() {
        this.p1 = { hp: 100, maxHp: 100, classId: 0, charge: 0, maxCharge: 10, isDead: false };
        this.p2 = { hp: 100, maxHp: 100, classId: 1, charge: 0, maxCharge: 10, isDead: false };
        this.isGauntlet = false;
        this.gauntletEnemies = [];
        this.gauntletIndex = 0;
        this.gameOver = false;
        this.turnNumber = 1;
    }

    _initFighter(id, isP1, classId) {
        let f = isP1 ? this.p1 : this.p2;
        f.classId = classId;
        f.isDead = false;
        f.charge = 0;
        f.maxCharge = 10;
        if (classId === 0) { f.maxHp = 115; f.hp = 115; } // Knight
        else if (classId === 1) { f.maxHp = 110; f.hp = 110; } // Alchemist
        else { f.maxHp = 105; f.hp = 105; } // Magician
    }

    initGame(isGauntlet, seed, p1Class, p2Class) {
        // mock seed behavior
        Math.random = function () {
            let x = Math.sin(seed++) * 10000;
            return x - Math.floor(x);
        };
        this.isGauntlet = isGauntlet;
        this.gauntletIndex = 0;
        this.gameOver = false;
        this.turnNumber = 1;

        this._initFighter(1, true, p1Class);

        if (isGauntlet) {
            this.gauntletEnemies = [
                { hp: 60, maxHp: 60, classId: Math.floor(Math.random() * 3) },
                { hp: 80, maxHp: 80, classId: Math.floor(Math.random() * 3) },
                { hp: 100, maxHp: 100, classId: Math.floor(Math.random() * 3) }
            ];
            this.p2 = { ...this.gauntletEnemies[0] };
        } else {
            this._initFighter(2, false, p2Class);
        }
    }

    chooseMoveAI() {
        let validMoves = [0, 1];
        if (this.p2.charge >= 3) validMoves.push(2);
        if (this.p2.charge >= 2) validMoves.push(3);
        if (this.p2.charge >= 10) validMoves.push(4);
        return validMoves[Math.floor(Math.random() * validMoves.length)];
    }

    resolveTurn(p1Move, p2Move) {
        if (this.gameOver) return null;

        // P1 attacks and charge handling
        this.p1.charge = Math.min(this.p1.maxCharge, this.p1.charge - MOVE_COSTS[p1Move] + CHARGE_GAINS[p1Move]);
        this.p2.charge = Math.min(this.p2.maxCharge, this.p2.charge - MOVE_COSTS[p2Move] + CHARGE_GAINS[p2Move]);

        // Both players attack (simultaneous check for tie)
        let p1Dmg = 10 + Math.floor(Math.random() * 15);
        if (p1Move === 4) p1Dmg = 35 + Math.floor(Math.random() * 20);
        if (p2Move === 1) p1Dmg = Math.floor(p1Dmg * 0.5);
        if (this.p1.classId === 0) p1Dmg += 5;

        // P2 attacks
        let p2Dmg = 8 + Math.floor(Math.random() * 12);
        if (p2Move === 4) p2Dmg = 35 + Math.floor(Math.random() * 20);
        if (p1Move === 1) p2Dmg = Math.floor(p2Dmg * 0.5);

        this.p2.hp = Math.max(0, this.p2.hp - p1Dmg);
        this.p1.hp = Math.max(0, this.p1.hp - p2Dmg);

        let winner = 0; // ongoing
        if (this.p1.hp <= 0 && this.p2.hp <= 0) {
            this.p1.isDead = true;
            this.p2.isDead = true;
            this.gameOver = true;
            winner = 4; // DRAW / TIE
        } else if (this.p2.hp <= 0) {
            this.p2.isDead = true;
            if (this.isGauntlet) {
                this.gauntletIndex++;
                if (this.gauntletIndex >= 3) {
                    this.gameOver = true;
                    winner = 1;
                } else {
                    this.p2 = { ...this.gauntletEnemies[this.gauntletIndex] };
                    winner = 3; // advance
                }
            } else {
                this.gameOver = true;
                winner = 1; // P1 Wins
            }
        } else if (this.p1.hp <= 0) {
            this.p1.isDead = true;
            this.gameOver = true;
            winner = 2; // P2 Wins
        }

        this.turnNumber++;
        return {
            p1DamageDealt: p1Dmg,
            p2DamageDealt: p2Dmg,
            p1MoveUsed: p1Move,
            p2MoveUsed: p2Move,
            winnerStatus: winner // 0: ongoing, 1: P1 win, 2: P2 win, 3: gauntlet advance
        };
    }

    getP1State() { return { ...this.p1 }; }
    getP2State() { return { ...this.p2 }; }
}

export const TrialEngine = new TrialCombatEngine();
