// server/stats.js
// Serverio statistikos modulis

/**
 * Grąžina visą serverio statistiką
 * @param {Map|Object} games - visi aktyvūs žaidimai
 * @returns {Object} statistika
 */
function getServerStats(games) {
  const gameList = [];
  let totalPlayers = 0;
  let activeGames = 0;
  let waitingGames = 0;
  let totalMoney = 0;
  let totalProperties = 0;

  // Normalizuojam į Map
  const gamesMap = games instanceof Map 
    ? games 
    : new Map(Object.entries(games || {}));

  gamesMap.forEach((game, gameId) => {
    const players = game.players || [];
    const playerCount = players.length;
    totalPlayers += playerCount;

    if (game.gameStarted) {
      activeGames++;
    } else {
      waitingGames++;
    }

    // Papildoma info
    players.forEach(p => {
      if (typeof p.money === 'number') totalMoney += p.money;
      if (Array.isArray(p.properties)) totalProperties += p.properties.length;
    });

    gameList.push({
      gameId,
      players: playerCount,
      started: !!game.gameStarted,
      host: players[0]?.name || players[0]?.username || 'N/A',
      createdAt: game.createdAt || null,
      currentPlayer: game.currentTurn !== undefined 
    ? (players[game.currentTurn]?.name || players[game.currentTurn]?.username || null)
    : null,
      money: players.reduce((sum, p) => sum + (p.money || 0), 0)
    });
  });

  return {
    timestamp: new Date().toISOString(),
    totalGames: gamesMap.size,
    activeGames,
    waitingGames,
    totalPlayers,
    totalMoney,
    totalProperties,
    gameList: gameList.sort((a, b) => {
      // Aktyvūs pirmi, tada pagal gameId
      if (a.started !== b.started) return b.started - a.started;
      return String(a.gameId).localeCompare(String(b.gameId));
    })
  };
}

/**
 * Trumpa statistika tik skaičiams (lengvesnis variantas)
 */
function getStatsSummary(games) {
  const stats = getServerStats(games);
  return {
    totalGames: stats.totalGames,
    activeGames: stats.activeGames,
    waitingGames: stats.waitingGames,
    totalPlayers: stats.totalPlayers
  };
}

module.exports = {
  getServerStats,
  getStatsSummary
};