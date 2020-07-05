const REQUEST_LIMIT = 40;
const COLORS = {
  BLUE: '#0077FF',
  RED: '#FF3E3E',
  GREEN: '#58BD7E',
  BLACK: '#2C2D2D',
  WHITE: '#F2F4F7',
};
const SEARCH = {
  SUCCESS: 'images/search-success.png',
  NEUTRAL: 'images/search.png',
  WARNING: 'images/search-warning.png',
  ERROR: 'images/search-error.png',
};
const PLACE = {
  SUCCESS: 'images/place-success.png',
  NEUTRAL: 'images/place.png',
  ERROR: 'images/place-error.png',
};
const USER = {
  SUCCESS: 'images/user-success.png',
  NEUTRAL: 'images/user.png',
  ERROR: 'images/user-error.png',
};

const search = document.getElementById('search');
const status = document.getElementById('status');
const placeInput = document.getElementById('pid');
const userInput = document.getElementById('user');
const userIcon = document.getElementById('user-icon');
const placeIcon = document.getElementById('place-icon');
const bar = document.getElementById('bar');
const media = document.getElementById('media');

const request = async (url, retry) => {
  try {
    return await fetch(url).then(r => r.json());
  } catch (e) {
    if (!retry || retry === 1) throw e;
    return request(url, retry - 1);
  }
};

const chunkArr = (arr, size) => arr.flatMap((_, i) => (i % size ? [] : [arr.slice(i, i + size)]));

const notify = (msg, color = true) => {
  status.style.color = COLORS.BLACK;
  if (color) search.src = SEARCH.NEUTRAL;
  return status.innerHTML = msg;
};

const error = (msg, enable = true) => {
  bar.style.width = '0%';
  bar.style.backgroundColor = COLORS.RED;
  status.style.color = COLORS.RED;
  if (enable) search.disabled = false;
  search.src = SEARCH.ERROR;
  return status.innerHTML = msg;
};

const reset = () => {
  bar.style.backgroundColor = COLORS.BLUE;
  return search.src = SEARCH.NEUTRAL;
};

const valid = {
  user: false,
  place: false,
};

userInput.oninput = () => {
  const test = /(^(?=^[^_]+_?[^_]+$)\w{3,20}$|^\d+$)/.test(userInput.value);
  if (!userInput.value) userIcon.src = USER.NEUTRAL;
  else userIcon.src = test ? USER.SUCCESS : USER.ERROR;
  valid.user = test;
  return search.disabled = !(valid.user && valid.place);
};

placeInput.oninput = () => {
  const test = /^\d+$/.test(placeInput.value);
  if (!placeInput.value) placeIcon.src = PLACE.NEUTRAL;
  else placeIcon.src = test ? PLACE.SUCCESS : PLACE.ERROR;
  valid.place = test;
  return search.disabled = !(valid.user && valid.place);
};

search.onclick = async () => {
  try {
    reset();
    search.disabled = true;

    const user = await request(`https://api.roblox.com/users/${/^\d+$/.test(userInput.value) ? userInput.value : `get-by-username?username=${userInput.value}`}`);

    if (user.errorMessage) return error('User not found!');

    const [place] = await request(`https://games.roblox.com/v1/games/multiget-place-details?placeIds=${placeInput.value}`);

    if (!place) return error('Place not found!');
    const req = await request(`https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${place.universeId}&size=768x432&format=Png&isCircular=false`);
    const thumbnail = req.data[0].thumbnails[0].imageUrl;

    const { Url: avatar } = await request(`https://www.roblox.com/headshot-thumbnail/json?userId=${user.Id}&width=48&height=48`);
    notify('Searching...');
    media.style.backgroundImage = `linear-gradient(to top right, ${COLORS.WHITE}, transparent), linear-gradient(to bottom left, transparent, ${COLORS.WHITE}), url(${thumbnail})`;
    media.style.opacity = 1;

    const { TotalCollectionSize: total } = await request(`https://www.roblox.com/games/getgameinstancesjson?placeId=${place.placeId}&startIndex=99999`);
    if (total > 5000) search.src = SEARCH.WARNING;

    const urls = Array.from({ length: Math.ceil(total / 10) }, (_, i) => `https://www.roblox.com/games/getgameinstancesjson?placeId=${place.placeId}&startIndex=${i * 10}`);
    const chunked = chunkArr(urls, REQUEST_LIMIT);
    let checked = [];
    let found;

    for (const chunk of chunked) {
      const data = await Promise.all(chunk.map(url => request(url, 3)));
      if (!data[0].Collection.length) break;

      found = data
        .flatMap(group => group.Collection)
        .find(server => server.CurrentPlayers
          .find(player => player.Id === user.Id || player.Thumbnail.Url === avatar));
      if (found) break;

      checked = [...checked, ...data];
      const percentage = Math.round((checked.reduce((ori, cur) => ori + cur.Collection.length, REQUEST_LIMIT) / (total >= 5000 ? 5000 : total)) * 100);
      bar.style.width = `${percentage}%`;
    }

    if (!found) return error('Server not found!');

    search.disabled = false;
    search.src = SEARCH.SUCCESS;
    bar.style.width = '100%';
    bar.style.backgroundColor = COLORS.GREEN;
    notify('Joining...', false);
    const url = `https://www.roblox.com/home?placeID=${place.placeId}&gameID=${found.Guid}`;
    return chrome.tabs.update({ url });
  } catch (e) {
    console.log(e);
    return error('Error! Please try again');
  }
};

const enter = ({ keyCode }) => keyCode === 13 && search.click();
userInput.addEventListener('keydown', enter);
placeInput.addEventListener('keydown', enter);
chrome.tabs.query({ active: true }, ([tab]) => {
  const match = tab.url.match(/www\.roblox\.com\/(users|games)\/(\d+)/);
  if (!match) return;
  const [, type, id] = match;
  if (type === 'users') {
    valid.user = true;
    userIcon.src = USER.SUCCESS;
    userInput.value = id;
  } else if (type === 'games') {
    valid.place = true;
    placeIcon.src = PLACE.SUCCESS;
    placeInput.value = id;
  }
});
