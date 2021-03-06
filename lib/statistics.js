var _ = require('lodash');
var decimal = require('deci-mal');
var Q = require('q');

var logger = require('./logger.js');

module.exports = function(db, lol) {
  var self = this;

  // Return total points of stats as a string
  self.evaluatePoints = function(stats) {
    var totalPoints = decimal.fromNumber(0, 2);

    totalPoints = totalPoints.add(decimal.fromNumber(stats.championKills, 2)           .mult(decimal.fromNumber(2, 2)));
    totalPoints = totalPoints.add(decimal.fromNumber(stats.deaths, 2)                  .mult(decimal.fromNumber(-2, 2)));
    totalPoints = totalPoints.add(decimal.fromNumber(stats.assists, 2)                 .mult(decimal.fromNumber(1.5, 2)));
    totalPoints = totalPoints.add(decimal.fromNumber(stats.minionKills, 2)             .mult(decimal.fromNumber(0.01, 2)));
    totalPoints = totalPoints.add(decimal.fromNumber(stats.doubleKills, 2)             .mult(decimal.fromNumber(1, 2)));
    totalPoints = totalPoints.add(decimal.fromNumber(stats.tripleKills, 2)             .mult(decimal.fromNumber(2, 2)));
    totalPoints = totalPoints.add(decimal.fromNumber(stats.quadraKills, 2)             .mult(decimal.fromNumber(5, 2)));
    totalPoints = totalPoints.add(decimal.fromNumber(stats.pentaKills, 2)              .mult(decimal.fromNumber(12, 2)));
    totalPoints = totalPoints.add(decimal.fromNumber(stats.goldEarned, 2)              .mult(decimal.fromNumber(0, 2)));
    totalPoints = totalPoints.add(decimal.fromNumber(stats.damageDealtToChampions, 2)  .mult(decimal.fromNumber(0, 2)));
    totalPoints = totalPoints.add(decimal.fromNumber(stats.healed, 2)                  .mult(decimal.fromNumber(0, 2)));
    totalPoints = totalPoints.add(decimal.fromNumber(stats.levels, 2)                  .mult(decimal.fromNumber(0, 2)));
    totalPoints = totalPoints.add(decimal.fromNumber(stats.turretKills, 2)             .mult(decimal.fromNumber(3, 2)));
    totalPoints = totalPoints.add(decimal.fromNumber(stats.wardKills, 2)               .mult(decimal.fromNumber(0, 2)));
    totalPoints = totalPoints.add(decimal.fromNumber(stats.wardPlaces, 2)              .mult(decimal.fromNumber(0, 2)));
    totalPoints = totalPoints.add(decimal.fromNumber(stats.damageTaken, 2)             .mult(decimal.fromNumber(0, 2)));
    totalPoints = totalPoints.add(decimal.fromNumber(stats.totalWins, 2)               .mult(decimal.fromNumber(0, 2)));
    totalPoints = totalPoints.add(decimal.fromNumber(stats.totalGames, 2)              .mult(decimal.fromNumber(0, 2)));

    return parseFloat(totalPoints.toString());
  };

  self.updateAllLeagues = function(useCached) {
    return Q.Promise(function(resolve, reject) {
      var gotAllRows = false;
      var rowsReceived = 0;
      var rowsProcessed = 0;

      function resolveCheck() {
        if (gotAllRows && rowsProcessed === rowsReceived) {
          resolve();
        }
      }

      db.getAllLeagues(function(league) {
        rowsReceived++;
        self.updateStatsOfLeague(league, useCached).then(function() {
          rowsProcessed++;
          logger.log('Updated League with id: ' + league.id);
          resolveCheck();
        }).fail(function(err) {
          logger.error('Failed to process League with id: ' + league.id);
          rowsProcessed++;
          resolveCheck();
        }).done();
      }, function() {
        gotAllRows = true;
        resolveCheck();
      });
    });
  };

  self.updateStatsOfLeague = function(league, useCached) {
    var summonerIds = [];
    var summonerIdsToNames = {};
    for (var summonerName in league.data) {
      summonerIds.push(league.data[summonerName].summonerId);
      summonerIdsToNames[summonerName] = league.data[summonerName].summonerId;
    }

    return getCommonGameIds(league.region, summonerIds, useCached).then(function(commonGameIds) {
      var trackedMatches = {};
      for (var i = 0; i < league.matches_tracked.length; i++) {
        trackedMatches[league.matches_tracked[i]] = true;
      }

      return getStatsOfGames(league.region, summonerIdsToNames, commonGameIds, trackedMatches, league.creation_time, useCached).then(function(playerStats) {
        for (var gameId in commonGameIds) {
          trackedMatches[gameId] = true;
        }

        var data = league.data;
        for (var summonerName in playerStats) {
          for (var stat in playerStats[summonerName]) {
            data[summonerName].stats[stat] += playerStats[summonerName][stat];
          }
        }

        return db.updateLeague(league.id, data, _.keys(trackedMatches).map(Number));
      });
    });
  };

  function getCommonGameIds(region, summonerIds, useCached) {
    return lol.getSummonersRecentGames(region, summonerIds[0], useCached).then(function(oneSummonersRecentGames) {
      var commonGameIds = {};
      for (var i = 0; i < oneSummonersRecentGames.length; i++) {
        var game = oneSummonersRecentGames[i];
        var commonPlayerCount = 1;

        game.fellowPlayers = game.fellowPlayers || {};
        for (var j = 0; j < game.fellowPlayers.length; j++) {
          if (summonerIds.indexOf(game.fellowPlayers[j].summonerId) !== -1) {
            commonPlayerCount += 1;
          }
        }

        if (commonPlayerCount === summonerIds.length) {
          commonGameIds[game.gameId] = true;
        }
      }

      return commonGameIds;
    });
  }

  function getStatsOfGames(region, summonerIds, gameIds, excludedGameIds, minStartDate, useCached) {
    var playerStats = {};
    for (var summonerName in summonerIds) {
      playerStats[summonerName] = {};

      playerStats[summonerName].championKills            = 0;
      playerStats[summonerName].deaths                   = 0;
      playerStats[summonerName].assists                  = 0;
      playerStats[summonerName].minionKills              = 0;
      playerStats[summonerName].doubleKills              = 0;
      playerStats[summonerName].tripleKills              = 0;
      playerStats[summonerName].quadraKills              = 0;
      playerStats[summonerName].pentaKills               = 0;
      playerStats[summonerName].goldEarned               = 0;
      playerStats[summonerName].damageDealtToChampions   = 0;
      playerStats[summonerName].healed                   = 0;
      playerStats[summonerName].levels                   = 0;
      playerStats[summonerName].turretKills              = 0;
      playerStats[summonerName].wardKills                = 0;
      playerStats[summonerName].wardPlaces               = 0;
      playerStats[summonerName].damageTaken              = 0;
      playerStats[summonerName].totalWins                = 0;
      playerStats[summonerName].totalGames               = 0;
    }

    var summonerNames = _.keys(summonerIds);
    var playerGameStatsPromises = summonerNames.map(function(name) {
      return lol.getSummonersRecentGames(region, summonerIds[name], useCached).then(function(recentGames) {
        for (var i = 0; i < recentGames.length; i++) {
          var game = recentGames[i];
          if (game.gameId in gameIds && !(game.gameId in excludedGameIds)) {
            if (game.createDate && game.createDate >= minStartDate.getTime()) {
              playerStats[name].championKills            += game.stats.championsKilled || 0;
              playerStats[name].deaths                   += game.stats.numDeaths || 0;
              playerStats[name].assists                  += game.stats.assists || 0;
              playerStats[name].minionKills              += (game.stats.minionsKilled || 0) + (game.stats.neutralMinionsKilled || 0);
              playerStats[name].doubleKills              += game.stats.doubleKills || 0;
              playerStats[name].tripleKills              += game.stats.tripleKills || 0;
              playerStats[name].quadraKills              += game.stats.quadraKills || 0;
              playerStats[name].pentaKills               += game.stats.pentaKills || 0;
              playerStats[name].goldEarned               += game.stats.goldEarned || 0;
              playerStats[name].damageDealtToChampions   += game.stats.totalDamageDealtToChampions || 0;
              playerStats[name].healed                   += game.stats.totalHeal || 0;
              playerStats[name].levels                   += game.stats.level || 0;
              playerStats[name].turretKills              += game.stats.turretsKilled || 0;
              playerStats[name].wardKills                += game.stats.wardKilled || 0;
              playerStats[name].wardPlaces               += game.stats.wardPlaced || 0;
              playerStats[name].damageTaken              += game.stats.totalDamageTaken || 0;
              playerStats[name].totalWins                += game.stats.win ? 1 : 0;
              playerStats[name].totalGames               += 1;
            }
          }
        }
      });
    });

    return Q.all(playerGameStatsPromises).then(function() {
      return playerStats;
    });
  }
};
