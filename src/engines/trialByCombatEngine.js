/**
 * Trial by Combat - Ported from C logic
 */

export class PRNG {
    constructor(seed) {
        this.seed = Math.floor(seed) % 2147483647;
        if (this.seed <= 0) this.seed += 2147483646;
    }

    next() {
        return this.seed = this.seed * 16807 % 2147483647;
    }

    nextFloat() {
        return (this.next() - 1) / 2147483646;
    }
}

export const ClassType = {
    KNIGHT: 0,
    MAGICIAN: 1,
    ALCHEMIST: 2
};

export const MoveType = {
    ATK: 0,
    DEF: 1,
    DOT: 2,
    BUFF: 3,
    ULT: 4
};

export const GameScreen = {
    MENU: 'MENU',
    SELECT_CLASS_P1: 'SELECT_CLASS_P1',
    SELECT_CLASS_P2: 'SELECT_CLASS_P2',
    SELECT_OPPONENT: 'SELECT_OPPONENT',
    BATTLE: 'BATTLE',
    RESOLVE: 'RESOLVE',
    RESULT: 'RESULT',
    GAUNTLET_BATTLE: 'GAUNTLET_BATTLE',
    GAUNTLET_RESOLVE: 'GAUNTLET_RESOLVE'
};

const MAX_CHARGE = 10;
const MAX_TURNS = 25;
const MAX_DOT_STACKS = 3;
const CHARGE_GAIN = [3, 2, 1, 1, 0];

const BASE_ATK_DAMAGE = [15, 13, 14];
const BASE_ULT_DAMAGE = [28, 26, 22];
const DOT_BASE = [5, 8, 12];

const KNIGHT_MOVES = [
    { name: "Steady Blade", type: MoveType.ATK, cost: 0 },
    { name: "Aegis Wall", type: MoveType.DEF, cost: 0 },
    { name: "Mortal Wounds", type: MoveType.DOT, cost: 3 },
    { name: "Indomitable Spirit", type: MoveType.BUFF, cost: 2 },
    { name: "Executioner's Verdict", type: MoveType.ULT, cost: 10 }
];

const MAGICIAN_MOVES = [
    { name: "Elemental Spark", type: MoveType.ATK, cost: 0 },
    { name: "Mana Barrier", type: MoveType.DEF, cost: 0 },
    { name: "Flesh Embers", type: MoveType.DOT, cost: 3 },
    { name: "Runic Overclock", type: MoveType.BUFF, cost: 2 },
    { name: "Arcane Overload", type: MoveType.ULT, cost: 10 }
];

const ALCHEMIST_MOVES = [
    { name: "Primed Flask", type: MoveType.ATK, cost: 0 },
    { name: "Pact of Attrition", type: MoveType.DEF, cost: 0 },
    { name: "Vial of Corrosion", type: MoveType.DOT, cost: 3 },
    { name: "Adrenal Mixture", type: MoveType.BUFF, cost: 2 },
    { name: "Grand Transmutation", type: MoveType.ULT, cost: 10 }
];

export class TrialByCombatEngine {
    constructor(seed = Math.random() * 2147483646) {
        this.reset(seed);
    }

    reset(seed = Math.random() * 2147483646) {
        this.rng = new PRNG(seed);
        this.p1 = this._createFighter("Player 1", ClassType.KNIGHT);
        this.p2 = this._createFighter("Player 2", ClassType.KNIGHT);
        this.enemies = []; // For gauntlet
        this.vsComputer = 0; // 0: Player, 1: AI, 2: Gauntlet
        this.turn = 1;
        this.log = [];
        this.winner = null;
        this.resultMsg = "";
        this.gauntletMode = false;
        this.p1chosen = false;
        this.moveP1 = null;
        this.moveP2 = null;
        this.selectedTarget = 0;
    }

    _createFighter(name, classId) {
        let f = {
            name,
            classId,
            hp: 0,
            maxHp: 0,
            baseAtk: 0,
            baseDef: 0,
            baseSpd: 0,
            crt: 12,
            charge: 0,
            buffActive: false,
            buffTurns: 0,
            buffStat: 0, // 0: DEF, 1: SPD, 2: ATK
            buffAmt: 4,
            dotStacks: 0,
            dotTurns: 0,
            defPenalty: 0
        };

        switch (classId) {
            case ClassType.KNIGHT:
                f.hp = f.maxHp = 115; f.baseAtk = 10; f.baseDef = 12; f.baseSpd = 9;
                f.buffStat = 0; f.buffAmt = 4; break;
            case ClassType.MAGICIAN:
                f.hp = f.maxHp = 105; f.baseAtk = 10; f.baseDef = 10; f.baseSpd = 12;
                f.buffStat = 1; f.buffAmt = 4; break;
            case ClassType.ALCHEMIST:
                f.hp = f.maxHp = 110; f.baseAtk = 12; f.baseDef = 10; f.baseSpd = 10;
                f.buffStat = 2; f.buffAmt = 4; break;
        }
        return f;
    }

    initGauntlet(classId) {
        this.reset(Math.random() * 2147483646);
        this.vsComputer = 2;
        this.gauntletMode = true;
        this.p1 = this._createFighter("Champion", classId);

        const enemyNames = ["Knight", "Magician", "Alchemist"];
        this.enemies = enemyNames.map((name, idx) => this._createFighter(name, idx));

        let totalEnemyHp = this.enemies.reduce((sum, e) => sum + e.maxHp, 0);
        this.p1.maxHp = this.p1.hp = Math.floor(totalEnemyHp * 1.5);
        this.selectedTarget = 0;
    }

    getMoves(classId) {
        if (classId === ClassType.MAGICIAN) return MAGICIAN_MOVES;
        if (classId === ClassType.ALCHEMIST) return ALCHEMIST_MOVES;
        return KNIGHT_MOVES;
    }

    eAtk(f) { return f.baseAtk + (f.buffActive && f.buffStat === 2 ? f.buffAmt : 0); }
    eDef(f) {
        let d = f.baseDef + (f.buffActive && f.buffStat === 0 ? f.buffAmt : 0) - f.defPenalty;
        return d < 0 ? 0 : d;
    }
    eSpd(f) { return f.baseSpd + (f.buffActive && f.buffStat === 1 ? f.buffAmt : 0); }

    randPct() { return Math.floor(this.rng.nextFloat() * 100); }

    calcDamage(base, atk, def) {
        let d = base + Math.floor(atk / 2) - Math.floor(def / 3);
        return d < 1 ? 1 : d;
    }

    calcDotTick(base, atk, def) {
        let d = base + Math.floor(atk / 4) - Math.floor(def / 4);
        return d < 1 ? 1 : d;
    }

    addLog(msg) {
        this.log.push(msg);
        if (this.log.length > 8) this.log.shift();
    }

    chooseMoveAI(ai, opp) {
        let hpPct = (ai.hp * 100) / ai.maxHp;
        if (ai.charge === MAX_CHARGE && this.randPct() < 65) return MoveType.ULT;
        if (hpPct < 25 && this.randPct() < 60) return MoveType.DEF;

        if (opp.buffActive) {
            let r = this.randPct();
            if (r < 45) return MoveType.ATK;
            if (r < 70 && ai.charge >= 3) return MoveType.DOT;
        }
        if (opp.dotStacks < MAX_DOT_STACKS && ai.charge >= 3 && this.randPct() < 35)
            return MoveType.DOT;
        if (!ai.buffActive && ai.charge >= 2 && hpPct > 40 && this.randPct() < 40)
            return MoveType.BUFF;
        if (ai.charge >= 7 && ai.charge < MAX_CHARGE && this.randPct() < 25)
            return MoveType.DEF;
        return MoveType.ATK;
    }

    resolveTurn(move1, move2) {
        const moves1 = this.getMoves(this.p1.classId);
        const moves2 = this.getMoves(this.p2.classId);
        const type1 = moves1[move1].type;
        const type2 = moves2[move2].type;

        this.addLog(`${this.p1.name} used ${moves1[move1].name}`);
        this.addLog(`${this.p2.name} used ${moves2[move2].name}`);

        const fighters = [this.p1, this.p2];
        const moveTypes = [type1, type2];

        for (let dir = 0; dir < 2; dir++) {
            let att = fighters[dir];
            let def = fighters[dir === 0 ? 1 : 0];
            let myT = moveTypes[dir];
            let oppT = moveTypes[dir === 0 ? 1 : 0];

            let aStat = this.eAtk(att);
            let dStat = this.eDef(def);
            let dodge = 5 + this.eSpd(def);

            if (myT === MoveType.ATK) {
                if (this.randPct() < dodge) {
                    this.addLog(`${def.name} dodged!`);
                } else {
                    let mult = 1.0;
                    if (oppT === MoveType.DEF) mult = 0.5;
                    if (oppT === MoveType.BUFF) mult = 1.3;
                    let crit = (this.randPct() < att.crt);
                    let dmg = this.calcDamage(BASE_ATK_DAMAGE[att.classId], aStat, dStat);
                    if (crit) dmg = Math.floor(dmg * 1.5);
                    dmg = Math.floor(dmg * mult);
                    if (dmg < 1) dmg = 1;
                    def.hp -= dmg;
                    this.addLog(`${crit ? "CRIT! " : ""}${att.name} -> ${def.name}: ${dmg} dmg${oppT === MoveType.DEF ? " (blocked)" : oppT === MoveType.BUFF ? " (off-guard)" : ""}`);
                }
            }

            if (myT === MoveType.DOT) {
                if (oppT === MoveType.ATK) {
                    this.addLog(`${att.name}'s DoT interrupted!`);
                } else if (this.randPct() < dodge) {
                    this.addLog(`${def.name} evaded DoT!`);
                } else {
                    if (def.dotStacks < MAX_DOT_STACKS) def.dotStacks++;
                    def.dotTurns = 3;
                    this.addLog(`${def.name}: DoT stack ${def.dotStacks}/3${oppT === MoveType.BUFF ? " EMPOWERED!" : ""}`);
                }
            }

            if (myT === MoveType.BUFF) {
                if (oppT === MoveType.DEF) {
                    this.addLog(`${att.name}'s buff suppressed!`);
                } else {
                    att.buffActive = true;
                    att.buffTurns = 3;
                    const statNames = ["DEF", "SPD", "ATK"];
                    this.addLog(`${att.name} buffed! +${att.buffAmt} ${statNames[att.buffStat]} (3T)`);
                }
            }

            if (myT === MoveType.ULT) {
                let mult = 1.0;
                if (oppT === MoveType.DEF) mult = 0.25;
                if (oppT === MoveType.BUFF) mult = 1.25;
                let effDef = (att.classId === ClassType.MAGICIAN) ? Math.floor(dStat / 2) : dStat;
                let crit = (this.randPct() < att.crt);
                let dmg = this.calcDamage(BASE_ULT_DAMAGE[att.classId], aStat, effDef);
                if (crit) dmg = Math.floor(dmg * 1.4);
                dmg = Math.floor(dmg * mult);
                if (dmg < 1) dmg = 1;
                def.hp -= dmg;
                this.addLog(`${crit ? "CRIT! " : ""}ULTIMATE! ${att.name} -> ${def.name}: ${dmg} dmg${oppT === MoveType.DEF ? " (deflected)" : ""}`);

                if (att.classId === ClassType.KNIGHT) {
                    def.defPenalty += 2;
                    this.addLog(`Armor sundered! ${def.name} -2 DEF permanently`);
                }
                if (att.classId === ClassType.ALCHEMIST) {
                    att.hp += dmg;
                    if (att.hp > att.maxHp) att.hp = att.maxHp;
                    this.addLog(`${att.name} absorbed ${dmg} life force!`);
                }
            }
        }

        // DoT ticks
        for (let dir = 0; dir < 2; dir++) {
            let f = fighters[dir];
            let src = fighters[dir === 0 ? 1 : 0];
            if (f.dotStacks > 0 && f.dotTurns > 0) {
                let tick = this.calcDotTick(DOT_BASE[f.dotStacks - 1], this.eAtk(src), this.eDef(f));
                f.hp -= tick;
                f.dotTurns--;
                this.addLog(`DoT: ${f.name} burned ${tick} (${f.dotTurns}T left)`);
                if (f.dotTurns === 0) {
                    f.dotStacks = 0;
                    this.addLog(`${f.name}'s DoT faded`);
                }
            }
        }

        // Charge update
        this.p1.charge += (CHARGE_GAIN[type1] - moves1[move1].cost);
        this.p2.charge += (CHARGE_GAIN[type2] - moves2[move2].cost);
        [this.p1, this.p2].forEach(f => {
            if (f.charge > MAX_CHARGE) f.charge = MAX_CHARGE;
            if (f.charge < 0) f.charge = 0;
        });

        // Buff tick
        [this.p1, this.p2].forEach(f => {
            if (f.buffActive) {
                f.buffTurns--;
                if (f.buffTurns <= 0) {
                    f.buffActive = false;
                    this.addLog(`${f.name}'s buff expired`);
                }
            }
        });
    }

    resolveGauntletTurn(move, targetIdx) {
        const pmoves = this.getMoves(this.p1.classId);
        const player = this.p1;
        const HEAL_REWARD = 20;

        this.addLog("--- YOUR TURN ---");
        this.addLog(`You used ${pmoves[move].name}`);

        const target = this.enemies[targetIdx];
        if (target && target.hp > 0) {
            let myT = pmoves[move].type;
            let aStat = this.eAtk(player);
            let dStat = this.eDef(target);
            let dodge = 5 + this.eSpd(target);

            if (myT === MoveType.ATK) {
                if (this.randPct() < dodge) {
                    this.addLog(`${target.name} dodged!`);
                } else {
                    let crit = (this.randPct() < player.crt);
                    let dmg = this.calcDamage(BASE_ATK_DAMAGE[player.classId], aStat, dStat);
                    if (crit) dmg = Math.floor(dmg * 1.5);
                    if (dmg < 1) dmg = 1;
                    target.hp -= dmg;
                    this.addLog(`${crit ? "CRIT! " : ""}${player.name} -> ${target.name}: ${dmg} dmg`);
                }
            } else if (myT === MoveType.DOT) {
                if (this.randPct() < dodge) {
                    this.addLog(`${target.name} evaded DoT!`);
                } else {
                    if (target.dotStacks < MAX_DOT_STACKS) target.dotStacks++;
                    target.dotTurns = 3;
                    this.addLog(`DoT on ${target.name} (stack ${target.dotStacks}/3)`);
                }
            } else if (myT === MoveType.BUFF) {
                player.buffActive = true;
                player.buffTurns = 3;
                this.addLog(`You buffed! +${player.buffAmt}`);
            } else if (myT === MoveType.ULT) {
                let effDef = (player.classId === ClassType.MAGICIAN) ? Math.floor(dStat / 2) : dStat;
                let crit = (this.randPct() < player.crt);
                let dmg = this.calcDamage(BASE_ULT_DAMAGE[player.classId], aStat, effDef);
                if (crit) dmg = Math.floor(dmg * 1.4);
                if (dmg < 1) dmg = 1;
                target.hp -= dmg;
                this.addLog(`${crit ? "CRIT! " : ""}ULTIMATE -> ${target.name}: ${dmg} dmg!`);
                if (player.classId === ClassType.KNIGHT) {
                    target.defPenalty += 2;
                    this.addLog(`${target.name} armor sundered! -2 DEF`);
                }
                if (player.classId === ClassType.ALCHEMIST) {
                    player.hp += dmg;
                    if (player.hp > player.maxHp) player.hp = player.maxHp;
                    this.addLog(`${player.name} absorbed ${dmg} life force!`);
                }
            }

            if (target.hp <= 0) {
                target.hp = 0;
                this.addLog(`${target.name} defeated! +${HEAL_REWARD} HP`);
                player.hp += HEAL_REWARD;
                if (player.hp > player.maxHp) player.hp = player.maxHp;
            }
        }

        // Charge update
        player.charge += (CHARGE_GAIN[pmoves[move].type] - pmoves[move].cost);
        if (player.charge > MAX_CHARGE) player.charge = MAX_CHARGE;
        if (player.charge < 0) player.charge = 0;

        // Player Buff tick
        if (player.buffActive) {
            player.buffTurns--;
            if (player.buffTurns <= 0) {
                player.buffActive = false;
                this.addLog("Your buff expired.");
            }
        }

        // Enemies Turn
        this.addLog("--- ENEMIES TURN ---");
        const playerDefending = (pmoves[move].type === MoveType.DEF);

        this.enemies.forEach(e => {
            if (e.hp <= 0) return;
            let emove = this.chooseMoveAI(e, player);
            let em = this.getMoves(e.classId)[emove];
            this.addLog(`${e.name}: ${em.name}`);

            let dodge = 5 + this.eSpd(player);
            let defMult = playerDefending ? 0.5 : 1.0;

            if (em.type === MoveType.ATK) {
                if (this.randPct() < dodge) {
                    this.addLog(" You dodged!");
                } else {
                    let crit = (this.randPct() < e.crt);
                    let dmg = this.calcDamage(BASE_ATK_DAMAGE[e.classId], this.eAtk(e), this.eDef(player));
                    if (crit) dmg = Math.floor(dmg * 1.5);
                    dmg = Math.floor(dmg * defMult);
                    if (dmg < 1) dmg = 1;
                    player.hp -= dmg;
                    this.addLog(`${crit ? "CRIT! " : ""}${e.name} deals ${dmg} to you${playerDefending ? " (blocked)" : ""}`);
                }
            } else if (em.type === MoveType.ULT) {
                let crit = (this.randPct() < e.crt);
                let dmg = this.calcDamage(BASE_ULT_DAMAGE[e.classId], this.eAtk(e), Math.floor(this.eDef(player) / (e.classId === ClassType.MAGICIAN ? 2 : 1)));
                if (crit) dmg = Math.floor(dmg * 1.4);
                dmg = Math.floor(dmg * defMult);
                if (dmg < 1) dmg = 1;
                player.hp -= dmg;
                this.addLog(`${crit ? "CRIT! " : ""}${e.name} ULTIMATE: ${dmg} dmg!`);
            } else if (em.type === MoveType.BUFF) {
                e.buffActive = true; e.buffTurns = 3;
            }

            e.charge += (CHARGE_GAIN[em.type] - em.cost);
            if (e.charge > MAX_CHARGE) e.charge = MAX_CHARGE;
            if (e.charge < 0) e.charge = 0;
            if (e.buffActive) {
                e.buffTurns--;
                if (e.buffTurns <= 0) e.buffActive = false;
            }
        });

        // DoT Ticks on enemies
        this.enemies.forEach(e => {
            if (e.hp > 0 && e.dotStacks > 0 && e.dotTurns > 0) {
                let tick = this.calcDotTick(DOT_BASE[e.dotStacks - 1], this.eAtk(player), this.eDef(e));
                e.hp -= tick; e.dotTurns--;
                this.addLog(`DoT: ${e.name} takes ${tick}`);
                if (e.dotTurns === 0) {
                    e.dotStacks = 0;
                    this.addLog(`${e.name} DoT faded`);
                }
                if (e.hp <= 0) {
                    e.hp = 0;
                    this.addLog(`${e.name} defeated by DoT! +${HEAL_REWARD} HP`);
                    player.hp += HEAL_REWARD;
                    if (player.hp > player.maxHp) player.hp = player.maxHp;
                }
            }
        });
    }

    getState() {
        return {
            p1: { ...this.p1 },
            p2: { ...this.p2 },
            enemies: this.enemies.map(e => ({ ...e })),
            turn: this.turn,
            log: [...this.log],
            vsComputer: this.vsComputer,
            gauntletMode: this.gauntletMode,
            p1chosen: this.p1chosen,
            selectedTarget: this.selectedTarget,
            MAX_CHARGE,
            MAX_TURNS
        };
    }
}
