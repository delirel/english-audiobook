/* ═══════════════════════════════════════════════════════════
   English Audiobook v3 — Main App
   React 18 UMD (no JSX, no bundler)
   ═══════════════════════════════════════════════════════════ */
'use strict';
(function () {
  const { useState: us, useEffect: ue, useRef: ur, useMemo: um, useCallback: uc } = React;
  const h = React.createElement;
  const F = React.Fragment;

  /* ── Helpers ─────────────────────────────────────────── */
  function spk(text, rate = 0.85) {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-GB'; u.rate = rate;
    const voices = speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'));
    const pref = voices.find(v => v.name.includes('Google UK')) || voices[0];
    if (pref) u.voice = pref;
    speechSynthesis.speak(u);
  }

  function cleanWord(w) {
    return w.toLowerCase().replace(/[^a-z']/g, '');
  }

  /* ── Level colors ────────────────────────────────────── */
  const LC = { A1:'#6B9080',A2:'#457B9D',B1:'#D4A843',B2:'#C8553D',C1:'#7B5EA7',C2:'#2D2A26' };

  /* ── STORAGE module ──────────────────────────────────── */
  const STORE_KEY = 'audiobook_v3_lessons';
  const SETTINGS_KEY = 'audiobook_v3_settings';

  function loadLessons() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); }
    catch { return []; }
  }
  function saveLessons(arr) {
    localStorage.setItem(STORE_KEY, JSON.stringify(arr));
  }
  function loadSettings() {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); }
    catch { return {}; }
  }
  function saveSettings(s) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  }

  /* ── Export / Import ─────────────────────────────────── */
  function exportLessons(lessons) {
    const payload = {
      version: 3,
      exportedAt: new Date().toISOString(),
      lessons
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audiobook-lekcje-' + new Date().toISOString().slice(0,10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function importLessons(file, onSuccess, onError) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        const incoming = Array.isArray(data) ? data : (data.lessons || []);
        if (!incoming.length) { onError('Plik nie zawiera lekcji.'); return; }
        const existing = loadLessons();
        const existingIds = new Set(existing.map(l => l.id));
        const merged = [
          ...incoming.filter(l => !existingIds.has(l.id)),
          ...existing
        ];
        saveLessons(merged);
        onSuccess(merged, incoming.length);
      } catch {
        onError('Nieprawidłowy plik JSON.');
      }
    };
    reader.readAsText(file);
  }

  /* ── Topics config ───────────────────────────────────── */
  const TOPICS = [
    { id:'business',      name:'Biznes ogólny',       icon:'💼' },
    { id:'finance',       name:'Finanse',              icon:'📊' },
    { id:'hr',            name:'HR i rekrutacja',      icon:'👥' },
    { id:'law',           name:'Prawo korporacyjne',   icon:'⚖️' },
    { id:'negotiations',  name:'Negocjacje',           icon:'🤝' },
    { id:'technology',    name:'Technologia',          icon:'💻' },
    { id:'communication', name:'Komunikacja',          icon:'📧' },
    { id:'general',       name:'Ogólny angielski',     icon:'📚' },
  ];

  const LEVELS = ['A1','A2','B1','B2','C1','C2'];

  const STYLES = [
    { v:'article',  l:'Artykuł' },
    { v:'story',    l:'Opowiadanie' },
    { v:'dialog',   l:'Dialog' },
    { v:'email',    l:'E-mail' },
  ];

  const LENGTHS = [
    { v:'short',  l:'Krótki (~150 słów)' },
    { v:'medium', l:'Średni (~300 słów)' },
    { v:'long',   l:'Długi (~500 słów)' },
  ];

  const GRAMMAR = [
    { v:'simple',   l:'Prosta' },
    { v:'standard', l:'Standardowa' },
    { v:'advanced', l:'Zaawansowana' },
  ];

  /* ── Section definitions ─────────────────────────────── */
  const SECTIONS = [
    { id:'reader',    name:'Tekst główny',         icon:'📖' },
    { id:'keyvocab',  name:'Słowa kluczowe',       icon:'🔑' },
    { id:'allvocab',  name:'Całe słownictwo',      icon:'📝' },
    { id:'exercises', name:'Ćwiczenia',             icon:'✏️' },
    { id:'quiz',      name:'Fiszki',                icon:'🃏' },
    { id:'dictation', name:'Dyktando',              icon:'🎧' },
    { id:'match',     name:'Dopasuj pary',          icon:'🎯' },
  ];

  /* ── Simple NLP pipeline (browser-side) ─────────────── */
  const STOPWORDS = new Set(['the','a','an','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','shall','can','to','of','in','on','at','for','with','by','from','as','but','and','or','if','so','not','it','its','this','that','these','those','he','she','we','they','you','i','me','him','her','us','them','my','your','his','our','their','what','which','who','when','where','how','all','each','every','both','than','then','there','here','just','also','been','more','very','much','such','into','after','before','about','up','out','over','no','nor','yet','still','even','than','only','too','most','some','any','other','own','same','few','rather','well','back','now','get','got','go','went','come','came','take','took','make','made','know','knew','see','saw','say','said','think','thought','one','two','three','four','five','six','seven','eight','nine','ten','new','good','first','last','long','great','little','own','right','big','high','different','small','large','next','early','young','important','public','private','real','best','free','old','used','like','need','feel','try']);

  function tokenize(text) {
    return text.split(/\s+/).map((raw, i) => {
      const clean = raw.replace(/[^a-zA-Z'-]/g, '').toLowerCase();
      return { raw, clean, index: i };
    }).filter(t => t.clean.length > 1);
  }

  function lemmatize(word) {
    const irregulars = { ran:'run',went:'go',went:'go',came:'come',took:'take',made:'make',knew:'know',saw:'see',said:'say',thought:'think',brought:'bring',bought:'buy',caught:'catch',chose:'choose',fell:'fall',felt:'feel',found:'find',got:'get',gave:'give',grew:'grow',heard:'hear',held:'hold',kept:'keep',led:'lead',left:'leave',lost:'lose',meant:'mean',met:'meet',paid:'pay',read:'read',rode:'ride',rose:'rise',sent:'send',set:'set',showed:'show',sat:'sit',slept:'sleep',spoke:'speak',spent:'spend',stood:'stand',told:'tell',taught:'teach',understood:'understand',wore:'wear',won:'win',wrote:'write' };
    if (irregulars[word]) return irregulars[word];
    if (word.endsWith('ing') && word.length > 5) return word.slice(0,-3);
    if (word.endsWith('tion')) return word;
    if (word.endsWith('ed') && word.length > 4) {
      const s = word.slice(0,-2);
      if (s.endsWith('i')) return s.slice(0,-1) + 'y';
      return s;
    }
    if (word.endsWith('ies') && word.length > 4) return word.slice(0,-3) + 'y';
    if (word.endsWith('es') && word.length > 4) return word.slice(0,-2);
    if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) return word.slice(0,-1);
    return word;
  }

  function splitSentences(text) {
    return text.split(/(?<=[.!?]["'»\])]?\s)/).map(s => s.trim()).filter(s => s.length > 10);
  }

  function extractVocab(text, wordLookup) {
    const tokens = tokenize(text);
    const sentences = splitSentences(text);
    const counts = {};
    const lemmaMap = {};

    tokens.forEach(t => {
      if (STOPWORDS.has(t.clean) || t.clean.length < 3) return;
      const lemma = lemmatize(t.clean);
      if (!counts[lemma]) { counts[lemma] = 0; lemmaMap[lemma] = t.clean; }
      counts[lemma]++;
    });

    const totalContent = Object.values(counts).reduce((a,b) => a+b, 0) || 1;

    const allVocab = Object.entries(counts)
      .map(([lemma, count]) => {
        const word = lemmaMap[lemma];
        const entry = wordLookup[word] || wordLookup[lemma];
        const tf = count / totalContent;
        // IDF: word in lookup = known vocab → slightly penalize (user already knows),
        // unknown = boost (topic-specific)
        const idf = entry ? 1.0 : 1.5;
        const score = tf * idf * Math.log(count + 1);
        const firstSentence = sentences.find(s => s.toLowerCase().includes(word)) || '';
        return { en: word, lemma, pl: entry ? entry.pl : '', count, score, firstSentence, isKnown: false };
      })
      .filter(v => v.count >= 1)
      .sort((a,b) => b.score - a.score);

    const keyVocab = allVocab
      .filter(v => v.pl)  // only words we can translate
      .slice(0, 20);

    return { allVocab, keyVocab, sentences };
  }

  function generateExercises(keyVocab, sentences) {
    const exercises = [];
    keyVocab.slice(0, 10).forEach(v => {
      const sent = sentences.find(s => {
        const lower = s.toLowerCase();
        return lower.includes(v.en) || lower.includes(v.lemma);
      });
      if (!sent) return;
      const blanked = sent.replace(new RegExp(v.en, 'gi'), '___');
      if (blanked === sent) return;
      // MCQ distractors
      const pool = keyVocab.filter(x => x.en !== v.en);
      const distractors = pool.sort(() => Math.random()-0.5).slice(0,3).map(x => x.en);
      const options = [...distractors, v.en].sort(() => Math.random()-0.5);
      exercises.push({ sentence: blanked, original: sent, answer: v.en, options, pl: v.pl });
    });
    return exercises;
  }

  /* ── Claude API client ───────────────────────────────── */
  async function generateWithClaude(apiKey, params) {
    const { level, topic, style, length, grammar, priorityWords } = params;
    const topicName = TOPICS.find(t => t.id === topic)?.name || topic;
    const lengthMap = { short:150, medium:300, long:500 };
    const targetWords = lengthMap[length] || 300;

    const prompt = `Create an English language learning text for a ${level} CEFR level learner.

Requirements:
- Topic: ${topicName}
- Style: ${style} (${style === 'dialog' ? 'a conversation between 2 people' : style === 'email' ? 'a professional email with subject, greeting, body, closing' : style === 'story' ? 'a short narrative story' : 'an informative article with a clear structure'})
- Target length: approximately ${targetWords} words
- Grammar difficulty: ${grammar}
- Write ONLY vocabulary appropriate for ${level} level
${priorityWords.length > 0 ? `- You MUST use these words: ${priorityWords.join(', ')}` : ''}

First write the full text in English.
Then add a separator line: ---TRANSLATION---
Then write a complete Polish translation of the text.

Do not add any explanations, comments, or metadata. Just the English text, the separator, and the Polish translation.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error ${response.status}`);
    }

    const data = await response.json();
    const full = data.content[0]?.text || '';
    const [enText, plText] = full.split('---TRANSLATION---').map(s => s.trim());
    return { enText: enText || full, plText: plText || '' };
  }

  /* ── wordLookup – built from D.vocab ────────────────── */
  function buildLookup() {
    const lookup = {};
    if (typeof D !== 'undefined' && D.vocab) {
      D.vocab.forEach(v => { lookup[v.en.toLowerCase()] = v; });
    }
    return lookup;
  }

  /* ═══════════════════════════════════════════════════════
     COMPONENTS
     ═══════════════════════════════════════════════════════ */

  /* ── Install Banner ──────────────────────────────────── */
  function InstallBanner({ onDismiss }) {
    const [deferredPrompt, setDP] = us(null);
    ue(() => {
      const handler = e => { e.preventDefault(); setDP(e); };
      window.addEventListener('beforeinstallprompt', handler);
      return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);
    if (!deferredPrompt) return null;
    return h('div', { className: 'install-banner' },
      h('div', { className: 'install-banner-text' },
        h('strong', null, '📱 Zainstaluj aplikację'),
        'Dodaj do ekranu głównego – działa offline'
      ),
      h('button', {
        className: 'install-btn',
        onClick: async () => {
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          setDP(null);
        }
      }, 'Zainstaluj'),
      h('button', { className: 'install-dismiss', onClick: onDismiss }, '✕')
    );
  }

  /* ── Update Toast ────────────────────────────────────── */
  function UpdateToast({ onUpdate }) {
    return h('div', { className: 'update-toast' },
      '✨ Nowa wersja dostępna',
      h('button', { onClick: onUpdate }, 'Odśwież')
    );
  }

  /* ── HOME ────────────────────────────────────────────── */
  /* ── Embedded stories ───────────────────────────────── */
  const EMBEDDED = typeof D !== 'undefined' && D.stories ? D.stories : [];
  const LEVELS_ORDER = ['A1','A2','B1','B2','C1','C2'];
  const LEVEL_NAMES = {A1:'Początkujący',A2:'Podstawowy',B1:'Średniozaawansowany',B2:'Wyższy średniozaawansowany',C1:'Zaawansowany',C2:'Biegły'};

  function Home({ lessons, onNew, onOpen, onDelete, onOpenStory }) {
    const [tab, setTab] = us(lessons.length > 0 ? 'my' : 'library');
    const totalSections = lessons.reduce((s, l) => s + Object.values(l.progress || {}).filter(Boolean).length, 0);
    return h('div', { className: 'container fade-up' },
      h('div', { className: 'home-header' },
        h('h1', { className: 'home-title' }, 'English', h('br'), 'Audiobook'),
        h('p', { className: 'home-sub' }, 'Nauka przez słuchanie i ćwiczenia')
      ),
      h('div', { className: 'mode-tabs', style:{marginBottom:20} },
        h('button', { className:'mode-tab '+(tab==='my'?'active':''), onClick:()=>setTab('my') }, '📂 Moje lekcje'),
        h('button', { className:'mode-tab '+(tab==='library'?'active':''), onClick:()=>setTab('library') }, '📚 Biblioteka')
      ),
      tab === 'my' && h(F, null,
        h('div', { className: 'home-stats' },
          h('div', { className: 'stat-pill' }, h('span', null, lessons.length), ' lekcji'),
          h('div', { className: 'stat-pill' }, h('span', null, totalSections), ' ukończonych')
        ),
        h('button', { className: 'new-lesson-btn', onClick: onNew },
          h('svg', { viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:2.5 },
            h('path', { d:'M12 5v14M5 12h14' })
          ),
          'Nowa lekcja'
        ),
        lessons.length === 0
          ? h('div', { className: 'empty' },
              h('div', { className: 'empty-icon' }, '📂'),
              'Brak lekcji. Stwórz lub wybierz z Biblioteki!'
            )
          : h(F, null,
              h('div', { className: 'section-label' }, 'Twoje lekcje'),
              ...lessons.map(l => h(LessonCard, { key: l.id, lesson: l, onOpen, onDelete }))
            )
      ),
      tab === 'library' && h(F, null,
        h('p', { style:{fontSize:13,color:'var(--t3)',marginBottom:20} }, '24 opowiadania biznesowe · A1–C2'),
        LEVELS_ORDER.map(lvl => {
          const group = EMBEDDED.filter(s => s.level === lvl);
          if (!group.length) return null;
          return h('div', { key:lvl, style:{marginBottom:24} },
            h('div', { className:'section-label', style:{display:'flex',alignItems:'center',gap:8} },
              h('span', { style:{background:LC[lvl],color:'#fff',padding:'2px 8px',borderRadius:10,fontSize:11,fontWeight:700} }, lvl),
              LEVEL_NAMES[lvl]
            ),
            group.map((s,i) => h('div', {
              key:i, className:'lesson-card', style:{marginBottom:8},
              onClick:()=>onOpenStory(s)
            },
              h('div', { className:'lc-top' },
                h('div', { className:'lc-icon' }, '📖'),
                h('div', { className:'lc-body' },
                  h('div', { className:'lc-title' }, s.title.replace(/Story \d+: /,'')),
                  h('div', { className:'lc-meta' }, s.context)
                )
              )
            ))
          );
        })
      )
    );
  }

  function LessonCard({ lesson, onOpen, onDelete }) {
    const prog = lesson.progress || {};
    const done = SECTIONS.map(s => prog[s.id]);
    return h('div', { className: 'lesson-card', onClick: () => onOpen(lesson.id) },
      h('div', { className: 'lc-top' },
        h('div', { className: 'lc-icon' }, TOPICS.find(t => t.id === lesson.topic)?.icon || '📖'),
        h('div', { className: 'lc-body' },
          h('div', { className: 'lc-title' }, lesson.title),
          h('div', { className: 'lc-meta' },
            h('span', { className: 'lc-badge lc-' + lesson.level }, lesson.level),
            TOPICS.find(t => t.id === lesson.topic)?.name,
            ' · ',
            new Date(lesson.createdAt).toLocaleDateString('pl-PL', { day:'numeric', month:'short' })
          )
        ),
        h('button', {
          style:{color:'var(--t4)',fontSize:18,flexShrink:0},
          onClick: e => { e.stopPropagation(); if(confirm('Usunąć lekcję?')) onDelete(lesson.id); }
        }, '×')
      ),
      h('div', { className: 'lc-progress' },
        done.map((d, i) => h('div', {
          key: i,
          className: 'lc-prog-seg ' + (d === 'done' ? 'done' : d === 'partial' ? 'partial' : '')
        }))
      )
    );
  }

  /* ── LESSON CREATOR ──────────────────────────────────── */
  function LessonCreator({ onBack, onCreate }) {
    const settings = loadSettings();
    const [level, setLevel] = us('B1');
    const [topic, setTopic] = us('business');
    const [style, setStyle] = us('article');
    const [length, setLength] = us('medium');
    const [grammar, setGrammar] = us('standard');
    const [mode, setMode] = us('ai'); // 'ai' | 'paste'
    const [pasteText, setPaste] = us('');
    const [pastePl, setPastePl] = us('');
    const [apiKey, setApiKey] = us(settings.apiKey || '');
    const [generating, setGenerating] = us(false);
    const [error, setError] = us('');

    const canGenerate = mode === 'ai'
      ? apiKey.trim().length > 10
      : pasteText.trim().length > 50;

    async function handleCreate() {
      setError('');
      setGenerating(true);
      try {
        let enText, plText;
        if (mode === 'ai') {
          // Save API key
          saveSettings({ ...loadSettings(), apiKey });
          ({ enText, plText } = await generateWithClaude(apiKey, { level, topic, style, length, grammar, priorityWords:[] }));
        } else {
          enText = pasteText.trim();
          plText = pastePl.trim();
        }
        // Process text
        const wordLookup = buildLookup();
        const { allVocab, keyVocab, sentences } = extractVocab(enText, wordLookup);
        const exercises = generateExercises(keyVocab, sentences);
        const title = sentences[0]?.slice(0, 60) || enText.slice(0, 60);
        const lesson = {
          id: Date.now().toString(),
          title,
          level, topic, style,
          rawText: enText,
          translation: plText,
          createdAt: Date.now(),
          generatedByAI: mode === 'ai',
          keyVocab,
          allVocab,
          sentences,
          exercises,
          knownWords: [],
          progress: {}
        };
        const lessons = loadLessons();
        lessons.unshift(lesson);
        saveLessons(lessons);
        onCreate(lesson.id);
      } catch(e) {
        setError(e.message || 'Wystąpił błąd. Spróbuj ponownie.');
      } finally {
        setGenerating(false);
      }
    }

    return h(F, null,
      generating && h('div', { className: 'generating-overlay' },
        h('div', { className: 'generating-card' },
          h('div', { className: 'gen-spinner' }),
          h('div', { className: 'gen-title' }, mode === 'ai' ? 'Generuję tekst' : 'Przetwarzam tekst'),
          h('div', { className: 'gen-sub' }, h('span', { className:'gen-dots' }, mode === 'ai' ? 'Claude pisze' : 'Analizuję słownictwo'))
        )
      ),
      h('div', { className: 'container creator fade-up' },
        h('button', { className: 'creator-back', onClick: onBack },
          h('svg', {viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2},
            h('path',{d:'M15 18l-6-6 6-6'})),
          ' Wstecz'
        ),
        h('h1', { className: 'creator-h1' }, 'Nowa lekcja'),
        h('p', { className: 'creator-sub' }, 'Wybierz poziom, temat i sposób generowania'),

        h('div', { className: 'form-section' },
          h('span', { className: 'form-label' }, 'Poziom CEFR'),
          h('div', { className: 'level-picker' },
            LEVELS.map(l => h('button', {
              key: l,
              className: 'level-btn ' + (level === l ? 'active ' + l : ''),
              style: level === l ? { background: LC[l] } : {},
              onClick: () => setLevel(l)
            }, l))
          )
        ),

        h('div', { className: 'form-section' },
          h('span', { className: 'form-label' }, 'Temat'),
          h('div', { className: 'topic-grid' },
            TOPICS.map(t => h('button', {
              key: t.id,
              className: 'topic-btn ' + (topic === t.id ? 'active' : ''),
              onClick: () => setTopic(t.id)
            },
              h('span', { className: 'topic-icon' }, t.icon),
              h('span', { className: 'topic-name' }, t.name)
            ))
          )
        ),

        h('div', { className: 'form-section' },
          h('span', { className: 'form-label' }, 'Opcje'),
          h('div', { className: 'options-grid' },
            h('div', { className: 'option-group' },
              h('label', null, 'Styl'),
              h('select', { className: 'option-select', value: style, onChange: e => setStyle(e.target.value) },
                STYLES.map(s => h('option', { key: s.v, value: s.v }, s.l))
              )
            ),
            h('div', { className: 'option-group' },
              h('label', null, 'Długość'),
              h('select', { className: 'option-select', value: length, onChange: e => setLength(e.target.value) },
                LENGTHS.map(s => h('option', { key: s.v, value: s.v }, s.l))
              )
            ),
            h('div', { className: 'option-group' },
              h('label', null, 'Gramatyka'),
              h('select', { className: 'option-select', value: grammar, onChange: e => setGrammar(e.target.value) },
                GRAMMAR.map(s => h('option', { key: s.v, value: s.v }, s.l))
              )
            )
          )
        ),

        h('div', { className: 'form-section' },
          h('span', { className: 'form-label' }, 'Źródło tekstu'),
          h('div', { className: 'mode-tabs' },
            h('button', { className: 'mode-tab ' + (mode==='ai'?'active':''), onClick: ()=>setMode('ai') }, '✨ Generuj z AI'),
            h('button', { className: 'mode-tab ' + (mode==='paste'?'active':''), onClick: ()=>setMode('paste') }, '📋 Wklej tekst')
          ),
          mode === 'ai'
            ? h(F, null,
                h('label', { className: 'form-label', style:{marginTop:8} }, 'Klucz Claude API'),
                h('input', {
                  className: 'api-key-input',
                  type: 'password',
                  placeholder: 'sk-ant-...',
                  value: apiKey,
                  onChange: e => setApiKey(e.target.value)
                }),
                h('p', { style:{fontSize:12,color:'var(--t3)',marginTop:6} },
                  '🔒 Klucz zapisywany lokalnie. Nigdy nie wysyłamy go nigdzie poza api.anthropic.com'
                )
              )
            : h(F, null,
                h('textarea', {
                  className: 'paste-area',
                  rows: 8,
                  placeholder: 'Wklej tekst angielski (min. 50 słów)...',
                  value: pasteText,
                  onChange: e => setPaste(e.target.value)
                }),
                h('textarea', {
                  className: 'paste-area',
                  rows: 4,
                  style:{marginTop:8},
                  placeholder: 'Opcjonalne: tłumaczenie polskie...',
                  value: pastePl,
                  onChange: e => setPastePl(e.target.value)
                })
              )
        ),

        error && h('div', {
          style:{padding:'12px 16px',background:'var(--redBg)',color:'var(--red)',borderRadius:'var(--rs)',marginBottom:12,fontSize:14,fontWeight:500}
        }, '⚠ ' + error),

        h('button', {
          className: 'generate-btn',
          disabled: !canGenerate || generating,
          onClick: handleCreate
        }, mode === 'ai' ? '✨ Generuj lekcję' : '📋 Stwórz z tekstu')
      )
    );
  }

  /* ── LESSON MENU ─────────────────────────────────────── */
  function LessonMenu({ lesson, onSection, onBack }) {
    const prog = lesson.progress || {};
    const topic = TOPICS.find(t => t.id === lesson.topic);
    return h('div', { className: 'container fade-up' },
      h('button', { className: 'creator-back', onClick: onBack },
        h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2},h('path',{d:'M15 18l-6-6 6-6'})),
        ' Lekcje'
      ),
      h('div', { className: 'lesson-menu-header' },
        h('div', { className: 'lesson-menu-meta' },
          h('span', { className: 'lc-badge lc-' + lesson.level }, lesson.level),
          topic?.name,
          lesson.generatedByAI && h('span', { style:{color:'var(--purple)',fontWeight:600} }, '✨ AI')
        ),
        h('h1', { className: 'lesson-menu-title' }, lesson.title)
      ),
      h('div', { className: 'sections-grid' },
        SECTIONS.map(s => {
          const status = prog[s.id];
          return h('div', {
            key: s.id,
            className: 'section-tile ' + (status === 'done' ? 'completed' : ''),
            onClick: () => onSection(s.id)
          },
            h('div', { className: 'st-top' },
              h('span', { className: 'st-icon' }, s.icon),
              status === 'done' && h('span', { className: 'st-badge' }, '✓')
            ),
            h('div', { className: 'st-name' }, s.name),
            status && h('div', { className: 'st-score' }, status === 'done' ? 'Ukończono' : 'W trakcie')
          );
        })
      )
    );
  }

  /* ── READER ──────────────────────────────────────────── */
  function Reader({ lesson, onBack, onDone }) {
    const [tooltip, setTT] = us(null);
    const [playing, setPlaying] = us(false);
    const [hiWord, setHi] = us(-1);
    const [speed, setSpeed] = us(0.75);
    const [showTrans, setShowTrans] = us(false);
    const stopRef = ur(false);
    const tmRef = ur(null);

    const wordLookup = um(() => buildLookup(), []);
    const words = lesson.rawText.split(/\s+/);
    const keySet = new Set(lesson.keyVocab.map(v => v.en.toLowerCase()));

    ue(() => {
      speechSynthesis.getVoices();
      const fn = e => { if (!e.target.closest('.word') && !e.target.closest('.popup')) setTT(null); };
      document.addEventListener('click', fn);
      return () => { stopRef.current = true; speechSynthesis.cancel(); if(tmRef.current) clearInterval(tmRef.current); document.removeEventListener('click', fn); };
    }, []);

    function stop() { stopRef.current = true; speechSynthesis.cancel(); setPlaying(false); setHi(-1); if(tmRef.current) clearInterval(tmRef.current); }

    function play() {
      if (playing) { speechSynthesis.pause(); setPlaying(false); return; }
      stopRef.current = false; setPlaying(true);
      const sents = lesson.sentences;
      let gi = 0, si = 0;
      function next() {
        if (stopRef.current || si >= sents.length) { setPlaying(false); setHi(-1); return; }
        const s = sents[si], sw = s.split(/\s+/);
        const u = new SpeechSynthesisUtterance(s);
        u.lang = 'en-GB'; u.rate = speed;
        const v = speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'));
        const pref = v.find(x => x.name.includes('Google UK')) || v[0];
        if (pref) u.voice = pref;
        setHi(gi);
        const avgMs = Math.round(300 / speed);
        let wi = 0, bFired = 0;
        if(tmRef.current) clearInterval(tmRef.current);
        tmRef.current = setInterval(() => {
          if (stopRef.current) { clearInterval(tmRef.current); return; }
          if (bFired > 1) { clearInterval(tmRef.current); return; }
          wi++; if (wi < sw.length) setHi(gi + wi);
        }, avgMs);
        u.onboundary = e => { if(e.name==='word') { bFired++; setHi(gi + s.substring(0,e.charIndex).trim().split(/\s+/).filter(Boolean).length); } };
        u.onend = () => { clearInterval(tmRef.current); if(!stopRef.current){gi+=sw.length;si++;setTimeout(next,150);} };
        u.onerror = () => { clearInterval(tmRef.current); if(!stopRef.current){gi+=sw.length;si++;next();} };
        speechSynthesis.speak(u);
      }
      speechSynthesis.cancel(); setTimeout(next, 80);
    }

    return h('div', { className: 'container fade-up' },
      h('button', { className: 'reader-back', onClick: () => { stop(); onBack(); } },
        h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2},h('path',{d:'M15 18l-6-6 6-6'})),
        ' Wstecz'
      ),
      h('div', { className: 'reader-head' },
        h('span', { className: 'reader-lvl lc-' + lesson.level }, lesson.level),
        h('h1', { className: 'reader-h1' }, lesson.title),
        h('p', { className: 'reader-meta' }, TOPICS.find(t=>t.id===lesson.topic)?.name)
      ),
      h('div', { className: 'audio-bar' },
        h('button', { className: 'play-btn ' + (playing?'playing':''), onClick: play },
          playing ? '⏸ Pauza' : '▶ Odsłuchaj'
        ),
        playing && h('button', { className: 'stop-btn', onClick: stop }, '■'),
        h('div', { style:{flex:1} }),
        [0.5,0.75,1].map(s => h('button', {
          key:s, className:'spd-btn '+(speed===s?'active':''), onClick:()=>setSpeed(s)
        }, s+'x'))
      ),
      h('div', { className: 'text-block' },
        words.map((w, i) => {
          const clean = w.replace(/[^a-zA-Z'-]/g,'').toLowerCase();
          const entry = wordLookup[clean];
          return h(F, { key:i },
            h('span', {
              className: 'word' + (i===hiWord?' highlighted':'') + (keySet.has(clean)?' key-word':entry?' has-trans':''),
              onClick: e => {
                e.stopPropagation();
                const r = e.target.getBoundingClientRect();
                setTT({ word:w, entry, x:r.left+r.width/2, y:r.top });
              }
            }, w),
            ' '
          );
        })
      ),
      tooltip && h('div', {
        className: 'popup',
        style: { left: Math.min(Math.max(tooltip.x,130),innerWidth-140)+'px', top: Math.max(tooltip.y-10,10)+'px' }
      },
        tooltip.entry
          ? h(F,null,
              h('div',{className:'popup-word'},tooltip.word),
              h('div',{className:'popup-trans'},tooltip.entry.pl),
              keySet.has(tooltip.word.replace(/[^a-zA-Z'-]/g,'').toLowerCase()) && h('div',{className:'popup-key'},'kluczowe'),
              h('button',{className:'popup-close',onClick:()=>{spk(tooltip.word.replace(/[^a-zA-Z'-]/g,''));}},'🔊')
            )
          : h(F,null,
              h('div',{className:'popup-word'},tooltip.word),
              h('button',{className:'popup-close',onClick:()=>setTT(null)},'✕')
            )
      ),
      lesson.translation && h(F,null,
        h('button',{className:'toggle-trans',onClick:()=>setShowTrans(!showTrans)},showTrans?'▲ Ukryj tłumaczenie':'▼ Pokaż tłumaczenie'),
        showTrans && h('div',{className:'trans-text'},lesson.translation)
      ),
      lesson.keyVocab.length > 0 && h('div',{className:'keyvocab'},
        h('h3',null,'Słowa kluczowe'),
        lesson.keyVocab.map(v => h('div',{key:v.en,className:'kv-row'},
          h('button',{className:'kv-speak',onClick:()=>spk(v.en)},'▶'),
          h('span',{className:'kv-en'},v.en),
          h('span',{className:'kv-pl'},v.pl)
        ))
      )
    );
  }

  /* ── KEY VOCAB ───────────────────────────────────────── */
  function KeyVocab({ lesson, onBack }) {
    return h('div', { className: 'container fade-up' },
      h('button', { className: 'creator-back', onClick: onBack },
        h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2},h('path',{d:'M15 18l-6-6 6-6'})),
        ' Wstecz'
      ),
      h('div', { className: 'vocab-head' },
        h('h1', { className: 'vocab-h1' }, '🔑 Słowa kluczowe'),
        h('p', { className: 'vocab-sub' }, lesson.keyVocab.length + ' najważniejszych słów')
      ),
      lesson.keyVocab.map(v => h('div', { key:v.en, className:'vocab-chip key' },
        h('button',{className:'vc-speak',onClick:()=>spk(v.en)},'▶'),
        h('div',{className:'vc-body'},
          h('div',{className:'vc-en'},v.en),
          h('div',{className:'vc-pl'},v.pl),
          v.firstSentence && h('div',{className:'vc-ex'},v.firstSentence)
        )
      ))
    );
  }

  /* ── ALL VOCAB ───────────────────────────────────────── */
  function AllVocab({ lesson, onBack }) {
    const [search, setSearch] = us('');
    const filtered = lesson.allVocab.filter(v => {
      if (!search) return v.pl; // only translated
      const q = search.toLowerCase();
      return v.en.includes(q) || v.pl.includes(q);
    });
    return h('div', { className: 'container fade-up' },
      h('button', { className: 'creator-back', onClick: onBack },
        h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2},h('path',{d:'M15 18l-6-6 6-6'})),
        ' Wstecz'
      ),
      h('div', { className: 'vocab-head' },
        h('h1', { className: 'vocab-h1' }, '📝 Całe słownictwo'),
        h('p', { className: 'vocab-sub' }, lesson.allVocab.filter(v=>v.pl).length + ' przetłumaczonych słów')
      ),
      h('input', {
        className: 'search-input',
        placeholder: 'Szukaj słówka...',
        value: search,
        onChange: e => setSearch(e.target.value)
      }),
      filtered.map(v => h('div', { key:v.en, className:'vocab-chip' },
        h('button',{className:'vc-speak',onClick:()=>spk(v.en)},'▶'),
        h('div',{className:'vc-body'},
          h('div',{className:'vc-en'},v.en),
          h('div',{className:'vc-pl'},v.pl)
        )
      ))
    );
  }

  /* ── EXERCISES ───────────────────────────────────────── */
  function Exercises({ lesson, onBack }) {
    const [mode, setMode] = us('mcq');
    const [idx, setIdx] = us(0);
    const [answer, setAnswer] = us('');
    const [feedback, setFeedback] = us(null);
    const [score, setScore] = us(0);
    const [done, setDone] = us(false);
    const exs = lesson.exercises || [];
    const cur = exs[idx];

    function check(opt) {
      if (feedback) return;
      const a = opt || answer.trim().toLowerCase();
      const correct = cur.answer.toLowerCase();
      const ok = a === correct || correct.includes(a);
      setFeedback({ ok, correct: cur.answer });
      if (ok) setScore(s => s+1);
    }
    function next() {
      if (idx+1 >= exs.length) { setDone(true); return; }
      setIdx(i => i+1); setAnswer(''); setFeedback(null);
    }

    if (!exs.length) return h('div',{className:'container fade-up'},
      h('button',{className:'creator-back',onClick:onBack},h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2},h('path',{d:'M15 18l-6-6 6-6'})),' Wstecz'),
      h('div',{className:'empty'},h('div',{className:'empty-icon'},'✏️'),'Brak ćwiczeń dla tego tekstu'));

    if (done) return h('div',{className:'container fade-up'},
      h('button',{className:'creator-back',onClick:onBack},h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2},h('path',{d:'M15 18l-6-6 6-6'})),' Wstecz'),
      h('div',{className:'done-box'},
        h('div',{className:'done-pct',style:{color:score/exs.length>=0.7?'var(--green)':'var(--red)'}},Math.round(score/exs.length*100)+'%'),
        h('div',{className:'done-detail'},score+' z '+exs.length+' poprawnych'),
        h('button',{className:'act-btn',onClick:()=>{setIdx(0);setAnswer('');setFeedback(null);setScore(0);setDone(false)}},'Jeszcze raz')
      )
    );

    return h('div',{className:'container fade-up'},
      h('button',{className:'creator-back',onClick:onBack},h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2},h('path',{d:'M15 18l-6-6 6-6'})),' Wstecz'),
      h('div',{className:'quiz-head'},h('h1',{className:'quiz-h1'},'✏️ Ćwiczenia'),h('p',{className:'quiz-sub'},'Uzupełnij brakujące słowa')),
      h('div',{className:'dir-btns'},
        h('button',{className:'dir-btn '+(mode==='mcq'?'active':''),onClick:()=>setMode('mcq')},'Wybór'),
        h('button',{className:'dir-btn '+(mode==='type'?'active':''),onClick:()=>setMode('type')},'Wpisz')
      ),
      h('div',{className:'pbar'},h('div',{className:'pfill',style:{width:(idx/exs.length*100)+'%'}})),
      h('div',{className:'exercise-card'},
        h('div',{className:'ex-sentence',style:{fontFamily:'var(--serif)',fontSize:18,lineHeight:1.8,marginBottom:16}},cur.sentence),
        mode === 'mcq'
          ? h('div',{className:'ex-mcq'},
              cur.options.map(opt => h('button',{
                key:opt,
                className:'ex-option'+(feedback?(opt===cur.answer?' correct':opt===answer?' wrong':''):''),
                onClick:()=>{ if(!feedback){setAnswer(opt);check(opt);} }
              },opt))
            )
          : h(F,null,
              h('input',{
                className:'ex-input'+(feedback?(feedback.ok?' correct':' wrong'):''),
                placeholder:'Wpisz brakujące słowo...',
                value:answer,
                onChange:e=>setAnswer(e.target.value),
                onKeyDown:e=>{ if(e.key==='Enter'&&!feedback&&answer.trim())check(); },
                disabled:!!feedback
              }),
              !feedback && h('button',{className:'act-btn',style:{marginTop:12},onClick:()=>{if(answer.trim())check();}},'Sprawdź')
            ),
        feedback && h(F,null,
          h('div',{className:'ex-feedback '+(feedback.ok?'correct':'wrong')},
            feedback.ok ? '✓ Dobrze!' : '✗ Poprawna odpowiedź: ' + feedback.correct
          ),
          h('button',{className:'act-btn',style:{marginTop:12},onClick:next},idx+1>=exs.length?'Wynik':'Dalej')
        )
      )
    );
  }

  /* ── QUIZ (Flashcards) ───────────────────────────────── */
  function QuizSection({ lesson, onBack }) {
    const [dir, setDir] = us('en2pl');
    const vocab = lesson.keyVocab.filter(v => v.pl);
    const [items, setItems] = us(() => [...vocab].sort(()=>Math.random()-0.5));
    const [idx, setIdx] = us(0);
    const [ans, setAns] = us('');
    const [fb, setFb] = us(null);
    const [score, setScore] = us(0);
    const [done, setDone] = us(false);
    const inputRef = ur(null);
    ue(()=>{ if(inputRef.current) inputRef.current.focus(); },[idx]);

    function reset() { setItems([...vocab].sort(()=>Math.random()-0.5)); setIdx(0); setAns(''); setFb(null); setScore(0); setDone(false); }
    ue(reset, [dir]);
    const cur = items[idx];
    function check() {
      if(!cur||fb) return;
      const correct = dir==='en2pl'?cur.pl:cur.en;
      const ok = ans.trim().toLowerCase() === correct.toLowerCase();
      setFb({ok,correct}); if(ok) setScore(s=>s+1);
    }
    function next() { if(idx+1>=items.length)setDone(true); else{setIdx(i=>i+1);setAns('');setFb(null);} }

    if (!vocab.length) return h('div',{className:'container fade-up'},
      h('button',{className:'creator-back',onClick:onBack},'← Wstecz'),
      h('div',{className:'empty'},h('div',{className:'empty-icon'},'🃏'),'Brak słówek do fiszek'));

    if (done) return h('div',{className:'container fade-up'},
      h('button',{className:'creator-back',onClick:onBack},h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2},h('path',{d:'M15 18l-6-6 6-6'})),' Wstecz'),
      h('div',{className:'done-box'},
        h('div',{className:'done-pct',style:{color:score/items.length>=0.7?'var(--green)':'var(--red)'}},Math.round(score/items.length*100)+'%'),
        h('div',{className:'done-detail'},score+' z '+items.length+' poprawnych'),
        h('button',{className:'act-btn',onClick:reset},'Jeszcze raz')
      )
    );

    return h('div',{className:'container fade-up'},
      h('button',{className:'creator-back',onClick:onBack},h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2},h('path',{d:'M15 18l-6-6 6-6'})),' Wstecz'),
      h('div',{className:'quiz-head'},h('h1',{className:'quiz-h1'},'🃏 Fiszki'),h('p',{className:'quiz-sub'},'Sprawdź słownictwo')),
      h('div',{className:'dir-btns'},
        h('button',{className:'dir-btn '+(dir==='en2pl'?'active':''),onClick:()=>setDir('en2pl')},'EN → PL'),
        h('button',{className:'dir-btn '+(dir==='pl2en'?'active':''),onClick:()=>setDir('pl2en')},'PL → EN')
      ),
      h('div',{className:'pbar'},h('div',{className:'pfill',style:{width:(idx/items.length*100)+'%'}})),
      cur && h('div',{className:'quiz-card'},
        h('div',{className:'quiz-num'},(idx+1)+' / '+items.length),
        h('div',{className:'quiz-word'},dir==='en2pl'?cur.en:cur.pl),
        h('input',{
          ref:inputRef,
          className:'quiz-inp'+(fb?(fb.ok?' correct':' wrong'):''),
          value:ans,
          onChange:e=>setAns(e.target.value),
          onKeyDown:e=>{ if(e.key==='Enter'){if(fb)next();else if(ans.trim())check();} },
          placeholder:dir==='en2pl'?'po polsku...':'in English...',
          disabled:!!fb
        }),
        fb && h('div',{className:'quiz-fb '+(fb.ok?'correct':'wrong')},fb.ok?'Dobrze!':fb.correct),
        h('div',{className:'quiz-actions'},
          !fb
            ? h('button',{className:'act-btn',onClick:check},'Sprawdź')
            : h('button',{className:'act-btn',onClick:next},idx+1>=items.length?'Wynik':'Dalej')
        )
      )
    );
  }

  /* ── MATCH ───────────────────────────────────────────── */
  function MatchSection({ lesson, onBack }) {
    const vocab = lesson.keyVocab.filter(v=>v.pl);
    const B = 6;
    const [round, setRound] = us(0);
    const [sel, setSel] = us(null);
    const [matched, setMatched] = us({});
    const [score, setScore] = us(0);
    const [errors, setErrors] = us(0);
    const [wrong, setWrong] = us(null);
    const [done, setDone] = us(false);

    const batch = um(()=>{
      const sh=[...vocab].sort(()=>Math.random()-0.5);
      return sh.slice(round*B,(round+1)*B);
    },[round,vocab]);
    const enCol = um(()=>[...batch].sort(()=>Math.random()-0.5),[batch]);
    const plCol = um(()=>[...batch].sort(()=>Math.random()-0.5),[batch]);

    function pickEn(v) { if(!matched[v.en])setSel(v); }
    function pickPl(v) {
      if(!sel||matched[sel.en])return;
      if(sel.en===v.en) {
        const n={...matched,[v.en]:true}; setMatched(n); setScore(s=>s+1); setSel(null);
        if(Object.keys(n).length>=batch.length) {
          setTimeout(()=>{
            if((round+1)*B<vocab.length) { setRound(r=>r+1); setMatched({}); setSel(null); }
            else setDone(true);
          },400);
        }
      } else {
        setWrong({en:sel.en,pl:v.en}); setErrors(e=>e+1);
        setTimeout(()=>{ setWrong(null); setSel(null); },400);
      }
    }

    if(!vocab.length) return h('div',{className:'container fade-up'},
      h('button',{className:'creator-back',onClick:onBack},'← Wstecz'),
      h('div',{className:'empty'},h('div',{className:'empty-icon'},'🎯'),'Brak słówek do gry'));

    if(done) return h('div',{className:'container fade-up'},
      h('button',{className:'creator-back',onClick:onBack},h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2},h('path',{d:'M15 18l-6-6 6-6'})),' Wstecz'),
      h('div',{className:'done-box'},
        h('div',{className:'done-pct',style:{color:'var(--green)'}},score+'/'+vocab.length),
        h('div',{className:'done-detail'},errors+' błędów'),
        h('button',{className:'act-btn',onClick:()=>{setRound(0);setMatched({});setSel(null);setScore(0);setErrors(0);setDone(false);}},'Ponownie')
      )
    );

    return h('div',{className:'container fade-up'},
      h('button',{className:'creator-back',onClick:onBack},h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2},h('path',{d:'M15 18l-6-6 6-6'})),' Wstecz'),
      h('div',{className:'quiz-head'},h('h1',{className:'quiz-h1'},'🎯 Dopasuj pary')),
      h('div',{className:'match-stats'},
        h('span',{className:'mstat ok'},'✓ '+score),
        h('span',{className:'mstat bad'},'✗ '+errors)
      ),
      h('div',{className:'match-board'},
        h('div',{className:'match-col'},enCol.map(v=>h('div',{
          key:v.en,
          className:'mcard en'+(matched[v.en]?' matched':'')+(sel&&sel.en===v.en?' selected':'')+(wrong&&wrong.en===v.en?' shake':''),
          onClick:()=>pickEn(v)
        },v.en))),
        h('div',{className:'match-col'},plCol.map(v=>h('div',{
          key:v.en+'p',
          className:'mcard pl'+(matched[v.en]?' matched':'')+(wrong&&wrong.pl===v.en?' shake':''),
          onClick:()=>pickPl(v)
        },v.pl)))
      )
    );
  }

  /* ── DICTATION ───────────────────────────────────────── */
  function DictSection({ lesson, onBack }) {
    const sents = lesson.sentences || [];
    const [idx, setIdx] = us(0);
    const [inp, setInp] = us('');
    const [res, setRes] = us(null);
    const [playing, setPlaying] = us(false);
    const [speed, setSpeed] = us(0.75);
    const [stats, setStats] = us({ok:0,t:0});
    const taRef = ur(null);

    function playSent() {
      if(playing) return;
      setPlaying(true);
      const u = new SpeechSynthesisUtterance(sents[idx]);
      u.lang='en-GB'; u.rate=speed;
      const v=speechSynthesis.getVoices().filter(v=>v.lang.startsWith('en'));
      const p=v.find(x=>x.name.includes('Google UK'))||v[0]; if(p)u.voice=p;
      u.onend=()=>{ setPlaying(false); if(taRef.current)taRef.current.focus(); };
      u.onerror=()=>setPlaying(false);
      speechSynthesis.speak(u);
    }

    function check() {
      const orig=sents[idx].split(/\s+/).map(cleanWord).filter(Boolean);
      const user=inp.trim().split(/\s+/).map(cleanWord).filter(Boolean);
      let ok=0; orig.forEach((w,i)=>{ if(user[i]&&user[i]===w)ok++; });
      const pct=orig.length?Math.round(ok/orig.length*100):0;
      setRes({pct,pass:pct>=70,orig:sents[idx]});
      setStats(s=>({ok:s.ok+(pct>=70?1:0),t:s.t+1}));
    }

    if(!sents.length) return h('div',{className:'container fade-up'},
      h('button',{className:'creator-back',onClick:onBack},'← Wstecz'),
      h('div',{className:'empty'},h('div',{className:'empty-icon'},'🎧'),'Brak zdań w tym tekście'));

    return h('div',{className:'container fade-up'},
      h('button',{className:'creator-back',onClick:onBack},h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2},h('path',{d:'M15 18l-6-6 6-6'})),' Wstecz'),
      h('div',{className:'quiz-head'},h('h1',{className:'quiz-h1'},'🎧 Dyktando'),h('p',{className:'quiz-sub'},'Posłuchaj i wpisz')),
      h('div',{className:'dict-card'},
        h('div',{className:'dict-counter'},'Zdanie '+(idx+1)+' z '+sents.length+(stats.t>0?' — '+stats.ok+'/'+stats.t+' OK':'')),
        h('div',{className:'dict-play'},
          h('button',{className:'dict-pbtn',onClick:playSent,disabled:playing},playing?'...':'🔊 Odsłuchaj'),
          [0.5,0.75,1].map(s=>h('button',{key:s,className:'spd-btn '+(speed===s?'active':''),onClick:()=>setSpeed(s)},s+'x'))
        ),
        !res && h(F,null,
          h('textarea',{ref:taRef,className:'dict-ta',rows:3,value:inp,onChange:e=>setInp(e.target.value),onKeyDown:e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if(inp.trim())check();}},placeholder:'Wpisz usłyszane zdanie...'}),
          h('div',{style:{textAlign:'center',marginTop:12}},
            h('button',{className:'act-btn',onClick:check,disabled:!inp.trim()},'Sprawdź')
          )
        ),
        res && h(F,null,
          h('div',{className:'dict-res '+(res.pass?'pass':'fail')},
            h('div',{className:'dict-res-label'},res.pass?'✓ Dobrze! '+res.pct+'%':'✗ '+res.pct+'%'),
            h('div',{className:'dict-res-text'},res.orig)
          ),
          h('div',{style:{display:'flex',gap:8,marginTop:12}},
            h('button',{className:'act-btn sec',onClick:()=>{setRes(null);setInp('');}}, 'Powtórz'),
            idx+1<sents.length && h('button',{className:'act-btn',onClick:()=>{setIdx(i=>i+1);setInp('');setRes(null);}},'Dalej'),
            idx+1>=sents.length && h('button',{className:'act-btn',onClick:()=>{setIdx(0);setInp('');setRes(null);setStats({ok:0,t:0});}},'Od nowa')
          )
        )
      )
    );
  }

  /* ═══════════════════════════════════════════════════════
     APP ROOT
     ═══════════════════════════════════════════════════════ */
  function App() {
    const [lessons, setLessons] = us(() => loadLessons());
    const [page, setPage] = us('home');  // home | creator | lesson | section
    const [activeLessonId, setActiveLessonId] = us(null);
    const [activeSection, setActiveSection] = us(null);
    const [showInstall, setShowInstall] = us(true);
    const [updateReady, setUpdateReady] = us(false);
    const [toast, setToast] = us(null);
    const [embeddedLesson, setEmbeddedLesson] = us(null);
    const importRef = ur(null);

    function showToast(msg,type="ok"){setToast({msg,type});setTimeout(()=>setToast(null),3000);}
    function handleExport(){exportLessons(lessons);showToast("📥 Pobrano lessons.json");}
    function handleImportClick(){importRef.current.value="";importRef.current.click();}
    function handleImportFile(e){const file=e.target.files[0];if(!file)return;importLessons(file,(merged,count)=>{setLessons(merged);showToast("✓ Zaimportowano "+count+" lekcji");},(err)=>showToast("✗ "+err,"err"));}

    // SW update detection
    ue(() => {
      if (!('serviceWorker' in navigator)) return;
      navigator.serviceWorker.addEventListener('controllerchange', () => setUpdateReady(true));
    }, []);

    const activeLesson = um(() => embeddedLesson && !activeLessonId ? embeddedLesson : lessons.find(l => l.id === activeLessonId), [lessons, activeLessonId, embeddedLesson]);

    function navigate(p, lessonId=null, section=null) {
      setPage(p);
      if (lessonId) setActiveLessonId(lessonId);
      if (section) setActiveSection(section);
      window.scrollTo(0,0);
    }

    function onLessonCreated(id) {
      setLessons(loadLessons());
      navigate('lesson', id);
    }

    function deleteLesson(id) {
      const updated = lessons.filter(l => l.id !== id);
      saveLessons(updated);
      setLessons(updated);
    }

    function onOpenStory(story) {
      // Convert embedded story to lesson format for Reader
      const wordLookup = buildLookup();
      const { allVocab, keyVocab, sentences } = extractVocab(story.en, wordLookup);
      const exercises = generateExercises(keyVocab, sentences);
      const lesson = {
        id: 'embedded_' + story.level + '_' + story.title.replace(/\W+/g,'_'),
        title: story.title.replace(/Story \d+: /, ''),
        level: story.level,
        topic: 'business',
        style: 'story',
        rawText: story.en,
        translation: story.pl || '',
        createdAt: 0,
        generatedByAI: false,
        isEmbedded: true,
        keyVocab, allVocab, sentences, exercises,
        knownWords: [], progress: {}
      };
      setActiveLessonId(null);
      // Store as temp lesson in state (not localStorage)
      setEmbeddedLesson(lesson);
      navigate('lesson');
    }

    // Bottom nav tabs (only for top-level pages)
    const tabs = [
      { id:'home', label:'Lekcje', icon: h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2},h('path',{d:'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'})) },
    ];

    const showSection = page === 'section' && activeLesson && activeSection;

    function renderSection() {
      switch(activeSection) {
        case 'reader':    return h(Reader,    {lesson:activeLesson, onBack:()=>navigate('lesson'), onDone:()=>navigate('lesson')});
        case 'keyvocab':  return h(KeyVocab,  {lesson:activeLesson, onBack:()=>navigate('lesson')});
        case 'allvocab':  return h(AllVocab,  {lesson:activeLesson, onBack:()=>navigate('lesson')});
        case 'exercises': return h(Exercises, {lesson:activeLesson, onBack:()=>navigate('lesson')});
        case 'quiz':      return h(QuizSection,  {lesson:activeLesson, onBack:()=>navigate('lesson')});
        case 'dictation': return h(DictSection,  {lesson:activeLesson, onBack:()=>navigate('lesson')});
        case 'match':     return h(MatchSection, {lesson:activeLesson, onBack:()=>navigate('lesson')});
        default: return null;
      }
    }

    const isFullscreen = page === 'creator' || page === 'section';

    return h(F, null,
      // Hidden file input for import
      h('input', { ref:importRef, type:'file', accept:'.json', style:{display:'none'}, onChange:handleImportFile }),

      // Top nav
      !isFullscreen && h('nav', { className: 'topnav' },
        h('span', { className: 'topnav-logo' }, 'English ', h('span', null, 'Audiobook')),
        h('div', { className: 'topnav-actions' },
          h('button', {
            className: 'icon-btn',
            title: 'Importuj lekcje z pliku JSON',
            onClick: handleImportClick
          }, '📂'),
          lessons.length > 0 && h('button', {
            className: 'icon-btn',
            title: 'Eksportuj lekcje do pliku JSON',
            onClick: handleExport
          }, '💾')
        )
      ),

      // Toast notification
      toast && h('div', {
        style: {
          position:'fixed', top:'calc(64px + var(--safe-top) + 8px)',
          left:'50%', transform:'translateX(-50%)',
          background: toast.type==='err' ? 'var(--red)' : 'var(--t1)',
          color:'#fff', borderRadius:20, padding:'10px 20px',
          fontSize:13, fontWeight:600, zIndex:300,
          boxShadow:'var(--shadow2)', whiteSpace:'nowrap',
          animation:'fadeIn 0.2s ease both'
        }
      }, toast.msg),

      // Update toast
      updateReady && h(UpdateToast, { onUpdate: () => window.location.reload() }),

      // Main content
      h('div', { className: 'shell' },
        page === 'home'    && h(Home,    { lessons, onNew:()=>navigate('creator'), onOpen:id=>{setEmbeddedLesson(null);navigate('lesson',id);}, onDelete:deleteLesson, onOpenStory }),
        page === 'creator' && h(LessonCreator, { onBack:()=>navigate('home'), onCreate:onLessonCreated }),
        page === 'lesson'  && activeLesson && h(LessonMenu, { lesson:activeLesson, onSection:s=>navigate('section',null,s), onBack:()=>navigate('home') }),
        page === 'section' && renderSection()
      ),

      // Install prompt
      page === 'home' && showInstall && h(InstallBanner, { onDismiss: ()=>setShowInstall(false) })
    );
  }

  ReactDOM.createRoot(document.getElementById('root')).render(h(App));
})();
