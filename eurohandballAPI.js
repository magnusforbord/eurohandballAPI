'use strict';

require('dotenv').config();
const axios = require('axios');
const dayjs = require('dayjs');
const TelegramBot = require('node-telegram-bot-api');
const { MongoClient } = require("mongodb");
const {HttpsProxyAgent} = require("https-proxy-agent");
const proxy_username = process.env.PROXY_USERNAME;
const proxy_password = process.env.PROXY_PASSWORD;

const token = process.env.TELEGRAM_TOKEN;
const chatId = process.env.CHAT_ID;
const bot = new TelegramBot(token);

const proxies = [
    `http://${proxy_username}:${proxy_password}@109.238.203.91:50100`,
    `http://${proxy_username}:${proxy_password}@109.238.203.180:50100`,
    `http://${proxy_username}:${proxy_password}@109.238.203.92:50100`,
    `http://${proxy_username}:${proxy_password}@109.238.203.94:50100`,
    `http://${proxy_username}:${proxy_password}@109.238.203.153:50100`,
];

const getRandomProxy = () => {
    return proxies[Math.floor(Math.random() * proxies.length)];
};

async function fetchMatchDetails(matchId) {
    const proxy = getRandomProxy();
    const httpsAgent = new HttpsProxyAgent(proxy);

    const axiosInstance = axios.create({
        httpsAgent,
    });

    const url = `https://www.eurohandball.com/umbraco/api/matchdetailapi/GetMatchDetails?matchId=${matchId}&culture=en-US&contentId=48481`;
    try {
        const response = await axiosInstance.get(url);
        const matchDetails = response.data.matchDetails;
        const roundId = matchDetails.details.comp.round.id;
        const competitionId = matchDetails.details.comp.id;

        const players = matchDetails.details.homeTeam.players.concat(matchDetails.details.guestTeam.players).map(player => ({
            id: player.id,
            name: `${player.person.firstName} ${player.person.lastName}`,
            position: player.playingPosition,
            goals: player.score.goals,
        }));

        return {
            id: matchDetails.details.matchID,
            roundId: roundId,
            competitionId: competitionId,
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
    } catch (error) {
        console.error(`Request failed for matchId ${matchId}: ${error}`);
        return null;
    }
}

async function fetchTeamRoster(clubId, competitionId, teamName, roundId) {
    const proxy = getRandomProxy();
    const httpsAgent = new HttpsProxyAgent(proxy);

    const axiosInstance = axios.create({
        httpsAgent,
    });

    const url = `https://www.eurohandball.com/umbraco/Api/ClubDetailsApi/GetPlayers?competitionId=${competitionId}&clubId=${clubId}&roundId=${roundId}&culture=en-US&contentId=1528`;
    try {
        const response = await axiosInstance.get(url);
        if (response.data && (response.data.players.length > 0 || response.data.goalKeepers.length > 0)) {
            const allPlayers = [...response.data.players, ...response.data.goalKeepers];

            const playerNamesAndStats = allPlayers.map(player => {
                const isGoalkeeper = player.isGoalkeeper;
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

    console.log(`Failed to fetch roster for ${teamName}`);
    return null;
}

async function fetchMatchIds() {
    const proxy = getRandomProxy();
    const httpsAgent = new HttpsProxyAgent(proxy);

    const axiosInstance = axios.create({
        httpsAgent,
    });

    const url = "https://www.eurohandball.com/umbraco/api/livescoreapi/GetLiveScoreMatches/1069";
    const today = dayjs().format('YYYY-MM-DD');
    try {
        const response = await axiosInstance.get(url);

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
    const matchPlayerMap = new Map(matchPlayers.map(player => [player.name, player]));

    return teamRoster.roster.filter(player => {
        return !matchPlayerMap.has(player.name);
    }).map(player => {
        const stats = player.stats.saves !== undefined ? { saves: player.stats.saves } : { goals: player.stats.goals };
        return {
            name: player.name,
            ...stats
        };
    });
}

async function sendNotification(match, teamKey, missingPlayers) {
    let messageHeader = `Players missing for ${match[teamKey].name}:\n`;
    let messageBody = '';

    if (missingPlayers.length > 0) {
        missingPlayers.forEach(player => {
            const playerPerformance = player.saves !== undefined ? `${player.saves} saves` : `${player.goals || 0} goals`;
            messageBody += `${player.name} - ${playerPerformance}\n`;
        });
    } else {
        messageBody += "None\n";
    }

    let fullMessage = messageHeader + messageBody;

    try {
        await bot.sendMessage(chatId, fullMessage, { parse_mode: 'Markdown' });
        console.log(`Notification sent for ${match[teamKey].name}`);
    } catch (error) {
        console.error(`Failed to send notification for ${match[teamKey].name}:`, error);
    }
}

async function processMatches(matchIds, collection) {
    for (const matchId of matchIds) {
        const matchExists = await collection.findOne({ matchId: matchId });
        if (matchExists) {
            console.log(`Match already exists in the database: ${matchId}`);
            continue;
        }

        const matchData = await fetchMatchDetails(matchId);

        if (matchData) {
            const roundId = matchData.roundId;
            if (matchData.home.players.length === 0 || matchData.away.players.length === 0) {
                console.log("No players on match page yet");
                continue;
            }

            const homeRoster = await fetchTeamRoster(matchData.home.id, matchData.competitionId, matchData.home.name, roundId);
            const awayRoster = await fetchTeamRoster(matchData.away.id, matchData.competitionId, matchData.away.name, roundId);

            if (homeRoster && awayRoster) {
                const missingPlayersHome = comparePlayers(homeRoster, matchData.home.players);
                const missingPlayersAway = comparePlayers(awayRoster, matchData.away.players);

                await sendNotification(matchData, 'home', missingPlayersHome);
                await sendNotification(matchData, 'away', missingPlayersAway);

                const matchDocument = {
                    $set: {
                        matchId: matchData.id,
                        roundId: matchData.roundId,
                        date: matchData.date,
                        league: matchData.league,
                        home: matchData.home,
                        away: matchData.away
                    }
                };

                await collection.updateOne({ matchId: matchData.id }, matchDocument, { upsert: true });

            } else {
                console.log(`Failed to fetch rosters for one or both teams.`);
            }
        }
    }
}

async function initializeMongoClient() {
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    return client;
}

async function main() {
    const client = await initializeMongoClient();
    try {
        const database = client.db('sent_teams_db');
        const collection = database.collection('sent_teams_eurohandball');

        const matchIds = await fetchMatchIds();
        if (matchIds.length) {
            await processMatches(matchIds, collection);
        }
    } catch (error) {
        console.error('Error in main function:', error);
    } finally {
        await client.close();
        console.log('Finished processing matches');
        process.exit(0);
    }
}

main().then(() => console.log("Bot finished running")).catch((error) => {
    console.error('Error in main execution:', error);
    process.exit(1);
});
