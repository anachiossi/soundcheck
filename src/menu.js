// menu.js — the app's menu tree (Ana, 18 Nov): five main buttons in a top row, each with its own tabs.
//   Today · Film · Mics · IFB · Gear
// The film's name in the top bar opens the list of films ('projects'), the sliders open 'app-settings'.
// Only names live here: main.js says which screen draws each one.
// Used by: main.js, parts/top-menu.js, state.js

import { crewHides } from './crew-link.js';

export const MENU = [
  { id: 'today', label: 'Today', icon: 'calendar', tabs: [
    ['day', 'Day'], ['calendar', 'Calendar'], ['overview', 'Overview'], ['hours', 'Hours'], ['tomorrow', 'Alarms'],
  ] },
  { id: 'film', label: 'Film', icon: 'book', tabs: [
    ['script', 'Script'], ['scenes', 'Scenes'], ['cues-picker', 'Dialogs'], ['characters', 'Characters'], ['paycheck', 'Paycheck'], ['film-settings', 'Settings'],
  ] },
  { id: 'mics', label: 'Mics', icon: 'mic', tabs: [
    ['transmitters', 'Transmitters'], ['lavaliers', 'Lavaliers'], ['preferences', 'Preferences'], ['lav-rules', 'Presets'],
  ] },
  { id: 'ifb', label: 'IFB', icon: 'headphones', tabs: [
    ['ifb-list', 'IFB'], ['ifb-crew', 'Crew'], ['ifb-kit', 'IFB kit'],
  ] },
  { id: 'gear', label: 'Gear', icon: 'gear', tabs: [
    ['gear-truck', 'Truck'], ['gear-inventory', 'Inventory'], ['gear-batteries', 'Batteries'], ['gear-manuals', 'Manuals'], ['gear-kit', 'Kit'],
  ] },
];

// screens opened from inside another one, and the main button they belong to
const INSIDE = { alarms: 'today', 'lav-share': 'today', cues: 'film', 'cues-map': 'film', 'cues-timeline': 'film', 'cues-game': 'film' };
// screens that belong to no main button
const APART = ['projects', 'app-settings', 'proposal', 'crew-suggestions', 'kit-requests', 'document', 'help'];

const inMenu = screen => MENU.find(section => section.tabs.some(([id]) => id === screen));

export const isScreen = screen => Boolean(inMenu(screen)) || screen in INSIDE || APART.includes(screen);

// which main button is lit: the screen's own, or the last one used for a screen that belongs to none
export const sectionOf = (screen, last) => inMenu(screen)?.id || INSIDE[screen] || last || MENU[0].id;

// a section's tabs on this device: a crew phone has no Alarms (personal), Presets or film Settings (Ana's job)
export function tabsOf(sectionId, connection) {
  const section = MENU.find(item => item.id === sectionId) || MENU[0];
  return section.tabs.filter(([id]) => !crewHides(connection, id));
}
