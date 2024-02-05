const axios = require('axios');
const dayjs = require('dayjs');

async function fetchMatchDetails(matchId) {
    console.log(`Fetching match details for matchId: ${matchId}`);
    const url = `https://ehfeuro.eurohandball.com/umbraco/Api/MatchDetailApi/GetMatchDetailsAsync?matchId=${matchId}&culture=en-US&contentId=51748`;
    try {
        const response = await axios.get(url);

        // Transform the fetched match details here
        const matchDetails = response.data.matchDetails;
        const transformedData = {
            id: matchDetails.details.matchID,
            away: {
                id: matchDetails.details.guestTeam.team.id,
                name: matchDetails.details.guestTeam.team.fullName
            },
            date: new Date(matchDetails.details.venue.date.utc).getTime(),
            home: {
                id: matchDetails.details.homeTeam.team.id,
                name: matchDetails.details.homeTeam.team.fullName
            },
            league: matchDetails.details.comp.name,
            // Assuming you have a way to determine missing and present players
            // missingPlayers: {...},
            // presentPlayers: {...},
        };

        console.log(JSON.stringify(transformedData, null, 2))
        return transformedData
    } catch (error) {
        console.error(`Request failed for matchId ${matchId}: ${error}`);
        return null;
    }
}

async function fetchTeamRoster(clubId, competitionIds, teamName) {
    for (const competitionId of competitionIds) {
        const url = `https://www.eurohandball.com/umbraco/Api/ClubDetailsApi/GetPlayers?competitionId=${competitionId}&clubId=${clubId}&roundId=kWvDaphagqoomWsHrgovow&culture=en-US&contentId=1528`;
        console.log(url);
        try {
            const response = await axios.get(url);
            if (response.data && response.data.players && response.data.players.length > 0) {
                console.log(`Fetched roster successfully for ${teamName} with competitionId: ${competitionId}`);

                // Extract player names and goals
                const playerNamesAndGoals = response.data.players.map(player => ({
                    name: `${player.person.firstName} ${player.person.lastName}`,
                    goals: player.score.goals
                }));

                console.log(`${teamName} roster:`, playerNamesAndGoals);

                return {
                    teamId: clubId,
                    roster: playerNamesAndGoals
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
    console.log(`Fetching match IDs for date: 2024-02-10`);
    const url = "https://www.eurohandball.com/umbraco/Api/LiveScoreApi/GetLiveScoreMatchesAsync?culture=en-US&contentId=1069&pastDays=0&upcomingMatches=15";
    const testingDate = '2024-02-10'
    try {
        const response = await axios.get(url);
        console.log(`Fetched match IDs successfully for date: ${testingDate}`);

        const json_data = response.data;
        console.log(json_data)
        const match_ids = [];

        json_data.days.forEach(day => {
            if (day.dayDatumFormatted === testingDate) {
                day.liveScoreMatches.forEach(match => {
                    match_ids.push(match.match.matchID);
                });
            }
        });

        if (match_ids.length === 0) {
            console.log(`No matches found for date: ${testingDate}`);
        } else {
            console.log(`Total found match IDs for date: ${testingDate}: ${match_ids.join(', ')}`);
        }

        return match_ids;
    } catch (error) {
        console.error(`Failed to fetch match IDs: ${error}`);
        return [];
    }
}

async function main() {
    console.log(`Starting main function to process matches for date: 2024-02-10`);
    const matchIds = await fetchMatchIds();
    if (matchIds.length) {
        console.log(`Processing all match IDs for date: 2024-02-10`);

        // Iterate over each matchId and process it
        for (const matchId of matchIds) {
            console.log(`Processing match details for matchId: ${matchId}`);
            const matchData = await fetchMatchDetails(matchId);
            if (matchData) {
                console.log(`Successfully processed match details for matchId: ${matchId}`);
                const competitionIds = ['s9H5PdMUfyxj4Ap4QMTvsQ', 'VOnXVrhoU4vff13IlFgt_w', 'EwoH_yk0xYpV1I73lyx4FQ'];

                // Fetch and log roster for the home team
                console.log(`Fetching roster for home team: ${matchData.home.name}`);
                await fetchTeamRoster(matchData.home.id, competitionIds, matchData.home.name);

                // Fetch and log roster for the away team
                console.log(`Fetching roster for away team: ${matchData.away.name}`);
                await fetchTeamRoster(matchData.away.id, competitionIds, matchData.away.name);
            } else {
                console.log(`Failed to fetch details or process match ID: ${matchId}`);
            }
        }
    } else {
        console.log("No match IDs were found for date: 2024-02-10");
    }
}

main();
