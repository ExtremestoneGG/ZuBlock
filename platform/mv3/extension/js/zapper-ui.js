/*******************************************************************************

    uBlock Origin Lite - a comprehensive, MV3-compliant content blocker
    Copyright (C) 2025-present Raymond Hill

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

import { dom } from './dom.js';
import { i18n$ } from './i18n.js';
import { toolOverlay } from './tool-overlay-ui.js';

/******************************************************************************/

let lastZappedSelector = '';

/******************************************************************************/

function updateSaveState(state = 'waiting') {
    const saveButton = document.querySelector('#saveZap');
    const status = document.querySelector('#zapStatus');
    if ( saveButton === null || status === null ) { return; }
    saveButton.disabled = lastZappedSelector === '';
    const statusId = state === 'ready'
        ? 'zapperSaveReady'
        : state === 'done'
            ? 'zapperSaveDone'
            : state === 'failed'
                ? 'zapperSaveFailed'
                : 'zapperSaveWaiting';
    status.textContent = i18n$(statusId);
}

async function zapAtPoint(mx, my, options = {}) {
    // If zap mode, highlight element under mouse, this makes the zapper usable
    // on touch screens.
    const result = await toolOverlay.postMessage({
        what: 'zapElementAtPoint',
        mx,
        my,
        options,
    });
    if ( result?.removed === true && typeof result.selector === 'string' ) {
        lastZappedSelector = result.selector;
        updateSaveState('ready');
    }
}

function onSvgClicked(ev) {
    zapAtPoint(ev.clientX, ev.clientY, {
        stay: true,
        highlight: dom.cl.has(dom.root, 'mobile') &&
            ev.target !== toolOverlay.svgIslands,
    });
}

/******************************************************************************/

const onSvgTouch = (( ) => {
    let startX = 0, startY = 0;
    let t0 = 0;
    return ev => {
        if ( ev.type === 'touchstart' ) {
            startX = ev.touches[0].screenX;
            startY = ev.touches[0].screenY;
            t0 = ev.timeStamp;
            return;
        }
        if ( startX === undefined ) { return; }
        const stopX = ev.changedTouches[0].screenX;
        const stopY = ev.changedTouches[0].screenY;
        const distance = Math.sqrt(
            Math.pow(stopX - startX, 2) +
            Math.pow(stopY - startY, 2)
        );
        // Interpret touch events as a tap if:
        // - Swipe is not valid; and
        // - The time between start and stop was less than 200ms.
        const duration = ev.timeStamp - t0;
        if ( distance >= 32 || duration >= 200 ) { return; }
        onSvgClicked({
            type: 'touch',
            target: ev.target,
            clientX: ev.changedTouches[0].pageX,
            clientY: ev.changedTouches[0].pageY,
        });
        ev.preventDefault();
    };
})();

/******************************************************************************/

function onKeyPressed(ev) {
    // Delete
    if ( ev.key === 'Delete' || ev.key === 'Backspace' ) {
        zapAtPoint(undefined, undefined, { stay: true });
        return;
    }
    // Esc
    if ( ev.key === 'Escape' || ev.which === 27 ) {
        quitZapper();
        return;
    }
}

/******************************************************************************/

async function onSaveClicked() {
    if ( lastZappedSelector === '' ) { return; }
    const selector = lastZappedSelector;
    const saveButton = document.querySelector('#saveZap');
    if ( saveButton !== null ) {
        saveButton.disabled = true;
    }
    try {
        await toolOverlay.sendMessage({
            what: 'addCustomFilters',
            hostname: toolOverlay.url.hostname,
            selectors: [ selector ],
        });
        lastZappedSelector = '';
        updateSaveState('done');
    } catch {
        if ( saveButton !== null ) {
            saveButton.disabled = false;
        }
        updateSaveState('failed');
    }
}

/******************************************************************************/

function startZapper() {
    toolOverlay.postMessage({ what: 'startTool' });
    self.addEventListener('keydown', onKeyPressed, true);
    dom.on('svg#overlay', 'click', onSvgClicked);
    dom.on('svg#overlay', 'touchstart', onSvgTouch, { passive: true });
    dom.on('svg#overlay', 'touchend', onSvgTouch);
    dom.on('#quit', 'click', quitZapper );
    dom.on('#pick', 'click', resetZapper );
    dom.on('#saveZap', 'click', onSaveClicked );
    updateSaveState();
    toolOverlay.highlightElementUnderMouse(true);
}

function quitZapper() {
    self.removeEventListener('keydown', onKeyPressed, true);
    toolOverlay.stop();
}

function resetZapper() {
    lastZappedSelector = '';
    updateSaveState();
    toolOverlay.postMessage({ what: 'unhighlight' });
}

/******************************************************************************/

function onMessage(msg) {
    switch ( msg.what ) {
    case 'startTool':
        startZapper();
        break;
    default:
        break;
    }
}

/******************************************************************************/

// Wait for the content script to establish communication
toolOverlay.start(onMessage);

/******************************************************************************/
