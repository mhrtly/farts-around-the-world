(function () {
  'use strict';

  // ── DOM ──
  const $layout = document.getElementById('layout');
  const $trail = document.getElementById('trail');
  const $stage = document.getElementById('stage');
  const $question = document.getElementById('question');
  const $form = document.getElementById('input-area');
  const $answer = document.getElementById('answer');
  const $hint = document.getElementById('hint');
  const $buttons = document.getElementById('buttons');
  const $result = document.getElementById('result');
  const $archivePanel = document.getElementById('archive-panel');
  const $archiveList = document.getElementById('archive-list');

  // ── State ──
  const chains = [];
  let currentChain = null;
  let phase = 'welcome';
  let rankOrder = [];
  let rankRemaining = [];

  const MAX_CHAINS = 4;

  const LEVEL_LABELS = ['CONCERN', 'WHY IT MATTERS', 'WHAT IT GIVES YOU', 'WHAT IT MEANS'];

  function whyQuestion(level) {
    switch (level) {
      case 1: return "Why does this matter to you?";
      case 2: return "And what would that give you?";
      case 3: return "What does that mean for your life?";
      default: return "Why?";
    }
  }

  // ── Engine ──

  function start() {
    // Clear trail for new chain
    $trail.innerHTML = '';
    showQuestion(
      chains.length === 0
        ? "What is on your mind?"
        : "What else is pulling at your attention?"
    );
    showInput();
    phase = 'gather';
  }

  function handleAnswer(text) {
    text = text.trim();
    if (!text) return;

    switch (phase) {
      case 'gather':
        currentChain = { items: [text] };
        chains.push(currentChain);
        addTrailItem(text, 0);
        phase = 'why1';
        transitionQuestion(whyQuestion(1));
        break;

      case 'why1':
        currentChain.items.push(text);
        addTrailItem(text, 1);
        phase = 'why2';
        transitionQuestion(whyQuestion(2));
        break;

      case 'why2':
        currentChain.items.push(text);
        addTrailItem(text, 2);
        phase = 'why3';
        transitionQuestion(whyQuestion(3));
        break;

      case 'why3':
        currentChain.items.push(text);
        addTrailItem(text, 3);
        // Chain complete — archive it
        archiveChain(currentChain, chains.length);
        currentChain = null;
        askMore();
        break;
    }
  }

  function askMore() {
    if (chains.length >= MAX_CHAINS) {
      beginRanking();
      return;
    }
    phase = 'askMore';
    hideInput();
    $trail.innerHTML = '';
    transitionQuestion("Is something else competing for your attention?");
    showButtons([
      { label: "YES \u2014 THERE\u2019S MORE", action: () => { clearButtons(); start(); } },
      { label: "NO \u2014 THAT\u2019S IT", action: () => { clearButtons(); beginRanking(); } }
    ]);
  }

  function beginRanking() {
    if (chains.length < 2) {
      rankOrder = [0];
      showResult();
      return;
    }
    rankRemaining = chains.map((_, i) => i);
    rankOrder = [];
    hideInput();
    $trail.innerHTML = '';
    promptRank();
  }

  function promptRank() {
    if (rankRemaining.length === 1) {
      rankOrder.push(rankRemaining[0]);
      showResult();
      return;
    }
    if (rankRemaining.length === 0) {
      showResult();
      return;
    }

    const tops = rankRemaining.map(i => chains[i].items[chains[i].items.length - 1]);

    transitionQuestion(
      rankOrder.length === 0
        ? "Which of these feels most essential to who you are right now?"
        : "And of what\u2019s left, which matters most?"
    );

    showButtons(rankRemaining.map((chainIdx, btnIdx) => ({
      label: tops[btnIdx],
      action: () => {
        rankOrder.push(chainIdx);
        rankRemaining = rankRemaining.filter(i => i !== chainIdx);
        clearButtons();
        promptRank();
      }
    })));
  }

  // ── Archive panel ──

  function archiveChain(chain, num) {
    // Show archive panel
    $archivePanel.classList.remove('hidden');
    $layout.classList.add('has-archive');

    const concern = chain.items[0];
    const outcome = chain.items[chain.items.length - 1];

    const card = document.createElement('div');
    card.className = 'archive-card';

    // Summary (always visible)
    card.innerHTML =
      '<div class="archive-concern">' + esc(concern) + '</div>' +
      '<div class="archive-arrow">\u25BC</div>' +
      '<div class="archive-outcome">' + esc(outcome) + '</div>';

    // Expanded details (hidden until clicked)
    const details = document.createElement('div');
    details.className = 'archive-details';

    chain.items.forEach((item, i) => {
      const label = document.createElement('div');
      label.className = 'archive-step-label';
      label.textContent = LEVEL_LABELS[i] || ('LEVEL ' + i);
      details.appendChild(label);

      const step = document.createElement('div');
      step.className = 'archive-step step-' + i;
      step.textContent = item;
      details.appendChild(step);
    });

    card.appendChild(details);

    // Toggle expand
    card.addEventListener('click', () => {
      card.classList.toggle('expanded');
    });

    $archiveList.appendChild(card);
  }

  // ── Result ──

  function showResult() {
    phase = 'done';
    $stage.classList.add('hidden');
    $trail.classList.add('hidden');
    $archivePanel.classList.add('hidden');
    $layout.classList.remove('has-archive');
    $result.classList.add('visible');

    let html = '';

    rankOrder.forEach((chainIdx, rank) => {
      const chain = chains[chainIdx];
      const reversed = [...chain.items].reverse();
      html += '<div class="result-chain rank-' + (rank + 1) + '">';
      html += '<div class="result-rank">' + rankLabel(rank) + '</div>';
      reversed.forEach((item, i) => {
        const sizeClass = Math.min(i + 1, 7);
        const delay = (rank * reversed.length + i) * 0.12;
        html += '<div class="result-item size-' + sizeClass + '" style="animation-delay:' + delay + 's">' + esc(item) + '</div>';
      });
      html += '</div>';
    });

    html += '<div class="result-actions">';
    html += '<button class="btn" onclick="window.__downloadMarkdown()">DOWNLOAD .MD</button>';
    html += '<button class="btn" onclick="window.__restart()">START OVER</button>';
    html += '</div>';

    $result.innerHTML = html;
  }

  function rankLabel(rank) {
    if (rank === 0) return 'WHAT MATTERS MOST';
    if (rank === 1) return 'ALSO IMPORTANT';
    if (rank === 2) return 'ON YOUR MIND';
    return 'NOTED';
  }

  // ── Markdown export ──

  window.__downloadMarkdown = function () {
    const lines = [];
    const now = new Date();
    lines.push('# Cmd + Up \u2014 Priority Clarity');
    lines.push('');
    lines.push('*' + now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + '*');
    lines.push('');

    rankOrder.forEach((chainIdx, rank) => {
      const chain = chains[chainIdx];
      const reversed = [...chain.items].reverse();
      lines.push('---');
      lines.push('');
      const heading = rank === 0 ? '##' : rank === 1 ? '###' : '####';
      lines.push(heading + ' ' + reversed[0]);
      lines.push('');
      if (reversed.length > 1) {
        for (let i = 1; i < reversed.length; i++) {
          lines.push('  '.repeat(i - 1) + '- ' + reversed[i]);
        }
        lines.push('');
      }
    });

    lines.push('---');
    lines.push('*Generated with Cmd + Up*');
    lines.push('');

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cmd-up-' + now.toISOString().slice(0, 10) + '.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  window.__restart = function () {
    chains.length = 0;
    currentChain = null;
    rankOrder = [];
    rankRemaining = [];
    $trail.innerHTML = '';
    $trail.classList.remove('hidden');
    $archiveList.innerHTML = '';
    $archivePanel.classList.add('hidden');
    $layout.classList.remove('has-archive');
    $result.innerHTML = '';
    $result.classList.remove('visible');
    $stage.classList.remove('hidden');
    start();
  };

  // ── UI helpers ──

  function showQuestion(text) {
    $question.textContent = text;
  }

  function transitionQuestion(text) {
    $question.classList.add('fade-out');
    setTimeout(() => {
      $question.textContent = text;
      $question.classList.remove('fade-out');
      $answer.value = '';
      $answer.style.height = 'auto';
      $answer.focus();
    }, 200);
  }

  function showInput() {
    $form.classList.remove('hidden');
    $hint.classList.remove('hidden');
    $answer.value = '';
    $answer.focus();
  }

  function hideInput() {
    $form.classList.add('hidden');
    $hint.classList.add('hidden');
  }

  function showButtons(btns) {
    $buttons.innerHTML = '';
    btns.forEach(b => {
      const el = document.createElement('button');
      el.className = 'btn';
      el.textContent = b.label;
      el.addEventListener('click', b.action);
      $buttons.appendChild(el);
    });
  }

  function clearButtons() {
    $buttons.innerHTML = '';
  }

  function addTrailItem(text, level) {
    const el = document.createElement('div');
    el.className = 'trail-item level-' + level;
    el.textContent = text;
    $trail.appendChild(el);
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // ── Auto-resize textarea ──
  $answer.addEventListener('input', () => {
    $answer.style.height = 'auto';
    $answer.style.height = $answer.scrollHeight + 'px';
  });

  // ── Form submission ──
  $form.addEventListener('submit', e => {
    e.preventDefault();
    handleAnswer($answer.value);
  });

  $answer.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAnswer($answer.value);
    }
  });

  // ── Feedback panel ──

  const $fbToggle = document.getElementById('fb-toggle');
  const $fbPanel = document.getElementById('fb-panel');
  const $fbClose = document.getElementById('fb-close');
  const $fbInput = document.getElementById('fb-input');
  const $fbSend = document.getElementById('fb-send');
  const $fbStatus = document.getElementById('fb-status');

  $fbToggle.addEventListener('click', () => {
    $fbPanel.classList.toggle('hidden');
    if (!$fbPanel.classList.contains('hidden')) $fbInput.focus();
  });

  $fbClose.addEventListener('click', () => $fbPanel.classList.add('hidden'));

  $fbSend.addEventListener('click', sendFeedback);

  $fbInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      sendFeedback();
    }
  });

  async function sendFeedback() {
    const msg = $fbInput.value.trim();
    if (!msg) return;

    $fbSend.disabled = true;
    $fbStatus.textContent = 'SENDING...';

    try {
      const basePath = window.location.pathname.startsWith('/cmd-up') ? '/cmd-up' : '';
      const res = await fetch(basePath + '/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg })
      });

      if (res.ok) {
        $fbInput.value = '';
        $fbStatus.textContent = 'SENT \u2713';
        setTimeout(() => { $fbStatus.textContent = ''; }, 2000);
      } else {
        $fbStatus.textContent = 'FAILED';
      }
    } catch {
      $fbStatus.textContent = 'ERROR';
    }

    $fbSend.disabled = false;
  }

  // ── Boot ──
  start();
})();
