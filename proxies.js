require('dotenv').config();

const proxy_username = process.env.PROXY_USERNAME;
const proxy_password = process.env.PROXY_PASSWORD;

const proxies = [
    `http://${proxy_username}:${proxy_password}@85.234.179.60:50100`,
    `http://${proxy_username}:${proxy_password}@122.8.79.236:50100`,
    `http://${proxy_username}:${proxy_password}@89.184.20.50:50100`,
    `http://${proxy_username}:${proxy_password}@89.184.22.68:50100`,
    `http://${proxy_username}:${proxy_password}@89.184.21.189:50100`,
    `http://${proxy_username}:${proxy_password}@85.234.179.44:50100`
];

const getRandomProxy = () => {
    return proxies[Math.floor(Math.random() * proxies.length)];
};

module.exports = { proxies, getRandomProxy };
