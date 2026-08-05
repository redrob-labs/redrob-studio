/**
 * Regenerate voice tool-eval suite JSON under eval/suites/sfw/.
 *
 * Keeps Speak + Voice clone only. Image comparison and music/voice-design
 * suites are hand-maintained. Place local audio under eval/fixtures/sfw/audio/
 * when running clone evals.
 *
 * Usage: node scripts/generate-tool-eval-suites.mjs
 */
import fs from 'fs';
import path from 'path';

const FIXTURE_ROOT = path.join('eval', 'fixtures', 'sfw');

function listRel(subdir, exts) {
  const dir = path.join(FIXTURE_ROOT, subdir);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => exts.some((ext) => name.toLowerCase().endsWith(ext)))
    .sort()
    .map((name) => path.posix.join('sfw', subdir, name).replace(/\\/g, '/'));
}

const AUDS = listRel('audio', ['.mp3', '.wav', '.flac', '.ogg']);

const REFS = [
  [
    'Once upon a time, in a village by the sea, the lanterns came alive at dusk and the whole harbor glowed like a constellation.',
    'Welcome to the evening cast — soft waves and warm light.',
  ],
  [
    'Good evening. Here are the top stories from around the world, starting with breakthroughs in renewable energy this week.',
    'In local news, community gardens are expanding across the city.',
  ],
  [
    'Welcome aboard! I will walk you through the highlights of the tour, and feel free to ask questions anytime.',
    'Next stop is the mural wall — cameras ready, smiles optional.',
  ],
  [
    'Take a slow breath in… and gently let it go. Feel your shoulders soften as you settle into this quiet moment.',
    'Now notice the quiet between each breath. Stay here a little longer.',
  ],
  [
    'Hey! Ready to try something new today? This takes under a minute and you are going to love how simple it feels.',
    'Tap start, follow the checklist, and celebrate the tiny win.',
  ],
  [
    'Far below the ice shelf, a hidden ecosystem thrives in darkness, feeding on minerals that seep from the ancient rock.',
    'Above the ice, storm light flickers on empty pressure ridges.',
  ],
  [
    'If I have learned anything in all these years, it is that kindness compounds quietly, like interest you forget you deposited.',
    'Ask one more question before the lamp is blown out.',
  ],
  [
    'She closed the letter carefully, as if the paper itself might shatter, and stepped back into the quiet of the morning room.',
    'Somewhere below, a cab door slammed and footsteps faded into fog.',
  ],
  [
    '어느 날 작은 토끼가 언덕 위에 올라갔어요. 거기엔 반짝이는 별 하나가 토끼를 기다리고 있었답니다.',
    '오늘은 먼저 개울가에서 반짝이는 돌을 찾아보자.',
  ],
  [
    '(instrumental indie pop reference — no spoken transcript)',
    'Hum a soft verse about rainy sidewalks and neon reflections.',
  ],
];

function writeSuite(name, obj) {
  const file = path.join('eval/suites/sfw', `${name}.json`);
  fs.writeFileSync(file, `${JSON.stringify(obj, null, 2)}\n`);
  console.log('wrote', file, 'prompts', obj.prompts.length);
}

function base(task, suite, modality, workflowId, description, prompts) {
  return {
    version: 2,
    suite,
    description,
    rating: 'sfw',
    path: 'sfw',
    modality,
    task,
    tool: true,
    loraRecipeSet: 'all',
    workflows: [workflowId],
    notes: [
      'Supply local media under eval/fixtures/ when running voice-clone (none shipped).',
      'Score intelligibility, language fidelity, and timbre match.',
    ],
    prompts,
  };
}

function take(arr, n = 10) {
  if (arr.length === 0) return Array.from({ length: n }, () => null);
  const out = [];
  for (let i = 0; i < n; i += 1) out.push(arr[i % arr.length]);
  return out;
}

const audSlots = take(AUDS);

console.log(`fixtures found: audio=${AUDS.length}`);

const speakers = [
  'Ryan',
  'Aiden',
  'Vivian',
  'Serena',
  'Uncle_fu',
  'Dylan',
  'Eric',
  'Ono_anna',
  'Sohee',
  'Ryan',
];
const langs = [
  'English',
  'English',
  'Chinese',
  'Chinese',
  'Auto',
  'English',
  'English',
  'Japanese',
  'Korean',
  'English',
];
const speakTexts = [
  'Hello! This is a quick clarity check for the Speak tool.',
  'Please leave your package by the door. Thank you for delivering today.',
  '欢迎收听今日天气播报，午后多云，气温适宜。',
  '请在提示音后留下您的姓名和回电号码。',
  '今天天气不错，我们晚点一起去公园走走吧。',
  'Your meeting starts in five minutes in the blue conference room.',
  'Safety first: look both ways before you cross the street.',
  'おはようございます。本日の予定をご確認ください。',
  '안녕하세요. 예약이 확인되었습니다. 잠시만 기다려 주세요.',
  'Speak eval sample ten — steady pacing, clear diction, SFW.',
];

writeSuite(
  'sfw-speak',
  base(
    'speak',
    'sfw-speak',
    'audio',
    'qwen3-tts-speak',
    'Speak: text × speaker × language. Score intelligibility and language fidelity.',
    speakTexts.map((prompt, i) => ({
      id: `speak-${['clarity', 'delivery', 'zh-weather', 'zh-voicemail', 'zh-casual', 'en-meeting', 'en-safety', 'ja-morning', 'ko-booking', 'en-meta'][i]}`,
      difficulty: i >= 7 ? 'hard' : 'medium',
      tags: ['speak', 'tts', 'sfw'],
      prompt,
      speaker: speakers[i],
      language: langs[i],
    })),
  ),
);

writeSuite(
  'sfw-voice-clone',
  base(
    'voice-clone',
    'sfw-voice-clone',
    'audio',
    'qwen3-tts-voice-clone',
    'Voice clone: reference audio + new target lines. Score timbre match + clarity.',
    audSlots.map((audioFixture, i) => {
      const row = {
        id: `clone-${['narrator', 'anchor', 'guide', 'meditation', 'energetic', 'doc', 'elderly', 'audiobook', 'ko-kids', 'indie-hum'][i]}`,
        difficulty: i === 9 ? 'hard' : 'medium',
        tags: ['voice-clone', 'tts', 'sfw'],
        refText: REFS[i][0],
        prompt: REFS[i][1],
        language: i === 8 ? 'Korean' : 'English',
      };
      if (audioFixture) row.audioFixture = audioFixture;
      return row;
    }),
  ),
);

const vdPath = 'eval/suites/sfw/sfw-voice-design.json';
if (fs.existsSync(vdPath)) {
  const vd = JSON.parse(fs.readFileSync(vdPath, 'utf8'));
  console.log('left voice-design unchanged:', vd.prompts?.length ?? 0, 'prompts');
}
