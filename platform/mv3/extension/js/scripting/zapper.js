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

(async ( ) => {

/******************************************************************************/

const ubolOverlay = self.ubolOverlay;
if ( ubolOverlay === undefined ) { return; }
if ( ubolOverlay.file === '/zapper-ui.html' ) { return; }

/******************************************************************************/

// https://www.reddit.com/r/uBlockOrigin/comments/bktxtb/scrolling_doesnt_work/emn901o
//   Override 'fixed' position property on body element if present.

// With touch-driven devices, first highlight the element and remove only
// when tapping again the highlighted area.

function cssEscape(text) {
    return self.CSS && typeof self.CSS.escape === 'function'
        ? self.CSS.escape(text)
        : text.replace(/["\\]/g, '\\$&');
}

function selectorPartFromElement(elem) {
    const tagName = elem.localName;
    if ( typeof elem.id === 'string' && elem.id !== '' ) {
        const selector = `#${cssEscape(elem.id)}`;
        try {
            if ( document.querySelectorAll(selector).length === 1 ) {
                return selector;
            }
        } catch {
        }
    }

    let selector = tagName;
    const preferredAttributes = [
        'data-testid',
        'data-test-id',
        'data-test',
        'data-qa',
        'aria-label',
        'role',
    ];
    for ( const attr of preferredAttributes ) {
        const value = elem.getAttribute(attr);
        if ( value === null || value === '' ) { continue; }
        selector += `[${cssEscape(attr)}="${cssEscape(value)}"]`;
        return selector;
    }

    for ( const name of elem.classList.values() ) {
        selector += `.${cssEscape(name)}`;
    }

    return selector;
}

function selectorFromElement(elem) {
    const parts = [];
    let current = elem;
    while (
        current instanceof Element &&
        current !== document.body &&
        current !== document.documentElement
    ) {
        let part = selectorPartFromElement(current);
        const parent = current.parentElement;
        if ( parent instanceof Element ) {
            let siblings;
            try {
                siblings = parent.querySelectorAll(`:scope > ${part}`);
            } catch {
            }
            if ( siblings === undefined || siblings.length !== 1 ) {
                let i = 1;
                let sibling = current;
                while ( (sibling = sibling.previousElementSibling) !== null ) {
                    if ( sibling.localName === current.localName ) {
                        i += 1;
                    }
                }
                part = `${current.localName}:nth-of-type(${i})`;
            }
        }
        parts.unshift(part);
        const selector = parts.join(' > ');
        try {
            if ( document.querySelectorAll(selector).length === 1 ) {
                return selector;
            }
        } catch {
        }
        current = parent;
    }
    return parts.join(' > ');
}

function zapElementAtPoint(mx, my, options) {
    if ( options.highlight ) {
        const elem = ubolOverlay.elementFromPoint(mx, my);
        if ( elem ) {
            ubolOverlay.highlightElements([ elem ]);
        }
        return;
    }

    let elemToRemove = ubolOverlay.highlightedElements?.[0] ?? null;
    if ( elemToRemove === null && mx !== undefined ) {
        elemToRemove = ubolOverlay.elementFromPoint(mx, my);
    }

    if ( elemToRemove instanceof Element === false ) { return; }
    const selector = selectorFromElement(elemToRemove);

    const getStyleValue = (elem, prop) => {
        const style = window.getComputedStyle(elem);
        return style ? style[prop] : '';
    };

    // Heuristic to detect scroll-locking: remove such lock when detected.
    let maybeScrollLocked = elemToRemove.shadowRoot instanceof DocumentFragment;
    if ( maybeScrollLocked === false ) {
        let elem = elemToRemove;
        do {
            maybeScrollLocked =
                parseInt(getStyleValue(elem, 'zIndex'), 10) >= 1000 ||
                getStyleValue(elem, 'position') === 'fixed';
            elem = elem.parentElement;
        } while ( elem !== null && maybeScrollLocked === false );
    }
    if ( maybeScrollLocked ) {
        const doc = document;
        if ( getStyleValue(doc.body, 'overflowY') === 'hidden' ) {
            doc.body.style.setProperty('overflow', 'auto', 'important');
        }
        if ( getStyleValue(doc.body, 'position') === 'fixed' ) {
            doc.body.style.setProperty('position', 'initial', 'important');
        }
        if ( getStyleValue(doc.documentElement, 'position') === 'fixed' ) {
            doc.documentElement.style.setProperty('position', 'initial', 'important');
        }
        if ( getStyleValue(doc.documentElement, 'overflowY') === 'hidden' ) {
            doc.documentElement.style.setProperty('overflow', 'auto', 'important');
        }
    }
    elemToRemove.remove();
    ubolOverlay.highlightElementAtPoint(mx, my);
    return { removed: true, selector };
}

/******************************************************************************/

function onKeyPressed(ev) {
    if ( ev.key !== 'Delete' && ev.key !== 'Backspace' ) { return; }
    ev.stopPropagation();
    ev.preventDefault();
    zapElementAtPoint();
}

/******************************************************************************/

function startZapper() {
    self.addEventListener('keydown', onKeyPressed, true);
}

function quitZapper() {
    self.removeEventListener('keydown', onKeyPressed, true);
}

/******************************************************************************/

function onMessage(msg) {
    switch ( msg.what ) {
    case 'startTool':
        startZapper();
        break;
    case 'quitTool':
        quitZapper();
        break;
    case 'zapElementAtPoint': {
        const result = zapElementAtPoint(msg.mx, msg.my, msg.options);
        if ( msg.options.highlight !== true && msg.options.stay !== true ) {
            quitZapper();
        }
        return result;
    }
    default:
        break;
    }
}

/******************************************************************************/

await ubolOverlay.install('/zapper-ui.html', onMessage);

/******************************************************************************/

})();


void 0;
