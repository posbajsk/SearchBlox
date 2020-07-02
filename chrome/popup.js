const search = document.getElementById('search');
const chunkSlider = document.getElementById('chunk');
const chunkLabel = document.getElementById('label');
const warning = document.getElementById('warning');
const status = document.getElementById('status');
const placeInput = document.getElementById('pid');
const usernameInput = document.getElementById('user');
const bar = document.getElementById('bar');
const icon = document.getElementById('icon');

const request = url => fetch(url).then(r => r.json());

const chunk = (arr, size) => arr.flatMap((_, i) => (i % size ? [] : [arr.slice(i, i + size)]));

const getTotal = async id => {
    const { TotalCollectionSize } = await request(`https://www.roblox.com/games/getgameinstancesjson?placeId=${id}&startIndex=0`);
    return TotalCollectionSize;
};

const reset = msg => { 
    search.disabled = false;
    status.innerHTML = '';
    bar.style.width = '0%';
    return warning.innerHTML = msg;
};

chunkSlider.oninput = () => chunkLabel.innerHTML = `Request Limit: <b>${chunkSlider.value}<b/>`;

search.onclick = async () => {
    try {
        search.disabled = true;
        warning.innerHTML = '';
    
        const placeID = placeInput.value;
        const username = usernameInput.value;
        const chunkSize = parseInt(chunkSlider.value);
    
        if (!placeID || !username) return reset('Place or Username not provided!');
    
        const user = await request(`https://api.roblox.com/users/get-by-username?username=${username}`);
    
        if (user.errorMessage) return reset('User not found!');
    
        const [ place ] = await request(`https://games.roblox.com/v1/games/multiget-place-details?placeIds=${placeID}`);
    
        if (!place) return reset('Place not found!');
    
        const { Url: avatar} = await request(`https://www.roblox.com/headshot-thumbnail/json?userId=${user.Id}&width=48&height=48`);
        status.innerHTML = `Working...`;
        icon.src = avatar;
    
        const total = await getTotal(placeID);
        if (total > 5000) warning.innerHTML = `${Math.round(5000 / total * 100)}% server coverage`;
    
        const urls = Array.from({ length: Math.ceil(total / 10) }, (_, i) => `https://www.roblox.com/games/getgameinstancesjson?placeId=${placeID}&startIndex=${i * 10}`);
        const chunked = chunk(urls, chunkSize);
        let checked = [];
        let found;
    
        for (const chunk of chunked) {
    
            const data = await Promise.all(chunk.map(url => request(url)));
            if (!data[0].Collection.length) break;
    
            found = data
                .flatMap(chunk => chunk.Collection)
                .find(server => server.CurrentPlayers
                .find(player => player.Id === user.Id || player.Thumbnail.Url === avatar));
            if (found) break;
    
            checked = [ ...checked, ...data ];
            const percentage = Math.round(checked.reduce((ori, cur) => ori + cur.Collection.length, chunkSize) / total * 100);
            status.innerHTML = `${percentage}%`;
            bar.style.width = `${percentage}%`;
        }
    
        if (!found) return reset('Didn\'t find the server (VIP?)');

        icon.src = 'images/tick.png';
        bar.style.width = '100%';
        status.innerHTML = 'Joining...';
        const url = `https://www.roblox.com/home?placeID=${placeID}&gameID=${found.Guid}`;
        chrome.tabs.update({ url });
    } catch {
        reset('Error! Please try again');
    };
};