/*******************************************************************************

    ZuBlock - Twitch Shield for Chromium MV3

    This module keeps the proxy off until the user enables Twitch Shield and a
    Twitch tab is open. The PAC falls back to DIRECT for every request.
*/

import {
    browser,
    localRead,
    localWrite,
} from './ext.js';

/******************************************************************************/

const STORAGE_KEY = 'zublockTwitchShieldEnabled';
const PROXY_HOST = 'chromium.api.cdn-perfprod.com';
const PROXY_PORT = 2023;

const twitchTabQueries = [
    '*://twitch.tv/*',
    '*://*.twitch.tv/*',
];

let initialized = false;
let enabled = false;
let active = false;

/******************************************************************************/

const proxyConfig = {
    mode: 'pac_script',
    pacScript: {
        data: `function FindProxyForURL(url, host) {
    host = host.toLowerCase();
    if (
        host === 'passport.twitch.tv' ||
        host === 'usher.ttvnw.net' ||
        host === 'gql.twitch.tv' ||
        dnsDomainIs(host, '.playlist.live-video.net') ||
        dnsDomainIs(host, '.playlist.ttvnw.net') ||
        shExpMatch(host, 'video-weaver.*.hls.ttvnw.net')
    ) {
        return 'PROXY ${PROXY_HOST}:${PROXY_PORT}; DIRECT';
    }
    return 'DIRECT';
}`,
    },
};

/******************************************************************************/

function proxyAvailable() {
    return browser?.proxy?.settings instanceof Object;
}

async function applyProxy() {
    if ( proxyAvailable() === false ) { return false; }
    try {
        await browser.proxy.settings.set({
            value: proxyConfig,
            scope: 'regular',
        });
        return true;
    } catch {
    }
    return false;
}

async function clearProxy() {
    if ( proxyAvailable() === false ) { return false; }
    try {
        await browser.proxy.settings.clear({ scope: 'regular' });
        return true;
    } catch {
    }
    return false;
}

async function hasTwitchTabs() {
    if ( browser?.tabs?.query instanceof Function === false ) { return false; }
    for ( const url of twitchTabQueries ) {
        try {
            const tabs = await browser.tabs.query({ url });
            if ( Array.isArray(tabs) && tabs.length !== 0 ) { return true; }
        } catch {
        }
    }
    return false;
}

async function updateProxyState() {
    const shouldBeActive = enabled && await hasTwitchTabs();
    if ( shouldBeActive === active ) { return; }
    active = shouldBeActive;
    if ( active ) {
        if ( await applyProxy() === false ) {
            active = false;
        }
        return;
    }
    await clearProxy();
}

function scheduleUpdate() {
    updateProxyState();
}

/******************************************************************************/

export async function initZublockTwitchShield() {
    if ( initialized ) { return; }
    initialized = true;
    enabled = await localRead(STORAGE_KEY) !== false;

    browser.tabs?.onCreated?.addListener(scheduleUpdate);
    browser.tabs?.onRemoved?.addListener(scheduleUpdate);
    browser.tabs?.onUpdated?.addListener(scheduleUpdate);
    browser.tabs?.onActivated?.addListener(scheduleUpdate);

    await updateProxyState();
}

export async function getZublockTwitchShieldState() {
    if ( initialized === false ) {
        await initZublockTwitchShield();
    } else {
        await updateProxyState();
    }
    return {
        enabled,
        active,
        available: proxyAvailable(),
    };
}

export async function setZublockTwitchShieldEnabled(state) {
    enabled = state === true;
    await localWrite(STORAGE_KEY, enabled);
    await updateProxyState();
    return getZublockTwitchShieldState();
}

/******************************************************************************/
