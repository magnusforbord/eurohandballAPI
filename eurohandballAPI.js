const axios = require('axios');
const dayjs = require('dayjs');

async function fetchMatchDetails(matchId) {
    const url = `https://ehfeuro.eurohandball.com/umbraco/Api/MatchDetailApi/GetMatchDetailsAsync?matchId=${matchId}&culture=en-US&contentId=51748`;
    try {
        const response = await axios.get(url);
        const matchDetails = response.data.matchDetails;
        const players = matchDetails.details.homeTeam.players.concat(matchDetails.details.guestTeam.players).map(player => ({
            id: player.id,
            name: `${player.person.firstName} ${player.person.lastName}`,
            position: player.playingPosition,
            goals: player.score.goals,
        }));


        const transformedData = {
            id: matchDetails.details.matchID,
            away: {
                id: matchDetails.details.guestTeam.team.id,
                name: matchDetails.details.guestTeam.team.fullName,
                players: matchDetails.details.guestTeam.players.map(player => ({
                    id: player.id,
                    name: `${player.person.firstName} ${player.person.lastName}`,
                    position: player.playingPosition,
                    goals: player.score.goals,
                })),
            },
            date: new Date(matchDetails.details.venue.date.utc).getTime(),
            home: {
                id: matchDetails.details.homeTeam.team.id,
                name: matchDetails.details.homeTeam.team.fullName,
                players: matchDetails.details.homeTeam.players.map(player => ({
                    id: player.id,
                    name: `${player.person.firstName} ${player.person.lastName}`,
                    position: player.playingPosition,
                    goals: player.score.goals,
                })),
            },
            league: matchDetails.details.comp.name,
            allPlayers: players,
        };

        return transformedData;
    } catch (error) {
        console.error(`Request failed for matchId ${matchId}: ${error}`);
        return null;
    }
}


async function fetchTeamRoster(clubId, competitionIds, teamName) {
    for (const competitionId of competitionIds) {
        const url = `https://www.eurohandball.com/umbraco/Api/ClubDetailsApi/GetPlayers?competitionId=${competitionId}&clubId=${clubId}&roundId=kWvDaphagqoomWsHrgovow&culture=en-US&contentId=1528`;
        try {
            const response = await axios.get(url);
            if (response.data && (response.data.players.length > 0 || response.data.goalKeepers.length > 0)) {
                // Process both players and goalkeepers
                const allPlayers = [...response.data.players, ...response.data.goalKeepers];

                const playerNamesAndStats = allPlayers.map(player => {
                    const isGoalkeeper = player.isGoalkeeper; // Adjust based on the actual field indicating a goalkeeper
                    const stats = isGoalkeeper ? { saves: player.score.goalkeeperSaves } : { goals: player.score.goals };

                    return {
                        name: `${player.person.firstName} ${player.person.lastName}`,
                        position: player.playingPosition,
                        stats: stats
                    };
                });

                return {
                    teamId: clubId,
                    roster: playerNamesAndStats
                };
            }
        } catch (error) {
            console.error(`Attempt with competitionId ${competitionId} for ${teamName} failed: ${error}`);
        }
    }
    console.log(`Failed to fetch roster for ${teamName} after trying multiple competitionIds.`);
    return null;
}




async function fetchMatchIds() {
    const url = "https://www.eurohandball.com/umbraco/Api/LiveScoreApi/GetLiveScoreMatchesAsync?culture=en-US&contentId=1069&pastDays=0&upcomingMatches=15";
    const today = dayjs().format('YYYY-MM-DD')
    try {
        const response = await axios.get(url);

        const json_data = response.data;
        const match_ids = [];

        json_data.days.forEach(day => {
            if (day.dayDatumFormatted === today) {
                day.liveScoreMatches.forEach(match => {
                    match_ids.push(match.match.matchID);
                });
            }
        });

        if (match_ids.length === 0) {
            console.log(`No matches found for date: ${today}`);
        } else {
            console.log(`Total found match IDs for date: ${today}: ${match_ids.join(', ')}`);
        }

        return match_ids;
    } catch (error) {
        console.error(`Failed to fetch match IDs: ${error}`);
        return [];
    }
}

function comparePlayers(teamRoster, matchPlayers) {
    // Creating a map of match players for efficient lookup
    const matchPlayerMap = new Map(matchPlayers.map(player => [player.name, player]));

    // Filtering the team roster to find players not in matchPlayerMap
    return teamRoster.roster.filter(player => {
        return !matchPlayerMap.has(player.name);
    }).map(player => {
        // Adjusted to include either goals or saves based on player stats
        const stats = player.stats.saves !== undefined ? {saves: player.stats.saves} : {goals: player.stats.goals};
        return {
            name: player.name,
            ...stats
        };
    });
}





async function main() {
    const matchIds = await fetchMatchIds();
    if (matchIds.length) {

        for (const matchId of matchIds) {
            const matchData = await fetchMatchDetails(matchId);
            if (matchData) {
                if (matchData.home.players.length === 0 || matchData.away.players.length === 0) {
                    console.log("No players on match page yet")
                    continue
                }
                const competitionIds = ['s9H5PdMUfyxj4Ap4QMTvsQ', 'VOnXVrhoU4vff13IlFgt_w', 'EwoH_yk0xYpV1I73lyx4FQ'];

                const homeRoster = await fetchTeamRoster(matchData.home.id, competitionIds, matchData.home.name);
                const awayRoster = await fetchTeamRoster(matchData.away.id, competitionIds, matchData.away.name);


                // Inside your main function, after calling comparePlayers
                if (homeRoster && awayRoster) {
                    const missingPlayersHome = comparePlayers(homeRoster, matchData.home.players);
                    const missingPlayersAway = comparePlayers(awayRoster, matchData.away.players);

                    console.log(`Missing players for home team (${matchData.home.name}):`, missingPlayersHome);
                    console.log(`Missing players for away team (${matchData.away.name}):`, missingPlayersAway);
                } else {
                    console.log(`Failed to fetch rosters for one or both teams.`);
                }

            }
        }
    }
}


main().then(r => console.log("Bot finished running"));
