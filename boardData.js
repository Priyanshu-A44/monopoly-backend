// boardData.js
export const BOARD_TILES = [
  // Top Row (0 - 10)
  { id: 0, name: "START", type: "SPECIAL" },
  { id: 1, name: "Salvador", type: "PROPERTY", group: "Brazil", price: 60, rent: [4, 20, 60, 180, 320, 450], houseCost: 50, flag: "🇧🇷" },
  { id: 2, name: "Treasure", type: "CARD" },
  { id: 3, name: "Rio", type: "PROPERTY", group: "Brazil", price: 60, rent: [4, 20, 60, 180, 320, 450], houseCost: 50, flag: "🇧🇷" },
  { id: 4, name: "Earnings Tax", type: "TAX", amount: 200 },
  { id: 5, name: "TLV Airport", type: "RAILROAD", price: 200, rent: [25, 50, 100, 200] },
  { id: 6, name: "Tel Aviv", type: "PROPERTY", group: "Israel", price: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50, flag: "🇮🇱" },
  { id: 7, name: "Haifa", type: "PROPERTY", group: "Israel", price: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50, flag: "🇮🇱" },
  { id: 8, name: "Surprise", type: "CARD" },
  { id: 9, name: "Jerusalem", type: "PROPERTY", group: "Israel", price: 120, rent: [8, 40, 100, 300, 450, 600], houseCost: 50, flag: "🇮🇱" },
  { id: 10, name: "In Prison / Passing by", type: "SPECIAL" },

  // Right Row (11 - 19)
  { id: 11, name: "Venice", type: "PROPERTY", group: "Italy", price: 130, rent: [10, 50, 150, 450, 625, 750], houseCost: 100, flag: "🇮🇹" },
  { id: 12, name: "Power Company", type: "UTILITY", price: 150 },
  { id: 13, name: "Milan", type: "PROPERTY", group: "Italy", price: 140, rent: [10, 50, 150, 450, 625, 750], houseCost: 100, flag: "🇮🇹" },
  { id: 14, name: "Rome", type: "PROPERTY", group: "Italy", price: 160, rent: [12, 60, 180, 500, 700, 900], houseCost: 100, flag: "🇮🇹" },
  { id: 15, name: "MUC Airport", type: "RAILROAD", price: 200, rent: [25, 50, 100, 200] },
  { id: 16, name: "Frankfurt", type: "PROPERTY", group: "Germany", price: 180, rent: [14, 70, 200, 550, 750, 950], houseCost: 100, flag: "🇩🇪" },
  { id: 17, name: "Treasure", type: "CARD" },
  { id: 18, name: "Munich", type: "PROPERTY", group: "Germany", price: 190, rent: [16, 80, 220, 600, 800, 1000], houseCost: 100, flag: "🇩🇪" },
  { id: 19, name: "Berlin", type: "PROPERTY", group: "Germany", price: 200, rent: [16, 80, 220, 600, 800, 1000], houseCost: 100, flag: "🇩🇪" },

  // Bottom Row (20 - 30)
  { id: 20, name: "Vacation ($0 on hold)", type: "SPECIAL" },
  { id: 21, name: "Shenzhen", type: "PROPERTY", group: "China", price: 210, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150, flag: "🇨🇳" },
  { id: 22, name: "Surprise", type: "CARD" },
  { id: 23, name: "Beijing", type: "PROPERTY", group: "China", price: 220, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150, flag: "🇨🇳" },
  { id: 24, name: "Shanghai", type: "PROPERTY", group: "China", price: 240, rent: [20, 100, 300, 750, 925, 1100], houseCost: 150, flag: "🇨🇳" },
  { id: 25, name: "CDG Airport", type: "RAILROAD", price: 200, rent: [25, 50, 100, 200] },
  { id: 26, name: "Lyon", type: "PROPERTY", group: "France", price: 260, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150, flag: "🇫🇷" },
  { id: 27, name: "Water Company", type: "UTILITY", price: 150 },
  { id: 28, name: "Toulouse", type: "PROPERTY", group: "France", price: 270, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150, flag: "🇫🇷" },
  { id: 29, name: "Paris", type: "PROPERTY", group: "France", price: 280, rent: [24, 120, 360, 850, 1025, 1200], houseCost: 150, flag: "🇫🇷" },
  { id: 30, name: "Go to prison", type: "SPECIAL" },

  // Left Row (31 - 39)
  { id: 31, name: "Liverpool", type: "PROPERTY", group: "UK", price: 290, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200, flag: "🇬🇧" },
  { id: 32, name: "Manchester", type: "PROPERTY", group: "UK", price: 300, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200, flag: "🇬🇧" },
  { id: 33, name: "Treasure", type: "CARD" },
  { id: 34, name: "London", type: "PROPERTY", group: "UK", price: 320, rent: [28, 150, 450, 1000, 1200, 1400], houseCost: 200, flag: "🇬🇧" },
  { id: 35, name: "JFK Airport", type: "RAILROAD", price: 200, rent: [25, 50, 100, 200] },
  { id: 36, name: "Surprise", type: "CARD" },
  { id: 37, name: "San Francisco", type: "PROPERTY", group: "USA", price: 360, rent: [35, 175, 500, 1100, 1300, 1500], houseCost: 200, flag: "🇺🇸" },
  { id: 38, name: "Premium Tax", type: "TAX", amount: 75 },
  { id: 39, name: "New York", type: "PROPERTY", group: "USA", price: 400, rent: [50, 200, 600, 1400, 1700, 2000], houseCost: 200, flag: "🇺🇸" }
];