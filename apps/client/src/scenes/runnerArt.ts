// Independent vector drawing, shared by menu portraits and cached Phaser textures.
export const BAND = ['#f34d54', '#2585ef', '#ffd12f', '#16ce70'];
export function runnerArt(slot: number, portrait = false, caught = false): string {
  const color = BAND[slot] ?? BAND[0];
  const mouth = caught ? 'M44 77 Q51 64 58 77Z' : 'M44 70 Q50 74 59 69 Q54 84 44 70Z';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 104" width="96" height="104" aria-hidden="true">
    ${portrait ? '<path fill="#102e39" d="M23 86h13l-2 16H22zm34 0h13l3 13H60z"/>' : ''}
    <path fill="${color}" d="M21 41C9 39 7 48 2 52l8 1-5 15q13-1 19-18z"/>
    <path fill="#103848" d="M17 42Q15 30 24 27L42 7q3-3 4 1l2 16L69 3q3-2 3 3l1 23q6 2 7 12l1 33q0 16-16 18l-33 1q-17-1-17-18z"/>
    <path fill="#204859" d="M24 29 41 11l1 15zm31-4L68 9l1 16z"/>
    <path fill="#fff" d="M21 45q0-9 13-10h14q4 0 5 8 4-8 12-8 15 1 15 12v8q-1 13-14 13-9 0-15-9-4 10-15 10-16 0-16-15z"/>
    <g fill="#122d37"><ellipse cx="39" cy="${caught?54:50}" rx="3.9" ry="5"/><ellipse cx="66" cy="${caught?54:50}" rx="3.9" ry="5"/></g>
    <path fill="white" d="${mouth}"/>
    <path fill="${color}" d="M14 32q0-4 6-4l58-1q6 0 6 5v8q0 4-5 4l-61 2q-6 0-6-5z"/>
    <path fill="white" opacity=".22" d="M18 30l56-1q3 0 3 2l-59 2z"/>
  </svg>`;
}
export const portrait = (slot:number, caught=false) => runnerArt(slot,true,caught);
