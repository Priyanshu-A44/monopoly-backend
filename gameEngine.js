import { BOARD_TILES } from "./boardData.js";

export const TURN_PHASES = {
  AWAITING_ROLL: "AWAITING_ROLL",
  ACTION_REQUIRED: "ACTION_REQUIRED",
  AUCTION: "AUCTION",
  AWAITING_END_TURN: "AWAITING_END_TURN",
  GAME_OVER: "GAME_OVER"
};

const COLORS = ["#e74c3c", "#3498db", "#2ecc71", "#f1c40f", "#9b59b6", "#e67e22"];

export class MonopolyEngine {
  constructor(roomCode, rawPlayers) {
    const shuffled = [...rawPlayers].sort(() => Math.random() - 0.5);
    this.state = {
      roomCode,
      board: BOARD_TILES,
      players: shuffled.map((p, idx) => ({
        id: p.id,
        name: p.name,
        color: COLORS[idx % COLORS.length],
        money: 1500,
        position: 0,
        inJail: false,
        jailTurns: 0,
        bankrupt: false
      })),
      turnIndex: 0,
      turnPhase: TURN_PHASES.AWAITING_ROLL,
      properties: {},
      auction: null,
      currentDice: [1, 1],
      doublesCount: 0,
      winnerId: null,
      log: ["Game started with randomized player order. Good luck!"]
    };
  }

  getState() {
    return this.state;
  }

  getCurrentPlayer() {
    return this.state.players[this.state.turnIndex];
  }

  logMessage(msg) {
    this.state.log.unshift(msg);
    if (this.state.log.length > 30) this.state.log.pop();
  }

  setPhase(phase) {
    if (this.state.turnPhase !== TURN_PHASES.GAME_OVER) this.state.turnPhase = phase;
  }

  getCountryTiles(countryCode) {
    return BOARD_TILES.filter((t) => t.countryCode === countryCode);
  }

  hasFullCountry(playerId, countryCode) {
    if (!countryCode) return false;
    const tiles = this.getCountryTiles(countryCode);
    return tiles.length > 0 && tiles.every((t) => this.state.properties[t.id]?.ownerId === playerId);
  }

  countOwned(playerId, type) {
    const searchType = (type || "").toLowerCase();
    return BOARD_TILES.filter(
      (t) => (t.type || "").toLowerCase() === searchType && this.state.properties[t.id]?.ownerId === playerId
    ).length;
  }

  // --- TIMER TICK FOR AUCTION ---
  tickAuctionTimer() {
    if (this.state.turnPhase !== TURN_PHASES.AUCTION || !this.state.auction) return false;
    this.state.auction.timeLeft = (this.state.auction.timeLeft ?? 10) - 1;
    if (this.state.auction.timeLeft <= 0) {
      const bidder = this.getAuctionCurrentBidder();
      if (bidder) {
        this.logMessage(`⏱️ Time expired for ${bidder.name}! Auto-passing.`);
        this.passBid(bidder.id);
      }
    }
    return true;
  }

  // --- MONEY / BANKRUPTCY ---
  chargePlayer(player, amount, creditor = null) {
    if (player.money >= amount) {
      player.money -= amount;
      if (creditor) creditor.money += amount;
      return true;
    }
    if (creditor) creditor.money += player.money;
    player.money = 0;
    this.declareBankruptcy(player, creditor);
    return false;
  }

  declareBankruptcy(player, creditor) {
    player.bankrupt = true;
    Object.entries(this.state.properties).forEach(([tileId, prop]) => {
      if (prop.ownerId !== player.id) return;
      if (creditor) {
        prop.ownerId = creditor.id;
        prop.houses = 0;
      } else {
        delete this.state.properties[tileId];
      }
    });
    this.logMessage(`💀 ${player.name} went bankrupt${creditor ? ` to ${creditor.name}` : ""}!`);

    const alive = this.state.players.filter((p) => !p.bankrupt);
    if (alive.length === 1) {
      this.state.winnerId = alive[0].id;
      this.state.turnPhase = TURN_PHASES.GAME_OVER;
      this.logMessage(`🏆 ${alive[0].name} wins the game!`);
    }
  }

  // --- MORTGAGE SYSTEM ---
  mortgageProperty(playerId, tileId) {
    const player = this.getCurrentPlayer();
    if (player.id !== playerId) throw new Error("Not your turn!");

    const prop = this.state.properties[tileId];
    if (!prop || prop.ownerId !== playerId) throw new Error("You do not own this property.");
    if (prop.isMortgaged) throw new Error("Property is already mortgaged.");
    if ((prop.houses || 0) > 0) throw new Error("Must sell houses/hotels before mortgaging!");

    const tile = BOARD_TILES[tileId];
    const value = Math.round((tile.price || 100) / 2);
    prop.isMortgaged = true;
    player.money += value;
    this.logMessage(`🏦 ${player.name} mortgaged ${tile.name} for +$${value}.`);
    return this.state;
  }

  unmortgageProperty(playerId, tileId) {
    const player = this.getCurrentPlayer();
    if (player.id !== playerId) throw new Error("Not your turn!");

    const prop = this.state.properties[tileId];
    if (!prop || prop.ownerId !== playerId) throw new Error("You do not own this property.");
    if (!prop.isMortgaged) throw new Error("Property is not mortgaged.");

    const tile = BOARD_TILES[tileId];
    const cost = Math.round(((tile.price || 100) / 2) * 1.1);
    if (player.money < cost) throw new Error(`Requires $${cost} to unmortgage (You have $${player.money}).`);

    prop.isMortgaged = false;
    player.money -= cost;
    this.logMessage(`🔓 ${player.name} unmortgaged ${tile.name} for -$${cost}.`);
    return this.state;
  }

  // --- MOVEMENT ---
  sendToJail(player) {
    player.position = 10;
    player.inJail = true;
    player.jailTurns = 0;
    this.logMessage(`🚔 ${player.name} was sent to Prison!`);
    this.setPhase(TURN_PHASES.AWAITING_END_TURN);
  }

  teleportPlayer(player, targetIndex, allowPassStart = true) {
    const oldPos = player.position;
    player.position = targetIndex;
    if (allowPassStart && targetIndex < oldPos) {
      player.money += 200;
      this.logMessage(`✨ ${player.name} passed START while traveling and collected $200!`);
    }
    this.handleTileLanding(player, BOARD_TILES[player.position]);
  }

  moveAndLand(player, steps) {
    const oldPos = player.position;
    player.position = (oldPos + steps) % 40;
    if (player.position < oldPos) {
      player.money += 200;
      this.logMessage(`${player.name} passed START and collected $200.`);
    }
    this.handleTileLanding(player, BOARD_TILES[player.position]);
  }

  // --- CARDS ---
  drawChestCard(player) {
    const cards = [
      { text: "✈️ Express Flight! Fly directly to CDG Airport.", action: (p) => this.teleportPlayer(p, 25) },
      {
        text: "🎉 Birthday Party! Collect $50 from every player.",
        action: (p) => {
          let total = 0;
          this.state.players.forEach((other) => {
            if (other.id !== p.id && !other.bankrupt) {
              const amount = Math.min(other.money, 50);
              other.money -= amount;
              total += amount;
            }
          });
          p.money += total;
          this.setPhase(TURN_PHASES.AWAITING_END_TURN);
        }
      },
      { text: "🚀 Jet Set Vacation! Advance directly to New York.", action: (p) => this.teleportPlayer(p, 39) },
      {
        text: "🏦 Bank error in your favor! Collect $200.",
        action: (p) => {
          p.money += 200;
          this.setPhase(TURN_PHASES.AWAITING_END_TURN);
        }
      },
      { text: "🚔 Tax Audit! Go directly to Prison.", action: (p) => this.sendToJail(p) }
    ];
    const card = cards[Math.floor(Math.random() * cards.length)];
    this.logMessage(`📦 Treasure: ${card.text}`);
    card.action(player);
  }

  drawChanceCard(player) {
    const cards = [
      { text: "✈️ Emergency Transfer! Move to JFK Airport.", action: (p) => this.teleportPlayer(p, 35) },
      { text: "🍕 Tour of Rome! Advance directly to Rome.", action: (p) => this.teleportPlayer(p, 14) },
      {
        text: "🔙 Move Back 3 Spaces.",
        action: (p) => this.teleportPlayer(p, (p.position - 3 + 40) % 40, false)
      },
      {
        text: "🎰 Crypto Dividend! Collect $250.",
        action: (p) => {
          p.money += 250;
          this.setPhase(TURN_PHASES.AWAITING_END_TURN);
        }
      }
    ];
    const card = cards[Math.floor(Math.random() * cards.length)];
    this.logMessage(`❓ Surprise: ${card.text}`);
    card.action(player);
  }

  // --- JAIL ---
  payBail(playerId) {
    const player = this.getCurrentPlayer();
    if (player.id !== playerId) throw new Error("Not your turn!");
    if (!player.inJail) throw new Error("You are not in prison!");
    if (this.state.turnPhase !== TURN_PHASES.AWAITING_ROLL) throw new Error("Cannot pay bail right now.");
    if (player.money < 50) throw new Error("Insufficient funds for $50 bail!");

    player.money -= 50;
    player.inJail = false;
    player.jailTurns = 0;
    this.logMessage(`🔓 ${player.name} paid $50 bail and was released from Prison!`);
    return this.state;
  }

  // --- BUILDING ---
  canBuildHouse(playerId, tileId) {
    const tile = BOARD_TILES[tileId];
    const typeLower = (tile?.type || "").toLowerCase();
    if (!tile || (typeLower !== "prop" && typeLower !== "property") || !tile.countryCode) {
      return { allowed: false, reason: "You can only build on city properties." };
    }

    const prop = this.state.properties[tileId];
    if (!prop || prop.ownerId !== playerId) return { allowed: false, reason: "You do not own this property." };
    if (prop.isMortgaged) return { allowed: false, reason: "Cannot build on a mortgaged property." };

    if (!this.hasFullCountry(playerId, tile.countryCode)) {
      return { allowed: false, reason: `You must own ALL cities in ${tile.countryCode} before building!` };
    }

    const group = this.getCountryTiles(tile.countryCode);
    if (group.some((t) => this.state.properties[t.id]?.isMortgaged)) {
      return { allowed: false, reason: "Unmortgage all cities in this country first." };
    }

    const current = prop.houses || 0;
    if (current >= 5) return { allowed: false, reason: "Property already has a Hotel!" };

    const minHouses = Math.min(...group.map((t) => this.state.properties[t.id]?.houses || 0));
    if (current > minHouses) {
      return { allowed: false, reason: "Build evenly: add to your other cities in this country first." };
    }

    const player = this.state.players.find((p) => p.id === playerId);
    const cost = tile.houseCost || 100;
    if (player.money < cost) return { allowed: false, reason: `Requires $${cost} (You have $${player.money}).` };

    return { allowed: true };
  }

  buildHouse(playerId, tileId) {
    const player = this.getCurrentPlayer();
    if (player.id !== playerId) throw new Error("Not your turn!");

    const check = this.canBuildHouse(playerId, tileId);
    if (!check.allowed) throw new Error(check.reason);

    const tile = BOARD_TILES[tileId];
    const cost = tile.houseCost || 100;
    player.money -= cost;

    const prop = this.state.properties[tileId];
    prop.houses = (prop.houses || 0) + 1;

    const name = prop.houses === 5 ? "a Hotel 🏨" : `House #${prop.houses} 🏠`;
    this.logMessage(`🏗️ ${player.name} built ${name} on ${tile.name} for $${cost}.`);
    return this.state;
  }

  // --- DICE ---
  rollDice(playerId) {
    const player = this.getCurrentPlayer();
    if (player.id !== playerId) throw new Error("Not your turn!");
    if (this.state.turnPhase !== TURN_PHASES.AWAITING_ROLL) throw new Error("Cannot roll right now.");

    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    this.state.currentDice = [d1, d2];
    const isDouble = d1 === d2;
    this.logMessage(`${player.name} rolled ${d1} and ${d2}.`);

    let leftJail = false;
    if (player.inJail) {
      if (isDouble) {
        player.inJail = false;
        player.jailTurns = 0;
        leftJail = true;
        this.logMessage(`🎲 Double! ${player.name} broke out of Prison!`);
      } else {
        player.jailTurns = (player.jailTurns || 0) + 1;
        if (player.jailTurns < 3) {
          this.logMessage(`🔒 ${player.name} failed to roll doubles and remains in Prison.`);
          this.setPhase(TURN_PHASES.AWAITING_END_TURN);
          return this.state;
        }
        this.logMessage(`⚖️ ${player.name} failed 3 times and must pay $50 bail.`);
        if (!this.chargePlayer(player, 50)) {
          this.setPhase(TURN_PHASES.AWAITING_END_TURN);
          return this.state;
        }
        player.inJail = false;
        player.jailTurns = 0;
        leftJail = true;
      }
    }

    if (leftJail) this.state.doublesCount = 0;
    else if (isDouble) this.state.doublesCount++;
    else this.state.doublesCount = 0;

    if (this.state.doublesCount === 3) {
      this.state.doublesCount = 0;
      this.logMessage(`${player.name} rolled 3 doubles in a row!`);
      this.sendToJail(player);
      return this.state;
    }

    this.moveAndLand(player, d1 + d2);
    return this.state;
  }

  // --- LANDING & RENT ---
  calculateRent(tile, prop) {
    const typeLower = (tile.type || "").toLowerCase();
    if (typeLower === "prop" || typeLower === "property") {
      const houses = prop.houses || 0;
      let rent = tile.rent[houses];
      if (houses === 0 && this.hasFullCountry(prop.ownerId, tile.countryCode)) rent *= 2;
      return rent;
    }
    if (typeLower === "airport" || typeLower === "railroad") {
      const n = this.countOwned(prop.ownerId, "airport") || this.countOwned(prop.ownerId, "railroad");
      return (tile.rent && tile.rent[Math.min(n, 4) - 1]) || 25 * Math.pow(2, Math.max(0, n - 1));
    }
    const n = this.countOwned(prop.ownerId, "utility");
    const roll = this.state.currentDice[0] + this.state.currentDice[1];
    return roll * (n >= 2 ? 10 : 4);
  }

  handleTileLanding(player, tile) {
    this.logMessage(`${player.name} landed on ${tile.name}.`);
    const END = TURN_PHASES.AWAITING_END_TURN;
    const typeLower = (tile.type || "").toLowerCase();

    switch (typeLower) {
      case "prop":
      case "property":
      case "airport":
      case "railroad":
      case "utility": {
        const prop = this.state.properties[tile.id];
        if (!prop) {
          this.setPhase(TURN_PHASES.ACTION_REQUIRED);
          return;
        }
        if (prop.ownerId === player.id) {
          this.setPhase(END);
          return;
        }
        if (prop.isMortgaged) {
          this.logMessage(`${tile.name} is mortgaged! No rent collected.`);
          this.setPhase(END);
          return;
        }
        const owner = this.state.players.find((p) => p.id === prop.ownerId);
        if (!owner) {
          this.setPhase(END);
          return;
        }
        const rent = this.calculateRent(tile, prop);
        this.logMessage(`${player.name} owes $${rent} rent to ${owner.name}.`);
        this.chargePlayer(player, rent, owner);
        this.setPhase(END);
        return;
      }
      case "tax": {
        const amount = typeof tile.amount === "number" ? tile.amount : (tile.price || 100);
        this.logMessage(`${player.name} pays $${amount} in ${tile.name}.`);
        this.chargePlayer(player, amount);
        this.setPhase(END);
        return;
      }
      case "treasure":
      case "chest":
        this.drawChestCard(player);
        return;
      case "surprise":
      case "chance":
        this.drawChanceCard(player);
        return;
      case "gotojail":
        this.sendToJail(player);
        return;
      default:
        this.setPhase(END);
    }
  }

  // --- BUY / AUCTION ---
  buyProperty(playerId) {
    const player = this.getCurrentPlayer();
    if (player.id !== playerId) throw new Error("Not your turn!");
    if (this.state.turnPhase !== TURN_PHASES.ACTION_REQUIRED) throw new Error("Cannot buy property right now.");

    const tile = BOARD_TILES[player.position];
    if (player.money < tile.price) throw new Error("Insufficient funds to buy property.");

    player.money -= tile.price;
    this.state.properties[tile.id] = { ownerId: player.id, houses: 0, isMortgaged: false };
    this.logMessage(`${player.name} bought ${tile.name} for $${tile.price}.`);
    this.setPhase(TURN_PHASES.AWAITING_END_TURN);
    return this.state;
  }

  declineProperty(playerId) {
    const player = this.getCurrentPlayer();
    if (player.id !== playerId) throw new Error("Not your turn!");
    if (this.state.turnPhase !== TURN_PHASES.ACTION_REQUIRED) throw new Error("Cannot trigger auction now.");

    const tile = BOARD_TILES[player.position];
    this.logMessage(`${player.name} declined to buy ${tile.name}. Auction started!`);
    this.startAuction(tile.id);
    return this.state;
  }

  startAuction(tileId) {
    const activeBidders = this.state.players.filter((p) => !p.bankrupt).map((p) => p.id);
    this.state.auction = {
      tileId,
      currentBid: 0,
      highestBidderId: null,
      activeBidders,
      turnIndex: 0,
      currentBidder: activeBidders[0] || null,
      timeLeft: 10
    };
    this.setPhase(TURN_PHASES.AUCTION);
    this.syncAuction();
  }

  syncAuction() {
    const a = this.state.auction;
    if (!a) return;
    a.currentBidder = a.activeBidders[a.turnIndex] || null;
    a.timeLeft = 10;
  }

  getAuctionCurrentBidder() {
    const a = this.state.auction;
    if (!a || a.activeBidders.length === 0) return null;
    return this.state.players.find((p) => p.id === a.activeBidders[a.turnIndex]);
  }

  placeBid(playerId, bidAmount) {
    if (this.state.turnPhase !== TURN_PHASES.AUCTION || !this.state.auction) throw new Error("No active auction.");

    const bidder = this.getAuctionCurrentBidder();
    if (!bidder || bidder.id !== playerId) throw new Error("Not your turn to bid!");

    const a = this.state.auction;
    if (!Number.isInteger(bidAmount) || bidAmount <= a.currentBid) {
      throw new Error(`Bid must be a whole number greater than $${a.currentBid}.`);
    }
    if (bidAmount > bidder.money) throw new Error("You do not have enough money for this bid.");

    a.currentBid = bidAmount;
    a.highestBidderId = playerId;
    this.logMessage(`${bidder.name} bid $${bidAmount}.`);

    if (a.activeBidders.length === 1) {
      this.resolveAuction();
      return this.state;
    }

    a.turnIndex = (a.turnIndex + 1) % a.activeBidders.length;
    this.syncAuction();
    return this.state;
  }

  passBid(playerId) {
    if (this.state.turnPhase !== TURN_PHASES.AUCTION || !this.state.auction) throw new Error("No active auction.");

    const bidder = this.getAuctionCurrentBidder();
    if (!bidder || bidder.id !== playerId) throw new Error("Not your turn to bid!");

    const a = this.state.auction;
    this.logMessage(`${bidder.name} passed on bidding.`);
    a.activeBidders = a.activeBidders.filter((id) => id !== playerId);

    const remaining = a.activeBidders.length;
    const onlyHighestLeft = remaining === 1 && a.activeBidders[0] === a.highestBidderId;

    if (remaining === 0 || onlyHighestLeft) {
      this.resolveAuction();
    } else {
      if (a.turnIndex >= remaining) a.turnIndex = 0;
      this.syncAuction();
    }
    return this.state;
  }

  resolveAuction() {
    const { tileId, currentBid, highestBidderId } = this.state.auction;
    const tile = BOARD_TILES[tileId];

    if (highestBidderId) {
      const winner = this.state.players.find((p) => p.id === highestBidderId);
      winner.money -= currentBid;
      this.state.properties[tileId] = { ownerId: winner.id, houses: 0, isMortgaged: false };
      this.logMessage(`Auction won! ${winner.name} bought ${tile.name} for $${currentBid}.`);
    } else {
      this.logMessage(`No bids placed. ${tile.name} remains unowned.`);
    }

    this.state.auction = null;
    this.setPhase(TURN_PHASES.AWAITING_END_TURN);
  }

  // --- TURN ---
  endTurn(playerId) {
    const player = this.getCurrentPlayer();
    if (player.id !== playerId) throw new Error("Not your turn!");
    if (this.state.turnPhase !== TURN_PHASES.AWAITING_END_TURN) {
      throw new Error("Must finish mandatory actions before ending turn.");
    }

    if (this.state.doublesCount > 0 && !player.inJail && !player.bankrupt) {
      this.setPhase(TURN_PHASES.AWAITING_ROLL);
      this.logMessage(`🎲 ${player.name} rolled doubles and goes again!`);
      return this.state;
    }

    do {
      this.state.turnIndex = (this.state.turnIndex + 1) % this.state.players.length;
    } while (this.state.players[this.state.turnIndex].bankrupt);

    this.state.turnPhase = TURN_PHASES.AWAITING_ROLL;
    this.state.doublesCount = 0;
    this.logMessage(`It is now ${this.getCurrentPlayer().name}'s turn.`);
    return this.state;
  }
}
