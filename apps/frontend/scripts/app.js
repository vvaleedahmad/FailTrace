const { bootLines, logStreams } = window.FailTraceData;

const bootConfig = {
      main: {
        lines: bootLines.main,
        progress: document.getElementById('progress-main'),
        container: document.getElementById('boot-main'),
        overlay: document.querySelector('[data-boot="main"]')
      },
      live: {
        lines: bootLines.live,
        progress: document.getElementById('progress-live'),
        container: document.getElementById('boot-live'),
        overlay: document.querySelector('[data-boot="live"]')
      }
    };

    const mainStream = document.getElementById('main-stream');
    const liveStream = document.getElementById('live-stream');
    const tabs = Array.from(document.querySelectorAll('[data-target]'));
    const screens = Array.from(document.querySelectorAll('.screen'));
    const navLinks = Array.from(document.querySelectorAll('.nav a[data-target]'));

    function formatTime() {
      return new Date().toLocaleTimeString('en-GB', { hour12: false });
    }

    function appendLog(target, endpoints, messages, errorThreshold) {
      const isError = Math.random() > errorThreshold;
      const line = document.createElement('div');
      line.className = `entry${isError ? ' error' : ''}`;
      const code = isError ? '500' : '200';
      const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
      const message = messages[Math.floor(Math.random() * messages.length)];
      const latency = `${(Math.random() * 100).toFixed(0)}ms`;
      line.innerHTML = `
        <span class="time">[${formatTime()}]</span>
        <span class="code">${code}</span>
        <span class="path">${endpoint}</span>
        <span class="message">${message}</span>
        <span class="latency">${latency}</span>
      `;
      target.appendChild(line);
      while (target.children.length > 44) target.removeChild(target.firstChild);
      target.scrollTop = target.scrollHeight;
    }

    function typeBoot(key) {
      const { lines, progress, container, overlay } = bootConfig[key];
      const total = lines.length;
      let index = 0;

      const writeNext = () => {
        if (index >= total) {
          setTimeout(() => overlay.classList.add('hidden'), 400);
          return;
        }

        const line = document.createElement('div');
        line.textContent = `> ${lines[index]}`;
        container.appendChild(line);
        progress.style.width = `${((index + 1) / total) * 100}%`;
        index += 1;
        setTimeout(writeNext, key === 'main' ? 320 : 240);
      };

      writeNext();
    }

    function switchScreen(targetId) {
      screens.forEach((screen) => screen.classList.toggle('active', screen.id === targetId));
      tabs.forEach((tab) => {
        const active = tab.dataset.target === targetId;
        tab.setAttribute('aria-pressed', String(active));
        tab.setAttribute('aria-selected', String(active));
      });
      navLinks.forEach((link) => link.classList.toggle('active', link.dataset.target === targetId));
      location.hash = targetId === 'live-screen' ? '#live' : '#main';
    }

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => switchScreen(tab.dataset.target));
    });

    navLinks.forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        switchScreen(link.dataset.target);
      });
    });

    window.addEventListener('hashchange', () => {
      if (location.hash === '#live') switchScreen('live-screen');
      else switchScreen('main-screen');
    });

    setInterval(() => {
      document.getElementById('session-time').textContent = new Date().toLocaleTimeString('en-GB', { hour12: false });
    }, 1000);

    typeBoot('main');
    typeBoot('live');

    appendLog(mainStream, logStreams.main.endpoints, logStreams.main.messages, logStreams.main.errorThreshold);
    appendLog(liveStream, logStreams.live.endpoints, logStreams.live.messages, logStreams.live.errorThreshold);

    setInterval(() => appendLog(mainStream, logStreams.main.endpoints, logStreams.main.messages, logStreams.main.errorThreshold), logStreams.main.intervalMs);
    setInterval(() => appendLog(liveStream, logStreams.live.endpoints, logStreams.live.messages, logStreams.live.errorThreshold), logStreams.live.intervalMs);

    if (location.hash === '#live') switchScreen('live-screen');
    else switchScreen('main-screen');
