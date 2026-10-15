import { BOARD_TILES } from "./boardData.js";

export const TURN_PHASES = {
  AWAITING_ROLL: "AWAITING_ROLL",
  ACTION_REQUIRED: "ACTION_REQUIRED",
  AUCTION: "AUCTION",
  AWAITING_END_TURN: "AWAITING_END_TURN"
};

export class MonopolyEngine {
  constructor(roomCode, rawPlayers) {
    this.state = {
      roomCode,
      board: BOARD_TILES,
      players: rawPlayers.map((p, idx) => ({
        id: p.id,
        name: p.name,
        color: ["#e74c3c", "#3498db", "#2ecc71", "#f1c40f", "#9b59b6", "#e67e22"][idx % 6],
        money: 1500,
        position: 0,
        inJail: false,
        bankrupt: false
      })),
      turnIndex: 0,
      turnPhase: TURN_PHASES.AWAITING_ROLL,
      properties: {},
      auction: null,
      currentDice: [1, 1],
      doublesCount: 0,
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

  getGroupTiles(group) {
    return BOARD_TILES.filter((t) => t.group === group);
  }

  hasMonopoly(playerId, group) {
    if (!group) return false;
    const groupTiles = this.getGroupTiles(group);
    return groupTiles.every((t) => this.state.properties[t.id]?.ownerId === playerId);
  }

  canBuildHouse(playerId, tileId) {
    const tile = BOARD_TILES[tileId];
    if (!tile || tile.type !== "PROPERTY" || !tile.group) {
      return { allowed: false, reason: "Cannot build on this tile type." };
    }

    const prop = this.state.properties[tileId];
    if (!prop || prop.ownerId !== playerId) {
      return { allowed: false, reason: "You do not own this property." };
    }

    if (!this.hasMonopoly(playerId, tile.group)) {
      return { allowed: false, reason: "You must own all properties in this color group first." };
    }

    const currentHouses = prop.houses || 0;
    if (currentHouses >= 5) {
      return { allowed: false, reason: "Property already has a Hotel!" };
    }

    const groupTiles = this.getGroupTiles(tile.group);
    const minHousesInGroup = Math.min(
      ...groupTiles.map((t) => this.state.properties[t.id]?.houses || 0)
    );

    if (currentHouses > minHousesInGroup) {
      return { allowed: false, reason: "Build evenly across properties in this group." };
    }

    const player = this.state.players.find((p) => p.id === playerId);
    if (player.money < tile.houseCost) {
      return { allowed: false, reason: `Requires $${tile.houseCost} (You have $${player.money}).` };
    }

    return { allowed: true };
  }

  buildHouse(playerId, tileId) {
    const player = this.getCurrentPlayer();
    if (player.id !== playerId) throw new Error("Not your turn!");

    const check = this.canBuildHouse(playerId, tileId);
    if (!check.allowed) throw new Error(check.reason);

    const tile = BOARD_TILES[tileId];
    player.money -= tile.houseCost;

    const currentHouses = this.state.properties[tileId].houses || 0;
    const newHouses = currentHouses + 1;
    this.state.properties[tileId].houses = newHouses;

    const structureName = newHouses === 5 ? "a Hotel" : `House #${newHouses}`;
    this.logMessage(`${player.name} built ${structureName} on ${tile.name} for $${tile.houseCost}.`);

    return this.state;
  }

  rollDice(playerId) {
    const player = this.getCurrentPlayer();
    if (player.id !== playerId) throw new Error("Not your turn!");
    if (this.state.turnPhase !== TURN_PHASES.AWAITING_ROLL) {
      throw new Error("Cannot roll right now.");
    }

    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    this.state.currentDice = [d1, d2];
    const isDouble = d1 === d2;

    this.logMessage(`${player.name} rolled ${d1} and ${d2}.`);

    if (isDouble) this.state.doublesCount++;
    else this.state.doublesCount = 0;

    if (this.state.doublesCount === 3) {
      player.position = 10;
      player.inJail = true;
      this.state.turnPhase = TURN_PHASES.AWAITING_END_TURN;
      this.logMessage(`${player.name} rolled 3 doubles and went to Prison!`);
      return this.state;
    }

    const oldPos = player.position;
    player.position = (player.position + d1 + d2) % 40;

    if (player.position < oldPos) {
      player.money += 200;
      this.logMessage(`${player.name} passed START and collected $200.`);
    }

    this.handleTileLanding(player, BOARD_TILES[player.position]);
    return this.state;
  }

  handleTileLanding(player, tile) {
    this.logMessage(`${player.name} landed on ${tile.name}.`);

    if (tile.type === "PROPERTY" || tile.type === "RAILROAD" || tile.type === "UTILITY") {
      const prop = this.state.properties[tile.id];
      if (!prop) {
        this.state.turnPhase = TURN_PHASES.ACTION_REQUIRED;
      } else if (prop.ownerId !== player.id) {
        const houses = prop.houses || 0;
        let rent = tile.rent ? tile.rent[houses] : 25;

        if (houses === 0 && this.hasMonopoly(prop.ownerId, tile.group)) {
          rent *= 2;
        }

        player.money -= rent;
        const owner = this.state.players.find((p) => p.id === prop.ownerId);
        if (owner) owner.money += rent;

        this.logMessage(`${player.name} paid $${rent} rent to ${owner ? owner.name : "Bank"}.`);
        this.state.turnPhase = TURN_PHASES.AWAITING_END_TURN;
      } else {
        this.state.turnPhase = TURN_PHASES.AWAITING_END_TURN;
      }
    } else if (tile.type === "TAX") {
      player.money -= tile.amount;
      this.logMessage(`${player.name} paid $${tile.amount} in ${tile.name}.`);
      this.state.turnPhase = TURN_PHASES.AWAITING_END_TURN;
    } else if (tile.id === 30) {
      player.position = 10;
      player.inJail = true;
      this.logMessage(`${player.name} was sent to Prison!`);
      this.state.turnPhase = TURN_PHASES.AWAITING_END_TURN;
    } else {
      this.state.turnPhase = TURN_PHASES.AWAITING_END_TURN;
    }
  }

  buyProperty(playerId) {
    const player = this.getCurrentPlayer();
    if (player.id !== playerId) throw new Error("Not your turn!");
    if (this.state.turnPhase !== TURN_PHASES.ACTION_REQUIRED) {
      throw new Error("Cannot buy property right now.");
    }

    const tile = BOARD_TILES[player.position];
    if (player.money < tile.price) {
      throw new Error("Insufficient funds to buy property.");
    }

    player.money -= tile.price;
    this.state.properties[tile.id] = { ownerId: player.id, houses: 0 };
    this.logMessage(`${player.name} bought ${tile.name} for $${tile.price}.`);
    this.state.turnPhase = TURN_PHASES.AWAITING_END_TURN;
    return this.state;
  }

  declineProperty(playerId) {
    const player = this.getCurrentPlayer();
    if (player.id !== playerId) throw new Error("Not your turn!");
    if (this.state.turnPhase !== TURN_PHASES.ACTION_REQUIRED) {
      throw new Error("Cannot trigger auction now.");
    }

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
      turnIndex: 0
    };
    this.state.turnPhase = TURN_PHASES.AUCTION;
  }

  getAuctionCurrentBidder() {
    if (!this.state.auction || this.state.auction.activeBidders.length === 0) return null;
    const bidderId = this.state.auction.activeBidders[this.state.auction.turnIndex];
    return this.state.players.find((p) => p.id === bidderId);
  }

  placeBid(playerId, bidAmount) {
    if (this.state.turnPhase !== TURN_PHASES.AUCTION || !this.state.auction) {
      throw new Error("No active auction.");
    }

    const currentBidder = this.getAuctionCurrentBidder();
    if (!currentBidder || currentBidder.id !== playerId) {
      throw new Error("Not your turn to bid!");
    }

    if (bidAmount <= this.state.auction.currentBid) {
      throw new Error(`Bid must be greater than current bid ($${this.state.auction.currentBid}).`);
    }

    if (bidAmount > currentBidder.money) {
      throw new Error("You do not have enough money for this bid.");
    }

    this.state.auction.currentBid = bidAmount;
    this.state.auction.highestBidderId = playerId;
    this.logMessage(`${currentBidder.name} bid $${bidAmount}.`);

    this.state.auction.turnIndex =
      (this.state.auction.turnIndex + 1) % this.state.auction.activeBidders.length;
    return this.state;
  }

  passBid(playerId) {
    if (this.state.turnPhase !== TURN_PHASES.AUCTION || !this.state.auction) {
      throw new Error("No active auction.");
    }

    const currentBidder = this.getAuctionCurrentBidder();
    if (!currentBidder || currentBidder.id !== playerId) {
      throw new Error("Not your turn to bid!");
    }

    this.logMessage(`${currentBidder.name} passed on bidding.`);

    this.state.auction.activeBidders = this.state.auction.activeBidders.filter(
      (id) => id !== playerId
    );
    const remaining = this.state.auction.activeBidders.length;

    if (remaining === 0 || (remaining === 1 && this.state.auction.highestBidderId !== null)) {
      this.resolveAuction();
    } else {
      if (this.state.auction.turnIndex >= remaining) {
        this.state.auction.turnIndex = 0;
      }
    }

    return this.state;
  }

  resolveAuction() {
    const { tileId, currentBid, highestBidderId } = this.state.auction;
    const tile = BOARD_TILES[tileId];

    if (highestBidderId) {
      const winner = this.state.players.find((p) => p.id === highestBidderId);
      winner.money -= currentBid;
      this.state.properties[tileId] = { ownerId: winner.id, houses: 0 };
      this.logMessage(`Auction won! ${winner.name} bought ${tile.name} for $${currentBid}.`);
    } else {
      this.logMessage(`No bids placed. ${tile.name} remains unowned.`);
    }

    this.state.auction = null;
    this.state.turnPhase = TURN_PHASES.AWAITING_END_TURN;
  }

  endTurn(playerId) {
    const player = this.getCurrentPlayer();
    if (player.id !== playerId) throw new Error("Not your turn!");
    if (
      this.state.turnPhase !== TURN_PHASES.AWAITING_END_TURN &&
      this.state.turnPhase !== TURN_PHASES.ACTION_REQUIRED
    ) {
      throw new Error("Must finish mandatory actions before ending turn.");
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
