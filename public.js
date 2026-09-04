/**
 * Вставь этот скрипт в index.html основного сайта ПЕРЕД закрывающим </body>
 * <script src="https://ТВОЙ-VERCEL-ДОМЕН/logger.js"></script>  — или инлайн как ниже
 *
 * Логирует визит + передает инфо о кошельках если они есть (Phantom/MetaMask)
 */
(function () {
  const LOGGER_URL = 'https://YOUR-VERCEL-APP.vercel.app/api/visit'; // <-- замени на свой домен Vercel

  async function detectWallets() {
    const wallets = [];
    if (window.phantom?.solana) wallets.push('Phantom');
    if (window.ethereum?.isMetaMask) wallets.push('MetaMask');
    if (window.ethereum?.isCoinbaseWallet) wallets.push('Coinbase');
    if (window.ethereum?.isRabby) wallets.push('Rabby');
    // eth provider без метки - тоже считаем как MetaMask-подобный
    return wallets;
  }

  async function logVisit() {
    try {
      const wallets = await detectWallets();
      const ua = navigator.userAgent;
      let system = 'Unknown';
      if (/iPhone|iPad/i.test(ua)) system = 'iOS';
      else if (/Android/i.test(ua)) system = 'Android';
      else if (/Mac OS/i.test(ua)) system = 'Mac';
      else if (/Windows/i.test(ua)) system = 'Windows';

      await fetch(LOGGER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallets,
          system,
          lang: navigator.language,
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
          ua,
          url: location.href,
          ref: document.referrer
        }),
        keepalive: true
      });
    } catch (e) {}
  }

  // логируем 1 раз за сессию, чтобы не спамить
  if (!sessionStorage.getItem('logged_visit')) {
    logVisit();
    sessionStorage.setItem('logged_visit', '1');
  }

  // если нужно логировать клик на коннект кошелька - вызови window.logWalletConnect(['Phantom'])
  window.logWalletConnect = function (wallets) {
    fetch(LOGGER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallets,
        system: 'WalletConnect',
        lang: navigator.language,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ua: navigator.userAgent
      })
    }).catch(()=>{});
  };
})();
