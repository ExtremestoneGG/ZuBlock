/*******************************************************************************

    uBlock Origin Lite - a comprehensive, MV3-compliant content blocker
    Copyright (C) 2022-present Raymond Hill

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see {http://www.gnu.org/licenses/}.

    Home: https://github.com/gorhill/uBlock
*/

import { browser, runtime, sendMessage } from './ext.js';
import { dom, qs$ } from './dom.js';
import { i18n$ } from './i18n.js';
import punycode from './punycode.js';

/******************************************************************************/

const popupPanelData = {};
const  currentTab = {};
const tabURL = new URL(runtime.getURL('/'));

/******************************************************************************/

function renderAdminRules() {
    const { disabledFeatures: forbid = [] } = popupPanelData;
    if ( forbid.length === 0 ) { return; }
    dom.body.dataset.forbid = forbid.join(' ');
}

/******************************************************************************/

const BLOCKING_MODE_MAX = 3;

async function setFilteringMode(level, commit = false) {
    const modeSlider = qs$('.filteringModeSlider');
    modeSlider.dataset.level = level;
    if ( qs$('.filteringModeSlider.moving') === null ) {
        dom.text(
            '#filteringModeText > span:nth-of-type(1)',
            i18n$(`filteringMode${level}Name`)
        );
    }
    if ( commit !== true ) { return; }
    dom.cl.add(dom.body, 'busy');
    await commitFilteringMode();
    dom.cl.remove(dom.body, 'busy');
}

async function commitFilteringMode() {
    if ( tabURL.hostname === '' ) { return; }
    const targetHostname = tabURL.hostname;
    const modeSlider = qs$('.filteringModeSlider');
    const afterLevel = parseInt(modeSlider.dataset.level, 10);
    const beforeLevel = parseInt(modeSlider.dataset.levelBefore, 10);
    if ( afterLevel > 1 ) {
        if ( beforeLevel <= 1 ) {
            sendMessage({
                what: 'setPendingFilteringMode',
                tabId: currentTab.id,
                url: tabURL.href,
                hostname: targetHostname,
                beforeLevel,
                afterLevel,
            });
        }
        let granted = false;
        try {
            granted = await browser.permissions.request({
                origins: [ `*://*.${targetHostname}/*` ],
            });
        } catch {
        }
        if ( granted !== true ) {
            setFilteringMode(beforeLevel);
            return;
        }
    }
    dom.text(
        '#filteringModeText > span:nth-of-type(1)',
        i18n$(`filteringMode${afterLevel}Name`)
    );
    const actualLevel = await sendMessage({
        what: 'setFilteringMode',
        hostname: targetHostname,
        level: afterLevel,
    });
    if ( actualLevel !== afterLevel ) {
        setFilteringMode(actualLevel);
    }
    if ( actualLevel !== beforeLevel && popupPanelData.autoReload ) {
        const justReload = tabURL.href === currentTab.url;
        self.setTimeout(( ) => {
            if ( justReload ) {
                browser.tabs.reload(currentTab.id);
            } else {
                browser.tabs.update(currentTab.id, { url: tabURL.href });
            }
        }, 437);
    }
}

{
    let mx0 = 0;
    let mx1 = 0;
    let l0 = 0;
    let lMax = 0;
    let timer;

    const move = ( ) => {
        timer = undefined;
        const l1 = Math.min(Math.max(l0 + mx1 - mx0, 0), lMax);
        let level = Math.floor(l1 * BLOCKING_MODE_MAX / lMax);
        if ( qs$('body[dir="rtl"]') !== null ) {
            level = 3 - level;
        }
        const modeSlider = qs$('.filteringModeSlider');
        if ( `${level}` === modeSlider.dataset.level ) { return; }
        dom.text(
            '#filteringModeText > span:nth-of-type(2)',
            i18n$(`filteringMode${level}Name`)
        );
        setFilteringMode(level);
    };

    const moveAsync = ev => {
        if ( timer !== undefined ) { return; }
        mx1 = ev.pageX;
        timer = self.requestAnimationFrame(move);
    };

    const stop = ev => {
        if ( ev.button !== 0 ) { return; }
        const modeSlider = qs$('.filteringModeSlider');
        if ( dom.cl.has(modeSlider, 'moving') === false ) { return; }
        dom.cl.remove(modeSlider, 'moving');
        self.removeEventListener('mousemove', moveAsync, { capture: true });
        self.removeEventListener('mouseup', stop, { capture: true });
        dom.text('#filteringModeText > span:nth-of-type(2)', '');
        commitFilteringMode();
        ev.stopPropagation();
        ev.preventDefault();
        if ( timer !== undefined ) {
            self.cancelAnimationFrame(timer);
            timer = undefined;
        }
    };

    const startSliding = ev => {
        if ( ev.button !== 0 ) { return; }
        const modeButton = qs$('.filteringModeButton');
        if ( ev.currentTarget !== modeButton ) { return; }
        const modeSlider = qs$('.filteringModeSlider');
        if ( dom.cl.has(modeSlider, 'moving') ) { return; }
        modeSlider.dataset.levelBefore = modeSlider.dataset.level;
        mx0 = ev.pageX;
        const buttonRect = modeButton.getBoundingClientRect();
        l0 = buttonRect.left + buttonRect.width / 2;
        const sliderRect = modeSlider.getBoundingClientRect();
        lMax = sliderRect.width - buttonRect.width ;
        dom.cl.add(modeSlider, 'moving');
        self.addEventListener('mousemove', moveAsync, { capture: true });
        self.addEventListener('mouseup', stop, { capture: true });
        ev.stopPropagation();
        ev.preventDefault();
    };

    dom.on('.filteringModeButton', 'mousedown', startSliding);
}

dom.on(
    '.filteringModeSlider',
    'click',
    '.filteringModeSlider span[data-level]',
    ev => {
        const modeSlider = qs$('.filteringModeSlider');
        modeSlider.dataset.levelBefore = modeSlider.dataset.level;
        const span = ev.target;
        const level = parseInt(span.dataset.level, 10);
        setFilteringMode(level, true);
    }
);

if ( dom.cl.has(dom.html, 'mobile') === false ) {
    dom.on('.filteringModeSlider',
        'mouseenter',
        '.filteringModeSlider span[data-level]',
        ev => {
            const span = ev.target;
            const level = parseInt(span.dataset.level, 10);
            dom.text('#filteringModeText > span:nth-of-type(2)',
                i18n$(`filteringMode${level}Name`)
            );
        }
    );

    dom.on('.filteringModeSlider',
        'mouseleave',
        '.filteringModeSlider span[data-level]',
        ( ) => {
            dom.text('#filteringModeText > span:nth-of-type(2)', '');
        }
    );
}

/******************************************************************************/

dom.on('#gotoMatchedRules', 'click', ev => {
    if ( ev.isTrusted !== true ) { return; }
    if ( ev.button !== 0 ) { return; }
    sendMessage({
        what: 'showMatchedRules',
        tabId: currentTab.id,
    });
});

/******************************************************************************/

dom.on('#gotoReport', 'click', ev => {
    if ( ev.isTrusted !== true ) { return; }
    let url;
    try {
        url = new URL(currentTab.url);
    } catch {
    }
    if ( url === undefined ) { return; }
    const reportURL = new URL(runtime.getURL('/report.html'));
    reportURL.searchParams.set('tabid', currentTab.id);
    reportURL.searchParams.set('url', tabURL.href);
    reportURL.searchParams.set('mode', popupPanelData.level);
    sendMessage({
        what: 'gotoURL',
        url: `${reportURL.pathname}${reportURL.search}`,
    });
});

/******************************************************************************/

dom.on('#gotoDashboard', 'click', ev => {
    if ( ev.isTrusted !== true ) { return; }
    if ( ev.button !== 0 ) { return; }
    runtime.openOptionsPage();
});

/******************************************************************************/

dom.on('#gotoZapper', 'click', ( ) => {
    if ( browser.scripting === undefined ) { return; }
    browser.scripting.executeScript({
        files: [ '/js/scripting/tool-overlay.js', '/js/scripting/zapper.js' ],
        target: { tabId: currentTab.id },
    });
    self.close();
});

/******************************************************************************/

dom.on('#gotoPicker', 'click', ( ) => {
    if ( browser.scripting === undefined ) { return; }
    browser.scripting.executeScript({
        files: [
            '/js/scripting/css-procedural-api.js',
            '/js/scripting/tool-overlay.js',
            '/js/scripting/picker.js',
        ],
        target: { tabId: currentTab.id },
    });
    self.close();
});

/******************************************************************************/

dom.on('#gotoUnpicker', 'click', ( ) => {
    if ( browser.scripting === undefined ) { return; }
    browser.scripting.executeScript({
        files: [
            '/js/scripting/css-procedural-api.js',
            '/js/scripting/tool-overlay.js',
            '/js/scripting/unpicker.js',
        ],
        target: { tabId: currentTab.id },
    });
    self.close();
});

/******************************************************************************/

function renderTwitchShield() {
    const state = popupPanelData.zublockTwitchShield || {};
    const tool = qs$('#toggleTwitchShield');
    if ( tool === null ) { return; }
    dom.cl.toggle(tool, 'enabled', state.available !== false);
    dom.cl.toggle(tool, 'on', state.enabled === true);
    tool.title = i18n$(state.enabled ? 'popupTwitchShieldOn' : 'popupTwitchShieldOff');
}

/******************************************************************************/

function renderPageTranslator() {
    const state = popupPanelData.pageTranslator || {};
    const tool = qs$('#togglePageTranslator');
    if ( tool !== null ) {
        dom.cl.toggle(tool, 'on', state.enabled === true);
        tool.title = i18n$(state.enabled
            ? 'popupTranslatorTipOn'
            : 'popupTranslatorTipOff'
        );
    }

    const language = qs$('#pageTranslatorLanguage');
    if ( language !== null ) {
        language.value = state.targetLanguage === 'en' ? 'en' : 'pt';
    }

    const save = qs$('#savePageTranslations input');
    if ( save !== null ) {
        save.checked = state.saveTranslations === true;
    }

    dom.text('#pageTranslatorStatus', i18n$(state.enabled
        ? 'popupTranslatorStatusOn'
        : 'popupTranslatorStatusOff'
    ));
}

async function patchPageTranslator(patch) {
    dom.cl.add(dom.body, 'busy');
    try {
        const after = await sendMessage({
            what: 'setPageTranslatorConfig',
            patch,
        });
        if ( after instanceof Object ) {
            popupPanelData.pageTranslator = after;
        }
        renderPageTranslator();
    } finally {
        dom.cl.remove(dom.body, 'busy');
    }
}

/******************************************************************************/

function toPrettySelector(selector) {
    if ( typeof selector !== 'string' ) { return ''; }
    if ( selector.startsWith('{') === false ) { return selector; }
    try {
        return JSON.parse(selector).raw || selector;
    } catch {
    }
    return selector;
}

function renderSavedEdits() {
    const count = popupPanelData.savedEditCount || 0;
    dom.text('#popupSavedEditsCount', count.toLocaleString());

    const toggle = qs$('#toggleSavedEdits input');
    if ( toggle !== null ) {
        toggle.checked = popupPanelData.savedEditsEnabled !== false;
        toggle.disabled = count === 0;
    }

    const list = qs$('#popupSavedEditsList');
    if ( list !== null ) {
        dom.clear(list);
        const samples = popupPanelData.savedEditSamples || [];
        if ( samples.length === 0 ) {
            const li = document.createElement('li');
            li.textContent = i18n$('popupSavedEditsEmpty');
            list.append(li);
        } else {
            for ( const selector of samples ) {
                const li = document.createElement('li');
                li.textContent = toPrettySelector(selector);
                list.append(li);
            }
        }
    }

    dom.cl.toggle('#gotoUnpicker', 'enabled', count !== 0);
}

dom.on('#toggleSavedEdits input', 'change', async ev => {
    if ( ev.isTrusted !== true ) { return; }
    if ( tabURL.hostname === '' ) { return; }
    dom.cl.add(dom.body, 'busy');
    try {
        await sendMessage({
            what: 'setCustomFiltersEnabled',
            hostname: tabURL.hostname,
            enabled: ev.target.checked === true,
        });
        popupPanelData.savedEditsEnabled = ev.target.checked === true;
        renderSavedEdits();
    } finally {
        dom.cl.remove(dom.body, 'busy');
    }
});

dom.on('#openSavedEdits', 'click', async ev => {
    if ( ev.isTrusted !== true ) { return; }
    if ( ev.button !== 0 ) { return; }
    await browser.storage.local.set({ 'dashboard.activePane': 'filters' });
    runtime.openOptionsPage();
});

/******************************************************************************/

dom.on('.openBraveClean', 'click', async ev => {
    if ( ev.isTrusted !== true ) { return; }
    if ( ev.button !== 0 ) { return; }
    const url = ev.currentTarget?.dataset?.url;
    if ( typeof url !== 'string' || url === '' ) { return; }
    try {
        await browser.tabs.create({ active: true, url });
        self.close();
    } catch {
        try {
            self.open(url, '_blank', 'noopener');
            self.close();
        } catch {
        }
    }
});

/******************************************************************************/

dom.on('#togglePageTranslator', 'click', ev => {
    if ( ev.isTrusted !== true ) { return; }
    if ( ev.button !== 0 ) { return; }
    const before = popupPanelData.pageTranslator || {};
    patchPageTranslator({ enabled: before.enabled !== true });
});

dom.on('#pageTranslatorLanguage', 'change', ev => {
    if ( ev.isTrusted !== true ) { return; }
    const targetLanguage = ev.target.value === 'en' ? 'en' : 'pt';
    patchPageTranslator({ targetLanguage });
});

dom.on('#savePageTranslations input', 'change', ev => {
    if ( ev.isTrusted !== true ) { return; }
    patchPageTranslator({ saveTranslations: ev.target.checked === true });
});

/******************************************************************************/

dom.on('#toggleTwitchShield', 'click', async ev => {
    if ( ev.isTrusted !== true ) { return; }
    const before = popupPanelData.zublockTwitchShield || {};
    dom.cl.add(dom.body, 'busy');
    try {
        const after = await sendMessage({
            what: 'setZublockTwitchShield',
            enabled: before.enabled !== true,
        });
        if ( after instanceof Object ) {
            popupPanelData.zublockTwitchShield = after;
        }
        renderTwitchShield();
    } finally {
        dom.cl.remove(dom.body, 'busy');
    }
});

/******************************************************************************/

async function init() {
    const [ tab ] = await browser.tabs.query({
        active: true,
        currentWindow: true,
    });
    if ( tab instanceof Object === false ) { return true; }
    Object.assign(currentTab, tab);

    let url;
    try {
        const strictBlockURL = runtime.getURL('/strictblock.');
        url = new URL(currentTab.url);
        if ( url.href.startsWith(strictBlockURL) ) {
            url = new URL(url.hash.slice(1));
        }
        tabURL.href = url.href || '';
    } catch {
        return false;
    }

    if ( url !== undefined ) {
        const response = await sendMessage({
            what: 'popupPanelData',
            origin: url.origin,
            hostname: tabURL.hostname,
        });
        if ( response instanceof Object ) {
            Object.assign(popupPanelData, response);
        }
    }

    renderAdminRules();

    setFilteringMode(popupPanelData.level);

    const hostnameText =
        tabURL.protocol === 'chrome-extension:' && tabURL.hostname === runtime.id
            ? i18n$('extName')
            : punycode.toUnicode(tabURL.hostname);
    dom.text('#hostname', hostnameText);

    dom.cl.toggle('#gotoMatchedRules', 'enabled',
        popupPanelData.isSideloaded === true &&
        popupPanelData.developerMode &&
        typeof currentTab.id === 'number' &&
        isNaN(currentTab.id) === false
    );

    const isHTTP = url.protocol === 'http:' || url.protocol === 'https:';
    dom.cl.toggle(dom.root, 'isHTTP', isHTTP);

    dom.cl.toggle('#gotoUnpicker', 'enabled', popupPanelData.hasCustomFilters);
    renderTwitchShield();
    renderPageTranslator();
    renderSavedEdits();

    return true;
}

async function tryInit() {
    try {
        await init();
    } catch {
        setTimeout(tryInit, 100);
    } finally {
        dom.cl.remove(dom.body, 'loading', 'busy');
    }
}

tryInit();

/******************************************************************************/

