/** Redrob Tune model presets. */
export const REDROB_TUNE_MODELS = [
  {
    id: 'redrob-tune-fast',
    label: 'Redrob Tune Fast',
    description: 'Quick drafts — good for iterating style and lyrics.',
    unetName: 'acestep_v1.5_xl_turbo_bf16.safetensors',
    steps: 8,
    // Fast is trained for CFG≈1; no APG.
    samplerCfg: 1,
    useApg: false,
    auraShift: 3,
    topP: 0.9,
  },
  {
    id: 'redrob-tune-pro',
    label: 'Redrob Tune Pro',
    description:
      'Highest polish — APG guidance on the SFT checkpoint (more steps).',
    unetName: 'acestep_v1.5_xl_sft_bf16.safetensors',
    steps: 50,
    samplerCfg: 1.05,
    useApg: true,
    apgEta: 1.0,
    apgNormThreshold: 7,
    apgMomentum: 0,
    auraShift: 3,
    topP: 1.0,
  },
];

export const REDROB_TUNE_LANGUAGES = [
  'en', 'ko', 'ja', 'zh', 'yue', 'es', 'fr', 'de', 'pt', 'it', 'ru', 'ar', 'hi', 'th', 'vi', 'id', 'tr', 'pl', 'nl', 'sv', 'unknown',
];

export const REDROB_TUNE_TIME_SIGNATURES = ['2', '3', '4', '6'];

export const REDROB_TUNE_KEY_SCALES = [
  ...['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'].flatMap(
    root => [`${root} major`, `${root} minor`],
  ),
];

export const REDROB_TUNE_SECTIONS = [
  { id: 'intro', label: 'Intro', marker: '[Intro]' },
  { id: 'verse', label: 'Verse', marker: '[Verse]' },
  { id: 'chorus', label: 'Chorus', marker: '[Chorus]' },
  { id: 'bridge', label: 'Bridge', marker: '[Bridge]' },
  { id: 'outro', label: 'Outro', marker: '[Outro]' },
];

/** Sample genre + lyrics packs for the Music tool (original lyrics; no artist imitation). */
export const REDROB_TUNE_TEMPLATES = [
  {
    id: 'seoul-night',
    label: 'Seoul Night Alt R&B',
    prompt:
      'A dark Korean alternative R&B track about two minutes, sparse nighttime keys, low 808 pulse, wet reverb, intimate male Korean vocals with airy falsetto and half-spoken confessions, late-drinking loneliness, 3AM city mood, minimal glossy production.',
    tags: 'ko,rnb,alt-rnb,falsetto,night',
    lyrics:
      '[Verse]\n창문 틈으로 새벽이 새고\n잔은 비었는데 목은 아직 말라\n네 번호는 그대로인데\n용기는 벌써 바닥이야\n빨간 불빛 아래서만 솔직해져\n낮엔 괜찮은 척 웃었지\n오늘도 같은 실수를 골라\n술에 기대서 너를 불러\n\n[Chorus]\n아직 안 잤지, 나도 못 자\n이 밤이 우리를 다시 묶어\n말은 짧게, 숨은 길게\n그냥 와, 설명은 내일로\n\n[Verse]\n향기가 옷에 남아서\n잠도 제대로 못 덮어\n사랑이 아니래도 상관없어\n순간이면 충분해 지금은\n도시가 꺼져도 심장은 빨라\n끊을 수 없는 버릇처럼\n또 손이 가, 또 마음이 기워\n\n[Chorus]\n아직 안 잤지, 나도 못 자\n이 밤이 우리를 다시 묶어\n말은 짧게, 숨은 길게\n그냥 와, 설명은 내일로\n\n[Bridge]\n달이 반쯤만 떠 있어도\n너는 아직 다 안 차',
    bpm: 78,
    keyScale: 'D minor',
    timeSignature: '4',
    language: 'ko',
    seconds: 120,
  },
  {
    id: 'cozy-soul',
    label: 'Cozy Soul R&B',
    prompt:
      'A warm Korean contemporary R&B track about two minutes, soft Rhodes, brushed drums, silky bass, velvet male Korean singing with gentle melisma, sofa-night romance and elegant longing, smooth soul-pop sheen.',
    tags: 'ko,rnb,soul,smooth',
    lyrics:
      '[Verse]\n소파에 기대면 시간이 느려져\n네 어깨에 머리를 맡기고\nTV는 켜져 있어도 안 보여\n네 숨소리만 크게 들려\n하루가 길었던 이유를\n네가 와서 다 풀어주네\n말보다 온도가 먼저야\n이 방이 작아도 충분해\n\n[Chorus]\n예쁘다기보단 편안해\n네가 있을 때 나는 느려져\n멀리 가지 마, 조금만 더\n이 공기가 너를 닮아서\n\n[Verse]\n작은 손짓까지 다 기억해\n커피 한 잔에도 네가 묻어\n싸우고 난 뒤의 침묵조차\n이상하게 다정하게 느껴져\n어떻게 지내냐 묻기 전에\n이미 네 얼굴을 떠올려\n계절이 바뀌어도 같은 자리\n네가 앉던 그 소파\n\n[Chorus]\n예쁘다기보단 편안해\n네가 있을 때 나는 느려져\n멀리 가지 마, 조금만 더\n이 공기가 너를 닮아서\n\n[Bridge]\nJust stay right here with me\n말없이 웃어주면 돼',
    bpm: 82,
    keyScale: 'A major',
    timeSignature: '4',
    language: 'ko',
    seconds: 120,
  },
  {
    id: 'hook-hop',
    label: 'Chart Hip-Hop Pop',
    prompt:
      'A catchy Korean hip-hop pop track about two minutes, bouncing drums, playful synth stabs, clear male Korean rap switching into a sticky sung chorus, witty swagger and chart-ready hooks.',
    tags: 'ko,hiphop,hook,pop',
    lyrics:
      '[Verse]\n요즘 곡은 너무 비슷해\n그래서 내가 판을 흔들어\n아무나 따라 불러도 되게\n중독은 단순할수록 세\n마이크 잡으면 장난이 아니야\n웃으면서 꽂는 punchline\n트렌드 위에 앉아 운전해\n핸들은 내 style로 잠가\n\n[Chorus]\n누가 들어도 바로 따라와\n입술이 먼저 기억하는 그 멜로디\n누가 들어도 바로 미쳐와\n오늘 밤은 네 플레이리스트 최상단\n\n[Verse]\n가짜들은 티가 나\n진짜는 그냥 티가 안 나\n내 이름은 이미 습관이 됐고\n네 피드는 나를 닮아가\n삼각 구도처럼 단단한 크루\n들어가면 출구가 안 보여\n그래도 다들 들어오지\n재미있으니까, 그게 답이지\n\n[Chorus]\n누가 들어도 바로 따라와\n입술이 먼저 기억하는 그 멜로디\n누가 들어도 바로 미쳐와\n오늘 밤은 네 플레이리스트 최상단\n\n[Bridge]\nPlay it again, don\'t switch the song\n이 중독에 항복해봐',
    bpm: 108,
    keyScale: 'G minor',
    timeSignature: '4',
    language: 'ko',
    seconds: 120,
  },
  {
    id: 'city-jazz-rap',
    label: 'Melodic Jazz Rap',
    prompt:
      'A melodic Korean jazz-rap track about two minutes, warm bass, dusty drums, soft guitar or keys, clear male Korean rap with sung edges and smooth Konglish, fashion and city-image storytelling.',
    tags: 'ko,jazz-rap,melodic,fashion',
    lyrics:
      '[Verse]\n한강 바람 맞으며 걸을 때\n옷차림이 먼저 말을 해\n갤러리 조명이 얼굴을 나누고\n나는 장면을 가사로 옮겨\n그림처럼 정지된 순간들\n사진보다 감각이 길어\n영어 한 줄 넣고 한국말로 풀고\n발음은 또렷하게, 감정은 여유롭게\n\n[Chorus]\n오늘 난 어떻게 보이나\n네 시선이 유일한 미러야\n오늘 난 어디에 서 있나\n이 도시의 프레임 안에서\n\n[Verse]\n밤새 깨 있어도 얼굴은 멀쩡해\n커피와 playlist가 내 루틴\n사랑은 과장하지 않고\n디테일로만 증명해\n운동화 끈을 고쳐 매며\n다음 골목을 고르듯 고르지\n내가 고른 색감이 곧 나야\n말은 적어도, 무드가 더 많아\n\n[Chorus]\n오늘 난 어떻게 보이나\n네 시선이 유일한 미러야\n오늘 난 어디에 서 있나\n이 도시의 프레임 안에서\n\n[Bridge]\nArt in the pocket, night on my sleeve\n과장 없이 너를 그려',
    bpm: 92,
    keyScale: 'E minor',
    timeSignature: '4',
    language: 'ko',
    seconds: 120,
  },
  {
    id: 'booth-battle',
    label: 'Boom-Bap Battle',
    prompt:
      'A hard US boom-bap battle track about two minutes, dusty drums, tense strings or piano stabs, clear male English rap with dense internal rhyme and rapid-fire precision, hungry prove-yourself intensity.',
    tags: 'en,boom-bap,technical,battle',
    lyrics:
      '[Verse]\nClock on the wall, sweat on the palm\nOne take only, no second chance calm\nCrowd goes quiet when the pocket locks\nEvery syllable counted like money in a box\nThey said I\'d fold when the pressure hits\nI fold the verse till the pressure quits\nMind like a maze, mouth like a blade\nCut through the doubters that said I would fade\n\n[Chorus]\nThis shot won\'t come around again\nDrop the fear or drop the pen\nThis shot — hold still, don\'t shake\nWin in the booth or watch the window break\n\n[Verse]\nKitchen light humming, dreams in the notes\nI swallowed failure till it floated my throat\nNow every line is a debt I repay\nTo the kid who swore he\'d be heard someday\nRhyme schemes stack like a weapon array\nFoes talk tough till they hear me play\nI don\'t need a gimmick, I need the craft\nClear out the room, leave the craft intact\n\n[Chorus]\nThis shot won\'t come around again\nDrop the fear or drop the pen\nThis shot — hold still, don\'t shake\nWin in the booth or watch the window break\n\n[Bridge]\nStay locked, don\'t blank\nWhole career riding on this one take',
    bpm: 96,
    keyScale: 'F minor',
    timeSignature: '4',
    language: 'en',
    seconds: 120,
  },
  {
    id: 'midnight-confession',
    label: 'Melodic R&B Rap',
    prompt:
      'A melodic R&B-rap track about two minutes, soft 808s, moody pads, clean male English sing-rap confession, nightlife loneliness and soft flex, late-night emotional ballad.',
    tags: 'en,melodic-rap,rnb-rap,ballad',
    lyrics:
      '[Verse]\nPhone lights up but I let it burn\nSame old number with a different concern\nYou want the old me, I want the peace\nBoth of us stuck in a downtown suite\nTables turn quieter than we admit\nLove got expensive, honesty got cheap\nI toast to the version that never left home\nThen I bounce alone with a different cologne\n\n[Chorus]\nDon\'t call me lonely in public\nSave that for after the club closes\nDon\'t call me lonely in public\nI\'ll still pick up when nobody notices\n\n[Verse]\nCame up on hunger, leftover pride\nNow every room tilts when I arrive\nStill got the same friends from the early grind\nStill got the same fears I try to hide\nYour name in my drafts, unsent all year\nFame in the front, doubt in the mirror\nIf I text at two, don\'t read it as love\nRead it as midnight needing a soft touch\n\n[Chorus]\nDon\'t call me lonely in public\nSave that for after the club closes\nDon\'t call me lonely in public\nI\'ll still pick up when nobody notices\n\n[Bridge]\nYeah, I know I go quiet\nBut quiet don\'t mean I\'m done with you',
    bpm: 104,
    keyScale: 'C minor',
    timeSignature: '4',
    language: 'en',
    seconds: 120,
  },
  {
    id: 'west-coast-cruise',
    label: 'West Coast G-Funk',
    prompt:
      'A laid-back West Coast G-funk track about two minutes, warm synth leads, deep bounce bass, crisp but lazy drums, clear male English rap with smooth drawl and cruise-control storytelling.',
    tags: 'en,g-funk,west-coast,laid-back',
    lyrics:
      '[Verse]\nSun on the boulevard, windows cracked wide\nCity move slow when I\'m riding that ride\nTalk soft enough that the bass gets heard\nEvery block nod like they know the word\nFriends from the old days still in the van\nSuccess didn\'t rewrite who I am\nPour something brown, keep the vibe in check\nWeekend forever on a Tuesday set\n\n[Chorus]\nKeep it rolling, keep it light\nWest side rhythm through the night\nKeep it rolling, take your time\nNo rush when the pocket feels this fine\n\n[Verse]\nPalm trees lean like they listening in\nStories get longer when the evening thins\nI don\'t chase heat, heat find the lane\nCool is a language I never had to explain\nPass the good feeling like a shared refrain\nLeave all the drama for another day\nIf the world get heavy, we float above\nBrush on the snare and a little bit of love\n\n[Chorus]\nKeep it rolling, keep it light\nWest side rhythm through the night\nKeep it rolling, take your time\nNo rush when the pocket feels this fine\n\n[Bridge]\nLong as the sun hit the chrome just right\nWe gon\' be alright',
    bpm: 94,
    keyScale: 'G major',
    timeSignature: '4',
    language: 'en',
    seconds: 120,
  },
  {
    id: 'punchline-bounce',
    label: 'Southern Punchline Rap',
    prompt:
      'A Southern punchline rap track about two minutes, hard bounce drums, bright synths, clear male English rap with dense metaphors and witty flex, elastic flow switches.',
    tags: 'en,punchline,southern,trap',
    lyrics:
      '[Verse]\nInk on my fingers, blood in the pen\nI talk in puzzles then solve \'em again\nMoney got kids, so the money got sons\nI raise my fortune like I raise the drums\nThey copy the slang but they miss the wit\nI bend a phrase till the whole room split\nCome from the bottom with a crown in the bag\nLeave with a masterpiece and a funny little brag\n\n[Chorus]\nPunchlines raining, beat stay knocking\nFlow so liquid, brain keep boxing\nPunchlines raining, crowd stay shocked\nI invent the metaphor then change the lock\n\n[Verse]\nTune so sticky it live in your head\nBars so heavy they sleep in your bed\nI skate on a beat like a winter parade\nFlip a weak setup into a grenade\nNobody faster when the pocket get thin\nNobody wetter when the punchline ends\nIf you talk that wealth, I invented the math\nIf you talk that craft, I invented the craft\n\n[Chorus]\nPunchlines raining, beat stay knocking\nFlow so liquid, brain keep boxing\nPunchlines raining, crowd stay shocked\nI invent the metaphor then change the lock\n\n[Bridge]\nHustle mindset, old soul scars\nStill the best at turning words into cars',
    bpm: 140,
    keyScale: 'A minor',
    timeSignature: '4',
    language: 'en',
    seconds: 120,
  },
];

export function resolveRedrobTuneModel(modelId) {
  return REDROB_TUNE_MODELS.find(m => m.id === modelId) ?? REDROB_TUNE_MODELS[0];
}

export function insertMusicSection(lyrics, marker) {
  const text = String(lyrics ?? '');
  const block = text.trim().length === 0 ? `${marker}\n` : `\n\n${marker}\n`;
  return `${text}${block}`;
}
