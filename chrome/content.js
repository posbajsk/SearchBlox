async function get(url) {
    return fetch('https://' + url).then(res => res.json());
}

async function join(place, id) {
    return chrome.runtime.sendMessage({ message: { place, id } });
}

async function find(user, place, nextPageCursor) {
    const { data: [{ imageUrl }] } = await get(`thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.Id}&size=150x150&format=Png&isCircular=false`);
    const { data } = await get(`games.roblox.com/v1/games/${place}/servers/Public?limit=100&nextPageCursor=${nextPageCursor}`);

    nextPageCursor = data.nextPageCursor;

    const servers = data.map(s => ({ id: s.id, tokens: s.playerTokens }));

    let found = false;

    for (const server of servers) {
        const { data } = await fetch('https://thumbnails.roblox.com/v1/batch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(server.tokens.map(t => ({ token: t, type: 'AvatarHeadshot', size: '150x150' }))),
        }).then(res => res.json());

        const thumbnails = data.filter(d => d.state === 'Completed').map(x => x.imageUrl);

        const check = thumbnails.some(url => url === imageUrl);

        if (check) {

            const first = document.querySelectorAll('.rbx-game-server-item')[0];
            // Saves an API call
            const maxPlayers = document.querySelectorAll('.text-info')[0].innerText.split(' ')[2];


            const item = document.createElement('li');
            item.className = 'stack-row rbx-game-server-item';
            item.style = 'border: solid #00b06f';

            item.innerHTML = `
            <div class="section-left rbx-game-server-details'">
            <div class="text-info rbx-game-status rbx-game-server-status'">${server.tokens.length} of ${maxPlayers} people max</div>
            <span>
            <button id="join-${server.id}" type="button" class="btn-full-width btn-control-xs rbx-game-server-join btn-primary-md btn-min-width">Join</button>
            </span>
            </div>
            <div class="section-right rbx-game-server-players">
            ${thumbnails.map(url => `<span class="avatar avatar-headshot-sm player-avatar"><span class="thumbnail-2d-container avatar-card-image"><img src="${url}"></span></span>`).join('')}
            </div>`;

            first.parentNode.insertBefore(item, first);

            const button = document.getElementById('join-' + server.id);

            button.addEventListener('click', () => join(place, server.id));
        };
    }

    if (!found && !nextPageCursor) return false;
    else if (nextPageCursor) return find(user, place, nextPageCursor);
}

async function execute() {
    const div = document.createElement('div');
    div.id = 'sbx-panel';
    div.innerHTML = await fetch(chrome.runtime.getURL('panel.html')).then(res => res.text());

    // add the newly created element and its content into the DOM
    const runningGames = document.getElementById('rbx-running-games');
    runningGames.parentNode.insertBefore(div, runningGames);

    const search = document.getElementById('sbx-search');
    const input = document.getElementById('sbx-input');

    search.addEventListener('click', async event => {
        // Prevents page from refreshing
        event.preventDefault();

        const user = await get(`api.roblox.com/users/${/^\d+$/.test(input.value) ? input.value : `get-by-username?username=${input.value}`}`);
        if (!user) return;

        const place = location.href.match(/games\/(\d+)\//)[1];
        const found = await find(user, place);
        return join(found);
    });
}

if (!document.getElementById('sbx-panel')) execute();