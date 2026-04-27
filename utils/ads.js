import { GAME_LAUNCH_AD_COOLDOWN_MS } from '../constants/gameConfig';

let InterstitialAd, AdEventType, TestIds;
let adsAvailable = false;

try {
  const ads = require('react-native-google-mobile-ads');
  InterstitialAd = ads.InterstitialAd;
  AdEventType = ads.AdEventType;
  TestIds = ads.TestIds;
  adsAvailable = true;
  console.log('[Ads] Module loaded OK');
} catch (e) {
  console.log('[Ads] Module NOT available:', e.message);
  adsAvailable = false;
}

const PROD_INTERSTITIAL_ID = 'ca-app-pub-xxxxxxxxxxxxx/yyyyyyyyyy'; // TODO: replace with real AdMob unit ID

const getInterstitialAdUnitId = () => {
  if (!adsAvailable) return '';
  if (__DEV__ || PROD_INTERSTITIAL_ID.includes('xxx')) return TestIds.INTERSTITIAL;
  return PROD_INTERSTITIAL_ID;
};

let interstitialAd = null;
let isAdLoaded = false;
let lastGameLaunchAdTime = 0;
let onAdClosedCallback = null;

export const loadInterstitialAd = () => {
  if (!adsAvailable) {
    console.log('[Ads] loadInterstitialAd skipped — module not available');
    return;
  }

  const adUnitId = getInterstitialAdUnitId();
  console.log('[Ads] Loading interstitial, adUnitId:', adUnitId, '__DEV__:', __DEV__);

  interstitialAd = InterstitialAd.createForAdRequest(adUnitId, {
    requestNonPersonalizedAdsOnly: true,
  });

  interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
    console.log('[Ads] Interstitial LOADED');
    isAdLoaded = true;
  });

  interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
    console.log('[Ads] Interstitial CLOSED');
    isAdLoaded = false;
    const cb = onAdClosedCallback;
    onAdClosedCallback = null;
    loadInterstitialAd();
    if (cb) cb();
  });

  interstitialAd.addAdEventListener(AdEventType.ERROR, (error) => {
    console.log('[Ads] Interstitial ERROR:', error);
    isAdLoaded = false;
  });

  interstitialAd.load();
};

export const showInterstitialAd = async () => {
  if (!adsAvailable) return false;

  if (isAdLoaded && interstitialAd) {
    await interstitialAd.show();
    return true;
  }
  return false;
};

// Shows an interstitial on game launch if the cooldown has expired.
// Calls `onClosed` when the user dismisses the ad; if no ad is shown, returns false
// and the caller should navigate immediately.
export const showGameLaunchAd = async (onClosed) => {
  console.log('[Ads] showGameLaunchAd — adsAvailable:', adsAvailable, 'isAdLoaded:', isAdLoaded, 'hasAd:', !!interstitialAd);

  if (!adsAvailable || !isAdLoaded || !interstitialAd) {
    console.log('[Ads] showGameLaunchAd skipped — not ready');
    return false;
  }

  const now = Date.now();
  const msSinceLast = now - lastGameLaunchAdTime;
  if (msSinceLast < GAME_LAUNCH_AD_COOLDOWN_MS) {
    console.log(`[Ads] showGameLaunchAd skipped — cooldown (${Math.round((GAME_LAUNCH_AD_COOLDOWN_MS - msSinceLast) / 1000)}s remaining)`);
    return false;
  }

  console.log('[Ads] Showing game launch interstitial');
  lastGameLaunchAdTime = now;
  onAdClosedCallback = onClosed;
  await interstitialAd.show();
  return true;
};

export const isInterstitialAdReady = () => isAdLoaded;

export const isAdsAvailable = () => adsAvailable;
