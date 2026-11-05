import { portrait } from './runnerArt';

export const titleArt = `<svg viewBox="0 0 420 152" role="img" aria-label="Tag" class="title-logo">
 <g fill="#fffdf8" stroke="#183647" stroke-width="3.8" stroke-linejoin="round" paint-order="stroke" transform="translate(2,4)">
 <path d="M13 18Q68 11 147 14L139 56l-40-2-11 78-50-2 16-75-43 3Z"/>
 <path fill-rule="evenodd" d="M168 14l56-5 40 118-50 9-5-27-42 3-8 25-48-5zm16 42-12 32 29-2-8-31z"/>
 <path d="M400 30l-22 33q-21-16-43-11-27 5-31 30-2 22 23 24 12 1 21-4l2-14-25 2 1-27 75-3-10 66q-26 19-71 15-67-4-68-58 0-48 38-66 53-25 110 13z"/>
 </g></svg>`;
export function gardenCast(){
  return '<div class="garden-cast" aria-hidden="true">'+[0,1,2,3].map((slot)=>'<div class="cast cast-'+slot+'">'+portrait(slot)+'</div>').join('')+'</div>';
}
export const speakerIcon = (muted:boolean)=>`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" stroke-linejoin="round"/>${muted?'<path d="m17 9 5 6m0-6-5 6"/>':'<path d="M17 8q4 4 0 8m3-11q6 7 0 14"/>'}</svg>`;
