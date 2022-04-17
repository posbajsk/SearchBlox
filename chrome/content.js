const { getURL } = chrome.runtime;

const COLORS = {
    GREEN: '#00b06f',
    BLUE: '#0077ff',
    RED: '#ff3e3e',
};

const USER = {
    SUCCESS: getURL('images/user-success.png'),
    NEUTRAL: getURL('images/user.png'),
    ERROR: getURL('images/user-error.png'),
};

const get = url => fetch('https://' + url).then(res => res.json());

const post = (url, body) => fetch('https://' + url, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body,
}).then(res => res.json());

let searching = false;
let cancelled = false;

function waitForElm(selector) {
    return new Promise(resolve => {
        if (document.querySelector(selector)) return resolve(document.querySelector(selector));

        const observer = new MutationObserver(() => {
            if (document.querySelector(selector)) {
                resolve(document.querySelector(selector));
                observer.disconnect();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });
}

async function find(imageUrl, place, bar, search, status, cursor = '', count = 0) {

    const kill = reason => {
        bar.style.width = `0%`;
        bar.style.backgroundColor = COLORS.RED;
        search.style.backgroundColor = COLORS.RED;
        return reason;
    }

    const { nextPageCursor, data } = await get(`games.roblox.com/v1/games/${place}/servers/Public?limit=100&cursor=${cursor}`);

    cursor = nextPageCursor;

    const playing = parseInt(document.querySelectorAll('.text-lead')[document.documentElement.dataset.btrLoaded ? 0 : 3].innerText.replace(/,/g, ''), 10);

    const servers = data.map(s => ({ id: s.id, tokens: s.playerTokens }));
    const maxPlayers = data[0].maxPlayers;

    for (const server of servers) {

        if (cancelled) return kill('cancelled');

        const { data } = await post('thumbnails.roblox.com/v1/batch', JSON.stringify(server.tokens.map(t => ({ token: t, type: 'AvatarHeadshot', size: '150x150' }))));

        const thumbnails = data.filter(d => d.state === 'Completed').map(x => x.imageUrl);

        count += thumbnails.length;
        console.log(`${Math.round((count / playing) * 100)}%`);
        bar.style.width = `${Math.round((count / playing) * 100)}%`;

        const check = thumbnails.some(url => url === imageUrl);

        if (!check) continue;

        found = true;
        bar.style.width = '100%';
        bar.style.backgroundColor = COLORS.GREEN;
        search.style.backgroundColor = COLORS.GREEN;

        const first = document.querySelectorAll('.rbx-game-server-item')[0];

        const item = document.createElement('li');
        item.className = 'stack-row rbx-game-server-item highlighted';

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

        button.onclick = () => chrome.runtime.sendMessage({ message: { place, id: server.id } });

        return 'found';

    }

    if (!cursor) return kill('notFound');

    return find(imageUrl, place, bar, search, status, cursor, count);


}

async function execute() {

    const dark = document.body.classList.contains('dark-theme');

    const div = document.createElement('div');
    div.id = 'sbx-panel';
    div.innerHTML = await fetch(getURL('panel.html')).then(res => res.text());

    const linebreak = document.createElement('br');

    const runningGames = await waitForElm('#rbx-game-server-item-container');

    runningGames.parentNode.insertBefore(div, runningGames);
    runningGames.parentNode.insertBefore(linebreak, runningGames);

    const search = document.getElementById('sbx-search');
    const input = document.getElementById('sbx-input');
    const status = document.getElementById('sbx-status');
    const icon = document.getElementById('sbx-user');
    const bar = document.getElementById('sbx-bar');

    if (dark) {
        div.classList.add('dark');
        input.classList.add('dark');
    }

    search.src = getURL('images/search.png');
    icon.src = getURL('images/user.png');

    input.oninput = () => {
        const test = /(^(?=^[^_]+_?[^_]+$)\w{3,20}$|^\d+$)/.test(input.value);
        if (!input.value) icon.src = USER.NEUTRAL;
        else icon.src = test ? USER.SUCCESS : USER.ERROR;
        return search.disabled = !test;
    };

    search.addEventListener('click', async event => {
        // Prevents page from refreshing
        event.preventDefault();

        const reset = () => {
            cancelled = false;
            searching = false;
            input.disabled = false;
            search.src = getURL('images/search.png');
        }

        if (searching) return cancelled = true;

        searching = true;

        status.innerText = 'Searching...';
        bar.style.backgroundColor = COLORS.BLUE;
        search.style.backgroundColor = COLORS.BLUE;
        search.src = getURL('images/cancel.png');
        input.disabled = true;

        const user = await get(`api.roblox.com/users/${/^\d+$/.test(input.value) ? input.value : `get-by-username?username=${input.value}`}`);

        if (user.errors || user.errorMessage) {
            icon.src = USER.ERROR;
            reset();
            return status.innerText = 'User not found!';
        }

        const { userPresences: [presence] } = await post('presence.roblox.com/v1/presence/users', JSON.stringify({ userIds: [user.Id] }));

        if ([0, 1].includes(presence.userPresenceType)) {
            icon.src = USER.ERROR;
            reset();
            return status.innerText = 'User is offline!';
        }

        const place = location.href.match(/games\/(\d+)\//)[1];

        const { data: [{ imageUrl }] } = await get(`thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.Id}&size=150x150&format=Png&isCircular=false`);

        const state = await find(imageUrl, place, bar, search, status);

        reset();

        if (state === 'notFound') status.innerText = 'Server not found!';
        if (state === 'cancelled') status.innerText = 'Cancelled!';
        if (state === 'found') status.innerText = 'Server found!';
    });
}

if (!document.getElementById('sbx-panel')) execute();